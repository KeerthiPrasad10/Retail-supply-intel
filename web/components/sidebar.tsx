"use client";

import type { Go, View } from "@/lib/types";
import { SUPPLIERS } from "@/lib/suppliers";
import { cc } from "@/lib/util";
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

export function Sidebar({ view, go, shortlistCount }: { view: View; go: Go; shortlistCount: number }) {
  const { trends, insights } = useModel();
  return (
    <aside className="sidebar">
      <div className="logo-mark">
        NxB<span className="slash">/Sourcing</span>
      </div>
      <div className="nav-group">
        <NavItem id="overview" label="Overview" icon="grid" view={view} go={go} />
        <NavItem id="insights" label="Insights" icon="spark" badge={insights.length} view={view} go={go} />
        <NavItem id="trending" label="Trending" icon="trending" badge={trends.length} view={view} go={go} />
        <NavItem id="map" label="Map" icon="globe" view={view} go={go} />
        <NavItem id="suppliers" label="Suppliers" icon="factory" badge={SUPPLIERS.length} view={view} go={go} />
        <NavItem id="shortlist" label="Shortlist" icon="bookmark" badge={shortlistCount || null} view={view} go={go} />
      </div>
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
