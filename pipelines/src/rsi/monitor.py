"""Monitor engine: demand momentum for any user-chosen terms in any markets.

A *monitor* (defined by a user elsewhere, e.g. the supplier map's monitor chat) names a few
terms and the markets to watch. :func:`collect` runs RSI's own connectors for exactly those, in a
throwaway in-memory database (one category per term, so each connector's per-category loop fetches
that term), and scores every (term, platform, market) series with
:func:`~rsi.trends.scoring.series_momentum`, the same scoring the pipeline uses. Nothing touches
RSI's main database or the dashboard snapshot.

Snapshot-style sources (AliExpress units sold) yield one point per run, so momentum only exists
across runs: the caller passes each series' earlier points back as ``history`` and stores the
extended ``points`` it gets back.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from .connectors import CONNECTORS
from .models import Base, Country, ProductCategory, Trend, TrendObservation
from .repository import get_or_create_trend
from .trends.scoring import series_acceleration, series_momentum

# Platforms a monitor can follow. Amazon is left out: its connector maps RSI's own category names
# to best-seller pages, so it cannot follow a free-text term.
MONITOR_PLATFORMS = ("google_trends", "tiktok", "instagram", "pinterest", "aliexpress")
MAX_TERMS = 3
MAX_MARKETS = 5
KEEP_POINTS = 180  # points kept per series between runs (~6 months of daily data)
STRONG_MOMENTUM = 1.0  # rsi.insights.engine.STRONG_MOMENTUM


def _term_of(trend_term: str) -> str:
    """'matcha (pinterest)' -> 'matcha', '#matcha' -> 'matcha', 'matcha (DE)' -> 'matcha'."""
    t = trend_term.split(" (")[0]
    return t.lstrip("#")


def collect(
    terms: Iterable[str],
    markets: Iterable[str] = (),
    platforms: Iterable[str] = MONITOR_PLATFORMS,
    history: Iterable[dict] = (),
    window: int = 14,
    connectors: dict[str, type] | None = None,
) -> list[dict]:
    """Fetch and score demand for ``terms`` in ``markets`` (ISO-2). Google Trends is the
    per-market source; the social and marketplace feeds are global.

    ``history``: earlier series, each ``{"term", "platform", "market", "points": [[date, value]]}``.
    Returns one dict per series: term, platform, market (None = global), momentum, growth, volume,
    acceleration, rising (momentum at RSI's strong mark), points (the extended series, trimmed to
    KEEP_POINTS) and new_points (how many dates this run added; 0 = the source returned nothing).
    """
    terms = [t.strip() for t in terms if t and t.strip()][:MAX_TERMS]
    markets = [m.strip().upper() for m in markets if m and m.strip()][:MAX_MARKETS]
    platforms = [p for p in platforms if p in MONITOR_PLATFORMS]
    registry = connectors or CONNECTORS
    if not terms or not platforms:
        return []

    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    session: Session = sessionmaker(bind=engine, future=True)()
    try:
        for code in markets:
            session.add(Country(code=code, iso3=code, name=code, region=""))
        for t in terms:
            session.add(ProductCategory(name=t, keywords=[t]))
        session.flush()
        cats = {c.name.lower(): c for c in session.scalars(select(ProductCategory))}

        seeded: dict[tuple[str, str, str | None], int] = {}
        for h in history:
            cat = cats.get(str(h.get("term", "")).lower())
            if not cat or h.get("platform") not in platforms:
                continue
            market = h.get("market") or None
            if market and market not in markets:
                continue
            trend = get_or_create_trend(session, _history_term(h), h["platform"], cat.id)
            for day, value in h.get("points") or []:
                session.add(
                    TrendObservation(
                        trend_id=trend.id,
                        country_code=market,
                        source=h["platform"],
                        observed_at=_day(day),
                        value=float(value),
                    )
                )
            seeded[(cat.name.lower(), h["platform"], market)] = len(h.get("points") or [])
        session.commit()  # in-memory SQLite lives on one pooled connection: commits keep it

        for name in platforms:
            cls = registry.get(name)
            if cls is None:
                continue
            kwargs = {"geos": markets} if name == "google_trends" and markets else {}
            try:
                cls().run(session, **kwargs)
                session.commit()
            except Exception:  # noqa: BLE001 - a failing source never aborts a monitor
                session.rollback()  # drops that source's rows only; the history is committed

        series: dict[tuple[str, str, str | None], list[tuple[datetime, float]]] = defaultdict(list)
        rows = session.execute(
            select(
                Trend.term,
                Trend.platform,
                Trend.category_id,
                TrendObservation.country_code,
                TrendObservation.observed_at,
                TrendObservation.value,
            ).join(TrendObservation, TrendObservation.trend_id == Trend.id)
        )
        by_id = {c.id: c.name for c in cats.values()}
        for _term, platform, cat_id, market, at, value in rows:
            series[(by_id.get(cat_id, _term_of(_term)), platform, market)].append((_day(at), value))
    finally:
        session.close()
        engine.dispose()

    out = []
    for (term, platform, market), points in series.items():
        points = sorted({p[0]: p for p in points}.values())[-KEEP_POINTS:]
        values = [v for _, v in points]
        momentum, growth, volume = series_momentum(values, window=window)
        out.append(
            {
                "term": term,
                "platform": platform,
                "market": market,
                "momentum": round(momentum, 4),
                "growth": round(growth, 4),
                "volume": round(volume, 4),
                "acceleration": round(series_acceleration(values, window=window), 4),
                "rising": momentum >= STRONG_MOMENTUM,
                "points": [[d.date().isoformat(), v] for d, v in points],
                "new_points": len(points) - seeded.get((term.lower(), platform, market), 0),
            }
        )
    out.sort(key=lambda s: -s["momentum"])
    return out


def _history_term(h: dict) -> str:
    """One trend name per (platform, market): seeded series never collide on (term, platform)."""
    return f"{h['term']} ({h.get('market') or 'global'})"


def _day(value) -> datetime:
    if isinstance(value, datetime):
        d = value
    else:
        d = datetime.fromisoformat(str(value)[:10])
    return datetime(d.year, d.month, d.day, tzinfo=UTC)
