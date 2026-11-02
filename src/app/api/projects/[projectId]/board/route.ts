import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, getParams, getProjectAccess, ApiContext, RouteContext } from "@/lib/api";
import { cacheGet, cacheSet, redis } from "@/lib/redis";
import { defaultColumnsData, getProjectColumns, invalidateProjectCaches, statusForColumnName } from "@/lib/board";

const movesSchema = z.object({
  moves: z
    .array(
      z.object({
        taskId: z.string().min(1),
        columnId: z.string().min(1),
        position: z.number(),
        version: z.number().int(),
      })
    )
    .min(1)
    .max(200),
});

// GET /api/projects/[projectId]/board
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId } = await getParams(context);
  const { searchParams } = new URL(req.url);
  const sprintId = searchParams.get("sprintId");

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!access.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const cacheKey = `board:${projectId}:${sprintId ?? "all"}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  // Auto-create board for older projects that didn't get one on creation
  await prisma.board.upsert({
    where: { projectId },
    update: {},
    create: { name: "Main Board", projectId, columns: { create: defaultColumnsData() } },
  });

  const board = await prisma.board.findUnique({
    where: { projectId },
    include: {
      project: { select: { name: true } },
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            where: {
              deletedAt: null,
              parentId: null,
              ...(sprintId ? { sprintId } : {}),
            },
            orderBy: { position: "asc" },
            include: {
              assignees: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
              _count: { select: { comments: true, subTasks: true } },
            },
          },
        },
      },
    },
  });

  await cacheSet(cacheKey, board, 15); // Short TTL for live board
  return ok(board);
});

// PATCH /api/projects/[projectId]/board — reorder tasks
export const PATCH = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId } = await getParams(context);
  const body = await req.json();
  const v = validate(movesSchema, body, ctx.requestId);
  if (!v.success) return v.response;
  const { moves } = v.data;

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!access.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const columns = new Map((await getProjectColumns(projectId)).map((c) => [c.id, c]));
  const invalidColumn = moves.find((m) => !columns.has(m.columnId));
  if (invalidColumn) {
    return error("BAD_REQUEST", `Column ${invalidColumn.columnId} does not belong to this project`, 400, ctx.requestId);
  }

  const results = await Promise.all(
    moves.map(async ({ taskId, columnId, position, version }) => {
      const status = statusForColumnName(columns.get(columnId)!.name);
      const { count } = await prisma.task.updateMany({
        where: { id: taskId, projectId, version, deletedAt: null },
        data: { columnId, position, version: { increment: 1 }, ...(status ? { status } : {}) },
      });
      return { taskId, updated: count === 1 };
    })
  );

  const conflicts = results.filter((r) => !r.updated).map((r) => r.taskId);

  await invalidateProjectCaches(projectId);

  if (conflicts.length > 0) {
    return error(
      "TASK_VERSION_CONFLICT",
      `Tasks modified by another user or not found: ${conflicts.join(", ")}. Please refresh.`,
      409,
      ctx.requestId
    );
  }

  // Emit WebSocket real-time event
  redis.publish("project-events", JSON.stringify({
    projectId,
    type: "BOARD_UPDATED",
    moves,
  })).catch(console.error);

  return ok({ moved: moves.length });
});
