import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, validate, ApiContext } from "@/lib/api";
import { createDueDateReminders } from "@/lib/notifications";

const markReadSchema = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);

// GET /api/notifications — latest notifications and unread count
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const userId = ctx.user.userId;

  try {
    await createDueDateReminders(userId);
  } catch (err) {
    console.error("[Notifications] Failed to create due date reminders", err);
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return ok({ notifications, unreadCount });
});

// PATCH /api/notifications — mark specific notifications (or all) as read
export const PATCH = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const v = validate(markReadSchema, await req.json(), ctx.requestId);
  if (!v.success) return v.response;

  const { count } = await prisma.notification.updateMany({
    where: {
      userId: ctx.user.userId,
      read: false,
      ...("ids" in v.data ? { id: { in: v.data.ids } } : {}),
    },
    data: { read: true },
  });

  return ok({ updated: count });
});
