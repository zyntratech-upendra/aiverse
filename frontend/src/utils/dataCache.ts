/**
 * High-performance caching utility for instantaneous UI rendering.
 * Implements Stale-While-Revalidate pattern with memory and sessionStorage tiers.
 */

const memoryCache = new Map<string, { data: any; timestamp: number }>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes cache lifetime

export interface IDataCache {
  get<T>(key: string, maxAgeMs?: number): T | null;
  set<T>(key: string, data: T, maxAgeMs?: number): void;
  invalidate(keyPrefix: string): void;
  loadWithRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    onFreshData: (data: T) => void,
    maxAgeMs?: number
  ): Promise<T>;
}

export const dataCache: IDataCache = {
  /**
   * Synchronously retrieve cached data from memory or sessionStorage
   */
  get<T>(key: string, maxAgeMs: number = DEFAULT_TTL_MS): T | null {
    // 1. Check in-memory cache first (fastest, 0ms)
    const mem = memoryCache.get(key);
    const now = Date.now();
    if (mem && (now - mem.timestamp < maxAgeMs)) {
      return mem.data as T;
    }

    // 2. Check sessionStorage fallback
    try {
      const raw = sessionStorage.getItem(`aiverse_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (now - parsed.timestamp < maxAgeMs)) {
          // Re-populate memory cache
          memoryCache.set(key, { data: parsed.data, timestamp: parsed.timestamp });
          return parsed.data as T;
        }
      }
    } catch {
      // Ignore storage errors
    }

    return null;
  },

  /**
   * Store data in memory and sessionStorage
   */
  set<T>(key: string, data: T, _maxAgeMs?: number): void {
    const timestamp = Date.now();
    memoryCache.set(key, { data, timestamp });

    try {
      sessionStorage.setItem(
        `aiverse_cache_${key}`,
        JSON.stringify({ data, timestamp })
      );
    } catch {
      // Storage quota or private browsing safeguard
    }
  },

  /**
   * Invalidate a specific cache key or prefix
   */
  invalidate(keyPrefix: string): void {
    for (const k of memoryCache.keys()) {
      if (k.startsWith(keyPrefix)) {
        memoryCache.delete(k);
      }
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`aiverse_cache_${keyPrefix}`)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
  },

  /**
   * Stale-While-Revalidate helper:
   * Returns cached data immediately if available, then executes the fetcher
   * and invokes the callback with fresh data.
   */
  async loadWithRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    onFreshData: (data: T) => void,
    maxAgeMs: number = DEFAULT_TTL_MS
  ): Promise<T> {
    const cached = dataCache.get<T>(key, maxAgeMs);
    if (cached) {
      // Immediately notify with cached copy
      onFreshData(cached);
    }

    // Fetch fresh data in background
    try {
      const fresh = await fetcher();
      dataCache.set(key, fresh);
      onFreshData(fresh);
      return fresh;
    } catch (err) {
      if (cached) {
        return cached;
      }
      throw err;
    }
  }
};
