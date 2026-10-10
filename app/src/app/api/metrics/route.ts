import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/metrics — Prometheus-compatible text format
export async function GET() {
  await connection();
  const [userCount, projectCount, taskCount, orgCount] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { deletedAt: null } }),
  ]);

  const metrics = [
    `# HELP projecthub_users_total Total registered users`,
    `# TYPE projecthub_users_total gauge`,
    `projecthub_users_total ${userCount}`,
    ``,
    `# HELP projecthub_projects_total Total active projects`,
    `# TYPE projecthub_projects_total gauge`,
    `projecthub_projects_total ${projectCount}`,
    ``,
    `# HELP projecthub_tasks_total Total active tasks`,
    `# TYPE projecthub_tasks_total gauge`,
    `projecthub_tasks_total ${taskCount}`,
    ``,
    `# HELP projecthub_orgs_total Total organizations`,
    `# TYPE projecthub_orgs_total gauge`,
    `projecthub_orgs_total ${orgCount}`,
    ``,
    `# HELP process_uptime_seconds Node.js process uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime().toFixed(2)}`,
    ``,
    `# HELP nodejs_heap_used_bytes Heap used`,
    `# TYPE nodejs_heap_used_bytes gauge`,
    `nodejs_heap_used_bytes ${process.memoryUsage().heapUsed}`,
  ].join("\n");

  return new Response(metrics, {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
