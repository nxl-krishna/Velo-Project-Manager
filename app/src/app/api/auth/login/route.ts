import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  signAccessToken,
  createRefreshToken,
  checkLoginRateLimit,
} from "@/lib/auth";
import { error, validate, log } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const allowed = await checkLoginRateLimit(ip);
    if (!allowed) {
      return error("RATE_LIMITED", "Too many login attempts. Try again in 15 minutes.", 429, requestId);
    }

    const body = await req.json();
    const v = validate(loginSchema, body, requestId);
    if (!v.success) return v.response;

    const { email, password } = v.data;

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return error("UNAUTHORIZED", "Invalid email or password", 401, requestId);
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = await createRefreshToken(user.id);

    log("info", "User logged in", { requestId, userId: user.id });

    return NextResponse.json({
      data: {
        accessToken,
        refreshToken,
        expiresIn: 900,
        user: { id: user.id, name: user.name, email: user.email },
      },
    });
  } catch (err) {
    log("error", "Login failed", { requestId, err: String(err) });
    return error("INTERNAL_ERROR", "Login failed", 500, requestId);
  }
}
