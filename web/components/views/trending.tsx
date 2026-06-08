"use client";

import type { Go, Tier as TierT } from "@/lib/types";
import { suppliersFor } from "@/lib/suppliers";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { useCname, useModel } from "../model-context";
import { DemandSpark, FlagCode, GrowthPill, Tier } from "../primitives";
import { TrendCard } from "./shared";

type Layout = "cards" | "table" | "compact";
type FilterTier = "All" | TierT;

export function Trending({
  go,
  layout,
  setLayout,
  filterTier,
  setFilterTier,
}: {
  go: Go;
  layout: Layout;
  setLayout: (l: Layout) => void;
  filterTier: FilterTier;
  setFilterTier: (t: FilterTier) => void;
}) {
  const { trends } = useModel();
  const cname = useCname();
  const tiers: FilterTier[] = ["All", "SURGING", "RISING", "WATCH"];
  const layouts: Layout[] = ["cards", "table", "compact"];
  const count = (x: FilterTier) => (x === "All" ? trends.length : trends.filter((t) => t.tier === x).length);
  const list = trends.filter((t) => filterTier === "All" || t.tier === filterTier);

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Trending</h1>
          <p className="page-sub">
            Ranked demand×supply opportunities. A high score means demand is accelerating in a market
            while a new origin is gaining share for that category.
          </p>
        </div>
        <div className="filter-row">
          {layouts.map((l) => (
            <span
              key={l}
              className={cc("pill", layout === l && "active")}
              onClick={() => setLayout(l)}
            >
              {l[0].toUpperCase() + l.slice(1)}
            </span>
          ))}
        </div>
      </header>
      <div className="filter-row">
        {tiers.map((x) => (
          <span
            key={x}
            className={cc("pill", filterTier === x && "active")}
            onClick={() => setFilterTier(x)}
          >
            {x === "All" ? "All" : x[0] + x.slice(1).toLowerCase()} · {count(x)}
          </span>
        ))}
        <span className="meta">Sorted by opportunity score</span>
      </div>

      {layout === "cards" && (
        <div className="tlist">
          {list.map((t) => (
            <TrendCard key={t.id} t={t} go={go} matches={suppliersFor(t).length} />
          ))}
        </div>
      )}

      {layout === "table" && (
        <div className="tablewrap">
          <table className="dtable">
            <thead>
              <tr>
                <th className="r">Score</th>
                <th>Product</th>
                <th>Market</th>
                <th className="r">Demand</th>
                <th>Top emerging origin</th>
                <th className="r">Suppliers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const em = t.emerging[0];
                return (
                  <tr key={t.id} onClick={() => go("deepdive", t.id)}>
                    <td className="r">
                      <span className="sc-num">{t.score}</span>
                    </td>
                    <td>
                      <div className="td-prod">
                        <span className="td-cat">{t.cat}</span>
                        <Tier tier={t.tier} />
                      </div>
                    </td>
                    <td className="muted">{t.market === "Global" ? "All markets" : t.market}</td>
                    <td className="r">
                      <GrowthPill g={t.growth} />
                    </td>
                    <td>
                      {em && (
                        <span className="td-em">
                          <FlagCode code={em[0]} />
                          {cname(em[0])}
                          <GrowthPill g={em[2]} />
                        </span>
                      )}
                    </td>
                    <td className="r mono">{suppliersFor(t).length}</td>
                    <td className="r">
                      <Icons.chevronLeft size={15} style={{ transform: "rotate(180deg)", opacity: 0.4 }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {layout === "compact" && (
        <div className="clist">
          {list.map((t) => {
            const em = t.emerging[0];
            return (
              <div key={t.id} className="crow" onClick={() => go("deepdive", t.id)}>
                <span className="c-score">{t.score}</span>
                <span className="c-spark">
                  <DemandSpark growth={t.growth} w={64} h={26} />
                </span>
                <div className="c-main">
                  <div className="c-title">
                    {t.cat} <span className="c-mk">· {t.market === "Global" ? "All markets" : t.market}</span>
                  </div>
                  <div className="c-meta">
                    <Tier tier={t.tier} />
                    {em && (
                      <span className="c-em">
                        <FlagCode code={em[0]} />
                        {cname(em[0])} emerging
                      </span>
                    )}
                  </div>
                </div>
                <GrowthPill g={t.growth} big />
                <button
                  className="link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    go("suppliers", t.id);
                  }}
                >
                  {suppliersFor(t).length} suppliers
                  <Icons.arrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { Layout, FilterTier };
