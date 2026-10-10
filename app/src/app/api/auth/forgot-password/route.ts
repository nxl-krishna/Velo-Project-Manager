import { NextRequest, after } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ok, error, validate, log } from "@/lib/api";
import { checkLoginRateLimit, getClientIp } from "@/lib/auth";
import { appBaseUrl, requestPasswordReset } from "@/lib/password-reset";

const forgotSchema = z.object({ email: z.string().trim().email().max(254) });

// The same answer whether or not the account exists, so this can't be used to discover emails
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a link to reset the password.";

// POST /api/auth/forgot-password — email a single-use reset link
export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("BAD_REQUEST", "Invalid JSON body", 400, requestId);
  }
  const v = validate(forgotSchema, body, requestId);
  if (!v.success) return v.response;
  const email = v.data.email.toLowerCase();

  const ip = getClientIp(req.headers);
  if (!(await checkLoginRateLimit(ip, "forgot"))) {
    return error("RATE_LIMITED", "Too many requests. Try again later.", 429, requestId);
  }
  // The per-email limit is silent: answering 429 would reveal that the address was targeted
  const emailAllowed = await checkLoginRateLimit(email, "forgot-email");

  if (emailAllowed) {
    const baseUrl = appBaseUrl(req);
    // Runs after the response so timing doesn't reveal whether the account exists
    after(async () => {
      try {
        await requestPasswordReset(email, baseUrl);
      } catch (err) {
        log("error", "Password reset email failed", { requestId, err: String(err) });
      }
    });
  }

  return ok({ message: GENERIC_MESSAGE });
}
