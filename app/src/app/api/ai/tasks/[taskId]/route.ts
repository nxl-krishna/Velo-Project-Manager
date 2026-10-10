import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, validate, getParams, getProjectAccess, ApiContext, RouteContext } from "@/lib/api";
import { generateText, isGeminiConfigured } from "@/lib/gemini";

const schema = z.object({ type: z.enum(["summarize", "assign"]) });

export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
  const { taskId } = await getParams(context);

  const v = validate(schema, await req.json(), ctx.requestId);
  if (!v.success) return v.response;
  const { type } = v.data;

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: { project: { include: { members: true } } },
  });
  if (!task) return error("NOT_FOUND", "Task not found", 404, ctx.requestId);

  const access = await getProjectAccess(task.projectId, ctx.user.userId);
  if (!access?.role) return error("FORBIDDEN", "Not a project member", 403, ctx.requestId);

  if (!isGeminiConfigured()) {
    return ok({ result: "Gemini API key is not configured." });
  }

  try {
    let prompt: string;
    if (type === "summarize") {
      prompt = `Summarize this task in exactly 2 concise sentences. Be direct and helpful. 
Title: "${task.title}"
Description: "${task.description || 'No description provided.'}"
Priority: ${task.priority}
Status: ${task.status}`;
    } else {
      const memberUserIds = task.project.members.map(m => m.userId);
      // Fetch users manually since ProjectMember lacks a Prisma relation to User
      const users = await prisma.user.findMany({
        where: { id: { in: memberUserIds }, deletedAt: null }
      });
      if (users.length === 0) return ok({ result: "No team members to suggest." });
      const members = users.map(u => u.name).join(", ");
      prompt = `Given the task "${task.title}" (Priority: ${task.priority}), suggest ONE person to assign it to from this team: [${members}]. 
Write a 1-sentence explanation of why they are a good fit. Be creative but realistic. Format: "🎯 Suggested: [Name] - [Reason]"`;
    }

    const text = await generateText(prompt, 0.7);
    return ok({ result: text });
  } catch (err) {
    console.error(err);
    return error("AI_SERVICE_UNAVAILABLE", "Failed to generate AI response", 503, ctx.requestId);
  }
});
