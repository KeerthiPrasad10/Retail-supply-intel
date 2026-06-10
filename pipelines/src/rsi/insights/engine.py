"""Procurement insight orchestrator.

Fuses every signal for a product category — multi-platform demand momentum
(Google Trends, TikTok, Instagram, Pinterest), marketplace + supply
activity (Amazon, AliExpress), trade origins/emerging (Comtrade) and competitor
moves — into a ranked, explainable recommendation telling Lidl's buyers **what
to procure and from which origin**. Claude writes the buyer-facing narrative
when configured; otherwise a deterministic fallback is used.
"""

from __future__ import annotations

import math
from collections import defaultdict

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..correlation.engine import category_sources
from ..models import (
    Competitor,
    CompetitorSourcing,
    Country,
    Insight,
    ProductCategory,
    Trend,
    TrendScore,
)
from . import llm

DEMAND_PLATFORMS = {"google_trends", "tiktok", "instagram", "pinterest"}
SUPPLY_PLATFORMS = {"amazon", "aliexpress"}
STRONG_MOMENTUM = 1.0
ACCELERATING = 0.1


def score_insight(
    max_momentum: float,
    max_accel: float,
    rising: int,
    total_platforms: int,
    has_emerging: bool,
    has_recommended: bool,
) -> tuple[str, float, float]:
    """Pure scoring: returns (action, score 0..100, confidence 0..1)."""
    strong = max_momentum >= STRONG_MOMENTUM or rising >= 2
    accelerating = max_accel >= ACCELERATING

    if strong and has_recommended:
        action = "PROCURE"
    elif (accelerating or rising >= 1) and has_recommended:
        action = "WATCH"
    elif strong and not has_recommended:
        action = "WATCH"
    else:
        action = "HOLD"

    # Confidence = how many independent signal types corroborate.
    breadth = rising / total_platforms if total_platforms else 0.0
    confidence = min(
        1.0,
        0.5 * breadth
        + (0.25 if has_emerging else 0.0)
        + (0.15 if max_accel > 0 else 0.0)
        + (0.10 if max_momentum > 0 else 0.0),
    )

    demand_component = min(60.0, 18.0 * math.log1p(max(max_momentum, 0.0)) + 12.0 * rising)
    accel_component = min(20.0, 40.0 * max(max_accel, 0.0))
    supply_component = 20.0 if has_emerging else (8.0 if has_recommended else 0.0)
    score = round(min(100.0, demand_component + accel_component + supply_component), 2)
    return action, score, round(confidence, 3)


def _demand_by_platform(session: Session, latest_as_of, cat_id: int) -> list[dict]:
    rows = session.execute(
        select(
            Trend.platform,
            func.max(TrendScore.momentum),
            func.max(TrendScore.growth_rate),
            func.max(TrendScore.acceleration),
        )
        .join(TrendScore, TrendScore.trend_id == Trend.id)
        .where(TrendScore.as_of == latest_as_of, Trend.category_id == cat_id)
        .group_by(Trend.platform)
    ).all()
    return [
        {
            "platform": p,
            "momentum": round(float(mom or 0), 4),
            "growth": round(float(gr or 0), 4),
            "acceleration": round(float(acc or 0), 4),
        }
        for p, mom, gr, acc in rows
    ]


def _top_market(session: Session, latest_as_of, cat_id: int) -> str | None:
    return session.scalar(
        select(TrendScore.country_code)
        .join(Trend, Trend.id == TrendScore.trend_id)
        .where(
            TrendScore.as_of == latest_as_of,
            Trend.category_id == cat_id,
            TrendScore.country_code.is_not(None),
        )
        .order_by(TrendScore.momentum.desc())
        .limit(1)
    )


def build_insights(session: Session, use_llm: bool = True) -> int:
    """(Re)generate procurement insights from the latest scores + supply data."""
    latest_as_of = session.scalar(select(func.max(TrendScore.as_of)))
    if latest_as_of is None:
        return 0

    country_names = dict(session.execute(select(Country.code, Country.name)).all())

    # Competitor sourcing by category -> [(competitor, origin)].
    comp_rows = session.execute(
        select(Competitor.name, CompetitorSourcing.category_id, CompetitorSourcing.partner_code)
        .join(CompetitorSourcing, CompetitorSourcing.competitor_id == Competitor.id)
    ).all()
    comps_by_cat: dict[int, list[dict]] = defaultdict(list)
    for name, cat_id, partner in comp_rows:
        if cat_id is not None:
            comps_by_cat[cat_id].append(
                {"competitor": name, "origin": country_names.get(partner, partner)}
            )

    session.execute(delete(Insight).where(Insight.status == "new"))

    insights: list[Insight] = []
    for cat in session.scalars(select(ProductCategory)):
        demand = _demand_by_platform(session, latest_as_of, cat.id)
        if not demand:
            continue
        demand_platforms = [d for d in demand if d["platform"] in DEMAND_PLATFORMS] or demand
        rising = [d for d in demand_platforms if d["growth"] > 0 or d["momentum"] > 0.1]
        max_momentum = max((d["momentum"] for d in demand_platforms), default=0.0)
        max_accel = max((d["acceleration"] for d in demand), default=0.0)

        sources = category_sources(session, cat.id)
        top = sources[:5]
        emerging = [s for s in sources if s["emerging"]][:5]
        recommended = emerging or top[:3]
        marketplace = [d for d in demand if d["platform"] in SUPPLY_PLATFORMS]
        comps = comps_by_cat.get(cat.id, [])

        action, score, confidence = score_insight(
            max_momentum, max_accel, len(rising), len(demand_platforms),
            has_emerging=bool(emerging), has_recommended=bool(recommended),
        )

        market_code = _top_market(session, latest_as_of, cat.id)
        rec_names = [country_names.get(s["partner_code"], s["partner_code"]) for s in recommended]
        evidence = {
            "category": cat.name,
            "market": country_names.get(market_code, "EU / all markets"),
            "demand": sorted(demand, key=lambda d: d["momentum"], reverse=True),
            "rising_sources": len(rising),
            "total_sources": len(demand_platforms),
            "max_acceleration": round(max_accel, 4),
            "top_origins": [
                {"origin": country_names.get(s["partner_code"], s["partner_code"]),
                 "share": round(s["share"], 4), "growth": round(s["growth"], 4),
                 "emerging": s["emerging"]}
                for s in top
            ],
            "recommended_origins": rec_names,
            "marketplace": marketplace,
            "competitors": comps,
        }
        headline = (
            f"{action}: {cat.name}"
            + (f" — source from {rec_names[0]}" if rec_names else "")
            + (" (emerging origin)" if emerging else "")
        )
        insights.append(
            Insight(
                category_id=cat.id,
                market_code=market_code,
                action=action,
                score=score,
                confidence=confidence,
                headline=headline,
                narrative=_fallback_narrative(
                    action, cat.name, evidence, rec_names, emerging, comps
                ),
                narrator="rule",
                evidence=evidence,
                status="new",
            )
        )

    insights.sort(key=lambda i: i.score, reverse=True)

    if use_llm and llm.available():
        for ins in insights:
            text = llm.narrate(ins.headline, ins.evidence)
            if text:
                ins.narrative = text
                ins.narrator = "llm"

    session.add_all(insights)
    session.flush()
    return len(insights)


def _fallback_narrative(action, category, evidence, rec_names, emerging, comps) -> str:
    top_demand = evidence["demand"][0] if evidence["demand"] else None
    parts: list[str] = []
    verb = {"PROCURE": "Procure", "WATCH": "Watch", "HOLD": "Hold on"}[action]
    parts.append(f"{verb} {category} for {evidence['market']}.")
    if top_demand:
        parts.append(
            f"Demand strongest on {top_demand['platform']} "
            f"(momentum {top_demand['momentum']:.2f}); "
            f"{evidence['rising_sources']} of {evidence['total_sources']} demand sources rising"
            + (
                f", accelerating ({evidence['max_acceleration']:+.2f})"
                if evidence["max_acceleration"] > 0
                else ""
            )
            + "."
        )
    if rec_names:
        parts.append(
            "Source from " + ", ".join(rec_names[:3])
            + (" — emerging origins gaining share." if emerging else " (current top origins).")
        )
    if comps:
        c = comps[0]
        parts.append(f"Note: {c['competitor']} already sources here ({c['origin']}).")
    return " ".join(parts)
