"use client";

import type { Go, Trend } from "@/lib/types";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { useCname } from "../model-context";
import { DemandSpark, FlagCode, GrowthPill, OriginBars, Tier } from "../primitives";
import { SummaryBlock } from "../summary-block";

export function StatTile({
  value,
  label,
  sub,
  accent,
}: {
  value: string | number;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="stat">
      <div className={cc("stat-val", accent && "accent")}>{value}</div>
      <div className="stat-lbl">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function ScoreBlock({ score, big }: { score: number; big?: boolean }) {
  return (
    <div className={cc("score", big && "score-big")}>
      <div className="score-num">{score}</div>
      <div className="score-lbl">opportunity</div>
    </div>
  );
}

export function TrendCard({ t, go, matches }: { t: Trend; go: Go; matches: number }) {
  const cname = useCname();
  const focusName = cname(t.focus);
  const topEm = t.emerging[0];
  const verb = t.tier === "SURGING" ? "surging" : t.tier === "RISING" ? "rising" : "moving";
  return (
    <article className="tcard" onClick={() => go("deepdive", t.id)}>
      <div className="tcard-l">
        <div className="tcard-top">
          <span className="cat-chip">
            <Icons.box size={13} />
            {t.cat}
          </span>
          <span className="sep">·</span>
          <span className="mk-name">{t.market === "Global" ? "All markets" : t.market}</span>
          <Tier tier={t.tier} />
        </div>
        <h3 className="tcard-title">
          {t.focusEmerging ? (
            <>
              {t.cat} demand is {verb} — source from <span className="focus">{focusName}</span>{" "}
              before competitors lock it in
            </>
          ) : (
            <>
              {t.cat} demand is {verb} — secure <span className="focus">{focusName}</span> capacity
              before supply tightens
            </>
          )}
        </h3>
        <SummaryBlock summary={t.summary} />
        <div className="tcard-origins">
          <OriginBars sources={t.sources} limit={3} focus={t.focus} />
        </div>
        <div className="tcard-foot">
          {t.competitors.length > 0 && (
            <span className="comp-flag">
              <Icons.alert size={13} />
              {t.competitors[0].name} sourcing here
            </span>
          )}
          <span className="match-count">
            <Icons.factory size={13} />
            {matches} suppliers ready
          </span>
          <button
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              go("suppliers", t.id);
            }}
          >
            Find suppliers <Icons.arrowRight size={13} />
          </button>
        </div>
      </div>
      <div className="tcard-r">
        <ScoreBlock score={t.score} />
        <div className="demand-mini">
          <span className="dm-lbl">demand</span>
          <DemandSpark growth={t.growth} strong={t.tier === "SURGING"} />
          <GrowthPill g={t.growth} big />
        </div>
        {topEm && (
          <div className="topem">
            <span className="topem-lbl">top emerging origin</span>
            <span className="topem-row">
              <FlagCode code={topEm[0]} /> {cname(topEm[0])} <GrowthPill g={topEm[2]} />
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
