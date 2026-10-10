import { NextRequest, connection } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ok, error, validate, audit, log } from "@/lib/api";
import { checkLoginRateLimit, getClientIp } from "@/lib/auth";
import { passwordSchema } from "@/lib/password-policy";
import { isResetTokenValid, resetPassword } from "@/lib/password-reset";

const tokenSchema = z.string().min(20).max(200);
const resetSchema = z.object({ token: tokenSchema, password: passwordSchema });

const INVALID_LINK = "This reset link is invalid or has expired. Request a new one.";

// GET /api/auth/reset-password?token=... — lets the page tell the user up front if the link is dead
export async function GET(req: NextRequest) {
  await connection();
  const token = tokenSchema.safeParse(req.nextUrl.searchParams.get("token"));
  return ok({ valid: token.success && (await isResetTokenValid(token.data)) });
}

// POST /api/auth/reset-password — set a new password using the emailed token
export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("BAD_REQUEST", "Invalid JSON body", 400, requestId);
  }
  const v = validate(resetSchema, body, requestId);
  if (!v.success) return v.response;

  if (!(await checkLoginRateLimit(getClientIp(req.headers), "reset"))) {
    return error("RATE_LIMITED", "Too many attempts. Try again later.", 429, requestId);
  }

  try {
    const userId = await resetPassword(v.data.token, v.data.password);
    if (!userId) return error("INVALID_TOKEN", INVALID_LINK, 400, requestId);

    await audit(userId, "auth.password_reset", "User", userId);
    log("info", "Password reset", { requestId, userId });
    return ok({ message: "Password updated. Sign in with your new password." });
  } catch (err) {
    log("error", "Password reset failed", { requestId, err: String(err) });
    return error("INTERNAL_ERROR", "Could not reset the password", 500, requestId);
  }
}
