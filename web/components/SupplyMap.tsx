"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
} from "react-simple-maps";
import worldTopo from "@/lib/world-110m.json";
import { geoIdToAlpha2 } from "@/lib/geo";
import type { Country, Flow } from "@/lib/types";
import { compactUsd } from "@/lib/format";

const PANEL = "#0f172a";
const EDGE = "#1e293b";
const ACCENT = "#38bdf8";

export function SupplyMap({
  flows,
  countries,
  categories,
}: {
  flows: Flow[];
  countries: Country[];
  categories: { id: number; name: string }[];
}) {
  const [categoryId, setCategoryId] = useState<number | "all">("all");

  const coords = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const c of countries) {
      if (c.lon != null && c.lat != null) m.set(c.code, [c.lon, c.lat]);
    }
    return m;
  }, [countries]);

  const filtered = useMemo(
    () => (categoryId === "all" ? flows : flows.filter((f) => f.category_id === categoryId)),
    [flows, categoryId],
  );

  const { originTotals, maxOrigin, marketCodes, topFlows } = useMemo(() => {
    const totals = new Map<string, number>();
    const markets = new Set<string>();
    for (const f of filtered) {
      totals.set(f.origin_code, (totals.get(f.origin_code) ?? 0) + f.value);
      markets.add(f.market_code);
    }
    const top = [...filtered].sort((a, b) => b.value - a.value).slice(0, 80);
    return {
      originTotals: totals,
      maxOrigin: Math.max(1, ...totals.values()),
      marketCodes: markets,
      topFlows: top,
    };
  }, [filtered]);

  const originFill = (value: number) => {
    const t = Math.log1p(value) / Math.log1p(maxOrigin);
    return `rgba(56, 189, 248, ${(0.18 + 0.72 * t).toFixed(3)})`;
  };
  const maxFlow = Math.max(1, ...topFlows.map((f) => f.value));

  return (
    <div className="rounded-xl border border-edge bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge p-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Asia → buyer-market sourcing flows</h2>
          <p className="text-xs text-gray-500">
            Import value by Asian origin, latest period · source: UN Comtrade
          </p>
        </div>
        <select
          value={categoryId}
          onChange={(e) =>
            setCategoryId(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          className="rounded-lg border border-edge bg-ink px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 185, center: [70, 25] }}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={worldTopo}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const a2 = geoIdToAlpha2(geo.id);
              const originVal = a2 ? originTotals.get(a2) : undefined;
              const isMarket = a2 ? marketCodes.has(a2) : false;
              const fill = originVal ? originFill(originVal) : PANEL;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={isMarket ? ACCENT : EDGE}
                  strokeWidth={isMarket ? 0.8 : 0.4}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: originVal ? fill : "#172033" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {topFlows.map((f, i) => {
          const from = coords.get(f.origin_code);
          const to = coords.get(f.market_code);
          if (!from || !to) return null;
          return (
            <Line
              key={`${f.origin_code}-${f.market_code}-${f.category_id}-${i}`}
              from={from}
              to={to}
              stroke={f.emerging ? "#34d399" : ACCENT}
              strokeWidth={0.4 + 2.6 * (f.value / maxFlow)}
              strokeLinecap="round"
              opacity={0.55}
            />
          );
        })}

        {[...originTotals.entries()].map(([code, value]) => {
          const pt = coords.get(code);
          if (!pt) return null;
          return (
            <Marker key={code} coordinates={pt}>
              <circle r={2.5} fill={ACCENT} stroke="#0b1120" strokeWidth={0.5} />
              <title>{`${code}: ${compactUsd(value)}`}</title>
            </Marker>
          );
        })}
      </ComposableMap>

      <div className="flex flex-wrap items-center gap-4 border-t border-edge p-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded" style={{ background: ACCENT }} /> origin intensity / flow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded" style={{ background: "#34d399" }} /> emerging flow (≥15% growth)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded border" style={{ borderColor: ACCENT }} /> buyer market
        </span>
      </div>
    </div>
  );
}
