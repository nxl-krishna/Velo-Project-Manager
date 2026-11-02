/**
 * Unit tests for auth library
 * Tests: password hashing, JWT signing/verification, rate limiting
 */

// Mock dependencies before imports
jest.mock("../../lib/prisma", () => ({
  prisma: {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../lib/redis", () => ({
  redis: {
    set: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  },
}));

import { hashPassword, verifyPassword, signAccessToken, verifyAccessToken, checkLoginRateLimit, isTokenBlocked } from "../../lib/auth";
import { redis } from "../../lib/redis";

// Set required env vars for tests
process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-chars!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-key-32-chars-min!!";

describe("Auth Library — Unit Tests", () => {
  // ─── Password hashing ──────────────────────────────────
  describe("hashPassword / verifyPassword", () => {
    it("should hash a password", async () => {
      const hash = await hashPassword("SecurePass123!");
      expect(hash).not.toBe("SecurePass123!");
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    });

    it("should verify correct password", async () => {
      const hash = await hashPassword("SecurePass123!");
      const valid = await verifyPassword("SecurePass123!", hash);
      expect(valid).toBe(true);
    });

    it("should reject wrong password", async () => {
      const hash = await hashPassword("SecurePass123!");
      const valid = await verifyPassword("WrongPassword!", hash);
      expect(valid).toBe(false);
    });

    it("should produce different hashes for same password (salt)", async () => {
      const hash1 = await hashPassword("SamePass123!");
      const hash2 = await hashPassword("SamePass123!");
      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── JWT ──────────────────────────────────────────────
  describe("signAccessToken / verifyAccessToken", () => {
    const payload = { userId: "user-123", email: "test@example.com" };

    it("should sign a valid JWT", () => {
      const token = signAccessToken(payload);
      expect(token).toBeTruthy();
      expect(token.split(".")).toHaveLength(3); // header.payload.signature
    });

    it("should verify a valid token", () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it("should throw on invalid token", () => {
      expect(() => verifyAccessToken("invalid.token.here")).toThrow();
    });

    it("should throw on tampered token", () => {
      const token = signAccessToken(payload);
      const [h, p] = token.split(".");
      expect(() => verifyAccessToken(`${h}.${p}.tampered_sig`)).toThrow();
    });
  });

  // ─── Rate limiting ────────────────────────────────────
  describe("checkLoginRateLimit", () => {
    beforeEach(() => jest.clearAllMocks());

    it("should allow first attempt", async () => {
      (redis.incr as jest.Mock).mockResolvedValue(1);
      const allowed = await checkLoginRateLimit("192.168.1.1");
      expect(allowed).toBe(true);
    });

    it("should allow 5th attempt", async () => {
      (redis.incr as jest.Mock).mockResolvedValue(5);
      const allowed = await checkLoginRateLimit("192.168.1.1");
      expect(allowed).toBe(true);
    });

    it("should block 6th attempt", async () => {
      (redis.incr as jest.Mock).mockResolvedValue(6);
      const allowed = await checkLoginRateLimit("192.168.1.1");
      expect(allowed).toBe(false);
    });

    it("should set TTL on first attempt", async () => {
      (redis.incr as jest.Mock).mockResolvedValue(1);
      await checkLoginRateLimit("192.168.1.2");
      expect(redis.expire).toHaveBeenCalledWith("ratelimit:login:192.168.1.2", 900);
    });
  });

  // ─── Token blocklist ──────────────────────────────────
  describe("isTokenBlocked", () => {
    it("should return false for non-blocked token", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const blocked = await isTokenBlocked("some-token");
      expect(blocked).toBe(false);
    });

    it("should return true for blocked token", async () => {
      (redis.get as jest.Mock).mockResolvedValue("1");
      const blocked = await isTokenBlocked("blocked-token");
      expect(blocked).toBe(true);
    });
  });
});
