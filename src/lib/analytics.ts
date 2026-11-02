import { createHash } from "crypto";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { accessibleProjectsWhere as accessibleProjects } from "./org";

const PRIORITIES: TaskPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const VELOCITY_PERIODS = 6;

export const ANALYTICS_SECTIONS = ["summary", "velocity", "priority", "status", "projects"] as const;
export type AnalyticsSection = (typeof ANALYTICS_SECTIONS)[number];

export interface Analytics {
  summary: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  velocity: {
    mode: "sprints" | "weeks";
    unit: "points" | "tasks";
    points: { label: string; value: number }[];
  };
  priority: { priority: TaskPriority; count: number; pct: number }[];
  status: { status: TaskStatus; count: number; pct: number }[];
  projects: { id: string; name: string; total: number; done: number; progress: number }[];
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

/**
 * Cheap fingerprint of everything the analytics page depends on. It changes whenever a task, comment,
 * project or sprint changes (soft deletes bump updatedAt, hard deletes change counts), when a task becomes
 * overdue, and once a day as the weekly velocity window rolls forward.
 */
export async function getAnalyticsVersion(userId: string): Promise<string> {
  const projects = await prisma.project.findMany({
    where: accessibleProjects(userId),
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
  const ids = projects.map((p) => p.id);
  const now = new Date();
  const [tasks, overdue, sprints, comments] = await Promise.all([
    prisma.task.aggregate({ where: { projectId: { in: ids } }, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.task.count({
      where: { projectId: { in: ids }, deletedAt: null, status: { not: "DONE" }, dueDate: { lt: now } },
    }),
    prisma.sprint.aggregate({
      where: { projectId: { in: ids } },
      _count: { _all: true },
      _max: { createdAt: true, endDate: true },
    }),
    // Comments don't affect the metrics, but they feed the AI insights' retrieved context
    prisma.comment.aggregate({
      where: { task: { projectId: { in: ids } } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
  ]);
  return sha1(
    JSON.stringify([projects, tasks, overdue, sprints, comments, Math.floor(now.getTime() / DAY_MS)])
  ).slice(0, 16);
}

export function sectionHashes(analytics: Analytics): string[] {
  return ANALYTICS_SECTIONS.map((s) => sha1(JSON.stringify(analytics[s])).slice(0, 12));
}

export async function getAnalytics(userId: string): Promise<Analytics> {
  const projects = await prisma.project.findMany({
    where: accessibleProjects(userId),
    select: {
      id: true,
      name: true,
      tasks: {
        where: { deletedAt: null },
        select: { status: true, priority: true, dueDate: true, updatedAt: true, storyPoints: true, sprintId: true },
      },
      sprints: {
        orderBy: { endDate: "desc" },
        take: VELOCITY_PERIODS,
        select: { id: true, name: true, endDate: true },
      },
    },
  });

  const tasks = projects.flatMap((p) => p.tasks);
  const now = Date.now();
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const overdueTasks = tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate.getTime() < now).length;

  // Velocity: per sprint when sprints exist, otherwise tasks finished per week.
  // Tasks have no completedAt column, so the last update of a DONE task approximates completion time.
  const sprints = projects
    .flatMap((p) => p.sprints)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
    .slice(0, VELOCITY_PERIODS)
    .reverse();

  let velocity: Analytics["velocity"];
  if (sprints.length > 0) {
    const hasPoints = tasks.some((t) => t.sprintId && t.storyPoints);
    velocity = {
      mode: "sprints",
      unit: hasPoints ? "points" : "tasks",
      points: sprints.map((s) => {
        const done = tasks.filter((t) => t.sprintId === s.id && t.status === "DONE");
        return {
          label: s.name,
          value: hasPoints ? done.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0) : done.length,
        };
      }),
    };
  } else {
    const points = Array.from({ length: VELOCITY_PERIODS }, (_, i) => {
      const end = now - (VELOCITY_PERIODS - 1 - i) * WEEK_MS;
      const start = end - WEEK_MS;
      return {
        label: new Date(start + 1).toLocaleDateString("en", { month: "short", day: "numeric" }),
        value: tasks.filter(
          (t) => t.status === "DONE" && t.updatedAt.getTime() > start && t.updatedAt.getTime() <= end
        ).length,
      };
    });
    velocity = { mode: "weeks", unit: "tasks", points };
  }

  return {
    summary: {
      totalProjects: projects.length,
      totalTasks: tasks.length,
      completedTasks,
      openTasks: tasks.length - completedTasks,
      overdueTasks,
      completionRate: pct(completedTasks, tasks.length),
    },
    velocity,
    priority: PRIORITIES.map((priority) => {
      const count = tasks.filter((t) => t.priority === priority).length;
      return { priority, count, pct: pct(count, tasks.length) };
    }),
    status: STATUSES.map((status) => {
      const count = tasks.filter((t) => t.status === status).length;
      return { status, count, pct: pct(count, tasks.length) };
    }),
    projects: projects
      .map((p) => {
        const done = p.tasks.filter((t) => t.status === "DONE").length;
        return { id: p.id, name: p.name, total: p.tasks.length, done, progress: pct(done, p.tasks.length) };
      })
      .sort((a, b) => b.total - a.total),
  };
}
