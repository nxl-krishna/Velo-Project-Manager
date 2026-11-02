import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";
import { accessibleProjectsWhere } from "@/lib/org";

// GET /api/tasks              — tasks assigned to me, plus unassigned tasks I created
// GET /api/tasks?scope=projects — every dated task in projects I can access (calendar)
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  const userId = ctx.user.userId;
  const scope = new URL(req.url).searchParams.get("scope");

  const where: Prisma.TaskWhereInput =
    scope === "projects"
      ? { dueDate: { not: null }, project: accessibleProjectsWhere(userId) }
      : {
          OR: [
            { assignees: { some: { userId } } },
            { creatorId: userId, assignees: { none: {} } },
          ],
          project: accessibleProjectsWhere(userId),
        };

  try {
    const tasks = await prisma.task.findMany({
      where: { ...where, deletedAt: null },
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
