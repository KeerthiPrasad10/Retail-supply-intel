"use client";

import { useState } from "react";
import { SUPPLIERS } from "@/lib/suppliers";
import { Icons } from "../icons";
import { FlagCode } from "../primitives";

export function QuoteModal({ ids, close }: { ids: string[]; close: () => void }) {
  const suppliers = SUPPLIERS.filter((s) => ids.includes(s.id));
  const [sent, setSent] = useState(false);
  return (
    <div className="modal-scrim" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!sent ? (
          <>
            <h3>
              Request quotes from {suppliers.length} supplier{suppliers.length > 1 ? "s" : ""}?
            </h3>
            <p>
              We&apos;ll send your private-label brief and standard terms to each. Replies land in
              your inbox and on the supplier profile.
            </p>
            <ul className="qm-list">
              {suppliers.map((s) => (
                <li key={s.id}>
                  <FlagCode code={s.cc} />
                  <span>{s.name}</span>
                  <span className="qm-lead">{s.lead}</span>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button className="btn ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn primary" onClick={() => setSent(true)}>
                <Icons.send size={14} />
                Send requests
              </button>
            </div>
          </>
        ) : (
          <div className="qm-done">
            <div className="qm-check">
              <Icons.check size={26} />
            </div>
            <h3>Requests sent</h3>
            <p>
              {suppliers.length} supplier{suppliers.length > 1 ? "s have" : " has"} been contacted.
              We&apos;ll notify you as quotes come back.
            </p>
            <button className="btn inverse" onClick={close}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
