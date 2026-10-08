import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    maxRetriesPerRequest: 3,
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected");
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ─── Cache helpers ────────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Non-fatal: cache miss is acceptable
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Non-fatal
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Non-fatal
  }
}
