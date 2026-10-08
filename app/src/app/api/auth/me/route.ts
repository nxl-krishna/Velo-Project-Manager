import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        orgMemberships: {
          include: {
            org: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        },
      },
    });

    if (!user) {
      return error("NOT_FOUND", "User not found", 404, requestId);
    }

    const orgs = user.orgMemberships.map((m) => ({
      ...m.org,
      role: m.role,
    }));

    return ok({ ...user, orgMemberships: undefined, orgs });
  } catch (err) {
    return error("INTERNAL_ERROR", "Failed to fetch profile", 500, requestId);
  }
});
