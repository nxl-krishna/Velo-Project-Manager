import { NextRequest } from "next/server";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, created, error, validate, audit, ApiContext } from "@/lib/api";
import { accessibleProjectsWhere, getOrCreatePrimaryOrgMembership, removeEmptyPersonalWorkspace } from "@/lib/org";
import { can, canManageRole, permissionsFor, ROLE_LABEL, ROLES } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { cacheDelPattern } from "@/lib/redis";

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).default("MEMBER"),
  projectIds: z.array(z.string().min(1)).max(50).default([]),
});

// Number of open tasks that counts as a fully loaded team member (100% workload)
const TASK_CAPACITY = 10;

function projectRoleFor(orgRole: Role, isOwner: boolean): Role {
  if (orgRole === "ADMIN") return "ADMIN";
  return isOwner ? "MANAGER" : orgRole;
}

// GET /api/team — the workspace directory and the team on each project, scoped by role:
// Admins and Managers see everyone in the workspace; Engineers see people who share a project with them.
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const userId = ctx.user.userId;
  const { orgId, role } = await getOrCreatePrimaryOrgMembership(userId);

  const [projects, orgMembers] = await Promise.all([
    prisma.project.findMany({
      where: { orgId, ...accessibleProjectsWhere(userId) },
      select: { id: true, name: true, status: true, ownerId: true, members: { select: { userId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.orgMember.findMany({
      where: { orgId, user: { deletedAt: null } },
      select: { role: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  const teamOf = new Map(projects.map((p) => [p.id, new Set([p.ownerId, ...p.members.map((m) => m.userId)])]));
  const sharesProject = (id: string) => [...teamOf.values()].some((team) => team.has(id));
  const visible = orgMembers.filter((m) => can(role, "team.viewAll") || m.user.id === userId || sharesProject(m.user.id));

  const openAssignments = await prisma.taskAssignee.groupBy({
    by: ["userId"],
    where: {
      userId: { in: visible.map((m) => m.user.id) },
      task: { deletedAt: null, status: { not: "DONE" }, projectId: { in: projects.map((p) => p.id) } },
    },
    _count: { _all: true },
  });
  const activeTaskCounts = new Map(openAssignments.map((a) => [a.userId, a._count._all]));
  const byId = new Map(orgMembers.map((m) => [m.user.id, m]));

  const members = visible
    .map((m) => {
      const activeTasks = activeTaskCounts.get(m.user.id) ?? 0;
      return {
        ...m.user,
        role: m.role,
        isYou: m.user.id === userId,
        activeTasks,
        workload: Math.min(100, Math.round((activeTasks / TASK_CAPACITY) * 100)),
        projects: projects.filter((p) => teamOf.get(p.id)!.has(m.user.id)).map((p) => ({ id: p.id, name: p.name })),
      };
    })
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));

  const projectTeams = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    canManage: can(projectRoleFor(role, p.ownerId === userId), "project.manageMembers"),
    members: [...teamOf.get(p.id)!].flatMap((id) => {
      const m = byId.get(id);
      return m ? [{ id, name: m.user.name, avatarUrl: m.user.avatarUrl, role: m.role, isOwner: id === p.ownerId }] : [];
    }),
  }));

  return ok({
    viewer: { id: userId, role, permissions: permissionsFor(role) },
    members,
    projects: projectTeams,
  });
});

// POST /api/team — add an existing user to the workspace, optionally straight onto some projects
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const v = validate(inviteSchema, await req.json(), ctx.requestId);
  if (!v.success) return v.response;
  const { email, role, projectIds } = v.data;

  const membership = await getOrCreatePrimaryOrgMembership(ctx.user.userId);
  if (!can(membership.role, "team.invite")) {
    return error("FORBIDDEN", "Only Admins and Managers can invite members", 403, ctx.requestId);
  }
  if (!canManageRole(membership.role, role)) {
    return error("FORBIDDEN", "Managers can only invite engineers", 403, ctx.requestId);
  }
  const { orgId } = membership;

  const invitee = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  if (!invitee) {
    return error("NOT_FOUND", "No Velo account uses that email. Ask them to sign up first, then invite them again.", 404, ctx.requestId);
  }

  const existing = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: invitee.id, orgId } },
  });
  if (existing) return error("CONFLICT", `${invitee.name} is already on your team`, 409, ctx.requestId);

  // Managers can only staff projects they are on; admins can staff any project in the workspace
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: {
          id: { in: projectIds },
          orgId,
          ...(membership.role === "ADMIN" ? { deletedAt: null } : accessibleProjectsWhere(ctx.user.userId)),
        },
        select: { id: true, name: true },
      })
    : [];
  if (projects.length !== new Set(projectIds).size) {
    return error("FORBIDDEN", "You can only add people to projects you manage", 403, ctx.requestId);
  }

  await removeEmptyPersonalWorkspace(invitee.id);
  await prisma.$transaction([
    prisma.orgMember.create({ data: { userId: invitee.id, orgId, role } }),
    prisma.projectMember.createMany({
      data: projects.map((p) => ({ userId: invitee.id, projectId: p.id, role })),
      skipDuplicates: true,
    }),
  ]);
  await cacheDelPattern(`projects:${orgId}:*`);
  await audit(ctx.user.userId, "team.member_added", "OrgMember", invitee.id, { orgId, role, projectIds });

  const [inviter, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
  ]);
  const projectText = projects.length ? ` You're on: ${projects.map((p) => p.name).join(", ")}.` : "";
  await notify([{
    userId: invitee.id,
    type: "INVITE",
    title: "You were added to a team",
    body: `${inviter?.name ?? "A teammate"} added you to ${org?.name ?? "their workspace"} as ${ROLE_LABEL[role].toLowerCase()}.${projectText}`,
    link: "/projects",
  }], ctx.user.userId);

  return created({ ...invitee, role, activeTasks: 0, workload: 0, projects });
});
