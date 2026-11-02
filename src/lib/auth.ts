import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { redis } from "./redis";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 7;

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ─── Password hashing ──────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT helpers ──────────────────────────────────────────────
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(
    { userId: payload.userId, email: payload.email },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, getJwtSecret()) as JWTPayload;
}

// ─── Refresh token ────────────────────────────────────────────
export async function createRefreshToken(
  userId: string,
  family?: string
): Promise<string> {
  const token = randomUUID();
  const tokenFamily = family ?? randomUUID();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      family: tokenFamily,
      expiresAt,
    },
  });

  return token;
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const record = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });

  if (!record) return null;

  // Reuse detection — if already revoked, revoke entire family
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: record.family },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Check expiry
  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  // Issue new pair
  const accessToken = signAccessToken({
    userId: record.userId,
    email: record.user.email,
  });
  const refreshToken = await createRefreshToken(record.userId, record.family);

  return { accessToken, refreshToken, userId: record.userId };
}

export async function revokeRefreshTokenFamily(token: string): Promise<void> {
  const record = await prisma.refreshToken.findUnique({
    where: { token },
  });
  if (!record) return;

  await prisma.refreshToken.updateMany({
    where: { family: record.family },
    data: { revokedAt: new Date() },
  });
}

// ─── Token blocklist (logout) ─────────────────────────────────
export async function blockAccessToken(
  token: string,
  ttlSeconds = 900
): Promise<void> {
  try {
    await redis.set(`blocklist:${token}`, "1", "EX", ttlSeconds);
  } catch (err) {
    console.warn("[Auth] Redis unavailable, access token not blocklisted:", (err as Error).message);
  }
}

// Fails open when Redis is down: a logged-out token stays valid until it expires (max 15 min)
export async function isTokenBlocked(token: string): Promise<boolean> {
  try {
    const result = await redis.get(`blocklist:${token}`);
    return result !== null;
  } catch (err) {
    console.warn("[Auth] Redis unavailable, skipping blocklist check:", (err as Error).message);
    return false;
  }
}

// ─── Rate limiting ────────────────────────────────────────────
// Fails open when Redis is down so an outage doesn't lock everyone out
export async function checkLoginRateLimit(ip: string, scope = "login"): Promise<boolean> {
  const key = `ratelimit:${scope}:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 900); // 15 min window
    return count <= 5; // 5 attempts per 15 min
  } catch (err) {
    console.warn("[Auth] Redis unavailable, skipping rate limit:", (err as Error).message);
    return true;
  }
}

export async function resetLoginRateLimit(ip: string, scope = "login"): Promise<void> {
  try {
    await redis.del(`ratelimit:${scope}:${ip}`);
  } catch {
    // Non-fatal: the counter expires on its own
  }
}

export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
