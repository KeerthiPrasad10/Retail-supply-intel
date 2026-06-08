import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional Supabase client. Returns null until the project is provisioned and
 * `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, at which
 * point `lib/data.ts` can switch from the snapshot to live queries.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
