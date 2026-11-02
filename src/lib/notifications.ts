import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export function taskLink(projectId: string, taskId: string): string {
  return `/projects/${projectId}/board?task=${taskId}`;
}

// Never notifies the user who performed the action. Failures are logged, not thrown.
export async function notify(items: NotificationInput[], actorId?: string): Promise<void> {
  const seen = new Set<string>();
  const data = items.filter((n) => {
    if (n.userId === actorId || seen.has(n.userId)) return false;
    seen.add(n.userId);
    return true;
  });
  if (data.length === 0) return;

  try {
    await prisma.notification.createMany({ data });
  } catch (err) {
    console.error("[Notifications] Failed to create notifications", err);
  }
}

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

// Creates one reminder per task that is due within the next 24h (or overdue) and not done.
export async function createDueDateReminders(userId: string): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { not: "DONE" },
      dueDate: { not: null, lte: new Date(Date.now() + REMINDER_WINDOW_MS) },
      project: { deletedAt: null },
      OR: [
        { assignees: { some: { userId } } },
        { creatorId: userId, assignees: { none: {} } },
      ],
    },
    select: { id: true, title: true, dueDate: true, projectId: true },
  });
  if (tasks.length === 0) return;

  const links = tasks.map((t) => taskLink(t.projectId, t.id));
  const existing = await prisma.notification.findMany({
    where: { userId, type: "DUE_DATE_REMINDER", link: { in: links } },
    select: { link: true },
  });
  const alreadyReminded = new Set(existing.map((n) => n.link));

  const now = Date.now();
  await notify(
    tasks
      .filter((t) => !alreadyReminded.has(taskLink(t.projectId, t.id)))
      .map((t) => {
        const overdue = t.dueDate!.getTime() < now;
        return {
          userId,
          type: "DUE_DATE_REMINDER" as const,
          title: overdue ? "Task overdue" : "Task due soon",
          body: `"${t.title}" ${overdue ? "was due" : "is due"} on ${t.dueDate!.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}.`,
          link: taskLink(t.projectId, t.id),
        };
      })
  );
}
