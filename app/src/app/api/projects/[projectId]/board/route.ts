import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/projects/[projectId]/board
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const projectId = params?.projectId!;
  const { searchParams } = new URL(req.url);
  const sprintId = searchParams.get("sprintId");

  const cacheKey = `board:${projectId}:${sprintId ?? "all"}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: ctx.user.userId, projectId } },
  });
  if (!member) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

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

  if (!board) return error("NOT_FOUND", "Board not found", 404, ctx.requestId);

  await cacheSet(cacheKey, board, 15); // Short TTL for live board
  return ok(board);
});

// PATCH /api/projects/[projectId]/board — reorder tasks
export const PATCH = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const projectId = params?.projectId!;
  const body = await req.json();

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: ctx.user.userId, projectId } },
  });
  if (!member) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const { moves } = body as {
    moves: Array<{ taskId: string; columnId: string; position: number; version: number }>;
  };

  const results = await Promise.allSettled(
    moves.map(async ({ taskId, columnId, position, version }) => {
      const current = await prisma.task.findUnique({
        where: { id: taskId },
        select: { version: true },
      });
      if (!current) throw new Error(`Task ${taskId} not found`);
      if (current.version !== version) throw new Error(`CONFLICT:${taskId}`);

      return prisma.task.update({
        where: { id: taskId },
        data: { columnId, position, version: { increment: 1 } },
      });
    })
  );

  const conflicts = results
    .filter((r) => r.status === "rejected" && (r.reason as Error).message.startsWith("CONFLICT:"))
    .map((r) => (r as PromiseRejectedResult).reason.message.replace("CONFLICT:", ""));

  if (conflicts.length > 0) {
    return error(
      "TASK_VERSION_CONFLICT",
      `Tasks modified by another user: ${conflicts.join(", ")}. Please refresh.`,
      409,
      ctx.requestId
    );
  }

  // Invalidate board cache
  const { cacheDelPattern, redis } = await import("@/lib/redis");
  await cacheDelPattern(`board:${projectId}:*`);

  // Emit WebSocket real-time event
  if (redis) {
    redis.publish("project-events", JSON.stringify({
      projectId,
      type: "BOARD_UPDATED",
      moves,
    })).catch(console.error);
  }

  return ok({ moved: moves.length - conflicts.length });
});
