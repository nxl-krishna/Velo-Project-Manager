import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, audit, getParams, ApiContext, RouteContext } from "@/lib/api";
import { getOrCreatePrimaryOrgMembership } from "@/lib/org";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { invalidateProjectCaches } from "@/lib/board";
import { cacheDelPattern } from "@/lib/redis";
import { notify } from "@/lib/notifications";

const updateRoleSchema = z.object({ role: z.enum(["ADMIN", "MANAGER", "MEMBER"]) });

async function loadTarget(ctx: ApiContext, context?: RouteContext) {
  const { userId } = await getParams(context);
  const me = await getOrCreatePrimaryOrgMembership(ctx.user.userId);
  if (!can(me.role, "team.manageRoles")) {
    return { ok: false as const, response: error("FORBIDDEN", "Only Admins can change roles or remove people", 403, ctx.requestId) };
  }
  if (userId === ctx.user.userId) {
    return { ok: false as const, response: error("BAD_REQUEST", "You can't change your own role or remove yourself", 400, ctx.requestId) };
  }
  const target = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: me.orgId } },
    include: { user: { select: { name: true } }, org: { select: { name: true } } },
  });
  if (!target) return { ok: false as const, response: error("NOT_FOUND", "That person isn't on your team", 404, ctx.requestId) };
  return { ok: true as const, me, target };
}

// PATCH /api/team/[userId] — change someone's workspace role (Admin only)
export const PATCH = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const v = validate(updateRoleSchema, await req.json(), ctx.requestId);
  if (!v.success) return v.response;

  const loaded = await loadTarget(ctx, context);
  if (!loaded.ok) return loaded.response;
  const { me, target } = loaded;
  const { role } = v.data;
  if (target.role === role) return ok({ id: target.userId, role });

  await prisma.$transaction([
    prisma.orgMember.update({ where: { id: target.id }, data: { role } }),
    prisma.projectMember.updateMany({ where: { userId: target.userId, project: { orgId: me.orgId } }, data: { role } }),
  ]);
  await audit(ctx.user.userId, "team.role_changed", "OrgMember", target.userId, { from: target.role, to: role });
  await notify(
    [{
      userId: target.userId,
      type: "INVITE",
      title: "Your role changed",
      body: `You are now ${ROLE_LABEL[role].toLowerCase()} in ${target.org.name}.`,
      link: "/team",
    }],
    ctx.user.userId
  );

  return ok({ id: target.userId, role });
});

// DELETE /api/team/[userId] — remove someone from the workspace and all of its projects (Admin only)
export const DELETE = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const loaded = await loadTarget(ctx, context);
  if (!loaded.ok) return loaded.response;
  const { me, target } = loaded;
  const inOrg = { project: { orgId: me.orgId } };

  const affected = await prisma.project.findMany({
    where: { orgId: me.orgId, OR: [{ ownerId: target.userId }, { members: { some: { userId: target.userId } } }] },
    select: { id: true },
  });

  await prisma.$transaction([
    // Their projects are handed to the admin removing them so nothing is orphaned
    prisma.project.updateMany({ where: { orgId: me.orgId, ownerId: target.userId }, data: { ownerId: ctx.user.userId } }),
    prisma.taskAssignee.deleteMany({ where: { userId: target.userId, task: inOrg } }),
    prisma.projectMember.deleteMany({ where: { userId: target.userId, ...inOrg } }),
    prisma.orgMember.delete({ where: { id: target.id } }),
  ]);

  await Promise.all(affected.map((p) => invalidateProjectCaches(p.id)));
  await cacheDelPattern(`projects:${me.orgId}:*`);
  await audit(ctx.user.userId, "team.member_removed", "OrgMember", target.userId, { orgId: me.orgId });
  await notify(
    [{
      userId: target.userId,
      type: "INVITE",
      title: "Removed from a team",
      body: `You were removed from ${target.org.name}.`,
      link: "/dashboard",
    }],
    ctx.user.userId
  );

  return ok({ removed: true });
});
