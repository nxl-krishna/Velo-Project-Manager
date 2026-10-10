import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, created, error, validate, audit, getParams, ApiContext, RouteContext } from "@/lib/api";
import { cacheGet, cacheSet, cacheDelPattern } from "@/lib/redis";
import type { Prisma } from "@prisma/client";
import { defaultColumnsData } from "@/lib/board";
import { accessibleProjectsWhere } from "@/lib/org";
import { can } from "@/lib/permissions";

const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES).default("PLANNING"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const querySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/orgs/[orgId]/projects
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { orgId } = await getParams(context);
  const { searchParams } = new URL(req.url);
  const q = validate(querySchema, Object.fromEntries(searchParams), ctx.requestId);
  if (!q.success) return q.response;
  const { status, page, limit } = q.data;

  // Verify org membership
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: ctx.user.userId, orgId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this organization", 403, ctx.requestId);

  const viewAll = can(membership.role, "project.viewAll");
  const cacheKey = `projects:${orgId}:${viewAll ? "all" : ctx.user.userId}:${status}:${page}:${limit}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  const where: Prisma.ProjectWhereInput = {
    orgId,
    deletedAt: null,
    ...(status && { status }),
    ...(!viewAll && accessibleProjectsWhere(ctx.user.userId)),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        members: true,
        _count: { select: { tasks: { where: { deletedAt: null } }, sprints: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const result = { projects, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  await cacheSet(cacheKey, result, 60);
  return ok(result);
});

// POST /api/orgs/[orgId]/projects
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { orgId } = await getParams(context);
  const body = await req.json();
  const v = validate(createProjectSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: ctx.user.userId, orgId } },
  });
  if (!membership || !can(membership.role, "project.create")) {
    return error("FORBIDDEN", "Only Admins and Managers can create projects", 403, ctx.requestId);
  }

  const project = await prisma.project.create({
    data: {
      ...v.data,
      orgId,
      ownerId: ctx.user.userId,
      startDate: v.data.startDate ? new Date(v.data.startDate) : undefined,
      endDate: v.data.endDate ? new Date(v.data.endDate) : undefined,
      boards: { create: { columns: { create: defaultColumnsData() } } },
      members: { create: { userId: ctx.user.userId, role: membership.role } },
    },
  });

  await cacheDelPattern(`projects:${orgId}:*`);
  await audit(ctx.user.userId, "project.created", "Project", project.id);

  return created(project);
});
