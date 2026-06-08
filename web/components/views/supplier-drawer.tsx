"use client";

import type { Supplier } from "@/lib/types";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { useModel } from "../model-context";
import { CertChip, FlagCode, MatchRing } from "../primitives";

type DrawerSupplier = Supplier & { isEmerging?: boolean };

export function SupplierDrawer({
  s,
  close,
  inList,
  toggle,
  requestQuote,
}: {
  s: DrawerSupplier | null;
  close: () => void;
  inList: boolean;
  toggle: (id: string) => void;
  requestQuote: (ids: string[]) => void;
}) {
  const { nameByCode, regionByCode } = useModel();
  if (!s) return null;
  const cname = (c: string) => nameByCode[c] ?? c;
  const regionOf = (c: string) => regionByCode[c] ?? "—";

  return (
    <div className="drawer-scrim" onClick={close}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="icon-btn" onClick={close}>
            <Icons.x size={15} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="dp-top">
            <MatchRing v={s.match} size={56} />
            <div>
              <h2 className="dp-name">
                {s.name}
                {s.verified && (
                  <span className="verified">
                    <Icons.check size={11} />
                  </span>
                )}
              </h2>
              <div className="dp-loc">
                <Icons.building size={14} />
                <FlagCode code={s.cc} />
                {cname(s.cc)} · {regionOf(s.cc)} · est. {s.est}
              </div>
            </div>
          </div>
          <p className="dp-note">{s.note}</p>
          <div className="dp-cats">
            {s.cats.map((c) => (
              <span key={c} className="cat-chip">
                <Icons.box size={12} />
                {c}
              </span>
            ))}
          </div>

          <h3 className="panel-h" style={{ marginTop: 24 }}>
            Capabilities
          </h3>
          <div className="dp-stats">
            <div className="dps">
              <span className="dps-l">Minimum order</span>
              <span className="dps-v">{s.moq}</span>
            </div>
            <div className="dps">
              <span className="dps-l">Lead time</span>
              <span className="dps-v">{s.lead}</span>
            </div>
            <div className="dps">
              <span className="dps-l">Monthly capacity</span>
              <span className="dps-v">{s.capacity}</span>
            </div>
            <div className="dps">
              <span className="dps-l">Price index</span>
              <span className="dps-v">
                {s.price}{" "}
                <span className="dps-hint">
                  {s.price < 100 ? "below market" : s.price > 110 ? "premium" : "market"}
                </span>
              </span>
            </div>
          </div>

          <h3 className="panel-h" style={{ marginTop: 24 }}>
            Certifications
          </h3>
          <div className="scard-certs">
            {s.certs.map((c) => (
              <CertChip key={c} c={c} />
            ))}
          </div>

          <h3 className="panel-h" style={{ marginTop: 24 }}>
            Why this match
          </h3>
          <ul className="dp-why">
            <li>
              <Icons.check size={14} />
              Produces in {cname(s.cc)}
              {s.isEmerging ? ", an emerging origin gaining share for this category" : ""}
            </li>
            <li>
              <Icons.check size={14} />
              Match fit {s.match}/100 on category, capacity and certification overlap
            </li>
            <li>
              <Icons.check size={14} />
              {s.lead} lead time and {s.moq} MOQ suit private-label trial runs
            </li>
          </ul>
        </div>
        <div className="drawer-foot">
          <button className={cc("btn", inList ? "secondary" : "inverse")} onClick={() => toggle(s.id)}>
            {inList ? (
              <>
                <Icons.check size={14} />
                Shortlisted
              </>
            ) : (
              <>
                <Icons.bookmark size={14} />
                Add to shortlist
              </>
            )}
          </button>
          <button className="btn primary" onClick={() => requestQuote([s.id])}>
            <Icons.mail size={14} />
            Request quote
          </button>
        </div>
      </aside>
    </div>
  );
}
