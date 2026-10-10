import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, audit, getParams, getProjectAccess, ApiContext, RouteContext } from "@/lib/api";
import { can, canManageRole } from "@/lib/permissions";
import { invalidateProjectCaches } from "@/lib/board";
import { cacheDelPattern } from "@/lib/redis";
import { notify } from "@/lib/notifications";

// DELETE /api/projects/[projectId]/members/[userId] — remove someone from the project
export const DELETE = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId, userId } = await getParams(context);

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!can(access.role, "project.manageMembers")) {
    return error("FORBIDDEN", "Only Admins and Managers can remove people from projects", 403, ctx.requestId);
  }
  if (userId === access.project.ownerId) {
    return error("BAD_REQUEST", "The project owner can't be removed from the project", 400, ctx.requestId);
  }

  const [membership, orgMember] = await Promise.all([
    prisma.projectMember.findUnique({ where: { userId_projectId: { userId, projectId } } }),
    prisma.orgMember.findUnique({ where: { userId_orgId: { userId, orgId: access.project.orgId } }, select: { role: true } }),
  ]);
  if (!membership) return error("NOT_FOUND", "That person isn't on this project", 404, ctx.requestId);
  if (!canManageRole(access.role, orgMember?.role ?? membership.role)) {
    return error("FORBIDDEN", "Managers can only remove engineers from projects", 403, ctx.requestId);
  }

  // Their open assignments in this project go back to the team
  await prisma.$transaction([
    prisma.projectMember.delete({ where: { id: membership.id } }),
    prisma.taskAssignee.deleteMany({ where: { userId, task: { projectId } } }),
  ]);

  await invalidateProjectCaches(projectId);
  await cacheDelPattern(`projects:${access.project.orgId}:*`);
  await audit(ctx.user.userId, "project.member_removed", "Project", projectId, { userId });
  await notify(
    [{
      userId,
      type: "INVITE",
      title: "Removed from a project",
      body: `You no longer have access to ${access.project.name}.`,
      link: "/projects",
    }],
    ctx.user.userId
  );

  return ok({ removed: true });
});
