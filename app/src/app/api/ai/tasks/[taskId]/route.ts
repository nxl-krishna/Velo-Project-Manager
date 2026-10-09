import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";

export const POST = withAuth(async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
  const params = await context?.params;
  const taskId = params?.taskId!;

  const { type } = await req.json(); // "summarize" | "assign"

  if (!process.env.GOOGLE_AI_API_KEY) {
    return ok({ result: "Gemini API key is not configured." });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { include: { members: true } },
        assignees: { include: { user: true } }
      }
    });

    if (!task) return error("NOT_FOUND", "Task not found", 404, ctx.requestId);

    let prompt = "";
    if (type === "summarize") {
      prompt = `Summarize this task in exactly 2 concise sentences. Be direct and helpful. 
Title: "${task.title}"
Description: "${task.description || 'No description provided.'}"
Priority: ${task.priority}
Status: ${task.status}`;
    } else if (type === "assign") {
      const memberUserIds = task.project.members.map(m => m.userId);
      // Fetch users manually since ProjectMember lacks a Prisma relation to User
      const users = await prisma.user.findMany({
        where: { id: { in: memberUserIds } }
      });
      const members = users.map(u => u.name).join(", ");
      prompt = `Given the task "${task.title}" (Priority: ${task.priority}), suggest ONE person to assign it to from this team: [${members}]. 
Write a 1-sentence explanation of why they are a good fit. Be creative but realistic. Format: "🎯 Suggested: [Name] - [Reason]"`;
    }

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!aiRes.ok) throw new Error(await aiRes.text());

    const aiData = await aiRes.json();
    const text = aiData.candidates[0].content.parts[0].text.trim();

    return ok({ result: text });
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to generate AI response", 500, ctx.requestId);
  }
});
