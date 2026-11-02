import type { TaskStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { cacheDelPattern } from "./redis";

export const DEFAULT_COLUMNS: { name: string; color: string; position: number; status: TaskStatus }[] = [
  { name: "Backlog", color: "#64748b", position: 0, status: "BACKLOG" },
  { name: "To Do", color: "#6366f1", position: 1, status: "TODO" },
  { name: "In Progress", color: "#f59e0b", position: 2, status: "IN_PROGRESS" },
  { name: "In Review", color: "#06b6d4", position: 3, status: "IN_REVIEW" },
  { name: "Done", color: "#22c55e", position: 4, status: "DONE" },
];

export function defaultColumnsData() {
  return DEFAULT_COLUMNS.map(({ name, color, position }) => ({ name, color, position }));
}

export function statusForColumnName(name: string): TaskStatus | undefined {
  const normalized = name.trim().toLowerCase();
  return DEFAULT_COLUMNS.find((c) => c.name.toLowerCase() === normalized)?.status;
}

export function getProjectColumns(projectId: string) {
  return prisma.column.findMany({ where: { board: { projectId } } });
}

export async function invalidateProjectCaches(projectId: string): Promise<void> {
  await cacheDelPattern(`board:${projectId}:*`, `tasks:${projectId}:*`, `sprints:${projectId}`);
}
