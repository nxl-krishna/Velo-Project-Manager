import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, audit, getParams, getProjectAccess, ApiContext, RouteContext } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getProjectColumns, invalidateProjectCaches, statusForColumnName } from "@/lib/board";
import { notify, taskLink } from "@/lib/notifications";
import { getAssignableUserIds } from "@/lib/project-members";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  columnId: z.string().optional(),
  sprintId: z.string().optional(),
  parentId: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  dueDate: z.string().datetime().optional(),
});

const querySchema = z.object({
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assigneeId: z.string().optional(),
  sprintId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/projects/[projectId]/tasks
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId } = await getParams(context);
  const { searchParams } = new URL(req.url);
  const q = validate(querySchema, Object.fromEntries(searchParams), ctx.requestId);
  if (!q.success) return q.response;
  const query = q.data;

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!access.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const cacheKey = `tasks:${projectId}:${JSON.stringify(query)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  const where = {
    projectId,
    deletedAt: null,
    parentId: null, // Top-level only by default
    ...(query.status && { status: query.status }),
    ...(query.priority && { priority: query.priority }),
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
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId } = await getParams(context);
  const body = await req.json();
  const v = validate(createTaskSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!access.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const { assigneeIds, ...taskData } = v.data;

  if (assigneeIds.length > 0) {
    const assignable = await getAssignableUserIds(access.project);
    if (assigneeIds.some((id) => !assignable.has(id))) {
      return error("BAD_REQUEST", "Tasks can only be assigned to people on this project", 400, ctx.requestId);
    }
  }

  // Keep column and status in sync so the task shows up in the right board column
  const columns = await getProjectColumns(projectId);
  let { columnId, status } = taskData;
  if (columnId) {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return error("BAD_REQUEST", "Column does not belong to this project", 400, ctx.requestId);
    status ??= statusForColumnName(column.name);
  } else {
    status ??= "BACKLOG";
    columnId = columns.find((c) => statusForColumnName(c.name) === status)?.id;
  }

  // Get max position for the target column
  const maxPos = await prisma.task.aggregate({
    where: { projectId, columnId: columnId ?? null, deletedAt: null },
    _max: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      ...taskData,
      columnId,
      status,
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
      _count: { select: { comments: true, subTasks: true } },
    },
  });

  await invalidateProjectCaches(projectId);
  await audit(ctx.user.userId, "task.created", "Task", task.id, { title: task.title });
  await notify(
    assigneeIds.map((userId) => ({
      userId,
      type: "ASSIGNMENT" as const,
      title: "New task assigned",
      body: `You were assigned to "${task.title}" in ${access.project.name}.`,
      link: taskLink(projectId, task.id),
    })),
    ctx.user.userId
  );

  return ok(task, 201);
});
