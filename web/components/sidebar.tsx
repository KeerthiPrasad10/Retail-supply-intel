"use client";

import { useEffect, useState } from "react";
import type { Go, SignalSource, View } from "@/lib/types";
import { SUPPLIERS } from "@/lib/suppliers";
import { ago, cc, shortDate } from "@/lib/util";
import { Icons, type IconName } from "./icons";
import { useModel } from "./model-context";

function NavItem({
  id,
  label,
  icon,
  badge,
  view,
  go,
}: {
  id: View;
  label: string;
  icon: IconName;
  badge?: number | null;
  view: View;
  go: Go;
}) {
  const Icon = Icons[icon];
  return (
    <div className={cc("nav-item", view === id && "active")} onClick={() => go(id)}>
      <Icon size={16} />
      <span>{label}</span>
      {badge != null && <span className="badge-num">{badge}</span>}
    </div>
  );
}

/** Dot colour by feed state — derived from status only (no clock), so it
 *  renders identically on the server and the client. */
function dotState(s: SignalSource): "live" | "stale" | "error" | "idle" {
  if (s.status === "error") return "error";
  if (s.status === "idle" || !s.lastRunAt) return "idle";
  if (s.status === "empty") return "stale";
  return "live";
}

/** The "signal sources" rail: every ingestion feed, when it last produced a
 *  signal, and a live/idle dot showing which we're actively sourcing from. */
function SignalSources({ sources }: { sources: SignalSource[] }) {
  // `now` is set after mount; until then we render a deterministic absolute
  // date so the first client paint matches the server (no hydration mismatch).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (sources.length === 0) return null;
  const live = sources.filter((s) => s.status === "ok").length;

  const when = (iso: string | null) =>
    !iso ? "idle" : now === null ? shortDate(iso) : ago(now - new Date(iso).getTime());

  return (
    <>
      <div className="nav-section src-head">
        <span>Signal sources</span>
        {live > 0 && <span className="src-live-count">{live} live</span>}
      </div>
      <div className="src-feed">
        {sources.map((s) => {
          const state = dotState(s);
          const rows = s.rows ? ` · ${s.rows.toLocaleString()} signals` : "";
          return (
            <div
              key={s.name}
              className={cc("src-row", state === "idle" && "is-idle")}
              title={`${s.label} — ${s.kind} signal · ${s.status}${rows}`}
            >
              <span className={cc("src-dot", state)} aria-hidden />
              <span className="src-name">{s.label}</span>
              <span className="src-when">{when(s.lastRunAt)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Sidebar({ view, go, shortlistCount }: { view: View; go: Go; shortlistCount: number }) {
  const { trends, insights, signalSources } = useModel();
  return (
    <aside className="sidebar">
      <div className="logo-mark">
        NxB<span className="slash">/Sourcing</span>
      </div>
      <div className="nav-group">
        {/* Ordered as the workflow runs: idea → research → suppliers → shortlist. */}
        <NavItem id="ideas" label="Product Ideas" icon="box" view={view} go={go} />
        <NavItem id="overview" label="Market overview" icon="grid" view={view} go={go} />
        <NavItem id="trending" label="Trending" icon="trending" badge={trends.length} view={view} go={go} />
        <NavItem id="insights" label="Insights" icon="spark" badge={insights.length} view={view} go={go} />
        <NavItem id="map" label="Map" icon="globe" view={view} go={go} />
        <NavItem id="suppliers" label="Suppliers" icon="factory" badge={SUPPLIERS.length} view={view} go={go} />
        <NavItem id="shortlist" label="Shortlist" icon="bookmark" badge={shortlistCount || null} view={view} go={go} />
      </div>
      <SignalSources sources={signalSources} />
      <div className="nav-section">Markets</div>
      <div className="nav-group">
        <div className="nav-item ghost">
          <Icons.globe size={16} />
          <span>All markets</span>
        </div>
        <div className="nav-item ghost">
          <span className="mk">DE</span>
          <span>Germany</span>
        </div>
        <div className="nav-item ghost">
          <span className="mk">FR</span>
          <span>France</span>
        </div>
        <div className="nav-item ghost">
          <span className="mk">NL</span>
          <span>Netherlands</span>
        </div>
      </div>
      <div className="sidebar-footer">
        <span className="avatar">LD</span>
        <div className="sf-text">
          <span className="sf-name">Lidl · Buying</span>
          <span className="sf-sub">Category sourcing</span>
        </div>
      </div>
    </aside>
  );
}
