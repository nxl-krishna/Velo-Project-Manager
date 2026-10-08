import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, audit, ApiContext } from "@/lib/api";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).default("BACKLOG"),
  storyPoints: z.number().int().min(1).max(100).optional(),
  columnId: z.string().optional(),
  sprintId: z.string().optional(),
  parentId: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  dueDate: z.string().datetime().optional(),
});

const querySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  sprintId: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(20),
});

// GET /api/projects/[projectId]/tasks
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const projectId = params?.projectId!;
  const { searchParams } = new URL(req.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));

  const cacheKey = `tasks:${projectId}:${JSON.stringify(query)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: ctx.user.userId, projectId } },
  });
  if (!member) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const where = {
    projectId,
    deletedAt: null,
    parentId: null, // Top-level only by default
    ...(query.status && { status: query.status as never }),
    ...(query.priority && { priority: query.priority as never }),
    ...(query.sprintId && { sprintId: query.sprintId }),
    ...(query.assigneeId && { assignees: { some: { userId: query.assigneeId } } }),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { position: "asc" },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { comments: true, subTasks: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  const result = {
    tasks,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
  await cacheSet(cacheKey, result, 30);
  return ok(result);
});

// POST /api/projects/[projectId]/tasks
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const projectId = params?.projectId!;
  const body = await req.json();
  const v = validate(createTaskSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: ctx.user.userId, projectId } },
  });
  if (!member) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const { assigneeIds, ...taskData } = v.data;

  // Get max position for the target column
  const maxPos = await prisma.task.aggregate({
    where: { projectId, columnId: taskData.columnId ?? null, deletedAt: null },
    _max: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      ...taskData,
      projectId,
      creatorId: ctx.user.userId,
      position: (maxPos._max.position ?? 0) + 1000,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
      assignees: assigneeIds.length
        ? { create: assigneeIds.map((userId) => ({ userId })) }
        : undefined,
    },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });

  await cacheDel(`tasks:${projectId}:*`, `board:${projectId}`);
  await audit(ctx.user.userId, "task.created", "Task", task.id, { title: task.title });

  return ok(task, 201);
});
