"use client";

import { useModel } from "./model-context";

/** Data provenance, shown on every view so nothing reads as fabricated. */
export function SourceFooter() {
  const { snapshotLabel } = useModel();
  return (
    <footer className="sources">
      <span className="src-h">Sources</span>
      <span className="src-i">
        <b>Demand</b> Wikipedia pageviews + Google Trends
      </span>
      <span className="src-i">
        <b>Supply</b> UN Comtrade · HS-4 import/export flows
      </span>
      <span className="src-i">
        <b>Suppliers</b> illustrative directory — not customs-verified
      </span>
      <span className="src-i src-date">Snapshot {snapshotLabel}</span>
    </footer>
  );
}
