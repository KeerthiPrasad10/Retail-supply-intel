/* Supply-chain graph builders for the world map (ported from the design). */

import type { Trend } from "./types";

export type LatLon = [number, number];
export type Geo = Record<string, LatLon>;

export interface MapNode {
  code: string;
  geo: LatLon;
  role: "market" | "origin";
  label?: string;
  share?: number;
  growth?: number;
  emerging?: boolean;
  focus?: boolean;
}
export interface MapFlow {
  from: LatLon;
  to: LatLon;
  share: number;
  growth: number;
  emerging: boolean;
  focus: boolean;
}

const EU_ANCHOR: { code: string; geo: LatLon; label: string } = {
  code: "EU",
  geo: [50.5, 9.5],
  label: "Lidl · EU demand",
};

function marketAnchor(trend: Trend, geo: Geo) {
  if (trend.marketCode && geo[trend.marketCode]) {
    return { code: trend.marketCode, geo: geo[trend.marketCode], label: trend.market };
  }
  return EU_ANCHOR;
}

export function buildSupplyChain(trend: Trend, geo: Geo): { nodes: MapNode[]; flows: MapFlow[] } {
  const m = marketAnchor(trend, geo);
  const seen: Record<string, number> = {};
  const origins = [...trend.sources, ...trend.emerging].filter((s) => {
    if (seen[s[0]]) return false;
    seen[s[0]] = 1;
    return true;
  });
  const nodes: MapNode[] = [{ code: m.code, geo: m.geo, role: "market", label: m.label }];
  const flows: MapFlow[] = [];
  origins.forEach((s) => {
    const [code, share, growth, emerging] = s;
    if (!geo[code] || code === m.code) return;
    const isEm = !!emerging || growth > 0.15;
    const focus = code === trend.focus;
    nodes.push({ code, geo: geo[code], role: "origin", share, growth, emerging: isEm, focus });
    flows.push({ from: geo[code], to: m.geo, share, growth, emerging: isEm, focus });
  });
  return { nodes, flows };
}

export function buildAllFlows(trends: Trend[], geo: Geo): { nodes: MapNode[]; flows: MapFlow[] } {
  const originSet: Record<string, MapNode> = {};
  const flows: MapFlow[] = [];
  const seenFlow: Record<string, number> = {};
  trends.forEach((t) => {
    if (!t.focus) return;
    const f = t.sources.find((s) => s[0] === t.focus) || t.emerging.find((s) => s[0] === t.focus);
    if (!f || !geo[t.focus] || t.focus === "EU") return;
    const prev = originSet[t.focus];
    originSet[t.focus] = {
      code: t.focus,
      geo: geo[t.focus],
      role: "origin",
      share: Math.max(prev ? prev.share ?? 0 : 0, f[1]),
      growth: f[2],
      emerging: true,
      focus: false,
    };
    if (!seenFlow[t.focus]) {
      seenFlow[t.focus] = 1;
      flows.push({ from: geo[t.focus], to: EU_ANCHOR.geo, share: f[1], growth: f[2], emerging: true, focus: false });
    }
  });
  const market: MapNode = { ...EU_ANCHOR, role: "market" };
  return { nodes: [market, ...Object.values(originSet)], flows };
}
