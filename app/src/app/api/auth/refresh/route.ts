import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rotateRefreshToken } from "@/lib/auth";
import { error, validate, log } from "@/lib/api";
import { randomUUID } from "crypto";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = await req.json();
    const v = validate(schema, body, requestId);
    if (!v.success) return v.response;

    const result = await rotateRefreshToken(v.data.refreshToken);
    if (!result) {
      return error("UNAUTHORIZED", "Invalid or expired refresh token", 401, requestId);
    }

    log("info", "Token refreshed", { requestId, userId: result.userId });

    return NextResponse.json({
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: 900,
      },
    });
  } catch (err) {
    log("error", "Token refresh failed", { requestId, err: String(err) });
    return error("INTERNAL_ERROR", "Token refresh failed", 500, requestId);
  }
}
