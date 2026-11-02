import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";

// GET /api/health
export async function GET() {
  await connection();
  const checks: Record<string, "ok" | "error"> = {};

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis check
  try {
    const { redis } = await import("@/lib/redis");
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return ok({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    checks,
    uptime: process.uptime(),
  }, allOk ? 200 : 503);
}
