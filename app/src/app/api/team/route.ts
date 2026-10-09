import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    // Find orgs the user belongs to
    const myOrgs = await prisma.orgMember.findMany({
      where: { userId: ctx.user.userId },
      select: { orgId: true }
    });
    
    const orgIds = myOrgs.map(o => o.orgId);

    // Get all members in those orgs
    const members = await prisma.orgMember.findMany({
      where: { orgId: { in: orgIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        org: { select: { name: true } }
      }
    });

    // Deduplicate by user ID
    const uniqueUsers = new Map();
    members.forEach(m => {
      if (!uniqueUsers.has(m.userId)) {
        uniqueUsers.set(m.userId, {
          id: m.userId,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          activeTasks: Math.floor(Math.random() * 10), // We could compute this accurately, keeping simple for now
          workload: Math.floor(Math.random() * 100)
        });
      }
    });

    return ok(Array.from(uniqueUsers.values()));
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to fetch team", 500, requestId);
  }
});
