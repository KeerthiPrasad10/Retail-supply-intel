"use client";

import type { Go, Trend } from "@/lib/types";
import { suppliersFor } from "@/lib/suppliers";
import { buildSupplyChain } from "@/lib/supplychain";
import { Icons } from "../icons";
import { useCname, useModel } from "../model-context";
import { DemandSpark, FlagCode, GrowthPill, OriginBars, Tier } from "../primitives";
import { WorldMap, MapLegend } from "../world-map";
import { SummaryBlock } from "../summary-block";
import { ScoreBlock } from "./shared";

export function DeepDive({ trend: t, go, showMap }: { trend: Trend; go: Go; showMap: boolean }) {
  const { hsByCat, geo } = useModel();
  const cname = useCname();
  const matches = suppliersFor(t);
  const hs = hsByCat[t.cat];
  const market = t.market === "Global" ? "All markets" : t.market;

  return (
    <div className="content">
      <button className="back" onClick={() => go("trending")}>
        <Icons.chevronLeft size={15} />
        Back to trending
      </button>
      <header className="dd-head">
        <div className="dd-head-l">
          <div className="dd-meta">
            <span className="mono">{t.id}</span>
            <span className="sep">·</span>
            <span>HS {hs ?? "—"}</span>
            <span className="sep">·</span>
            <span>{market}</span>
          </div>
          <h1 className="dd-title">{t.cat}</h1>
          <div className="dd-tags">
            <Tier tier={t.tier} />
            {t.competitors.length > 0 && (
              <span className="comp-flag">
                <Icons.alert size={13} />
                {t.competitors.length} competitor signal{t.competitors.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="dd-head-r">
          <ScoreBlock score={t.score} big />
          <button className="btn primary" onClick={() => go("suppliers", t.id)}>
            <Icons.factory size={14} />
            Find suppliers ({matches.length})
          </button>
        </div>
      </header>

      <div className="callout">
        <Icons.spark size={15} />
        <SummaryBlock summary={t.summary} />
      </div>

      <div className="dd-grid">
        <div className="dd-main">
          <section className="panel">
            <h3 className="panel-h">
              <Icons.pulse size={13} />
              Demand signal
            </h3>
            <div className="demand-big">
              <div className="db-stat">
                <div className="db-num">{t.momentum.toFixed(2)}</div>
                <div className="db-lbl">momentum</div>
              </div>
              <div className="db-stat">
                <GrowthPill g={t.growth} big />
                <div className="db-lbl">vs prior window</div>
              </div>
              <div className="db-spark">
                <DemandSpark growth={t.growth} w={260} h={64} strong={t.tier === "SURGING"} />
              </div>
            </div>
            <p className="db-foot">
              Interest momentum from Google Trends &amp; social feeds, weighted by volume.
              Recent window vs the prior one.
            </p>
          </section>

          <section className="panel">
            <h3 className="panel-h">
              <Icons.box size={13} />
              Origin breakdown <span className="panel-meta">by export value · UN Comtrade</span>
            </h3>
            <OriginBars sources={t.sources} limit={5} focus={t.focus} />
          </section>

          {showMap &&
            (() => {
              const sc = buildSupplyChain(t, geo);
              return (
                <section className="panel">
                  <h3 className="panel-h">
                    <Icons.globe size={13} />
                    Supply chain <span className="panel-meta">origin → {market} · arc weight = share</span>
                  </h3>
                  <WorldMap nodes={sc.nodes} flows={sc.flows} dense={false} />
                  <MapLegend />
                </section>
              );
            })()}
        </div>

        <aside className="dd-rail">
          <section className="panel em-panel">
            <h3 className="panel-h">
              <Icons.spark size={13} />
              Emerging origins <span className="panel-meta">the opportunity</span>
            </h3>
            <ul className="em-list">
              {t.emerging.map(([c, s, g]) => (
                <li key={c} className="em-row" onClick={() => go("suppliers", t.id)}>
                  <FlagCode code={c} />
                  <div className="em-info">
                    <span className="em-name">{cname(c)}</span>
                    <span className="em-share">{(s * 100).toFixed(s < 0.01 ? 2 : 1)}% share</span>
                  </div>
                  <GrowthPill g={g} />
                </li>
              ))}
            </ul>
          </section>

          {t.competitors.length > 0 && (
            <section className="panel comp-panel">
              <h3 className="panel-h">
                <Icons.alert size={13} />
                Competitor intel
              </h3>
              <ul className="comp-list">
                {t.competitors.map((c, i) => (
                  <li key={i}>
                    <span className="comp-name">{c.name}</span>
                    <span className="comp-note">{c.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <h3 className="panel-h">
              <Icons.factory size={13} />
              Matched suppliers <span className="panel-meta">{matches.length} ready</span>
            </h3>
            <div className="mini-suppliers">
              {matches.slice(0, 3).map((s) => (
                <div key={s.id} className="ms-row" onClick={() => go("suppliers", t.id)}>
                  <span className="ms-match">{s.match}</span>
                  <div className="ms-info">
                    <span className="ms-name">
                      {s.name}
                      {s.verified && <Icons.check size={11} style={{ color: "var(--nxb-status-low)" }} />}
                    </span>
                    <span className="ms-meta">
                      <FlagCode code={s.cc} />
                      {cname(s.cc)} · {s.lead} lead
                    </span>
                  </div>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="db-foot" style={{ margin: 0 }}>
                  No directory suppliers mapped to this category yet.
                </p>
              )}
            </div>
            {matches.length > 0 && (
              <button className="btn block" onClick={() => go("suppliers", t.id)}>
                View all {matches.length} suppliers
                <Icons.arrowRight size={14} />
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
