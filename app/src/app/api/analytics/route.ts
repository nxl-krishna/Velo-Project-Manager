import { NextRequest } from "next/server";
import { withAuth, ok, ApiContext } from "@/lib/api";
import { ANALYTICS_SECTIONS, getAnalytics, getAnalyticsVersion, sectionHashes, type Analytics } from "@/lib/analytics";

// GET /api/analytics — workspace metrics across every project the user can access
// Delta sync: ?since=<version>&h=<section hashes> returns { changed: false } when nothing changed,
// otherwise only the sections whose hash differs from the client's copy.
export const GET = withAuth(async (req: NextRequest, ctx: ApiContext) => {
  const since = req.nextUrl.searchParams.get("since");
  const have = (req.nextUrl.searchParams.get("h") ?? "").split(",");

  const version = await getAnalyticsVersion(ctx.user.userId);
  if (since === version) return ok({ changed: false, version });

  const analytics = await getAnalytics(ctx.user.userId);
  const hashes = sectionHashes(analytics);
  const patch = Object.fromEntries(
    ANALYTICS_SECTIONS.filter((_, i) => hashes[i] !== have[i]).map((s) => [s, analytics[s]])
  ) as Partial<Analytics>;

  return ok({ changed: true, version, hashes, patch });
});
