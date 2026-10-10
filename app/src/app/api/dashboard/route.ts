import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, ok, error, ApiContext } from "@/lib/api";
import { createHash } from "crypto";
import { generateText, isGeminiConfigured } from "@/lib/gemini";
import { cacheGet, cacheSet } from "@/lib/redis";
import { accessibleProjectsWhere } from "@/lib/org";

const INSIGHTS_TIMEOUT_MS = 10000;
const INSIGHTS_CACHE_TTL_S = 600;

interface Insight {
  title: string;
  body: string;
  action: string;
}

export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const requestId = ctx.requestId;
  try {
    // 1. Fetch the projects the user can access
    const projects = await prisma.project.findMany({
      where: accessibleProjectsWhere(ctx.user.userId),
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
    let openTasks = 0;
    let inProgress = 0;
    const teamMembersSet = new Set<string>();

    // For AI context
    const projectSummaries = projects.map(p => {
      totalTasks += p.tasks.length;
      openTasks += p.tasks.filter(t => t.status !== "DONE").length;
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
      openTasks,
      inProgress,
      teamMembers: teamMembersSet.size
    };

    // 3. Generate AI Insights via Gemini API
    if (new URL(req.url).searchParams.get("insights") === "false") {
      return ok({ stats });
    }

    let insights: Insight[] = [];
    if (isGeminiConfigured() && projects.length > 0) {
      const prompt = `You are an AI project manager analyzing a user's workspace.
Here is the JSON summary of their projects and tasks:
${JSON.stringify(projectSummaries)}

Based on this data, provide exactly 2 brief insights. 
One should highlight a potential bottleneck or risk (e.g., too many tasks in progress, critical tasks stuck).
The second should be a positive observation or a suggestion.
Return ONLY a valid JSON array of objects with this format: 
[{"title": "emoji and short title", "body": "1 sentence explanation", "action": "View projects"}]`;

      // Keyed on the workspace contents so insights regenerate only when tasks change
      const cacheKey = `insights:${ctx.user.userId}:${createHash("sha1").update(JSON.stringify(projectSummaries)).digest("hex")}`;
      const cached = await cacheGet<Insight[]>(cacheKey);
      if (cached) {
        insights = cached;
      } else {
        try {
          const text = await generateText(prompt, 0.2, INSIGHTS_TIMEOUT_MS);
          // Strip markdown blocks if any
          const parsed: unknown = JSON.parse(text.replace(/```json\n?/g, "").replace(/```/g, "").trim());
          if (Array.isArray(parsed)) {
            insights = parsed.filter(
              (i): i is Insight => typeof i?.title === "string" && typeof i?.body === "string"
            ).map(i => ({ ...i, action: typeof i.action === "string" ? i.action : "View projects" }));
          }
          if (insights.length > 0) await cacheSet(cacheKey, insights, INSIGHTS_CACHE_TTL_S);
        } catch (e) {
          console.error("Failed to generate Gemini insights:", e instanceof Error ? `${e.name}: ${e.message}` : e);
        }
      }
    }

    // Fallback insights if AI fails or no projects
    if (insights.length === 0) {
      insights = [
        {
          title: "Welcome to Velo",
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
