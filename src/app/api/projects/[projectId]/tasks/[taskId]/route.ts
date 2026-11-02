import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, getParams, getProjectAccess, ApiContext, RouteContext } from "@/lib/api";
import { getProjectColumns, invalidateProjectCaches, statusForColumnName } from "@/lib/board";
import { notify, taskLink } from "@/lib/notifications";

function formatStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  columnId: z.string().optional(),
});

export const PATCH = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { projectId, taskId } = await getParams(context);

  const body = await req.json();
  const v = validate(updateTaskSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  const access = await getProjectAccess(projectId, ctx.user.userId);
  if (!access) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);
  if (!access.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const existing = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
    select: { id: true, status: true, creatorId: true },
  });
  if (!existing) return error("NOT_FOUND", "Task not found", 404, ctx.requestId);

  const { dueDate, ...data } = v.data;

  // Moving a task between columns changes its status, and vice versa
  if (data.columnId !== undefined || data.status !== undefined) {
    const columns = await getProjectColumns(projectId);
    if (data.columnId !== undefined) {
      const column = columns.find((c) => c.id === data.columnId);
      if (!column) return error("BAD_REQUEST", "Column does not belong to this project", 400, ctx.requestId);
      data.status ??= statusForColumnName(column.name);
    } else {
      const column = columns.find((c) => statusForColumnName(c.name) === data.status);
      if (column) data.columnId = column.id;
    }
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      ...(dueDate !== undefined && { dueDate: dueDate === null ? null : new Date(dueDate) }),
      version: { increment: 1 },
    },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { comments: true, subTasks: true } },
    },
  });

  await invalidateProjectCaches(projectId);

  if (task.status !== existing.status) {
    const watchers = [existing.creatorId, ...task.assignees.map((a) => a.userId)];
    await notify(
      watchers.map((userId) => ({
        userId,
        type: "STATUS_CHANGE" as const,
        title: "Task status changed",
        body: `"${task.title}" moved from ${formatStatus(existing.status)} to ${formatStatus(task.status)}.`,
        link: taskLink(projectId, task.id),
      })),
      ctx.user.userId
    );
  }

  return ok(task);
});
