import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// The user's oldest org membership; creates a personal workspace on first use.
export async function getOrCreatePrimaryOrgMembership(userId: string) {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (membership) return membership;

  const org = await prisma.organization.create({
    data: {
      name: "Personal Workspace",
      slug: `workspace-${userId}`,
      members: { create: { userId, role: "ADMIN" } },
    },
    include: { members: true },
  });
  return org.members[0];
}

/** Projects a user may open: ones they own or were added to, plus every project in workspaces they administer. */
export function accessibleProjectsWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    deletedAt: null,
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
      { org: { members: { some: { userId, role: "ADMIN" } } } },
    ],
  };
}

/**
 * Deletes the user's auto-created personal workspace if it is still empty (only them, no projects),
 * so that a workspace they are invited to becomes their primary one.
 */
export async function removeEmptyPersonalWorkspace(userId: string): Promise<void> {
  await prisma.organization.deleteMany({
    where: {
      slug: `workspace-${userId}`,
      projects: { none: {} },
      members: { every: { userId } },
    },
  });
}
