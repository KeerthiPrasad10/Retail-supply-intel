import "server-only";

import snapshotJson from "./snapshot.json";
import type { Country, Snapshot, SourceEntry, Trigger } from "./types";

/**
 * Data access for the dashboard.
 *
 * The committed snapshot (written by `rsi export`) is the MVP source of truth,
 * so the app renders real data with zero setup. When Supabase is wired (Phase
 * 2), these functions gain a live-query branch behind `NEXT_PUBLIC_SUPABASE_URL`
 * without changing any component.
 */
const snapshot = snapshotJson as unknown as Snapshot;

export async function getSnapshot(): Promise<Snapshot> {
  return snapshot;
}

export async function getTriggers(): Promise<Trigger[]> {
  return [...snapshot.triggers].sort((a, b) => b.score - a.score);
}

export async function getTrends() {
  return [...snapshot.trends].sort((a, b) => b.momentum - a.momentum);
}

export async function getCategorySources(categoryId: number): Promise<SourceEntry[]> {
  return snapshot.sources[String(categoryId)] ?? [];
}

export function countryName(snap: Snapshot, code: string | null): string {
  if (!code) return "Global";
  return snap.countries.find((c) => c.code === code)?.name ?? code;
}

export function countriesByCode(snap: Snapshot): Map<string, Country> {
  return new Map(snap.countries.map((c) => [c.code, c]));
}
