import { createHash, randomUUID } from "crypto";
import { prisma } from "./prisma";
import { redis, cacheGet, cacheSet } from "./redis";
import { embedText, embeddingModel, isGeminiConfigured } from "./gemini";

const CURSOR_KEY = "rag:sync:cursor:v1";
const LOCK_KEY = "rag:sync:lock";
const LOCK_TTL_S = 120;
// Re-scan a short window behind the cursor so rows committed late (with an older updatedAt) are not missed.
// Content hashes make the re-scan cheap: unchanged rows are never re-embedded.
const LOOKBACK_MS = 2 * 60 * 1000;
const PAGE_SIZE = 200;
const EMBED_CONCURRENCY = 4;
const MAX_CONTENT_CHARS = 4000;
const QUERY_EMBEDDING_TTL_S = 7 * 24 * 60 * 60;

type EntityType = "task" | "comment";

interface Cursor {
  at: string;
  id: string;
}

interface Doc {
  taskId: string;
  projectId: string;
  content: string;
}

interface SourceRow {
  id: string;
  updatedAt: Date;
  doc: Doc | null; // null = soft-deleted, remove from the index
}

export interface SyncResult {
  scanned: number;
  embedded: number;
  removed: number;
  complete: boolean;
}

export interface RagHit {
  taskId: string;
  entityType: EntityType;
  content: string;
  score: number;
}

const START: Cursor = { at: new Date(0).toISOString(), id: "" };

function embedBudget(): number {
  const n = parseInt(process.env.RAG_EMBEDS_PER_RUN || "", 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

function clip(text: string): string {
  return text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
}

function hashDoc(doc: Doc): string {
  return createHash("sha1").update(`${embeddingModel()}\n${doc.projectId}\n${doc.content}`).digest("hex");
}

function toVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

function later(a: Cursor, b: Cursor): Cursor {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.id >= b.id ? a : b;
}

function afterWhere(after: Cursor) {
  const at = new Date(after.at);
  return { OR: [{ updatedAt: { gt: at } }, { updatedAt: at, id: { gt: after.id } }] };
}

const ORDER = [{ updatedAt: "asc" as const }, { id: "asc" as const }];

async function fetchTasks(after: Cursor): Promise<SourceRow[]> {
  const rows = await prisma.task.findMany({
    where: afterWhere(after),
    orderBy: ORDER,
    take: PAGE_SIZE,
    select: { id: true, title: true, description: true, labels: true, projectId: true, deletedAt: true, updatedAt: true },
  });
  return rows.map((t) => ({
    id: t.id,
    updatedAt: t.updatedAt,
    doc: t.deletedAt
      ? null
      : {
          taskId: t.id,
          projectId: t.projectId,
          content: clip(
            [`Task: ${t.title}`, t.labels.length > 0 ? `Labels: ${t.labels.join(", ")}` : "", t.description ?? ""]
              .filter(Boolean)
              .join("\n")
          ),
        },
  }));
}

async function fetchComments(after: Cursor): Promise<SourceRow[]> {
  const rows = await prisma.comment.findMany({
    where: afterWhere(after),
    orderBy: ORDER,
    take: PAGE_SIZE,
    select: {
      id: true,
      content: true,
      taskId: true,
      deletedAt: true,
      updatedAt: true,
      author: { select: { name: true } },
      task: { select: { title: true, projectId: true, deletedAt: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    updatedAt: c.updatedAt,
    doc:
      c.deletedAt || c.task.deletedAt
        ? null
        : {
            taskId: c.taskId,
            projectId: c.task.projectId,
            content: clip(`Comment by ${c.author.name} on task "${c.task.title}": ${c.content}`),
          },
  }));
}

type RowOutcome = "embedded" | "unchanged" | "removed" | "deferred";

async function processRow(
  type: EntityType,
  row: SourceRow,
  hashes: Map<string, string>,
  budget: { left: number }
): Promise<RowOutcome> {
  if (!row.doc) {
    const { count } =
      type === "task"
        ? await prisma.ragDocument.deleteMany({ where: { taskId: row.id } })
        : await prisma.ragDocument.deleteMany({ where: { entityType: type, entityId: row.id } });
    return count > 0 ? "removed" : "unchanged";
  }

  const hash = hashDoc(row.doc);
  if (hashes.get(row.id) === hash) return "unchanged";
  if (budget.left <= 0) return "deferred";
  budget.left--;

  const vector = toVector(await embedText(row.doc.content, "RETRIEVAL_DOCUMENT"));
  await prisma.$executeRaw`
    INSERT INTO "RagDocument" ("id", "entityType", "entityId", "taskId", "projectId", "content", "contentHash", "embedding", "updatedAt")
    VALUES (${randomUUID()}, ${type}, ${row.id}, ${row.doc.taskId}, ${row.doc.projectId}, ${row.doc.content}, ${hash}, ${vector}::vector, now())
    ON CONFLICT ("entityType", "entityId") DO UPDATE SET
      "taskId" = EXCLUDED."taskId",
      "projectId" = EXCLUDED."projectId",
      "content" = EXCLUDED."content",
      "contentHash" = EXCLUDED."contentHash",
      "embedding" = EXCLUDED."embedding",
      "updatedAt" = now()`;
  return "embedded";
}

async function syncEntity(
  type: EntityType,
  saved: Cursor,
  budget: { left: number },
  stats: Omit<SyncResult, "complete">
): Promise<{ cursor: Cursor; complete: boolean; error?: unknown }> {
  const fetchPage = type === "task" ? fetchTasks : fetchComments;
  let cursor = saved;
  let pos: Cursor = { at: new Date(Math.max(0, Date.parse(saved.at) - LOOKBACK_MS)).toISOString(), id: "" };

  for (;;) {
    const rows = await fetchPage(pos);
    if (rows.length === 0) return { cursor, complete: true };
    stats.scanned += rows.length;

    const live = rows.filter((r) => r.doc);
    const existing = await prisma.ragDocument.findMany({
      where: { entityType: type, entityId: { in: live.map((r) => r.id) } },
      select: { entityId: true, contentHash: true },
    });
    const hashes = new Map(existing.map((e) => [e.entityId, e.contentHash]));

    for (let i = 0; i < rows.length; i += EMBED_CONCURRENCY) {
      const chunk = rows.slice(i, i + EMBED_CONCURRENCY);
      const results = await Promise.allSettled(chunk.map((r) => processRow(type, r, hashes, budget)));
      // Advance the cursor only over the unbroken prefix of finished rows, so failures are retried next run
      for (let j = 0; j < chunk.length; j++) {
        const result = results[j];
        if (result.status === "rejected") return { cursor, complete: false, error: result.reason };
        if (result.value === "deferred") return { cursor, complete: false };
        if (result.value === "embedded") stats.embedded++;
        if (result.value === "removed") stats.removed++;
        cursor = later(cursor, { at: chunk[j].updatedAt.toISOString(), id: chunk[j].id });
      }
    }

    const last = rows[rows.length - 1];
    pos = { at: last.updatedAt.toISOString(), id: last.id };
    if (rows.length < PAGE_SIZE) return { cursor, complete: true };
  }
}

/**
 * Incrementally embeds tasks and comments changed since the last run.
 * Returns null when another run holds the lock or Gemini is not configured.
 */
export async function syncRagIndex(): Promise<SyncResult | null> {
  if (!isGeminiConfigured()) return null;

  const token = randomUUID();
  const acquired = await redis.set(LOCK_KEY, token, "EX", LOCK_TTL_S, "NX");
  if (acquired !== "OK") return null;

  try {
    const raw = await redis.get(CURSOR_KEY);
    const saved: Record<EntityType, Cursor> = raw ? JSON.parse(raw) : { task: START, comment: START };
    const budget = { left: embedBudget() };
    const stats = { scanned: 0, embedded: 0, removed: 0 };

    const task = await syncEntity("task", saved.task, budget, stats);
    const comment = task.error
      ? { cursor: saved.comment, complete: false, error: undefined }
      : await syncEntity("comment", saved.comment, budget, stats);

    await redis.set(CURSOR_KEY, JSON.stringify({ task: task.cursor, comment: comment.cursor }));

    const error = task.error ?? comment.error;
    if (error) throw error;
    return { ...stats, complete: task.complete && comment.complete };
  } finally {
    if ((await redis.get(LOCK_KEY).catch(() => null)) === token) await redis.del(LOCK_KEY).catch(() => {});
  }
}

async function queryEmbedding(query: string): Promise<number[]> {
  const key = `rag:qemb:${createHash("sha1").update(`${embeddingModel()}\n${query}`).digest("hex")}`;
  const cached = await cacheGet<number[]>(key);
  if (cached) return cached;
  const vector = await embedText(query, "RETRIEVAL_QUERY");
  await cacheSet(key, vector, QUERY_EMBEDDING_TTL_S);
  return vector;
}

/** Semantic search over open tasks (and their comments) in the given projects. */
export async function searchRag(query: string, projectIds: string[], limit = 5): Promise<RagHit[]> {
  if (projectIds.length === 0) return [];
  const vector = toVector(await queryEmbedding(query));
  return prisma.$queryRaw<RagHit[]>`
    SELECT d."taskId", d."entityType", d."content", (1 - (d."embedding" <=> ${vector}::vector))::float8 AS "score"
    FROM "RagDocument" d
    JOIN "Task" t ON t."id" = d."taskId"
    JOIN "Project" p ON p."id" = t."projectId"
    WHERE t."projectId" = ANY(${projectIds})
      AND d."embedding" IS NOT NULL
      AND t."deletedAt" IS NULL
      AND p."deletedAt" IS NULL
      AND t."status" <> 'DONE'
    ORDER BY d."embedding" <=> ${vector}::vector
    LIMIT ${limit}`;
}

export async function countIndexedDocuments(projectIds: string[]): Promise<number> {
  if (projectIds.length === 0) return 0;
  return prisma.ragDocument.count({ where: { projectId: { in: projectIds } } });
}
