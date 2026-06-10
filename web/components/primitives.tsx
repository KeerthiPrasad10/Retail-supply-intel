"use client";

import { useRef } from "react";
import type { Source, Tier as TierT } from "@/lib/types";
import { cc, fmtPct } from "@/lib/util";
import { useCname } from "./model-context";

export function Tier({ tier }: { tier: TierT }) {
  const map: Record<TierT, string> = { SURGING: "high", RISING: "low", WATCH: "ok" };
  return (
    <span className={cc("badge", map[tier])}>
      <span className="dot" />
      {tier}
    </span>
  );
}

export function GrowthPill({ g, mono = true, big = false }: { g: number; mono?: boolean; big?: boolean }) {
  const pos = g >= 0;
  return (
    <span
      className={cc("growth", pos ? "up" : "down", big && "big")}
      style={mono ? undefined : { fontFamily: "var(--font-sans)" }}
    >
      <svg
        width={big ? 13 : 11}
        height={big ? 13 : 11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pos ? <path d="M5 17 12 10l4 4 5-5M16 7h5v5" /> : <path d="M5 7l7 7 4-4 5 5M16 17h5v-5" />}
      </svg>
      {fmtPct(g)}
    </span>
  );
}

export function FlagCode({ code }: { code: string }) {
  return <span className="flagcode">{code}</span>;
}

export function CertChip({ c }: { c: string }) {
  return <span className="cert">{c}</span>;
}

export function OriginBars({ sources, limit = 5, focus }: { sources: Source[]; limit?: number; focus?: string | null }) {
  const cname = useCname();
  const top = sources.slice(0, limit);
  return (
    <ul className="obars">
      {top.map((s) => {
        const [code, share, growth, emerging] = s;
        const isFocus = code === focus;
        return (
          <li key={code} className={cc("obar", !!emerging && "is-emerging")}>
            <div className="obar-head">
              <span className="obar-name">
                <FlagCode code={code} />
                <span>{cname(code)}</span>
                {emerging ? <span className="tag-emerging">EMERGING</span> : null}
              </span>
              <span className="obar-vals">
                <span className="obar-share">{Math.round(share * 100)}%</span>
                <GrowthPill g={growth} />
              </span>
            </div>
            <div className="track">
              <div
                className={cc("fill", !!emerging && "fill-em", isFocus && "fill-focus")}
                style={{ width: Math.min(100, Math.max(0, share * 100)) + "%" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DemandSpark({
  growth,
  w = 132,
  h = 38,
  strong,
}: {
  growth: number;
  w?: number;
  h?: number;
  strong?: boolean;
}) {
  const pts = useRef<number[] | null>(null);
  if (!pts.current) {
    const n = 16;
    const slope = Math.max(-0.5, Math.min(1.4, growth));
    const arr: number[] = [];
    let seed = Math.round((growth + 2) * 9973) % 1000;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < n; i++) {
      const base = 0.32 + (i / (n - 1)) * slope * 0.55;
      arr.push(Math.max(0.05, Math.min(0.98, base + (rnd() - 0.5) * 0.14)));
    }
    pts.current = arr;
  }
  const arr = pts.current;
  const n = arr.length;
  const X = (i: number) => (i / (n - 1)) * w;
  const Y = (v: number) => h - v * h;
  const d = arr.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  const col = growth >= 0 ? "var(--nxb-status-low)" : "var(--nxb-status-high)";
  const gid = "g" + Math.round(growth * 1000);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity={strong ? 0.22 : 0.14} />
          <stop offset="1" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={col} strokeWidth={strong ? 2 : 1.5} />
      <circle cx={w} cy={Y(arr[n - 1])} r={strong ? 3 : 2.4} fill={col} />
    </svg>
  );
}

export function MatchRing({ v, size = 40 }: { v: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const col =
    v >= 90 ? "var(--nxb-status-low)" : v >= 80 ? "var(--nxb-status-ok)" : "var(--nxb-text-muted)";
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nxb-border-medium)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - v / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-num" style={{ color: col }}>
        {v}
      </span>
    </div>
  );
}
