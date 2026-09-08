/**
 * Quiz Monitor — Centralized Production Diagnostics
 * 
 * Tracks quiz operation failures and provides rate-limited logging
 * to avoid console spam in production while preserving diagnostic data.
 */

interface QuizError {
  type: "load_failure" | "save_failure" | "submission_failure" | "auth_failure" | "firestore_error" | "network_error";
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

const errorLog: QuizError[] = [];
const MAX_LOG_SIZE = 200;
const lastLoggedByType = new Map<string, number>();
const LOG_THROTTLE_MS = 30_000; // 30 seconds per error type

const isProduction = typeof import.meta !== "undefined" && import.meta.env?.PROD;

function shouldLog(type: string): boolean {
  if (!isProduction) return true; // Always log in dev
  const lastLogged = lastLoggedByType.get(type) || 0;
  if (Date.now() - lastLogged < LOG_THROTTLE_MS) return false;
  lastLoggedByType.set(type, Date.now());
  return true;
}

export const quizMonitor = {
  /**
   * Track a quiz operation error
   */
  trackError(type: QuizError["type"], message: string, context?: Record<string, unknown>): void {
    const entry: QuizError = { type, message, timestamp: Date.now(), context };
    
    // Keep bounded log
    if (errorLog.length >= MAX_LOG_SIZE) {
      errorLog.shift();
    }
    errorLog.push(entry);

    // Rate-limited console output
    if (shouldLog(type)) {
      console.error(`[QuizMonitor:${type}]`, message, context || "");
    }
  },

  /**
   * Track a successful operation (clears error state for type)
   */
  trackSuccess(type: string): void {
    lastLoggedByType.delete(type);
  },

  /**
   * Get all tracked errors (for debugging)
   */
  getErrors(): QuizError[] {
    return [...errorLog];
  },

  /**
   * Get error count by type
   */
  getErrorCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const err of errorLog) {
      counts[err.type] = (counts[err.type] || 0) + 1;
    }
    return counts;
  },

  /**
   * Get recent errors (last N minutes)
   */
  getRecentErrors(minutesBack = 5): QuizError[] {
    const cutoff = Date.now() - (minutesBack * 60 * 1000);
    return errorLog.filter((e) => e.timestamp >= cutoff);
  },

  /**
   * Clear all tracked errors
   */
  clear(): void {
    errorLog.length = 0;
    lastLoggedByType.clear();
  }
};

// Expose for debugging in browser console
if (typeof window !== "undefined") {
  (window as any).__quizMonitor = quizMonitor;
}
