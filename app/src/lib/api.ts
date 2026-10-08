import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, isTokenBlocked, JWTPayload } from "./auth";
import { prisma } from "./prisma";
import { v4 as uuidv4 } from "uuid";

export type ApiContext = {
  user: JWTPayload & { role?: string };
  requestId: string;
};

export type ApiHandler = (
  req: NextRequest,
  ctx: ApiContext,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

// ─── API Response helpers ──────────────────────────────────────
export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function created(data: unknown): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function error(
  code: string,
  message: string,
  statusCode: number,
  requestId: string
): NextResponse {
  return NextResponse.json(
    { error: { code, message, statusCode, requestId } },
    { status: statusCode }
  );
}

// ─── Auth middleware ───────────────────────────────────────────
export function withAuth(handler: ApiHandler) {
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    const requestId = uuidv4();

    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return error("UNAUTHORIZED", "Missing authorization token", 401, requestId);
      }

      const token = authHeader.slice(7);

      // Check blocklist
      const blocked = await isTokenBlocked(token);
      if (blocked) {
        return error("UNAUTHORIZED", "Token has been revoked", 401, requestId);
      }

      const payload = verifyAccessToken(token);
      const ctx: ApiContext = { user: payload, requestId };

      return handler(req, ctx, context);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TokenExpiredError") {
        return error("UNAUTHORIZED", "Token expired", 401, requestId);
      }
      if (err instanceof Error && err.name === "JsonWebTokenError") {
        return error("UNAUTHORIZED", "Invalid token", 401, requestId);
      }
      console.error("[API Error]", { requestId, err });
      return error("INTERNAL_ERROR", "An unexpected error occurred", 500, requestId);
    }
  };
}

// ─── RBAC middleware ───────────────────────────────────────────
export function withRole(roles: string[], handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, ctx: ApiContext, context?: { params: Promise<Record<string, string>> }) => {
    const requestId = ctx.requestId;
    if (!ctx.user.role || !roles.includes(ctx.user.role)) {
      return error(
        "FORBIDDEN",
        "You do not have permission to perform this action",
        403,
        requestId
      );
    }
    return handler(req, ctx, context);
  };
}

// ─── Audit logging ─────────────────────────────────────────────
export async function audit(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, action, resource, resourceId, metadata: metadata as any },
    });
  } catch {
    // Non-fatal
  }
}

// ─── Structured logging ────────────────────────────────────────
export function log(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Zod validation helper ──────────────────────────────────────
import { ZodSchema } from "zod";

export function validate<T>(schema: ZodSchema<T>, data: unknown, requestId: string): 
  | { success: true; data: T } 
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: error(
        "VALIDATION_ERROR",
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        400,
        requestId
      ),
    };
  }
  return { success: true, data: result.data };
}
