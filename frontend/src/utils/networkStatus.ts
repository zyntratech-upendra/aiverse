/**
 * Network Status & Resilience Utilities
 * 
 * Provides centralized online/offline detection, exponential backoff,
 * and safe save-on-close mechanisms for the quiz system.
 */

type NetworkStatusListener = (online: boolean) => void;

const listeners = new Set<NetworkStatusListener>();
let currentOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    currentOnline = true;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener("offline", () => {
    currentOnline = false;
    listeners.forEach((fn) => fn(false));
  });
}

export function isOnline(): boolean {
  return currentOnline;
}

export function onNetworkChange(listener: NetworkStatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Exponential backoff with jitter for retry operations.
 * Returns the delay in ms for the given attempt (0-indexed).
 */
export function getBackoffDelay(attempt: number, baseMs = 500, maxMs = 30000): number {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * (exponential * 0.3));
  return exponential + jitter;
}

/**
 * Retry an async operation with exponential backoff.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt, baseMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Debounce utility that returns a debounced function.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delayMs);
  }) as T & { cancel: () => void };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}
