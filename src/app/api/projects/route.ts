import { NextRequest } from "next/server";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, audit, ApiContext } from "@/lib/api";
import { defaultColumnsData } from "@/lib/board";
import { accessibleProjectsWhere, getOrCreatePrimaryOrgMembership } from "@/lib/org";
import { can } from "@/lib/permissions";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).default("PLANNING"),
});

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  const userId = ctx.user.userId;
  try {
    const [projects, myOrgs] = await Promise.all([
      prisma.project.findMany({
        where: accessibleProjectsWhere(userId),
        include: {
          _count: {
            select: { tasks: { where: { deletedAt: null } }, sprints: true }
          },
          members: { select: { userId: true } },
          tasks: { where: { deletedAt: null }, select: { status: true } }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.orgMember.findMany({ where: { userId }, select: { orgId: true, role: true } }),
    ]);
    const orgRoles = new Map(myOrgs.map((m) => [m.orgId, m.role]));

    const userIds = new Set<string>();
    projects.forEach(p => {
      userIds.add(p.ownerId);
      p.members.forEach(m => userIds.add(m.userId));
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) }, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const formatted = projects.map(p => {
      const memberIds = [...new Set([p.ownerId, ...p.members.map((m) => m.userId)])];
      const members = memberIds.flatMap((id) => {
        const u = userMap.get(id);
        return u ? [{ id: u.id, name: u.name, avatarUrl: u.avatarUrl, isOwner: id === p.ownerId }] : [];
      });

      const orgRole = orgRoles.get(p.orgId);
      const myRole: Role | null =
        orgRole === "ADMIN" ? "ADMIN" : orgRole && p.ownerId === userId ? "MANAGER" : orgRole ?? null;

      const totalTasks = p.tasks.length;
      const doneTasks = p.tasks.filter(t => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        description: p.description || "No description provided",
        status: p.status,
        progress: progress,
        dueDate: p.endDate?.toISOString() ?? null,
        _count: p._count,
        members,
        myRole,
      };
    });

    return ok(formatted);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to fetch projects", 500, requestId);
  }
});

export const POST = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  const body = await req.json();
  const v = validate(createProjectSchema, body, requestId);
  if (!v.success) return v.response;

  try {
    const { orgId, role } = await getOrCreatePrimaryOrgMembership(ctx.user.userId);
    if (!can(role, "project.create")) {
      return error("FORBIDDEN", "Only Admins and Managers can create projects", 403, requestId);
    }

    // Only the creator joins automatically; admins see every project, managers add engineers explicitly
    const project = await prisma.project.create({
      data: {
        name: v.data.name,
        description: v.data.description || null,
        status: v.data.status,
        orgId: orgId,
        ownerId: ctx.user.userId,
        members: { create: { userId: ctx.user.userId, role } },
        boards: {
          create: {
            name: "Main Board",
            columns: { create: defaultColumnsData() }
          }
        }
      }
    });

    await audit(ctx.user.userId, "project.created", "Project", project.id);
    return ok(project, 201);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to create project", 500, requestId);
  }
});
