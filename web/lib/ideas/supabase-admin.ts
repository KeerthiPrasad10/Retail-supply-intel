import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key — for trusted writes
 * from the "Validate" API routes (creating ideas, fanning research out into the
 * shared RSI tables). It bypasses RLS, so it must never be imported into a
 * client component.
 *
 * Env (server-side only; never NEXT_PUBLIC):
 *   SUPABASE_URL                 (falls back to NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY    required for live writes
 *
 * With either unset, supabaseAdminEnabled() is false and callers fall back to
 * the in-memory store in lib/ideas/store.ts — so build and runtime work without
 * a database (this runs on serverless; never write files to disk).
 */

let client: SupabaseClient | null = null;

function url(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function supabaseAdminEnabled(): boolean {
  return Boolean(url() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdminEnabled()) return null;
  if (!client) {
    client = createClient(url()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
