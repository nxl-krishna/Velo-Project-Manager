// Temporary dummy implementation to allow the app to run without Redis
export const redis = null as any;

export async function cacheGet<T>(key: string): Promise<T | null> {
  return null; // Always return cache miss
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  // Do nothing
}

export async function cacheDel(...keys: string[]): Promise<void> {
  // Do nothing
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  // Do nothing
}
