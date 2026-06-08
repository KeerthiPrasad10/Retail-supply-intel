/* Adapt the pipeline snapshot (web/lib/snapshot.json) into the dashboard
 * view-model. Demand momentum/growth, trade-flow origins and emerging origins
 * are all real; the opportunity score is a 0..100 rescale of the trigger score
 * and the tier is derived from momentum/growth. */

import type { Model, Snapshot, Source, Tier, Trend } from "./types";
import { fmtPct } from "./util";

function tierOf(momentum: number, growth: number): Tier {
  if (momentum >= 5) return "SURGING";
  if (growth >= 0.15 || momentum >= 0.4) return "RISING";
  return "WATCH";
}

function competitorNote(snap: Snapshot, name: string, categoryId: number | null): string {
  const comp = snap.competitors?.find((c) => c.name === name);
  const src = comp?.sourcing?.find((s) => s.category_id === categoryId && s.partner);
  if (src?.partner) return `already sourcing this category from ${src.partner}`;
  return "active in this category";
}

export function buildModel(snap: Snapshot): Model {
  const nameByCode: Record<string, string> = {};
  const geo: Record<string, [number, number]> = {};
  const regionByCode: Record<string, string> = {};
  for (const c of snap.countries) {
    nameByCode[c.code] = c.name;
    if (typeof c.lat === "number" && typeof c.lon === "number") geo[c.code] = [c.lat, c.lon];
    if (c.region) regionByCode[c.code] = c.region;
  }

  const hsByCat: Record<string, string> = {};
  for (const cat of snap.categories) if (cat.hs_code) hsByCat[cat.name] = cat.hs_code;

  const rawScores = snap.triggers.map((t) => t.score);
  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  const scale = (v: number) => (max === min ? 80 : Math.round(34 + ((v - min) / (max - min)) * 62));

  const trends: Trend[] = snap.triggers
    .map((t): Trend => {
      const p = t.payload || {};
      const sources: Source[] = (p.top_sources || []).map((s): Source =>
        s.emerging ? [s.partner_code, s.share, s.growth, 1] : [s.partner_code, s.share, s.growth],
      );
      const emerging: Source[] = (p.emerging_suppliers || []).map(
        (s): Source => [s.partner_code, s.share, s.growth],
      );
      const momentum = p.demand_momentum ?? 0;
      const growth = p.demand_growth ?? 0;
      return {
        id: "T-" + (1000 + t.id),
        cat: t.category ?? "—",
        market: t.market ?? "Global",
        marketCode: t.market_code,
        momentum,
        growth,
        score: scale(t.score),
        tier: tierOf(momentum, growth),
        focus: t.focus_partner,
        sources,
        emerging,
        competitors: (p.competitors || []).map((name) => ({
          name,
          note: competitorNote(snap, name, t.category_id),
        })),
        why: t.rationale ?? "",
      };
    })
    .sort((a, b) => b.score - a.score);

  const emSet = new Set<string>();
  trends.forEach((t) => t.emerging.forEach((e) => emSet.add(e[0])));

  const surging = trends.filter((t) => t.tier === "SURGING");
  const top = surging[0];
  const topSurge = top
    ? `${top.cat} · ${top.market === "Global" ? "All markets" : top.market} ${fmtPct(top.growth)}`
    : null;

  const snapshotLabel = (() => {
    const d = new Date(snap.generated_at);
    return isNaN(d.getTime())
      ? snap.generated_at
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  })();

  return {
    generatedAt: snap.generated_at,
    snapshotLabel,
    trends,
    nameByCode,
    geo,
    regionByCode,
    hsByCat,
    emergingOriginCount: emSet.size,
    surgingCount: surging.length,
    topSurge,
  };
}
