import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, getParams, ApiContext, RouteContext } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/redis";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = 10000;

// Circuit breaker state (in-memory, per-instance)
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_RESET_MS = 30000;

async function callAIService(endpoint: string, payload: Record<string, unknown>) {
  // Circuit breaker check
  if (circuitOpen) {
    if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
      circuitOpen = false;
    } else {
      throw new Error("AI_CIRCUIT_OPEN");
    }
  }

  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });

      if (!res.ok) throw new Error(`AI service error: ${res.status}`);
      return await res.json();
    } catch (err) {
      attempt++;
      if (attempt >= 2) {
        circuitOpen = true;
        circuitOpenedAt = Date.now();
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential backoff
    }
  }
}

// POST /api/ai/tasks/[taskId]/summarize
export const POST_SUMMARIZE = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { taskId } = await getParams(context);
  const cacheKey = `ai:summary:${taskId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ok({ ...cached as Record<string, unknown>, cached: true });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      comments: { select: { content: true }, take: 20 },
    },
  });
  if (!task) return error("NOT_FOUND", "Task not found", 404, ctx.requestId);

  try {
    const start = Date.now();
    const result = await callAIService("/v1/summarize", {
      title: task.title,
      description: task.description,
      comments: task.comments.map((c) => c.content),
    });

    const latencyMs = Date.now() - start;

    // Store AI result
    await prisma.aIResult.create({
      data: {
        taskId,
        type: "summary",
        input: { title: task.title, description: task.description },
        output: result,
        modelUsed: result.model ?? "unknown",
        latencyMs,
      },
    });

    await cacheSet(cacheKey, result, 3600); // Cache AI results for 1h
    return ok(result);
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === "AI_CIRCUIT_OPEN" || err.name === "AbortError" || err.name === "TimeoutError")) {
      return error("AI_SERVICE_UNAVAILABLE", "AI service is temporarily unavailable. Please try again later.", 503, ctx.requestId);
    }
    return error("INTERNAL_ERROR", "AI summarization failed", 500, ctx.requestId);
  }
});

// POST /api/ai/tasks/[taskId]/suggest-assignee
export const POST_SUGGEST_ASSIGNEE = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { taskId } = await getParams(context);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { members: true } } },
  });
  if (!task) return error("NOT_FOUND", "Task not found", 404, ctx.requestId);

  // Gather team workload
  const memberIds = task.project.members.map((m) => m.userId);
  const workload = await prisma.task.groupBy({
    by: ["projectId"],
    where: {
      projectId: task.projectId,
      status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
      assignees: { some: { userId: { in: memberIds } } },
    },
    _count: true,
  });

  try {
    const result = await callAIService("/v1/suggest-assignee", {
      taskTitle: task.title,
      taskDescription: task.description,
      taskLabels: task.labels,
      teamMembers: memberIds,
      workloadData: workload,
    });
    return ok(result);
  } catch {
    return error("AI_SERVICE_UNAVAILABLE", "AI service unavailable", 503, ctx.requestId);
  }
});

// POST /api/ai/tasks/parse-nlp
export const POST_PARSE_NLP = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json();
  const schema = z.object({ text: z.string().min(5).max(2000) });
  const v = validate(schema, body, ctx.requestId);
  if (!v.success) return v.response;

  try {
    const result = await callAIService("/v1/parse-task", { text: v.data.text });
    return ok(result);
  } catch {
    return error("AI_SERVICE_UNAVAILABLE", "AI service unavailable", 503, ctx.requestId);
  }
});
