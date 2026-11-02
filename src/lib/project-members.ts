import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { ROLES } from "./permissions";

export interface ProjectTeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  isOwner: boolean;
  openTasks: number;
}

/** Owner + explicit members of a project who are still in the workspace, with their workspace role. */
export async function getProjectTeam(project: { id: string; orgId: string; ownerId: string }): Promise<ProjectTeamMember[]> {
  const rows = await prisma.projectMember.findMany({ where: { projectId: project.id }, select: { userId: true } });
  const ids = [...new Set([project.ownerId, ...rows.map((r) => r.userId)])];

  const [orgMembers, open] = await Promise.all([
    prisma.orgMember.findMany({
      where: { orgId: project.orgId, userId: { in: ids }, user: { deletedAt: null } },
      select: { role: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.taskAssignee.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, task: { projectId: project.id, deletedAt: null, status: { not: "DONE" } } },
      _count: { _all: true },
    }),
  ]);
  const openTasks = new Map(open.map((o) => [o.userId, o._count._all]));

  return orgMembers
    .map((m) => ({
      ...m.user,
      role: m.role,
      isOwner: m.user.id === project.ownerId,
      openTasks: openTasks.get(m.user.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.isOwner) - Number(a.isOwner) ||
        ROLES.indexOf(a.role) - ROLES.indexOf(b.role) ||
        a.name.localeCompare(b.name)
    );
}

/** Users who may be assigned tasks in the project. */
export async function getAssignableUserIds(project: { id: string; orgId: string; ownerId: string }): Promise<Set<string>> {
  return new Set((await getProjectTeam(project)).map((m) => m.id));
}
