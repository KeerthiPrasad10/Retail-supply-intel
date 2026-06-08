"""Correlation engine: demand (trend momentum) x supply (trade flows) -> triggers.

For every product category whose demand is rising in a market, it looks at who
the category is sourced from (top + *emerging* origin countries from trade
flows) and which competitors already buy there, then emits a ranked, explainable
:class:`Trigger`.
"""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import (
    Competitor,
    CompetitorSourcing,
    Country,
    ProductCategory,
    TradeFlow,
    Trend,
    TrendScore,
    Trigger,
)

EMERGING_GROWTH = 0.15  # >=15% YoY import-value growth flags an emerging origin
SUPPLY_WEIGHT = 0.5


def category_sources(session: Session, category_id: int) -> list[dict]:
    """Origin countries for a category, ranked by latest import value.

    Each entry carries ``value`` (latest period, summed across reporters),
    ``share`` of that period's total, ``growth`` vs the prior period, and an
    ``emerging`` flag.
    """
    rows = session.execute(
        select(
            TradeFlow.partner_code,
            TradeFlow.period,
            func.sum(TradeFlow.trade_value),
        )
        .where(TradeFlow.category_id == category_id, TradeFlow.flow == "import")
        .group_by(TradeFlow.partner_code, TradeFlow.period)
    ).all()
    if not rows:
        return []

    periods = sorted({r[1] for r in rows})
    latest = periods[-1]
    prev = periods[-2] if len(periods) > 1 else None

    by_partner: dict[str, dict[str, float]] = defaultdict(dict)
    for partner, period, value in rows:
        by_partner[partner][period] = float(value or 0.0)

    total_latest = sum(p.get(latest, 0.0) for p in by_partner.values()) or 1.0
    out: list[dict] = []
    for partner, vals in by_partner.items():
        v_latest = vals.get(latest, 0.0)
        v_prev = vals.get(prev, 0.0) if prev else 0.0
        if v_latest <= 0:
            continue
        growth = (v_latest - v_prev) / v_prev if v_prev > 0 else (1.0 if v_latest else 0.0)
        out.append(
            {
                "partner_code": partner,
                "value": v_latest,
                "share": v_latest / total_latest,
                "growth": growth,
                "emerging": (v_prev == 0 and v_latest > 0) or growth >= EMERGING_GROWTH,
            }
        )
    out.sort(key=lambda d: d["value"], reverse=True)
    return out


def _competitors_for_category(session: Session, category_id: int) -> dict[str, list[str]]:
    """Map origin country -> competitors known to source the category there."""
    rows = session.execute(
        select(Competitor.name, CompetitorSourcing.partner_code)
        .join(CompetitorSourcing, CompetitorSourcing.competitor_id == Competitor.id)
        .where(CompetitorSourcing.category_id == category_id)
    ).all()
    mapping: dict[str, list[str]] = defaultdict(list)
    for name, partner in rows:
        if partner:
            mapping[partner].append(name)
    return mapping


def run_correlation(session: Session, top_n: int = 100, min_momentum: float = 0.0) -> int:
    """(Re)generate `new` triggers from the latest score snapshot. Returns count."""
    latest_as_of = session.scalar(select(func.max(TrendScore.as_of)))
    if latest_as_of is None:
        return 0

    country_names = dict(session.execute(select(Country.code, Country.name)).all())
    cat_names = dict(session.execute(select(ProductCategory.id, ProductCategory.name)).all())
    sources_cache: dict[int, list[dict]] = {}
    comp_cache: dict[int, dict[str, list[str]]] = {}

    # Drop only un-triaged triggers so human decisions survive a rerun.
    session.execute(delete(Trigger).where(Trigger.status == "new"))

    scored = session.execute(
        select(TrendScore, Trend)
        .join(Trend, Trend.id == TrendScore.trend_id)
        .where(
            TrendScore.as_of == latest_as_of,
            TrendScore.momentum > min_momentum,
            Trend.category_id.is_not(None),
        )
        .order_by(TrendScore.momentum.desc())
    ).all()

    triggers: list[Trigger] = []
    for score, trend in scored:
        cat_id = trend.category_id
        sources = sources_cache.setdefault(cat_id, category_sources(session, cat_id))
        if not sources:
            continue
        comp_map = comp_cache.setdefault(cat_id, _competitors_for_category(session, cat_id))

        emerging = [s for s in sources if s["emerging"]][:5]
        top = sources[:5]
        opportunity = max((s["growth"] for s in emerging), default=0.0)
        trigger_score = round(score.momentum * (1 + SUPPLY_WEIGHT * opportunity), 4)

        focus = emerging[0] if emerging else top[0]
        market = country_names.get(score.country_code, score.country_code or "Global")

        def fmt(items):
            return ", ".join(
                f"{country_names.get(s['partner_code'], s['partner_code'])} "
                f"({s['share']:.0%}, {s['growth']:+.0%})"
                for s in items
            )

        competitors = sorted({c for s in top for c in comp_map.get(s["partner_code"], [])})
        rationale = (
            f"Demand for {cat_names.get(cat_id, cat_id)} is rising in {market} "
            f"(momentum {score.momentum:.2f}, {score.growth_rate:+.0%}). "
            f"Top origins: {fmt(top)}. "
        )
        if emerging:
            rationale += f"Emerging: {fmt(emerging)}. "
        if competitors:
            rationale += f"Competitors already sourcing there: {', '.join(competitors)}."

        triggers.append(
            Trigger(
                trend_id=trend.id,
                country_code=score.country_code,
                category_id=cat_id,
                partner_code=focus["partner_code"],
                score=trigger_score,
                rationale=rationale.strip(),
                status="new",
                payload={
                    "top_sources": top,
                    "emerging_suppliers": emerging,
                    "competitors": competitors,
                    "demand_momentum": score.momentum,
                    "demand_growth": score.growth_rate,
                },
            )
        )

    triggers.sort(key=lambda t: t.score, reverse=True)
    triggers = triggers[:top_n]
    session.add_all(triggers)
    session.flush()
    return len(triggers)
