import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { passwordResetEmail, sendEmail } from "./email";

export const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Base URL for links in emails. Production uses the configured app URL rather than the request's
 * Host header, which an attacker could spoof to send victims a reset link to their own domain.
 */
export function appBaseUrl(req: NextRequest): string {
  if (process.env.NODE_ENV === "production") {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (!url) throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
    return url.replace(/\/$/, "");
  }
  return req.nextUrl.origin;
}

/** Emails a reset link if the account exists. Silently does nothing otherwise. */
export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, name: true, email: true },
  });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // A new request replaces any earlier unused link
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
  await sendEmail(passwordResetEmail(user.email, user.name, resetUrl, RESET_TOKEN_TTL_MINUTES));
}

async function findUsableToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { deletedAt: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || record.user.deletedAt) return null;
  return record;
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return (await findUsableToken(token)) !== null;
}

/**
 * Sets the new password and signs the user out everywhere. Returns the user id, or null when the
 * link is invalid, expired or already used.
 */
export async function resetPassword(token: string, password: string): Promise<string | null> {
  const record = await findUsableToken(token);
  if (!record) return null;

  const passwordHash = await hashPassword(password);
  const now = new Date();

  // Claim the token atomically so two concurrent submissions can't both succeed
  const { count } = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });
  if (count === 0) return null;

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
  ]);
  return record.userId;
}
