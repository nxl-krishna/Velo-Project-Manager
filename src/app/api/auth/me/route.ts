import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";
import { getOrCreatePrimaryOrgMembership } from "@/lib/org";
import { permissionsFor } from "@/lib/permissions";

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

    // Role in the workspace the app operates on decides what the UI offers
    const primary = await getOrCreatePrimaryOrgMembership(user.id);
    const workspace = orgs.find((o) => o.id === primary.orgId);

    return ok({
      ...user,
      orgMemberships: undefined,
      orgs,
      workspace: { id: primary.orgId, name: workspace?.name ?? "Personal Workspace" },
      role: primary.role,
      permissions: permissionsFor(primary.role),
    });
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to fetch profile", 500, requestId);
  }
});
