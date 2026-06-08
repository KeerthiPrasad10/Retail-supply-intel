"use client";

import type { LatLon, MapFlow, MapNode } from "@/lib/supplychain";
import { cc } from "@/lib/util";
import { WORLD_PATHS } from "@/lib/worldgeo";

export function WorldMap({
  nodes,
  flows,
  animate = true,
}: {
  nodes: MapNode[];
  flows: MapFlow[];
  dense?: boolean;
  animate?: boolean;
}) {
  const W = 720;
  const H = 360;
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;

  const maxShare = Math.max(...(flows.length ? flows.map((f) => f.share) : [0.1]), 0.05);

  // Quadratic arc with a guaranteed perpendicular bow so even short
  // (intra-Europe) flows stay legible instead of collapsing onto each other.
  const arcPath = (from: LatLon, to: LatLon) => {
    const x1 = px(from[1]);
    const y1 = py(from[0]);
    const x2 = px(to[1]);
    const y2 = py(to[0]);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const mag = Math.max(16, dist * 0.26);
    const cx = mx + nx * mag;
    const cy = my + ny * mag - dist * 0.1;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const arcClass = (f: MapFlow) => (f.focus ? "focus" : f.emerging ? "em" : f.growth < 0 ? "dim" : "neu");

  return (
    <div className="worldmap" style={{ aspectRatio: "720 / 300" }}>
      <svg viewBox={`0 30 ${W} 300`} preserveAspectRatio="xMidYMid meet" className="wm-svg">
        <g className="wm-geo">
          {WORLD_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g className="wm-arcs">
          {flows.map((f, i) => {
            const w = 1.2 + (f.share / maxShare) * 5;
            const cls = arcClass(f);
            const d = arcPath(f.from, f.to);
            return (
              <g key={i} className={cc("arc", cls)}>
                <path d={d} strokeWidth={w + 3} className="arc-halo" />
                <path d={d} strokeWidth={w} className="arc-base" />
                {animate && (cls === "focus" || cls === "em") && (
                  <path d={d} strokeWidth={w} className="arc-flow" />
                )}
              </g>
            );
          })}
        </g>
        <g className="wm-nodes">
          {nodes.map((n, i) => {
            const x = px(n.geo[1]);
            const y = py(n.geo[0]);
            if (n.role === "market") {
              const s = 7;
              return (
                <g key={i} className="node market">
                  <rect x={x - s} y={y - s} width={s * 2} height={s * 2} className="mk-sq" rx="2" />
                  <rect x={x - s - 3} y={y - s - 3} width={s * 2 + 6} height={s * 2 + 6} className="mk-ring" rx="3" />
                  <text x={x} y={y - s - 7} className="mk-lbl">
                    {n.label}
                  </text>
                </g>
              );
            }
            const r = 3.5 + ((n.share || 0.05) / maxShare) * 6;
            const cls = n.focus ? "focus" : n.emerging ? "em" : (n.growth ?? 0) < 0 ? "dim" : "neu";
            return (
              <g key={i} className={cc("node origin", cls)}>
                <circle cx={x} cy={y} r={r + 4} className="nd-halo" />
                <circle cx={x} cy={y} r={Math.max(2.6, r * 0.55)} className="nd-dot" />
                <text x={x} y={y - r - 5} className="nd-lbl">
                  {n.code}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="map-legend">
      <span className="lg">
        <i className="sw focus" />
        Focus origin
      </span>
      <span className="lg">
        <i className="sw em" />
        Emerging · gaining share
      </span>
      <span className="lg">
        <i className="sw dim" />
        Declining share
      </span>
      <span className="lg">
        <i className="sw mk" />
        Demand market
      </span>
    </div>
  );
}
