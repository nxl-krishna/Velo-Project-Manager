import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, created, error, validate, audit, getParams, getProjectAccess, ApiContext, RouteContext } from "@/lib/api";
import { can, canManageRole, ROLE_LABEL } from "@/lib/permissions";
import { getProjectTeam } from "@/lib/project-members";
import { cacheDelPattern } from "@/lib/redis";
import { notify } from "@/lib/notifications";

const addMemberSchema = z.object({ userId: z.string().min(1) });

// GET /api/projects/[projectId]/members — the project team, plus who the caller may add
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId } = await getParams(context);
  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!access.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const members = await getProjectTeam(access.project);
  const canManage = can(access.role, "project.manageMembers");

  let candidates: { id: string; name: string; email: string; avatarUrl: string | null; role: string }[] = [];
  if (canManage) {
    const onProject = new Set(members.map((m) => m.id));
    const orgMembers = await prisma.orgMember.findMany({
      where: { orgId: access.project.orgId, user: { deletedAt: null } },
      select: { role: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { user: { name: "asc" } },
    });
    candidates = orgMembers
      .filter((m) => !onProject.has(m.user.id) && canManageRole(access.role, m.role))
      .map((m) => ({ ...m.user, role: m.role }));
  }

  return ok({
    project: { id: access.project.id, name: access.project.name },
    myRole: access.role,
    canManage,
    members: members.map((m) => ({
      ...m,
      removable: canManage && !m.isOwner && canManageRole(access.role, m.role),
    })),
    candidates,
  });
});

// POST /api/projects/[projectId]/members — add a workspace member to the project
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId } = await getParams(context);
  const v = validate(addMemberSchema, await req.json(), ctx.requestId);
  if (!v.success) return v.response;

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!can(access.role, "project.manageMembers")) {
    return error("FORBIDDEN", "Only Admins and Managers can add people to projects", 403, ctx.requestId);
  }

  const target = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: v.data.userId, orgId: access.project.orgId } },
    select: { role: true, user: { select: { id: true, name: true, email: true, avatarUrl: true, deletedAt: true } } },
  });
  if (!target || target.user.deletedAt) {
    return error("NOT_FOUND", "That person isn't in this workspace. Invite them from the Team page first.", 404, ctx.requestId);
  }
  if (!canManageRole(access.role, target.role)) {
    return error("FORBIDDEN", "Managers can only add engineers to projects", 403, ctx.requestId);
  }

  const existing = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: target.user.id, projectId } },
  });
  if (existing || target.user.id === access.project.ownerId) {
    return error("CONFLICT", `${target.user.name} is already on this project`, 409, ctx.requestId);
  }

  await prisma.projectMember.create({ data: { userId: target.user.id, projectId, role: target.role } });
  await cacheDelPattern(`projects:${access.project.orgId}:*`);
  await audit(ctx.user.userId, "project.member_added", "Project", projectId, { userId: target.user.id });

  const actor = await prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } });
  await notify(
    [{
      userId: target.user.id,
      type: "INVITE",
      title: "Added to a project",
      body: `${actor?.name ?? "A manager"} added you to ${access.project.name} as ${ROLE_LABEL[target.role].toLowerCase()}.`,
      link: `/projects/${projectId}/board`,
    }],
    ctx.user.userId
  );

  const { id, name, email, avatarUrl } = target.user;
  return created({ id, name, email, avatarUrl, role: target.role, isOwner: false, openTasks: 0, removable: true });
});
