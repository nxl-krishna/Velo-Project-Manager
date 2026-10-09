import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    // 1. Fetch user's active projects (where they are owner or member)
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: ctx.user.userId },
          { members: { some: { userId: ctx.user.userId } } }
        ],
        deletedAt: null
      },
      include: {
        tasks: {
          where: { deletedAt: null }
        },
        members: true
      }
    });

    // 2. Calculate Stats
    const totalProjects = projects.length;
    let totalTasks = 0;
    let inProgress = 0;
    const teamMembersSet = new Set<string>();

    // For AI context
    const projectSummaries = projects.map(p => {
      totalTasks += p.tasks.length;
      inProgress += p.tasks.filter(t => t.status === "IN_PROGRESS").length;
      
      teamMembersSet.add(p.ownerId);
      p.members.forEach(m => teamMembersSet.add(m.userId));

      return {
        name: p.name,
        status: p.status,
        tasks: p.tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority }))
      };
    });

    const stats = {
      totalProjects,
      totalTasks,
      inProgress,
      teamMembers: teamMembersSet.size
    };

    // 3. Generate AI Insights via Gemini API
    let insights = [];
    if (process.env.GOOGLE_AI_API_KEY && projects.length > 0) {
      const prompt = `You are an AI project manager analyzing a user's workspace.
Here is the JSON summary of their projects and tasks:
${JSON.stringify(projectSummaries)}

Based on this data, provide exactly 2 brief insights. 
One should highlight a potential bottleneck or risk (e.g., too many tasks in progress, critical tasks stuck).
The second should be a positive observation or a suggestion.
Return ONLY a valid JSON array of objects with this format: 
[{"title": "emoji and short title", "body": "1 sentence explanation", "action": "View projects"}]`;

      try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          let text = aiData.candidates[0].content.parts[0].text;
          // Strip markdown blocks if any
          text = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          insights = JSON.parse(text);
        } else {
          console.error("Gemini API error:", await aiRes.text());
        }
      } catch (e) {
        console.error("Failed to parse Gemini response", e);
      }
    }

    // Fallback insights if AI fails or no projects
    if (insights.length === 0) {
      insights = [
        {
          title: "🚀 Welcome to Velo",
          body: "Start by creating a new project and adding tasks to your Kanban board.",
          action: "Get started"
        }
      ];
    }

    return ok({ stats, insights });
  } catch (err) {
    console.error(err);
    return error("INTERNAL_ERROR", "Failed to load dashboard stats", 500, requestId);
  }
});
