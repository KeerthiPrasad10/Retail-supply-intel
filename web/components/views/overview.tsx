"use client";

import { useMemo, type ReactNode } from "react";
import type { Go } from "@/lib/types";
import { SUPPLIERS, suppliersFor } from "@/lib/suppliers";
import { fmtPct } from "@/lib/util";
import { Icons } from "../icons";
import { useCname, useModel } from "../model-context";
import { FlagCode, GrowthPill } from "../primitives";
import { StatTile, TrendCard } from "./shared";

export function Overview({ go }: { go: Go }) {
  const { trends, surgingCount, topSurge, emergingOriginCount } = useModel();
  const cname = useCname();
  const top = trends.slice(0, 3);

  const emRank = useMemo(() => {
    const m: Record<string, { c: string; g: number; cat: string }> = {};
    trends.forEach((t) =>
      t.emerging.forEach(([c, , g]) => {
        if (!m[c] || g > m[c].g) m[c] = { c, g, cat: t.cat };
      }),
    );
    return Object.values(m).sort((a, b) => b.g - a.g).slice(0, 6);
  }, [trends]);

  const feed = useMemo(() => {
    const items: { dot: string; node: ReactNode; t: string }[] = [];
    const surge = trends.find((t) => t.tier === "SURGING");
    if (surge) {
      items.push({
        dot: "high",
        t: "3m",
        node: (
          <span>
            <b>
              {surge.cat} · {surge.market === "Global" ? "All markets" : surge.market}
            </b>{" "}
            momentum hit {surge.momentum.toFixed(1)} — a {fmtPct(surge.growth)} jump week-on-week.
          </span>
        ),
      });
    }
    if (emRank[0])
      items.push({
        dot: "low",
        t: "2h",
        node: (
          <span>
            <b>{cname(emRank[0].c)}</b> {emRank[0].cat.toLowerCase()} exports up{" "}
            {fmtPct(emRank[0].g)}; now an emerging origin.
          </span>
        ),
      });
    if (emRank[1])
      items.push({
        dot: "ok",
        t: "5h",
        node: (
          <span>
            <b>{cname(emRank[1].c)}</b> {emRank[1].cat.toLowerCase()} share climbing as a near-shore
            alternative.
          </span>
        ),
      });
    const comp = trends.find((t) => t.competitors.length > 0);
    if (comp)
      items.push({
        dot: "high",
        t: "1d",
        node: (
          <span>
            <b>{comp.competitors[0].name}</b> {comp.competitors[0].note} — {comp.cat}.
          </span>
        ),
      });
    return items;
  }, [trends, emRank, cname]);

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Sourcing intelligence</h1>
          <p className="page-sub">
            Where rising consumer demand meets the supply chain. Each opportunity pairs an
            accelerating trend with the origins it&apos;s sourced from — surfacing emerging suppliers
            before competitors lock them in.
          </p>
        </div>
        <button className="btn primary" onClick={() => go("trending")}>
          View all trending
          <Icons.arrowRight size={14} />
        </button>
      </header>

      <div className="stat-row">
        <StatTile value={trends.length} label="Active opportunities" sub="across tracked categories" />
        <StatTile value={surgingCount} label="Surging now" sub={topSurge ?? "—"} accent />
        <StatTile value={emergingOriginCount} label="Emerging origins" sub="gaining share" />
        <StatTile value={SUPPLIERS.length} label="Suppliers matched" sub="ready to engage" />
      </div>

      <div className="ov-grid">
        <section>
          <div className="sec-head">
            <h2 className="sec-title">Top opportunities this week</h2>
            <button className="link-btn" onClick={() => go("trending")}>
              All {trends.length} <Icons.arrowRight size={13} />
            </button>
          </div>
          <div className="tlist">
            {top.map((t) => (
              <TrendCard key={t.id} t={t} go={go} matches={suppliersFor(t).length} />
            ))}
          </div>
        </section>
        <aside className="ov-rail">
          <div className="panel">
            <h3 className="panel-h">
              <Icons.spark size={13} />
              Emerging origins leaderboard
            </h3>
            <ul className="lead">
              {emRank.map((e, i) => (
                <li key={e.c} className="lead-row">
                  <span className="lead-rank">{i + 1}</span>
                  <span className="lead-flag">
                    <FlagCode code={e.c} />
                  </span>
                  <span className="lead-name">
                    {cname(e.c)}
                    <span className="lead-cat">{e.cat}</span>
                  </span>
                  <GrowthPill g={e.g} />
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3 className="panel-h">
              <Icons.bell size={13} />
              Signal feed
            </h3>
            <ul className="feed">
              {feed.map((f, i) => (
                <li key={i}>
                  <span className={`feed-dot ${f.dot}`} />
                  {f.node}
                  <span className="feed-t">{f.t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
