import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: ctx.user.userId },
          { members: { some: { userId: ctx.user.userId } } }
        ],
        deletedAt: null
      },
      include: {
        _count: {
          select: { tasks: true, sprints: true }
        },
        members: {
          include: {
            user: {
              select: { name: true, id: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Format for the frontend
    const formatted = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || "No description provided",
      status: p.status,
      progress: Math.floor(Math.random() * 100), // In a real app, compute based on completed tasks
      dueDate: p.endDate?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      _count: p._count,
      members: p.members.map(m => ({
        name: m.user.name.charAt(0).toUpperCase(),
        color: "var(--brand-500)" 
      }))
    }));

    return ok(formatted);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to fetch projects", 500, requestId);
  }
});
