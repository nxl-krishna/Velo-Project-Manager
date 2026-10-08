import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, created, error, validate, audit, ApiContext } from "@/lib/api";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).default("PLANNING"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// GET /api/orgs/[orgId]/projects
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const orgId = params?.orgId!;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  const cacheKey = `projects:${orgId}:${status}:${page}:${limit}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  // Verify org membership
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: ctx.user.userId, orgId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this organization", 403, ctx.requestId);

  const where = {
    orgId,
    deletedAt: null,
    ...(status && { status: status as never }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        members: { include: { project: false } },
        _count: { select: { tasks: true, sprints: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const result = { projects, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  await cacheSet(cacheKey, result, 60);
  return ok(result);
});

// POST /api/orgs/[orgId]/projects
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const orgId = params?.orgId!;
  const body = await req.json();
  const v = validate(createProjectSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: ctx.user.userId, orgId } },
  });
  if (!membership || membership.role === "MEMBER") {
    return error("FORBIDDEN", "Only Admins and Managers can create projects", 403, ctx.requestId);
  }

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        ...v.data,
        orgId,
        ownerId: ctx.user.userId,
        startDate: v.data.startDate ? new Date(v.data.startDate) : undefined,
        endDate: v.data.endDate ? new Date(v.data.endDate) : undefined,
      },
    });

    // Auto-create board with default columns
    const board = await tx.board.create({ data: { projectId: p.id } });
    await tx.column.createMany({
      data: [
        { boardId: board.id, name: "Backlog", position: 0, color: "#64748b" },
        { boardId: board.id, name: "To Do", position: 1, color: "#6366f1" },
        { boardId: board.id, name: "In Progress", position: 2, color: "#f59e0b" },
        { boardId: board.id, name: "In Review", position: 3, color: "#06b6d4" },
        { boardId: board.id, name: "Done", position: 4, color: "#22c55e" },
      ],
    });

    // Add creator as Admin member
    await tx.projectMember.create({
      data: { projectId: p.id, userId: ctx.user.userId, role: "ADMIN" },
    });

    return p;
  });

  await cacheDel(`projects:${orgId}:*`);
  await audit(ctx.user.userId, "project.created", "Project", project.id);

  return created(project);
});
