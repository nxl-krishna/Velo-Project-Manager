import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revokeRefreshTokenFamily, blockAccessToken } from "@/lib/auth";
import { error, validate, log } from "@/lib/api";
import { randomUUID } from "crypto";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = await req.json();
    const v = validate(schema, body, requestId);
    if (!v.success) return v.response;

    // Revoke entire refresh token family
    await revokeRefreshTokenFamily(v.data.refreshToken);

    // Blocklist access token if provided
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await blockAccessToken(token);
    }

    log("info", "User logged out", { requestId });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    log("error", "Logout failed", { requestId, err: String(err) });
    return error("INTERNAL_ERROR", "Logout failed", 500, requestId);
  }
}
