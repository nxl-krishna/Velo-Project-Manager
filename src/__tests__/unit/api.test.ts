/**
 * Unit tests for API utility library
 * Tests: response helpers, validation, structured logging
 */

import { validate, log, ok, error, created } from "../../lib/api";
import { z } from "zod";

// Mock auth and redis
jest.mock("../../lib/auth", () => ({
  verifyAccessToken: jest.fn(),
  isTokenBlocked: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../lib/prisma", () => ({ prisma: { auditLog: { create: jest.fn() } } }));

describe("API Utilities — Unit Tests", () => {
  const requestId = "test-request-id";

  // ─── Response helpers ─────────────────────────────────
  describe("Response helpers", () => {
    it("ok() returns 200 with data", async () => {
      const res = ok({ foo: "bar" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual({ foo: "bar" });
    });

    it("ok() accepts custom status code", async () => {
      const res = ok({ created: true }, 201);
      expect(res.status).toBe(201);
    });

    it("created() returns 201", async () => {
      const res = created({ id: "new-id" });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe("new-id");
    });

    it("error() returns correct status and structure", async () => {
      const res = error("NOT_FOUND", "Resource not found", 404, requestId);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Resource not found");
      expect(body.error.statusCode).toBe(404);
      expect(body.error.requestId).toBe(requestId);
    });
  });

  // ─── Zod validation ───────────────────────────────────
  describe("validate()", () => {
    const schema = z.object({
      name: z.string().min(2),
      age: z.number().min(0).max(120),
    });

    it("should return success for valid data", () => {
      const result = validate(schema, { name: "Jane", age: 30 }, requestId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Jane");
      }
    });

    it("should return failure for missing field", async () => {
      const result = validate(schema, { name: "Jo" }, requestId);
      // name too short
      expect(result.success).toBe(false);
    });

    it("should return validation error response on failure", async () => {
      const result = validate(schema, { name: "J", age: -1 }, requestId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const body = await result.response.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should handle extra fields (strip by default)", () => {
      const result = validate(schema, { name: "Jane", age: 25, extra: "field" }, requestId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).extra).toBeUndefined();
      }
    });
  });

  // ─── Logging ──────────────────────────────────────────
  describe("log()", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();
      jest.spyOn(console, "warn").mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    it("should log info as JSON", () => {
      log("info", "Test message", { userId: "u1" });
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.level).toBe("info");
      expect(logged.message).toBe("Test message");
      expect(logged.userId).toBe("u1");
      expect(logged.timestamp).toBeTruthy();
    });

    it("should include timestamp in log", () => {
      log("info", "With timestamp");
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(new Date(logged.timestamp).getTime()).not.toBeNaN();
    });
  });
});
