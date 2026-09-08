/**
 * Centralized Environment Configuration & Diagnostics
 * 
 * Vite inlines `import.meta.env.VITE_*` variables at BUILD TIME.
 * This module ensures safe defaults, runtime validation, and avoids blank screen crashes.
 */

export interface AppEnvConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  isProduction: boolean;
  isDevelopment: boolean;
}

// 1. Read environment variables with safe string fallbacks
const FIREBASE_API_KEY = (import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB9eYytrVSNVbAMp58rrWxpNm730b68N6U").trim();
const FIREBASE_AUTH_DOMAIN = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-verse-54c65.firebaseapp.com").trim();
const FIREBASE_PROJECT_ID = (import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-verse-54c65").trim();
const FIREBASE_STORAGE_BUCKET = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-verse-54c65.firebasestorage.app").trim();
const FIREBASE_MESSAGING_SENDER_ID = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "457448123889").trim();
const FIREBASE_APP_ID = (import.meta.env.VITE_FIREBASE_APP_ID || "1:457448123889:web:78c4c286d63f6227db2850").trim();
const FIREBASE_MEASUREMENT_ID = (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VH65XQLDS2").trim();

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "https://glwwaoqbnguvorophdle.supabase.co").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsd3dhb3Fibmd1dm9yb3BoZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTY2OTYsImV4cCI6MjEwMjYzMjY5Nn0.P8oG1R9kUrDORU0k2AFK6TbLnOtqGngiZcwlu4XflgU").trim();
const SUPABASE_SERVICE_ROLE_KEY = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsd3dhb3Fibmd1dm9yb3BoZGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA1NjY5NiwiZXhwIjoyMTAyNjMyNjk2fQ._VhjPvPtlU5S0lPoME0pKzBQuJN_g_4k1QLLpISKw1A").trim();

export const env: AppEnvConfig = {
  firebase: {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
    measurementId: FIREBASE_MEASUREMENT_ID || undefined,
  },
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
 * Validates whether all required frontend environment variables are present.
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!env.firebase.apiKey) missing.push("VITE_FIREBASE_API_KEY");
  if (!env.firebase.authDomain) missing.push("VITE_FIREBASE_AUTH_DOMAIN");
  if (!env.firebase.projectId) missing.push("VITE_FIREBASE_PROJECT_ID");
  if (!env.firebase.appId) missing.push("VITE_FIREBASE_APP_ID");
  
  if (!env.supabase.url) warnings.push("VITE_SUPABASE_URL is not configured.");
  if (!env.supabase.anonKey) warnings.push("VITE_SUPABASE_ANON_KEY is not configured.");

  if (missing.length > 0) {
    console.error(
      `[AI Verse Env Diagnostic] Missing critical environment variables at build-time: ${missing.join(", ")}.\n` +
      `Ensure these VITE_* variables are added in your Cloudflare/Hosting Build Settings.`
    );
  }

  return {
    isValid: missing.length === 0,
    missingVariables: missing,
    warnings,
  };
}

export const envValidation = validateEnvironment();
