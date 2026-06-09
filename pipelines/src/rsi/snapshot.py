"""Build a read-optimised JSON snapshot consumed by the web dashboard.

The web app reads live data from Supabase when configured; otherwise it falls
back to this committed snapshot so ``npm run dev`` renders real data with zero
setup. ``rsi export`` writes it to ``web/lib/snapshot.json``.

Beyond the MVP trends/triggers, the snapshot now carries the market-intelligence
layer for LKA (Lidl Kaufland Asia): the top-10 competitors and their
(best-effort) sourcing, the researched Asian supplier list, Asian-origin →
buyer-market trade flows for the map, and a leading-indicator board.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import reference
from .config import REPO_ROOT
from .connectors import CONNECTORS, SOURCE_META
from .correlation.engine import category_sources
from .models import (
    Competitor,
    CompetitorSourcing,
    Country,
    Insight,
    ProductCategory,
    SourceStatus,
    Supplier,
    TradeFlow,
    Trend,
    TrendScore,
    Trigger,
)

DEFAULT_SNAPSHOT_PATH = REPO_ROOT / "web" / "lib" / "snapshot.json"

# Minimum positive acceleration to qualify for the "about to trend" board.
LEADING_MIN_ACCEL = 0.05


def _origin_market_flows(session: Session, cat_names: dict[int, str],
                         country_names: dict[str, str]) -> list[dict]:
    """Asian-origin → buyer-market import flows (latest period), for the map.

    Each row is one (market, Asian origin, category) edge with the latest-period
    import value and growth vs the prior period.
    """
    rows = session.execute(
        select(
            TradeFlow.reporter_code,
            TradeFlow.partner_code,
            TradeFlow.category_id,
            TradeFlow.period,
            func.sum(TradeFlow.trade_value),
        )
        .where(
            TradeFlow.flow == "import",
            TradeFlow.partner_code.in_(reference.ASIAN_ORIGINS),
        )
        .group_by(
            TradeFlow.reporter_code,
            TradeFlow.partner_code,
            TradeFlow.category_id,
            TradeFlow.period,
        )
    ).all()
    if not rows:
        return []

    periods = sorted({r[3] for r in rows})
    latest = periods[-1]
    prev = periods[-2] if len(periods) > 1 else None

    by_edge: dict[tuple, dict[str, float]] = defaultdict(dict)
    for market, origin, cat_id, period, value in rows:
        by_edge[(market, origin, cat_id)][period] = float(value or 0.0)

    flows: list[dict] = []
    for (market, origin, cat_id), vals in by_edge.items():
        v_latest = vals.get(latest, 0.0)
        if v_latest <= 0:
            continue
        v_prev = vals.get(prev, 0.0) if prev else 0.0
        growth = (v_latest - v_prev) / v_prev if v_prev > 0 else (1.0 if v_latest else 0.0)
        flows.append(
            {
                "market_code": market,
                "market": country_names.get(market, market),
                "origin_code": origin,
                "origin": country_names.get(origin, origin),
                "category_id": cat_id,
                "category": cat_names.get(cat_id),
                "value": round(v_latest, 2),
                "period": latest,
                "growth": round(growth, 4),
                "emerging": (v_prev == 0 and v_latest > 0) or growth >= 0.15,
            }
        )
    flows.sort(key=lambda f: f["value"], reverse=True)
    return flows


def _competitors(session: Session, cat_names: dict[int, str],
                 country_names: dict[str, str]) -> list[dict]:
    comps = list(session.scalars(select(Competitor).order_by(Competitor.name)))
    sourcing_rows = session.execute(
        select(
            CompetitorSourcing.competitor_id,
            CompetitorSourcing.category_id,
            CompetitorSourcing.partner_code,
            CompetitorSourcing.source,
        )
    ).all()
    by_comp: dict[int, list[dict]] = defaultdict(list)
    for comp_id, cat_id, partner, source in sourcing_rows:
        by_comp[comp_id].append(
            {
                "category_id": cat_id,
                "category": cat_names.get(cat_id),
                "partner_code": partner,
                "partner": country_names.get(partner, partner),
                "source": source,
            }
        )
    return [
        {
            "id": c.id,
            "name": c.name,
            "home_country": c.home_country,
            "home_market": country_names.get(c.home_country, c.home_country),
            "sourcing": sorted(
                by_comp.get(c.id, []), key=lambda s: (s["category"] or "", s["partner"] or "")
            ),
        }
        for c in comps
    ]


def _suppliers(session: Session, cat_names: dict[int, str],
               country_names: dict[str, str]) -> list[dict]:
    rows = session.scalars(select(Supplier).order_by(Supplier.name))
    return [
        {
            "id": s.id,
            "name": s.name,
            "country_code": s.country_code,
            "country": country_names.get(s.country_code, s.country_code),
            "category_id": s.category_id,
            "category": cat_names.get(s.category_id),
            "source": s.source,
        }
        for s in rows
    ]


def _leading_indicators(session: Session, latest_as_of, cat_names: dict[int, str],
                        country_names: dict[str, str], limit: int = 40) -> list[dict]:
    """Top accelerating demand series — the 'about to trend' board."""
    if latest_as_of is None:
        return []
    rows = session.execute(
        select(TrendScore, Trend)
        .join(Trend, Trend.id == TrendScore.trend_id)
        .where(
            TrendScore.as_of == latest_as_of,
            TrendScore.acceleration >= LEADING_MIN_ACCEL,
            Trend.category_id.is_not(None),
        )
        .order_by(TrendScore.acceleration.desc())
        .limit(limit)
    ).all()
    return [
        {
            "term": t.term,
            "platform": t.platform,
            "category_id": t.category_id,
            "category": cat_names.get(t.category_id),
            "country_code": s.country_code,
            "country": country_names.get(s.country_code, "Global"),
            "acceleration": round(s.acceleration, 4),
            "momentum": round(s.momentum, 4),
            "growth": round(s.growth_rate, 4),
            "volume": round(s.volume, 2),
        }
        for s, t in rows
    ]


def _insights(
    session: Session, cat_names: dict[int, str], country_names: dict[str, str]
) -> list[dict]:
    """Ranked procurement recommendations for the buying team."""
    rows = session.scalars(select(Insight).order_by(Insight.score.desc()))
    return [
        {
            "id": i.id,
            "category_id": i.category_id,
            "category": cat_names.get(i.category_id),
            "market_code": i.market_code,
            "market": country_names.get(i.market_code, "EU / all markets"),
            "action": i.action,
            "score": round(i.score, 2),
            "confidence": round(i.confidence, 3),
            "headline": i.headline,
            "narrative": i.narrative,
            "narrator": i.narrator,
            "evidence": i.evidence,
            "status": i.status,
        }
        for i in rows
    ]


def _signal_sources(session: Session) -> list[dict]:
    """Operational status of each ingestion connector — the "signal sources".

    Authoritative telemetry comes from ``source_status`` (written by ``rsi
    ingest`` after every run). For any source without a recorded run we fall
    back to deriving last-activity from the data it produced, so the panel is
    truthful even before the telemetry table has been populated. Comtrade has
    no per-row ingest timestamp, so its "last run" is proxied by the latest
    demand-series timestamp (sources are ingested together in one pipeline run).
    """
    recorded: dict[str, SourceStatus] = {}
    try:
        recorded = {s.name: s for s in session.scalars(select(SourceStatus))}
    except Exception:  # table absent on an older DB — fall back to derivation
        recorded = {}

    demand = {
        platform: (last_seen, count)
        for platform, last_seen, count in session.execute(
            select(Trend.platform, func.max(Trend.last_seen), func.count()).group_by(
                Trend.platform
            )
        ).all()
    }
    pipeline_run = session.scalar(select(func.max(Trend.last_seen)))
    flow_count = session.scalar(select(func.count()).select_from(TradeFlow)) or 0

    def _iso(dt) -> str | None:
        return dt.isoformat() if dt else None

    out: list[dict] = []
    for name, cls in CONNECTORS.items():
        meta = SOURCE_META.get(name, {})
        kind = meta.get("kind", "demand")
        st = recorded.get(name)
        if st is not None:
            last_run, status, rows = _iso(st.last_run_at), st.status, st.rows
        elif name in demand:  # demand feed with persisted series
            last_seen, count = demand[name]
            last_run, status, rows = _iso(last_seen), "ok" if count else "idle", count
        elif kind == "supply" and flow_count:  # comtrade: proxy run time
            last_run, status, rows = _iso(pipeline_run), "ok", flow_count
        else:  # opt-in feed not run yet
            last_run, status, rows = None, "idle", 0
        out.append(
            {
                "name": name,
                "label": meta.get("label", name.replace("_", " ").title()),
                "kind": kind,
                "default": bool(getattr(cls, "default", True)),
                "last_run_at": last_run,
                "status": status,
                "rows": rows,
            }
        )
    return out


def build_snapshot(session: Session, top_trends: int = 200) -> dict:
    country_names = dict(session.execute(select(Country.code, Country.name)).all())
    cat_names = dict(session.execute(select(ProductCategory.id, ProductCategory.name)).all())

    countries = [
        {
            "code": c.code,
            "name": c.name,
            "region": c.region,
            "lat": reference.CENTROIDS.get(c.code, (None, None))[0],
            "lon": reference.CENTROIDS.get(c.code, (None, None))[1],
            "is_origin": c.code in reference.ASIAN_ORIGINS,
        }
        for c in session.scalars(select(Country).order_by(Country.name))
    ]
    categories = [
        {"id": c.id, "name": c.name, "hs_code": c.hs_code}
        for c in session.scalars(select(ProductCategory).order_by(ProductCategory.name))
    ]

    latest_as_of = session.scalar(select(func.max(TrendScore.as_of)))
    trends = []
    if latest_as_of is not None:
        rows = session.execute(
            select(TrendScore, Trend)
            .join(Trend, Trend.id == TrendScore.trend_id)
            .where(TrendScore.as_of == latest_as_of)
            .order_by(TrendScore.momentum.desc())
            .limit(top_trends)
        ).all()
        for s, t in rows:
            trends.append(
                {
                    "term": t.term,
                    "platform": t.platform,
                    "category_id": t.category_id,
                    "category": cat_names.get(t.category_id),
                    "country_code": s.country_code,
                    "country": country_names.get(s.country_code, "Global"),
                    "momentum": round(s.momentum, 4),
                    "growth": round(s.growth_rate, 4),
                    "volume": round(s.volume, 2),
                    "acceleration": round(s.acceleration, 4),
                    "rank": s.rank,
                }
            )

    sources = {str(c["id"]): category_sources(session, c["id"]) for c in categories}

    triggers = []
    for t in session.scalars(select(Trigger).order_by(Trigger.score.desc())):
        triggers.append(
            {
                "id": t.id,
                "score": round(t.score, 4),
                "market_code": t.country_code,
                "market": country_names.get(t.country_code, "Global"),
                "category_id": t.category_id,
                "category": cat_names.get(t.category_id),
                "focus_partner": t.partner_code,
                "focus_partner_name": country_names.get(t.partner_code, t.partner_code),
                "rationale": t.rationale,
                "status": t.status,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "payload": t.payload,
            }
        )

    return {
        "generated_at": datetime.now(tz=UTC).isoformat(),
        "countries": countries,
        "categories": categories,
        "trends": trends,
        "signal_sources": _signal_sources(session),
        "sources": sources,
        "triggers": triggers,
        "flows": _origin_market_flows(session, cat_names, country_names),
        "competitors": _competitors(session, cat_names, country_names),
        "suppliers": _suppliers(session, cat_names, country_names),
        "leading_indicators": _leading_indicators(
            session, latest_as_of, cat_names, country_names
        ),
        "insights": _insights(session, cat_names, country_names),
    }
