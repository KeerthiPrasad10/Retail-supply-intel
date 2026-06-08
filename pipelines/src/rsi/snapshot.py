"""Build a read-optimised JSON snapshot consumed by the web dashboard.

The web app reads live data from Supabase when configured; otherwise it falls
back to this committed snapshot so ``npm run dev`` renders real data with zero
setup. ``rsi export`` writes it to ``web/lib/snapshot.json``.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import REPO_ROOT
from .correlation.engine import category_sources
from .models import Country, ProductCategory, Trend, TrendScore, Trigger

DEFAULT_SNAPSHOT_PATH = REPO_ROOT / "web" / "lib" / "snapshot.json"


def build_snapshot(session: Session, top_trends: int = 200) -> dict:
    country_names = dict(session.execute(select(Country.code, Country.name)).all())
    cat_names = dict(session.execute(select(ProductCategory.id, ProductCategory.name)).all())

    countries = [
        {"code": c.code, "name": c.name, "region": c.region}
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
                    "rank": s.rank,
                }
            )

    sources = {
        str(c["id"]): category_sources(session, c["id"]) for c in categories
    }

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
        "sources": sources,
        "triggers": triggers,
    }
