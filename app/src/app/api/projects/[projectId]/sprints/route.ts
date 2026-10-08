import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, created, error, validate, audit, ApiContext } from "@/lib/api";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

const createSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// GET /api/projects/[projectId]/sprints
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const projectId = params?.projectId!;
  const cacheKey = `sprints:${projectId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok(cached);

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: ctx.user.userId, projectId } },
  });
  if (!member) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        select: { status: true, storyPoints: true },
      },
    },
  });

  // Add velocity stats
  const enriched = sprints.map((s) => {
    const total = s.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completed = s.tasks
      .filter((t) => t.status === "DONE")
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    return { ...s, tasks: undefined, stats: { totalPoints: total, completedPoints: completed } };
  });

  await cacheSet(cacheKey, enriched, 120);
  return ok(enriched);
});

// POST /api/projects/[projectId]/sprints
export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const params = await context?.params;
  const projectId = params?.projectId!;
  const body = await req.json();
  const v = validate(createSprintSchema, body, ctx.requestId);
  if (!v.success) return v.response;

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: ctx.user.userId, projectId } },
  });
  if (!member || member.role === "MEMBER") {
    return error("FORBIDDEN", "Only Admins and Managers can create sprints", 403, ctx.requestId);
  }

  const sprint = await prisma.sprint.create({
    data: {
      ...v.data,
      projectId,
      startDate: new Date(v.data.startDate),
      endDate: new Date(v.data.endDate),
    },
  });

  await cacheDel(`sprints:${projectId}`);
  await audit(ctx.user.userId, "sprint.created", "Sprint", sprint.id);
  return created(sprint);
});
