import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, ApiContext } from "@/lib/api";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  columnId: z.string().optional(),
});

export const PATCH = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
  const params = await context?.params;
  const projectId = params?.projectId!;
  const taskId = params?.taskId!;

  const body = await req.json();
  const v = validate(updateTaskSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return error("NOT_FOUND", "Project not found", 404, ctx.requestId);

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: ctx.user.userId, projectId } },
    });
    if (!member && project.ownerId !== ctx.user.userId) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

    const task = await prisma.task.update({
      where: { id: taskId, projectId },
      data: {
        ...v.data,
        dueDate: v.data.dueDate !== undefined ? (v.data.dueDate === null ? null : new Date(v.data.dueDate)) : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { comments: true, subTasks: true } },
      }
    });

    return ok(task);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to update task", 500, ctx.requestId);
  }
});
