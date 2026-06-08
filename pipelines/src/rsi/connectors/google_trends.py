"""Google Trends connector via pytrends (unofficial, no API key).

Per-country interest-over-time for category keywords. Google rate-limits
aggressively (HTTP 429); the connector degrades gracefully — partial or zero
results never abort a pipeline run.
"""

from __future__ import annotations

import time
from datetime import UTC
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ProductCategory, TrendObservation
from ..repository import get_or_create_trend

# Countries to pull per-geo interest for (Google geo = ISO alpha-2).
DEFAULT_GEOS = ["DE", "GB", "FR", "IT", "ES", "NL", "PL", "US"]


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
