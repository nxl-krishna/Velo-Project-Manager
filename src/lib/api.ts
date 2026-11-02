import { NextRequest, NextResponse, connection } from "next/server";
import { randomUUID } from "crypto";
import type { Prisma, Role } from "@prisma/client";
import type { ZodType } from "zod";
import { verifyAccessToken, isTokenBlocked, JWTPayload } from "./auth";
import { prisma } from "./prisma";

export type ApiContext = {
  user: JWTPayload & { role?: string };
  requestId: string;
};

export type RouteContext = { params: Promise<Record<string, string>> };

export type ApiHandler = (
  req: NextRequest,
  ctx: ApiContext,
  context?: RouteContext
) => Promise<NextResponse>;

export async function getParams(context?: RouteContext): Promise<Record<string, string>> {
  return (await context?.params) ?? {};
}

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
  return async (req: NextRequest, context?: RouteContext) => {
    // Opt out of prerendering before the try block so Next's internal bail-out isn't swallowed as an API error
    await connection();
    const requestId = randomUUID();

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

      return await handler(req, ctx, context);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TokenExpiredError") {
        return error("UNAUTHORIZED", "Token expired", 401, requestId);
      }
      if (err instanceof Error && err.name === "JsonWebTokenError") {
        return error("UNAUTHORIZED", "Invalid token", 401, requestId);
      }
      if (err instanceof SyntaxError) {
        return error("BAD_REQUEST", "Invalid JSON body", 400, requestId);
      }
      console.error("[API Error]", { requestId, err });
      return error("INTERNAL_ERROR", "An unexpected error occurred", 500, requestId);
    }
  };
}

// ─── RBAC middleware ───────────────────────────────────────────
export function withRole(roles: string[], handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, ctx: ApiContext, context?: RouteContext) => {
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

// ─── Project access ────────────────────────────────────────────
// Returns null when the project doesn't exist; role is null when the user has no access.
// Effective project role: workspace admins are ADMIN everywhere in their workspace; otherwise the
// user must be on the project (or own it) and gets their workspace role, with owners at least MANAGER.
export async function getProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      orgId: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
      org: { select: { members: { where: { userId }, select: { role: true } } } },
    },
  });
  if (!project) return null;

  const orgRole: Role | null = project.org.members[0]?.role ?? null;
  const isOwner = project.ownerId === userId;
  const onProject = isOwner || project.members.length > 0;

  let role: Role | null = null;
  if (orgRole === "ADMIN") role = "ADMIN";
  else if (orgRole && onProject) role = isOwner ? "MANAGER" : orgRole;

  return { project, role, orgRole, isOwner };
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
      data: { userId, action, resource, resourceId, metadata: metadata as Prisma.InputJsonValue },
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
export function validate<T>(schema: ZodType<T>, data: unknown, requestId: string):
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
