"use client";

import { useEffect, useState } from "react";
import type { Insight, InsightAction } from "@/lib/types";
import type { ProductIdea, ResearchResult } from "@/lib/ideas/types";
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
        <span className="ins-narrator">
          {i.narrator === "supplyscope" ? "Validate" : i.narrator === "llm" ? "Claude" : "rule-based"}
        </span>
      </div>
    </article>
  );
}

// Parse a leading number out of a price string (e.g. "$0.99", "US $12.50").
function priceToNum(p?: string | null): number | null {
  if (!p) return null;
  const m = String(p).replace(/[, ]/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Map a completed "Validate" idea into the dashboard's Insight shape so it
// renders alongside the pipeline's procurement recommendations. Score is the
// retail-vs-cheapest-supplier margin on RSI's 0..100 scale.
function validatedToInsight(idea: ProductIdea, i: number): Insight {
  const r = idea.research as ResearchResult;
  const pr = r?.benchmark?.priceRange;
  const lows = (r?.suppliers ?? [])
    .map((s) => priceToNum(s.price))
    .filter((v): v is number => v != null && v > 0);
  const score =
    pr && pr.avg > 0 && lows.length
      ? Math.max(0, Math.min(100, Math.round((1 - Math.min(...lows) / pr.avg) * 100)))
      : 60;
  const action: InsightAction = score >= 70 ? "PROCURE" : score >= 45 ? "WATCH" : "HOLD";
  const compCount = r?.benchmark?.competitors?.length ?? 0;
  const lead = r?.analysis?.positioning || r?.benchmark?.insights?.[0] || "Market scan complete.";
  return {
    id: -(i + 1), // negative ids never collide with snapshot insights
    category: idea.category || r?.classification?.category || "Product idea",
    market: idea.targetMarket || "Validated idea",
    action,
    score,
    confidence: Math.min(0.95, 0.45 + compCount * 0.05),
    headline: idea.title,
    narrative: `${idea.title} — ${lead}`,
    narrator: "supplyscope",
    evidence: {},
  };
}

export function Insights() {
  const { insights: base, procureCount: basePC } = useModel();
  const [validated, setValidated] = useState<Insight[]>([]);

  // Pull completed "Validate" ideas (live Supabase or the in-memory store) and
  // surface them as procurement insights. Client-side so it stays fresh without
  // a rebuild of the prerendered dashboard.
  useEffect(() => {
    let live = true;
    fetch("/api/ideas")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        const ideas: ProductIdea[] = Array.isArray(d?.ideas) ? d.ideas : [];
        setValidated(ideas.filter((x) => x.status === "complete" && x.research).map(validatedToInsight));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const insights = [...validated, ...base];
  const procureCount = basePC + validated.filter((i) => i.action === "PROCURE").length;
  const watch = insights.filter((i) => i.action === "WATCH").length;

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">Procurement insights</h1>
          <p className="page-sub">
            Ranked recommendations for the buying team — <b>what to procure and from which origin</b>
            , fused from demand momentum (search + social), marketplace and supply-side activity, and
            trade origins. Submitted product ideas from <b>Validate</b> appear here too.
          </p>
        </div>
      </header>

      <div className="stat-row">
        <StatTile value={insights.length} label="Recommendations" sub="across tracked categories" />
        <StatTile value={procureCount} label="Procure now" sub="strong multi-signal demand" accent />
        <StatTile value={watch} label="Watch" sub="early / accelerating" />
        <StatTile
          value={validated.length}
          label="From Validate"
          sub={validated.length ? "submitted product ideas" : "submit ideas in Validate"}
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
