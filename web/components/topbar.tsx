"use client";

import type { ReactNode } from "react";
import { useModel } from "./model-context";
import { Icons } from "./icons";

export function Topbar({
  crumbs,
  dark,
  onToggleDark,
  children,
}: {
  crumbs: string[];
  dark: boolean;
  onToggleDark: () => void;
  children?: ReactNode;
}) {
  const { snapshotLabel } = useModel();
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            {i > 0 && <span className="sep">·</span>}
            <span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>
          </span>
        ))}
      </div>
      <div className="topbar-actions">
        <span className="pill-status">
          <span className="dot" />
          Snapshot · {snapshotLabel}
        </span>
        <button className="icon-btn" aria-label="search">
          <Icons.search size={14} />
        </button>
        <button className="icon-btn" aria-label="alerts">
          <Icons.bell size={14} />
        </button>
        <button className="icon-btn" aria-label="toggle theme" onClick={onToggleDark}>
          {dark ? <Icons.sun size={14} /> : <Icons.moon size={14} />}
        </button>
        {children}
      </div>
    </div>
  );
}
