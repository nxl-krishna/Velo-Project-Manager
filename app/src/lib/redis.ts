import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    family: 4, // Force IPv4 to prevent ECONNRESET on ISPs without IPv6
    keepAlive: 30000,
    // Never give up reconnecting: returning null here permanently closes the client
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
    reconnectOnError: (err) => err.message.includes("READONLY") || err.message.includes("ECONNRESET"),
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

export async function cacheDelPattern(...patterns: string[]): Promise<void> {
  try {
    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== "0");
    }
  } catch {
    // Non-fatal
  }
}
