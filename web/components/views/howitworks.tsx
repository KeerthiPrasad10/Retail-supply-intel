"use client";

import { Fragment, useEffect, useState } from "react";
import type { Go, View } from "@/lib/types";
import { SUPPLIERS } from "@/lib/suppliers";
import { cc } from "@/lib/util";
import { Icons, type IconName } from "../icons";
import { useModel } from "../model-context";

type Stage = { icon: IconName; kicker: string; title: string; lead: string; rows: string[] };
type Outcome = { icon: IconName; title: string; body: string; cta: string; view: View };

/**
 * "How it works" — an animated walk-through of the demand×supply pipeline:
 * how intelligence is sourced, analysed and presented, and the moves it drives.
 * The active stage cycles on a timer so the flow reads as a process, not a
 * static diagram. All motion is CSS and disabled under prefers-reduced-motion.
 */
export function HowItWorks({ go }: { go: Go }) {
  const { trends, insights, signalSources, emergingOriginCount } = useModel();
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % 3), 2600);
    return () => clearInterval(id);
  }, []);

  const live = signalSources.filter((s) => s.status === "ok");
  const demand = live.filter((s) => s.kind === "demand").map((s) => s.label);
  const supply = live.filter((s) => s.kind === "supply").map((s) => s.label);

  const stages: Stage[] = [
    {
      icon: "pulse",
      kicker: "01 — Source",
      title: "Signals in",
      lead: "Two sides of the market, pulled continuously.",
      rows: [
        `Demand · ${demand.join(", ") || "search + social momentum"}`,
        `Supply · ${supply.join(", ") || "UN Comtrade trade flows"}`,
        "Competitor sourcing footprints",
      ],
    },
    {
      icon: "spark",
      kicker: "02 — Analyze",
      title: "Turned into signal",
      lead: "Scored, correlated and ranked — explainably.",
      rows: [
        "Momentum & growth scoring per category",
        "HS-4 demand ↔ supply correlation",
        "Like-for-like YoY emerging-origin detection",
        "Opportunity scoring vs competitor moves",
      ],
    },
    {
      icon: "grid",
      kicker: "03 — Present",
      title: "Decisions out",
      lead: "Ready to act on, with the reasoning attached.",
      rows: [
        "Ranked, explainable sourcing triggers",
        "Origin breakdown + emerging challengers",
        "Matched, on-origin suppliers to engage",
      ],
    },
  ];

  const funnel: { n: string; label: string }[] = [
    { n: String(live.length), label: "live signal sources" },
    { n: String(trends.length), label: "opportunities scored" },
    { n: String(emergingOriginCount), label: "emerging origins" },
    { n: String(insights.length), label: "buyer recommendations" },
  ];

  const outcomes: Outcome[] = [
    {
      icon: "trending",
      title: "Move first",
      body: "Catch demand turning up while it's still early, and secure origin capacity before competitors lock it in.",
      cta: "See trending",
      view: "trending",
    },
    {
      icon: "shield",
      title: "De-risk concentration",
      body: "Spot when an incumbent origin is slipping and which emerging origins are gaining share to diversify into.",
      cta: "Open the map",
      view: "map",
    },
    {
      icon: "clock",
      title: "Time the buy",
      body: "Act while supply is loosening or tightening — ahead of the price move, not after it.",
      cta: "View insights",
      view: "insights",
    },
    {
      icon: "factory",
      title: "Shortlist faster",
      body: "Jump from a trend straight to matched, on-origin suppliers and build a shortlist in minutes.",
      cta: "Browse suppliers",
      view: "suppliers",
    },
  ];

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <h1 className="page-title">How it works</h1>
          <p className="page-sub">
            From raw market signals to a ranked sourcing decision — and the moves it lets a buying
            team make before the rest of the market.
          </p>
        </div>
        <button className="btn primary" onClick={() => go("overview")}>
          See it live
          <Icons.arrowRight size={14} />
        </button>
      </header>

      <div className="hiw-funnel">
        {funnel.map((f, i) => (
          <Fragment key={f.label}>
            {i > 0 && <Icons.arrowRight size={16} className="hiw-fn-arrow" />}
            <div className="hiw-fstat" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="hiw-fn-n">{f.n}</span>
              <span className="hiw-fn-l">{f.label}</span>
            </div>
          </Fragment>
        ))}
      </div>

      <div className="hiw-pipe">
        {stages.map((s, i) => {
          const Icon = Icons[s.icon];
          return (
            <Fragment key={s.kicker}>
              {i > 0 && (
                <div className="hiw-conn" aria-hidden>
                  <span className="hiw-packet" />
                  <span className="hiw-packet d2" />
                </div>
              )}
              <div className={cc("hiw-stage", active === i && "on")}>
                <div className="hiw-stage-ic">
                  <Icon size={19} />
                </div>
                <div className="hiw-kicker">{s.kicker}</div>
                <div className="hiw-stage-title">{s.title}</div>
                <p className="hiw-stage-lead">{s.lead}</p>
                <ul className="hiw-rows">
                  {s.rows.map((r) => (
                    <li key={r}>
                      <span className="hiw-tick" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="sec-head hiw-sec">
        <h2 className="sec-title">What it drives</h2>
      </div>
      <div className="hiw-outcomes">
        {outcomes.map((o) => {
          const Icon = Icons[o.icon];
          return (
            <button className="hiw-outcome" key={o.title} onClick={() => go(o.view)}>
              <span className="hiw-out-ic">
                <Icon size={17} />
              </span>
              <span className="hiw-out-title">{o.title}</span>
              <p className="hiw-out-body">{o.body}</p>
              <span className="hiw-out-link">
                {o.cta}
                <Icons.arrowUpRight size={13} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
