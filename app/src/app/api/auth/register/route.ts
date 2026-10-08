import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  signAccessToken,
  createRefreshToken,
  checkLoginRateLimit,
} from "@/lib/auth";
import { error, validate, log } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain a number"),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();

  try {
    const body = await req.json();
    const v = validate(registerSchema, body, requestId);
    if (!v.success) return v.response;

    const { name, email, password } = v.data;

    // Check rate limit
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const allowed = await checkLoginRateLimit(ip);
    if (!allowed) {
      return error("RATE_LIMITED", "Too many requests. Try again later.", 429, requestId);
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return error("CONFLICT", "Email is already registered", 409, requestId);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = await createRefreshToken(user.id);

    log("info", "User registered", { requestId, userId: user.id });

    return NextResponse.json(
      { data: { user, accessToken, refreshToken } },
      { status: 201 }
    );
  } catch (err) {
    log("error", "Register failed", { requestId, err: String(err) });
    return error("INTERNAL_ERROR", "Registration failed", 500, requestId);
  }
}
