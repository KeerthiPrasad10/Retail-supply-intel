"use client";

import { useMemo, useState } from "react";
import type { Go, SupplierMatch, Trend } from "@/lib/types";
import { SUPPLIERS, suppliersFor } from "@/lib/suppliers";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { useCname } from "../model-context";
import { CertChip, FlagCode, MatchRing } from "../primitives";

function SupplierCard({
  s,
  open,
  inList,
  toggle,
}: {
  s: SupplierMatch;
  open: (id: string) => void;
  inList: boolean;
  toggle: (id: string) => void;
}) {
  const cname = useCname();
  return (
    <article className="scard" onClick={() => open(s.id)}>
      <div className="scard-head">
        <MatchRing v={s.match} />
        <div className="scard-id">
          <div className="scard-name">
            {s.name}
            {s.verified && (
              <span className="verified" title="Verified">
                <Icons.check size={10} />
              </span>
            )}
          </div>
          <div className="scard-loc">
            <FlagCode code={s.cc} />
            {cname(s.cc)} · est. {s.est}
            {s.isEmerging && <span className="tag-emerging">EMERGING ORIGIN</span>}
          </div>
        </div>
      </div>
      <p className="scard-note">{s.note}</p>
      <div className="scard-stats">
        <div className="ss">
          <Icons.box size={13} />
          <span className="ss-v">{s.moq}</span>
          <span className="ss-l">min order</span>
        </div>
        <div className="ss">
          <Icons.clock size={13} />
          <span className="ss-v">{s.lead}</span>
          <span className="ss-l">lead time</span>
        </div>
        <div className="ss">
          <Icons.factory size={13} />
          <span className="ss-v">{s.capacity}</span>
          <span className="ss-l">capacity</span>
        </div>
        <div className="ss">
          <span className="ss-idx">{s.price}</span>
          <span className="ss-l">price index</span>
        </div>
      </div>
      <div className="scard-certs">
        {s.certs.map((c) => (
          <CertChip key={c} c={c} />
        ))}
      </div>
      <div className="scard-foot">
        <button
          className={cc("btn", inList ? "secondary" : "inverse", "sm")}
          onClick={(e) => {
            e.stopPropagation();
            toggle(s.id);
          }}
        >
          {inList ? (
            <>
              <Icons.check size={13} />
              Shortlisted
            </>
          ) : (
            <>
              <Icons.bookmark size={13} />
              Add to shortlist
            </>
          )}
        </button>
        <button
          className="link-btn"
          onClick={(e) => {
            e.stopPropagation();
            open(s.id);
          }}
        >
          View profile
          <Icons.arrowRight size={13} />
        </button>
      </div>
    </article>
  );
}

export function Suppliers({
  go,
  contextTrend,
  openSupplier,
  shortlist,
  toggleShort,
}: {
  go: Go;
  contextTrend: Trend | null;
  openSupplier: (id: string) => void;
  shortlist: Set<string>;
  toggleShort: (id: string) => void;
}) {
  const cname = useCname();
  const [originFilter, setOrigin] = useState<string | null>(null);
  const [emergingOnly, setEm] = useState(false);

  const base: SupplierMatch[] = useMemo(
    () =>
      contextTrend
        ? suppliersFor(contextTrend)
        : SUPPLIERS.map((s) => ({ ...s, onTrendOrigin: false, isEmerging: false })).sort(
            (a, b) => b.match - a.match,
          ),
    [contextTrend],
  );

  const origins = useMemo(() => [...new Set(base.map((s) => s.cc))], [base]);
  let list = base;
  if (originFilter) list = list.filter((s) => s.cc === originFilter);
  if (emergingOnly) list = list.filter((s) => s.isEmerging);

  return (
    <div className="content">
      {contextTrend && (
        <button className="back" onClick={() => go("deepdive", contextTrend.id)}>
          <Icons.chevronLeft size={15} />
          Back to {contextTrend.cat}
        </button>
      )}
      <header className="page-head">
        <div>
          <h1 className="page-title">
            Suppliers{contextTrend && <span className="title-ctx"> · {contextTrend.cat}</span>}
          </h1>
          <p className="page-sub">
            {contextTrend ? (
              <>
                Producers who can supply <b>{contextTrend.cat}</b>, matched to the{" "}
                {contextTrend.market === "Global" ? "global" : contextTrend.market} opportunity and
                ranked by fit. Emerging-origin suppliers are flagged.
              </>
            ) : (
              <>
                The full supplier directory across every tracked category. Ranked by match fit;
                filter by origin or shortlist directly.
              </>
            )}
          </p>
        </div>
      </header>

      <div className="callout warn">
        <Icons.alert size={15} />
        <p>
          <b>Illustrative directory.</b> These supplier profiles model the Phase-3
          supplier-resolution layer and are <b>not customs-verified</b>. Demand momentum and
          trade-flow origins are real (Wikipedia + Google Trends · UN Comtrade).
        </p>
      </div>

      <div className="filter-row">
        <span className={cc("pill", !originFilter && "active")} onClick={() => setOrigin(null)}>
          All origins · {base.length}
        </span>
        {origins.map((c) => (
          <span
            key={c}
            className={cc("pill", originFilter === c && "active")}
            onClick={() => setOrigin(c)}
          >
            <FlagCode code={c} />
            {cname(c)} · {base.filter((s) => s.cc === c).length}
          </span>
        ))}
        {contextTrend && (
          <span className={cc("pill", emergingOnly && "active")} onClick={() => setEm(!emergingOnly)}>
            <Icons.spark size={12} />
            Emerging only
          </span>
        )}
        <span className="meta">Sorted by match fit</span>
      </div>

      <div className="sgrid">
        {list.map((s) => (
          <SupplierCard
            key={s.id}
            s={s}
            open={openSupplier}
            inList={shortlist.has(s.id)}
            toggle={toggleShort}
          />
        ))}
        {list.length === 0 && <div className="empty">No suppliers match these filters yet.</div>}
      </div>
    </div>
  );
}
