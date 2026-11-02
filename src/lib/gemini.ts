import { cacheGet, cacheSet } from "./redis";

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_COOLDOWN_S = 60;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY);
}

/** Thrown when a model's quota is exhausted; calls short-circuit until `retryAt` instead of hitting the API. */
export class GeminiQuotaError extends Error {
  constructor(
    public model: string,
    public retryAt: number
  ) {
    super(`Gemini quota exhausted for ${model} until ${new Date(retryAt).toISOString()}`);
    this.name = "GeminiQuotaError";
  }
}

const cooldownKey = (model: string) => `gemini:cooldown:${model}`;

async function assertNotCoolingDown(model: string): Promise<void> {
  const retryAt = await cacheGet<number>(cooldownKey(model));
  if (retryAt && retryAt > Date.now()) throw new GeminiQuotaError(model, retryAt);
}

async function throwApiError(res: Response, model: string, label: string): Promise<never> {
  const body = await res.text();
  if (res.status === 429) {
    const delay = body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
    const seconds = delay ? Math.ceil(parseFloat(delay[1])) : DEFAULT_COOLDOWN_S;
    const retryAt = Date.now() + seconds * 1000;
    await cacheSet(cooldownKey(model), retryAt, seconds);
    console.warn(`[Gemini] Quota exhausted for ${model}; pausing calls for ${Math.round(seconds / 60)} min`);
    throw new GeminiQuotaError(model, retryAt);
  }
  throw new Error(`${label} ${res.status}: ${body}`);
}

export async function generateText(prompt: string, temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  await assertNotCoolingDown(model);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_AI_API_KEY ?? "",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  if (!res.ok) await throwApiError(res, model, "Gemini API error");

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini returned an empty response");
  return text.trim();
}

// Must match the vector(N) column of RagDocument in prisma/schema.prisma
export const EMBEDDING_DIMS = 768;

export function embeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
}

export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  timeoutMs = 15000
): Promise<number[]> {
  const model = embeddingModel();
  await assertNotCoolingDown(model);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_AI_API_KEY ?? "",
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  if (!res.ok) await throwApiError(res, model, "Gemini embedding error");

  const data = await res.json();
  const values: unknown = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
    throw new Error("Gemini returned an invalid embedding");
  }
  return values as number[];
}
