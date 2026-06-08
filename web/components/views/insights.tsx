"use client";

import type { Insight, InsightAction } from "@/lib/types";
import { cc } from "@/lib/util";
import { Icons } from "../icons";
import { useModel } from "../model-context";
import { StatTile } from "./shared";

const ACTION_CLASS: Record<InsightAction, string> = {
  PROCURE: "low", // green
  WATCH: "med", // amber
  HOLD: "", // neutral
};

function InsightCard({ insight: i }: { insight: Insight }) {
  const ev = i.evidence ?? {};
  const platforms = (ev.demand ?? []).map((d) => d.platform);
  const origins = ev.recommended_origins ?? [];
  const competitors = ev.competitors ?? [];
  return (
    <article className="panel ins-card">
      <div className="ins-head">
        <span className={cc("badge", ACTION_CLASS[i.action])}>
          <span className="dot" />
          {i.action}
        </span>
        <span className="ins-cat">{i.category}</span>
        <span className="ins-market">· {i.market}</span>
        <span className="ins-score">
          {i.score}
          <span className="ins-score-l">score</span>
        </span>
      </div>

      <p className="ins-narrative">{i.narrative}</p>

      {origins.length > 0 && (
        <div className="ins-origins">
          <span className="ins-lbl">Source from</span>
          {origins.slice(0, 4).map((o) => (
            <span key={o} className="cat-chip">
              <Icons.factory size={12} />
              {o}
            </span>
          ))}
        </div>
      )}

      <div className="ins-foot">
        <span className="ins-conf">
          <span className="ins-lbl">confidence</span>
          <span className="ins-bar">
            <span className="ins-bar-fill" style={{ width: `${Math.round(i.confidence * 100)}%` }} />
          </span>
          <span className="ins-conf-v">{Math.round(i.confidence * 100)}%</span>
        </span>
        {platforms.length > 0 && (
          <span className="ins-platforms">
            <Icons.pulse size={12} />
            {platforms.join(" · ")}
          </span>
        )}
        {competitors.length > 0 && (
          <span className="comp-flag">
            <Icons.alert size={12} />
            {competitors[0].competitor} sources {competitors[0].origin}
          </span>
        )}
        <span className="ins-narrator">{i.narrator === "llm" ? "Claude" : "rule-based"}</span>
      </div>
    </article>
  );
}

export function Insights() {
  const { insights, procureCount } = useModel();
  const watch = insights.filter((i) => i.action === "WATCH").length;

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Procurement insights</h1>
          <p className="page-sub">
            Ranked recommendations for the buying team — <b>what to procure and from which origin</b>
            , fused from demand momentum (search + social), marketplace and supply-side activity, and
            trade origins. Each is scored and confidence-rated by how many signals corroborate.
          </p>
        </div>
      </header>

      <div className="stat-row">
        <StatTile value={insights.length} label="Recommendations" sub="across tracked categories" />
        <StatTile value={procureCount} label="Procure now" sub="strong multi-signal demand" accent />
        <StatTile value={watch} label="Watch" sub="early / accelerating" />
        <StatTile
          value={insights[0]?.narrator === "llm" ? "Claude" : "Rule"}
          label="Narratives"
          sub={insights[0]?.narrator === "llm" ? "AI-written" : "deterministic"}
        />
      </div>

      <div className="ins-list">
        {insights.map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
        {insights.length === 0 && (
          <div className="empty">No insights yet — run `rsi orchestrate`.</div>
        )}
      </div>
    </div>
  );
}
