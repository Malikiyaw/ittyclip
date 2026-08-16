type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 15 * 60 * 1000;

function prune(now = Date.now()) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export function getAiCache<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setAiCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  const now = Date.now();
  cache.set(key, { value, createdAt: now, expiresAt: now + Math.max(1_000, ttlMs) });
  prune(now);
}

export function clearAiCache(): void {
  cache.clear();
}

export function getAiCacheStats() {
  prune();
  return { entries: cache.size, maxEntries: MAX_ENTRIES };
}
