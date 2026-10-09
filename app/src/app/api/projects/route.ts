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
        members: true // Just fetch the members, no 'user' relation since it doesn't exist
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Manually fetch the users for members and owners since relations are missing in schema
    const userIds = new Set<string>();
    projects.forEach(p => {
      userIds.add(p.ownerId);
      p.members.forEach(m => userIds.add(m.userId));
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, avatarUrl: true }
    });
    
    const userMap = new Map(users.map(u => [u.id, u]));

    // Format for the frontend
    const formatted = projects.map(p => {
      // Map members to their user details
      const memberDetails = p.members.map(m => {
        const u = userMap.get(m.userId);
        return {
          name: u ? u.name.charAt(0).toUpperCase() : "?",
          color: "var(--brand-500)" 
        };
      });

      // Include owner in members if not already there
      if (!p.members.some(m => m.userId === p.ownerId)) {
        const owner = userMap.get(p.ownerId);
        if (owner) {
          memberDetails.push({
            name: owner.name.charAt(0).toUpperCase(),
            color: "var(--info)"
          });
        }
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description || "No description provided",
        status: p.status,
        progress: Math.floor(Math.random() * 100), // In a real app, compute based on completed tasks
        dueDate: p.endDate?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        _count: p._count,
        members: memberDetails
      };
    });

    return ok(formatted);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to fetch projects", 500, requestId);
  }
});

export const POST = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    const body = await req.json();
    if (!body.name) {
      return error("BAD_REQUEST", "Project name is required", 400, requestId);
    }

    // Get user's first org or create a default one
    let orgMembership = await prisma.orgMember.findFirst({
      where: { userId: ctx.user.userId }
    });

    if (!orgMembership) {
      const org = await prisma.organization.create({
        data: {
          name: "Personal Workspace",
          slug: `workspace-${ctx.user.userId.slice(-6)}`,
          members: {
            create: {
              userId: ctx.user.userId,
              role: "ADMIN"
            }
          }
        }
      });
      orgMembership = { orgId: org.id } as any;
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description || null,
        status: body.status || "PLANNING",
        orgId: orgMembership.orgId,
        ownerId: ctx.user.userId,
      }
    });

    return ok(project, 201);
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to create project", 500, requestId);
  }
});
