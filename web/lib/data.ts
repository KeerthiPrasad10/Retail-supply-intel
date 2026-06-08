import "server-only";

import committedSnapshot from "./snapshot.json";
import type { Snapshot } from "./types";

/**
 * Loads the dashboard read-model.
 *
 * When `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, it
 * reads the latest published row from the Supabase `snapshots` table (populated
 * by `rsi export`). Otherwise — or on any error — it falls back to the snapshot
 * committed in the repo, so the dashboard always renders.
 */
export async function loadSnapshot(): Promise<Snapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/snapshots?select=data&order=created_at.desc&limit=1`,
        {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          // Refresh at most every 5 minutes; the pipeline publishes periodically.
          next: { revalidate: 300 },
        },
      );
      if (res.ok) {
        const rows = (await res.json()) as { data: Snapshot }[];
        if (Array.isArray(rows) && rows[0]?.data) {
          return rows[0].data;
        }
      }
    } catch {
      // fall through to the committed snapshot
    }
  }
  return committedSnapshot as unknown as Snapshot;
}
