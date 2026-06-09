"""Google Trends connector — interest-over-time for category keywords.

Backend is chosen at runtime:

* **With ``RSI_APIFY_TOKEN``** → the Apify ``apify/google-trends-scraper`` actor,
  which proxies Google Trends through residential IPs and so works reliably from
  CI / datacenter IPs (where the free path gets 429-blocked).
* **Otherwise** → ``pytrends`` (unofficial, no key) — fine locally, rate-limited
  from datacenter IPs.

Either way the connector degrades gracefully: partial/zero results never abort a
pipeline run.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory, TrendObservation
from ..repository import get_or_create_trend

# Countries to pull per-geo interest for (Google geo = ISO alpha-2) — pytrends path.
DEFAULT_GEOS = ["DE", "GB", "FR", "IT", "ES", "NL", "PL", "US"]

# Apify actor that proxies Google Trends (reliable from CI).
_APIFY_ACTOR = "apify~google-trends-scraper"


def _interest_points(items: list[dict], parse_dt) -> list[tuple[datetime, float]]:
    """Daily (date, value) points from google-trends-scraper ``interestOverTime``."""
    buckets: dict[datetime, float] = {}
    for it in items:
        for entry in it.get("interestOverTime_timelineData") or []:
            ts = parse_dt(entry.get("time"))
            if ts is None:
                continue
            value = entry.get("value")
            if isinstance(value, list):  # single term still returns a 1-element list
                value = value[0] if value else 0
            day = datetime(ts.year, ts.month, ts.day, tzinfo=UTC)
            try:
                buckets[day] = buckets.get(day, 0.0) + float(value or 0)
            except (TypeError, ValueError):
                continue
    return sorted(buckets.items())


class GoogleTrendsConnector:
    name: ClassVar[str] = "google_trends"

    def run(
        self,
        session: Session,
        geos: list[str] | None = None,
        timeframe: str = "today 3-m",
        pause: float = 1.5,
        **_: object,
    ) -> int:
        if get_settings().apify_token:
            return self._run_apify(session, get_settings().apify_token, timeframe)
        return self._run_pytrends(session, geos, timeframe, pause)

    # --- Apify backend (reliable from CI) --------------------------------- #
    def _run_apify(self, session: Session, token: str, timeframe: str) -> int:
        from .apify_base import apify_client, parse_dt, run_actor_items, write_daily

        written = 0
        with apify_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                keyword = (cat.keywords or [cat.name])[0]
                items = run_actor_items(
                    client,
                    _APIFY_ACTOR,
                    token,
                    {"searchTerms": [keyword], "timeRange": timeframe, "geo": ""},
                )
                points = _interest_points(items, parse_dt)
                if not points:
                    continue
                trend = get_or_create_trend(session, f"{keyword} (trends)", self.name, cat.id)
                written += write_daily(session, trend.id, self.name, None, points)
        return written

    # --- pytrends backend (local / no token) ------------------------------ #
    def _run_pytrends(
        self, session: Session, geos: list[str] | None, timeframe: str, pause: float
    ) -> int:
        try:
            from pytrends.request import TrendReq
        except ImportError:  # pragma: no cover
            return 0

        geos = geos or DEFAULT_GEOS
        pytrends = TrendReq(hl="en-US", tz=0)
        written = 0

        for cat in session.scalars(select(ProductCategory)):
            keyword = (cat.keywords or [cat.name])[0]
            for geo in geos:
                written += self._fetch(session, pytrends, cat, keyword, geo, timeframe)
                time.sleep(pause)  # be polite; reduce 429s
        return written

    def _fetch(self, session, pytrends, cat, keyword, geo, timeframe) -> int:
        try:
            pytrends.build_payload([keyword], geo=geo, timeframe=timeframe)
            df = pytrends.interest_over_time()
        except Exception:
            return 0
        if df is None or df.empty or keyword not in df.columns:
            return 0

        term = f"{keyword} ({geo})"
        trend = get_or_create_trend(session, term, self.name, cat.id)
        n = 0
        for idx, value in df[keyword].items():
            ts = idx.to_pydatetime().replace(tzinfo=UTC)
            exists = session.scalar(
                select(TrendObservation.id).where(
                    TrendObservation.trend_id == trend.id,
                    TrendObservation.country_code == geo,
                    TrendObservation.observed_at == ts,
                    TrendObservation.source == self.name,
                )
            )
            if exists:
                continue
            session.add(
                TrendObservation(
                    trend_id=trend.id,
                    country_code=geo,
                    observed_at=ts,
                    value=float(value),
                    source=self.name,
                )
            )
            n += 1
        session.flush()
        return n
