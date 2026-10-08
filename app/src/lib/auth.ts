import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "./prisma";
import { redis } from "./redis";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
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
export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ─── Refresh token ────────────────────────────────────────────
export async function createRefreshToken(
  userId: string,
  family?: string
): Promise<string> {
  const token = uuidv4();
  const tokenFamily = family ?? uuidv4();

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
  await redis.set(`blocklist:${token}`, "1", "EX", ttlSeconds);
}

export async function isTokenBlocked(token: string): Promise<boolean> {
  const result = await redis.get(`blocklist:${token}`);
  return result !== null;
}

// ─── Rate limiting ────────────────────────────────────────────
export async function checkLoginRateLimit(ip: string): Promise<boolean> {
  const key = `ratelimit:login:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 900); // 15 min window
  return count <= 5; // 5 attempts per 15 min
}
