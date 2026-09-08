// Supabase is completely deprecated in favor of MongoDB Atlas + JWT Authentication.
// This file provides safe stub types and objects to prevent breakage during migration.

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase Auth is replaced by MongoDB JWT') }),
    signUp: async () => ({ data: { user: null }, error: new Error('Supabase Auth is replaced by MongoDB JWT') }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }),
      order: () => Promise.resolve({ data: [], error: null }),
    }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    upsert: () => Promise.resolve({ error: null }),
  }),
  rpc: async () => ({ data: null, error: null }),
} as any;

export const supabaseAdmin = null;
