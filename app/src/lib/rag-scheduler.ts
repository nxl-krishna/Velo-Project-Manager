import { syncRagIndex } from "./rag";
import { GeminiQuotaError, isGeminiConfigured } from "./gemini";

const SYNC_INTERVAL_MS = 60_000;
const FIRST_RUN_DELAY_MS = 5_000;

const globalForRag = globalThis as unknown as { ragSyncTimer?: NodeJS.Timeout };

async function runSync() {
  try {
    const result = await syncRagIndex();
    if (result && (result.embedded > 0 || result.removed > 0)) {
      console.log(
        `[RAG] Indexed ${result.embedded}, removed ${result.removed}${result.complete ? "" : " (more pending, continuing next run)"}`
      );
    }
  } catch (e) {
    if (e instanceof GeminiQuotaError) return; // already logged once; sync resumes after the cooldown
    console.error("[RAG] Sync failed:", e instanceof Error ? e.message.slice(0, 300) : e);
  }
}

/** Starts the once-a-minute incremental index sync. Safe to call more than once. */
export function startRagSync() {
  if (globalForRag.ragSyncTimer || !isGeminiConfigured() || process.env.RAG_SYNC_DISABLED === "true") return;
  globalForRag.ragSyncTimer = setInterval(runSync, SYNC_INTERVAL_MS);
  globalForRag.ragSyncTimer.unref();
  setTimeout(runSync, FIRST_RUN_DELAY_MS).unref();
}
