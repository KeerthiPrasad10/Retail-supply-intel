"use client";

import type { Go } from "@/lib/types";
import { buildAllFlows, buildSupplyChain } from "@/lib/supplychain";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { useCname, useModel } from "../model-context";
import { FlagCode, GrowthPill } from "../primitives";
import { WorldMap, MapLegend } from "../world-map";

export function MapView({
  go,
  selId,
  setSel,
}: {
  go: Go;
  selId: string | null;
  setSel: (id: string | null) => void;
}) {
  const { trends, geo } = useModel();
  const cname = useCname();
  const trend = trends.find((t) => t.id === selId) ?? null;
  const { nodes, flows } = trend ? buildSupplyChain(trend, geo) : buildAllFlows(trends, geo);

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">
            Supply-chain map{trend && <span className="title-ctx"> · {trend.cat}</span>}
          </h1>
          <p className="page-sub">
            {!trend ? (
              <>
                Every live opportunity, drawn as a flow from its <b>emerging origin</b> to the market
                where demand is rising. Pick one to trace its full supply chain.
              </>
            ) : (
              <>
                Where <b>{trend.cat}</b> is sourced from and the{" "}
                {trend.market === "Global" ? "EU" : trend.market} market it feeds. Arc weight = share
                of import value; green = emerging origins gaining share.
              </>
            )}
          </p>
        </div>
        {trend && (
          <button className="btn primary" onClick={() => go("suppliers", trend.id)}>
            <Icons.factory size={14} />
            Find suppliers
          </button>
        )}
      </header>

      <div className="map-grid">
        <section className="panel map-panel">
          <div className="map-head">
            <div className="filter-row" style={{ flex: 1 }}>
              <span className={cc("pill", !trend && "active")} onClick={() => setSel(null)}>
                <Icons.globe size={12} />
                All flows · {trends.length}
              </span>
              {trend && (
                <span className="pill active">
                  {trend.cat} · {trend.market === "Global" ? "All markets" : trend.market}
                  <span
                    className="x"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSel(null);
                    }}
                  >
                    ×
                  </span>
                </span>
              )}
            </div>
          </div>
          <WorldMap nodes={nodes} flows={flows} />
          <MapLegend />
        </section>

        <aside className="map-rail">
          <div className="panel">
            <h3 className="panel-h">
              <Icons.trending size={13} />
              Opportunities <span className="panel-meta">tap to trace</span>
            </h3>
            <ul className="map-opps">
              {trends.map((t) => {
                const em = t.emerging[0];
                return (
                  <li
                    key={t.id}
                    className={cc("mo-row", selId === t.id && "sel")}
                    onClick={() => setSel(t.id)}
                  >
                    <span className="mo-score">{t.score}</span>
                    <div className="mo-info">
                      <span className="mo-cat">{t.cat}</span>
                      <span className="mo-meta">
                        {em && <FlagCode code={em[0]} />}
                        {em ? cname(em[0]) : "—"} → {t.market === "Global" ? "EU" : t.market}
                      </span>
                    </div>
                    {em && <GrowthPill g={em[2]} />}
                  </li>
                );
              })}
            </ul>
          </div>
          {trend && (
            <div className="panel em-panel">
              <h3 className="panel-h">
                <Icons.spark size={13} />
                Emerging origins
              </h3>
              <ul className="em-list">
                {trend.emerging.map(([c, s, g]) => (
                  <li key={c} className="em-row" onClick={() => go("suppliers", trend.id)}>
                    <FlagCode code={c} />
                    <div className="em-info">
                      <span className="em-name">{cname(c)}</span>
                      <span className="em-share">{(s * 100).toFixed(s < 0.01 ? 2 : 1)}% share</span>
                    </div>
                    <GrowthPill g={g} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
