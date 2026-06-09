/* Adapt the pipeline snapshot (web/lib/snapshot.json) into the dashboard
 * view-model. Demand momentum/growth, trade-flow origins and emerging origins
 * are all real; the opportunity score is a 0..100 rescale of the trigger score
 * and the tier is derived from momentum/growth. */

import type { Model, SignalSource, Snapshot, Source, Tier, Trend, TrendSummary } from "./types";
import { fmtPct } from "./util";

function tierOf(momentum: number, growth: number): Tier {
  if (momentum >= 5) return "SURGING";
  if (growth >= 0.15 || momentum >= 0.4) return "RISING";
  return "WATCH";
}

/** Structured summary — what changed, why, and the sourcing impact. The full
 * numeric breakdown lives in the structured UI, so each line stays one clause. */
function synthSummary(o: {
  cat: string;
  market: string;
  growth: number;
  tier: Tier;
  focusName: string | null;
  focusGrowth: number | null;
  leaderName: string | null;
  leaderShare: number | null;
  leaderFalling: boolean;
  compName: string | null;
}): TrendSummary {
  const mkt = o.market === "Global" ? "all markets" : o.market;
  const verb = o.tier === "SURGING" ? "surging" : o.tier === "RISING" ? "rising" : "holding steady";

  const change = `${o.cat} demand is ${verb} in ${mkt} — ${fmtPct(o.growth)} vs the prior window.`;

  let why: string;
  if (o.focusName) {
    why = `${o.focusName} is gaining import share`;
    if (o.focusGrowth != null) why += ` (${fmtPct(o.focusGrowth)})`;
    why += " as an emerging origin";
    if (o.leaderName && o.leaderShare != null) {
      why += o.leaderFalling
        ? `, while the incumbent ${o.leaderName} (${o.leaderShare}%) is slipping.`
        : `; ${o.leaderName} still leads at ${o.leaderShare}%.`;
    } else why += ".";
  } else {
    why = "Supply is shifting across origin countries for this category.";
  }

  let impact = `Window to source ${o.cat} from ${o.focusName ?? "an emerging origin"} early`;
  impact += o.compName ? ` — ${o.compName} is already sourcing there.` : ", ahead of the demand curve.";

  return { change, why, impact };
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

  const allOpps: Trend[] = snap.triggers
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
      const tier = tierOf(momentum, growth);
      const cat = t.category ?? "—";
      const market = t.market ?? "Global";
      const focusName = t.focus_partner ? (nameByCode[t.focus_partner] ?? t.focus_partner) : null;
      const focusEntry =
        sources.find((s) => s[0] === t.focus_partner) ||
        emerging.find((s) => s[0] === t.focus_partner);
      const compName = p.competitors && p.competitors[0] ? p.competitors[0] : null;
      const leader = sources[0];
      const leaderName = leader ? (nameByCode[leader[0]] ?? leader[0]) : null;
      const leaderShare = leader ? Math.round(leader[1] * 100) : null;
      const leaderFalling = leader ? leader[2] < 0 : false;
      return {
        id: "T-" + (1000 + t.id),
        cat,
        market,
        marketCode: t.market_code,
        momentum,
        growth,
        score: scale(t.score),
        tier,
        focus: t.focus_partner,
        sources,
        emerging,
        competitors: (p.competitors || []).map((name) => ({
          name,
          note: competitorNote(snap, name, t.category_id),
        })),
        summary: synthSummary({
          cat,
          market,
          growth,
          tier,
          focusName,
          focusGrowth: focusEntry ? focusEntry[2] : null,
          leaderName,
          leaderShare,
          leaderFalling,
          compName,
        }),
      };
    })
    .sort((a, b) => b.score - a.score);

  // One opportunity per category — keep the strongest market. Per-market
  // triggers share the same category-level supply data (origins, why, impact),
  // so extra markets render as duplicate cards (e.g. "Coffee" three times).
  // Collapse to the top-scoring market per category.
  const trends: Trend[] = [];
  const seenCat = new Set<string>();
  for (const t of allOpps) {
    if (seenCat.has(t.cat)) continue;
    seenCat.add(t.cat);
    trends.push(t);
  }

  const emSet = new Set<string>();
  trends.forEach((t) => t.emerging.forEach((e) => emSet.add(e[0])));

  const surging = trends.filter((t) => t.tier === "SURGING");
  const top = surging[0];
  const topSurge = top
    ? `${top.cat} · ${top.market === "Global" ? "All markets" : top.market} ${fmtPct(top.growth)}`
    : null;

  const insights = [...(snap.insights ?? [])].sort((a, b) => b.score - a.score);

  const signalSources: SignalSource[] = (snap.signal_sources ?? []).map((s) => ({
    name: s.name,
    label: s.label,
    kind: s.kind,
    isDefault: s.default,
    lastRunAt: s.last_run_at,
    status: s.status,
    rows: s.rows,
  }));

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
    insights,
    procureCount: insights.filter((i) => i.action === "PROCURE").length,
    signalSources,
  };
}
