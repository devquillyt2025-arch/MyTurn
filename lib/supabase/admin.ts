import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses Row Level Security, so it must ONLY
 * ever be imported from server-side code (Server Components, Route Handlers).
 * Never import this from a file with 'use client'.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
