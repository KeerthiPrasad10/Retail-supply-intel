"use client";

import { useMemo } from "react";
import type { LatLon, MapFlow, MapNode } from "@/lib/supplychain";
import { cc } from "@/lib/util";

/* procedural dotted land (equirectangular) */
const LAND_BOXES: [number, number, number, number][] = [
  [-130, -95, 32, 60], [-122, -80, 49, 70], [-168, -140, 55, 71], [-95, -66, 30, 49], [-110, -90, 15, 32],
  [-92, -78, 8, 18], [-50, -22, 60, 82], [-78, -50, -5, 11], [-72, -40, -23, -5], [-72, -54, -40, -23], [-73, -65, -52, -40],
  [-9, 15, 43, 55], [-7, 1, 50, 58], [6, 28, 56, 70], [12, 45, 40, 60], [-9, 3, 36, 43], [8, 18, 38, 46], [26, 45, 36, 42],
  [-16, 32, 18, 35], [-16, 18, 5, 20], [10, 42, -10, 12], [12, 38, -34, -10], [38, 52, 2, 14], [44, 50, -25, -12],
  [34, 60, 14, 40], [30, 90, 52, 70], [90, 180, 52, 73], [50, 80, 38, 52], [78, 125, 22, 50], [69, 89, 8, 30],
  [96, 108, 8, 23], [98, 120, -2, 20], [96, 141, -10, 6], [129, 146, 31, 45], [125, 131, 34, 43], [120, 127, 6, 19],
  [114, 154, -39, -11], [166, 179, -47, -34],
];
const isLand = (lon: number, lat: number) =>
  LAND_BOXES.some(([a, b, c, d]) => lon >= a && lon <= b && lat >= c && lat <= d);

export function WorldMap({
  nodes,
  flows,
  dense = true,
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

  const dots = useMemo(() => {
    const step = dense ? 9 : 12;
    const arr: [number, number][] = [];
    for (let x = step / 2; x < W; x += step) {
      const lon = (x / W) * 360 - 180;
      for (let y = step / 2; y < H; y += step) {
        const lat = 90 - (y / H) * 180;
        if (isLand(lon, lat)) arr.push([x, y]);
      }
    }
    return arr;
  }, [dense]);

  const maxShare = Math.max(...(flows.length ? flows.map((f) => f.share) : [0.1]), 0.05);

  const arcPath = (from: LatLon, to: LatLon) => {
    const x1 = px(from[1]);
    const y1 = py(from[0]);
    const x2 = px(to[1]);
    const y2 = py(to[0]);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const lift = Math.min(0.42, 0.18 + (dist / W) * 0.3);
    const cx = mx - dy * lift;
    const cy = my + dx * lift - dist * 0.12;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const arcClass = (f: MapFlow) => (f.focus ? "focus" : f.emerging ? "em" : f.growth < 0 ? "dim" : "neu");

  return (
    <div className="worldmap" style={{ aspectRatio: "720 / 330" }}>
      <svg viewBox={`0 18 ${W} 330`} preserveAspectRatio="xMidYMid meet" className="wm-svg">
        <g className="wm-land">
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.05" />
          ))}
        </g>
        <g className="wm-arcs">
          {flows.map((f, i) => {
            const w = 1 + (f.share / maxShare) * 5;
            const cls = arcClass(f);
            const d = arcPath(f.from, f.to);
            return (
              <g key={i} className={cc("arc", cls)}>
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
                  <rect x={x - s} y={y - s} width={s * 2} height={s * 2} className="mk-sq" />
                  <rect x={x - s - 3} y={y - s - 3} width={s * 2 + 6} height={s * 2 + 6} className="mk-ring" />
                  <text x={x} y={y - s - 7} className="mk-lbl">
                    {n.label}
                  </text>
                </g>
              );
            }
            const r = 3 + ((n.share || 0.05) / maxShare) * 6;
            const cls = n.focus ? "focus" : n.emerging ? "em" : (n.growth ?? 0) < 0 ? "dim" : "neu";
            return (
              <g key={i} className={cc("node origin", cls)}>
                <circle cx={x} cy={y} r={r + 4} className="nd-halo" />
                <circle cx={x} cy={y} r={Math.max(2.4, r * 0.55)} className="nd-dot" />
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
