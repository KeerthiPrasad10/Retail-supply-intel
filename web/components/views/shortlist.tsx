"use client";

import type { Go } from "@/lib/types";
import { SUPPLIERS } from "@/lib/suppliers";
import { Icons } from "../icons";
import { useCname } from "../model-context";
import { CertChip, FlagCode, MatchRing } from "../primitives";

export function Shortlist({
  go,
  shortlist,
  toggleShort,
  openSupplier,
  requestQuote,
}: {
  go: Go;
  shortlist: Set<string>;
  toggleShort: (id: string) => void;
  openSupplier: (id: string) => void;
  requestQuote: (ids: string[]) => void;
}) {
  const cname = useCname();
  const items = SUPPLIERS.filter((s) => shortlist.has(s.id));
  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Shortlist</h1>
          <p className="page-sub">
            Suppliers you&apos;re considering across opportunities. Request quotes from the whole list
            in one go, or open any to review.
          </p>
        </div>
        {items.length > 0 && (
          <button className="btn primary" onClick={() => requestQuote(items.map((s) => s.id))}>
            <Icons.send size={14} />
            Request quotes ({items.length})
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="empty-big">
          <Icons.bookmark size={28} style={{ opacity: 0.3 }} />
          <h3>No suppliers shortlisted yet</h3>
          <p>
            Open a trending opportunity and add the suppliers worth pursuing. They&apos;ll collect
            here.
          </p>
          <button className="btn inverse" onClick={() => go("trending")}>
            Browse trending
            <Icons.arrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="sl-list">
          {items.map((s) => (
            <div key={s.id} className="sl-row">
              <MatchRing v={s.match} />
              <div className="sl-main" onClick={() => openSupplier(s.id)}>
                <div className="sl-name">
                  {s.name}
                  {s.verified && (
                    <span className="verified">
                      <Icons.check size={10} />
                    </span>
                  )}
                </div>
                <div className="sl-meta">
                  <FlagCode code={s.cc} />
                  {cname(s.cc)} · {s.cats[0]} · {s.lead} lead · MOQ {s.moq}
                </div>
              </div>
              <div className="sl-certs">
                {s.certs.slice(0, 2).map((c) => (
                  <CertChip key={c} c={c} />
                ))}
              </div>
              <button className="icon-btn" onClick={() => toggleShort(s.id)} title="Remove">
                <Icons.x size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
