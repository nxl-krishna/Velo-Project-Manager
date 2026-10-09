import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    const tasks = await prisma.task.findMany({
      where: {
        assignees: { some: { userId: ctx.user.userId } },
        deletedAt: null
      },
      include: {
        project: { select: { name: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    return ok(tasks);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to fetch tasks", 500, requestId);
  }
});
