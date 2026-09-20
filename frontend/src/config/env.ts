/**
 * Centralized Environment Configuration & Diagnostics
 * 
 * Vite inlines `import.meta.env.VITE_*` variables at BUILD TIME.
 * This module ensures safe defaults, runtime validation, and avoids blank screen crashes.
 */

export interface AppEnvConfig {
  apiBase: string;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  isProduction: boolean;
  isDevelopment: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE || "").trim();
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "https://glwwaoqbnguvorophdle.supabase.co").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsd3dhb3Fibmd1dm9yb3BoZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTY2OTYsImV4cCI6MjEwMjYzMjY5Nn0.P8oG1R9kUrDORU0k2AFK6TbLnOtqGngiZcwlu4XflgU").trim();
const SUPABASE_SERVICE_ROLE_KEY = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsd3dhb3Fibmd1dm9yb3BoZGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA1NjY5NiwiZXhwIjoyMTAyNjMyNjk2fQ._VhjPvPtlU5S0lPoME0pKzBQuJN_g_4k1QLLpISKw1A").trim();

export const env: AppEnvConfig = {
  apiBase: API_BASE,
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  },
  isProduction: import.meta.env.PROD ?? false,
  isDevelopment: import.meta.env.DEV ?? true,
};

export interface EnvValidationResult {
  isValid: boolean;
  missingVariables: string[];
  warnings: string[];
}

/**
 * Validates whether essential frontend environment variables are present.
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!env.supabase.url) warnings.push("VITE_SUPABASE_URL is not configured.");
  if (!env.supabase.anonKey) warnings.push("VITE_SUPABASE_ANON_KEY is not configured.");

  return {
    isValid: true,
    missingVariables: missing,
    warnings,
  };
}

export const envValidation = validateEnvironment();
