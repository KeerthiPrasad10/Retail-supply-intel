"""TikTok connector — social-demand momentum via the Apify actor platform.

Runs the `clockworks/tiktok-hashtag-scraper` actor for a hashtag per category,
then buckets the returned videos by day and sums engagement (play counts) into a
daily ``trend_observations`` series — a momentum proxy for the social signal the
free sources don't capture.

It's **opt-in** (``default = False``: excluded from a bare ``rsi ingest``, run via
``rsi ingest tiktok``) and no-ops without ``RSI_APIFY_TOKEN`` (Apify spends
credits per result). Set the token in the environment, never in the repo:

    export RSI_APIFY_TOKEN=apify_api_xxx
    uv run rsi ingest tiktok
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from typing import ClassVar

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory, TrendObservation
from ..repository import get_or_create_trend

ACTOR = "clockworks~tiktok-hashtag-scraper"
_API = f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items"

# Cleaner hashtags than the raw category keyword for the well-known categories.
HASHTAG_BY_CATEGORY: dict[str, str] = {
    "Beauty & Cosmetics": "makeup",
    "Tea & Matcha": "matcha",
    "Coffee": "coffee",
    "Footwear": "sneakers",
    "Knitwear & Apparel": "knitwear",
    "Toys & Collectibles": "labubu",
    "Small Kitchen Appliances": "airfryer",
    "Drinkware & Tumblers": "stanleycup",
    "Candles & Home Fragrance": "candle",
    "Audio & Earbuds": "earbuds",
    "Pet Care": "petfood",
}


def hashtag_for(cat: ProductCategory) -> str:
    if cat.name in HASHTAG_BY_CATEGORY:
        return HASHTAG_BY_CATEGORY[cat.name]
    seed = (cat.keywords or [cat.name])[0]
    return "".join(ch for ch in seed.lower() if ch.isalnum())


def aggregate_daily(videos: list[dict], metric: str = "playCount") -> list[tuple[datetime, float]]:
    """Bucket scraped videos by calendar day, summing ``metric``. Pure + testable."""
    buckets: dict[datetime, float] = defaultdict(float)
    for v in videos:
        iso = v.get("createTimeISO")
        ts: datetime | None = None
        try:
            if iso:
                ts = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            elif v.get("createTime") is not None:
                ts = datetime.fromtimestamp(int(v["createTime"]), tz=UTC)
        except (TypeError, ValueError, OSError):
            ts = None
        if ts is None:
            continue
        day = datetime(ts.year, ts.month, ts.day, tzinfo=UTC)
        buckets[day] += float(v.get(metric) or 0.0)
    return sorted(buckets.items())


class TikTokTrendsConnector:
    name: ClassVar[str] = "tiktok"
    default: ClassVar[bool] = False  # opt-in: consumes paid Apify credits

    def run(
        self,
        session: Session,
        results_per_page: int = 50,
        metric: str = "playCount",
        **_: object,
    ) -> int:
        token = get_settings().apify_token
        if not token:  # graceful no-op when unconfigured
            return 0

        written = 0
        headers = {"User-Agent": get_settings().user_agent}
        with httpx.Client(timeout=300.0, headers=headers) as client:
            for cat in session.scalars(select(ProductCategory)):
                tag = hashtag_for(cat)
                written += self._fetch(session, client, token, cat, tag, results_per_page, metric)
        return written

    def _fetch(self, session, client, token, cat, tag, results_per_page, metric) -> int:
        payload = {"hashtags": [tag], "resultsPerPage": results_per_page}
        try:
            resp = client.post(_API, params={"token": token}, json=payload)
            resp.raise_for_status()
            videos = resp.json()
        except Exception:
            return 0
        if not isinstance(videos, list) or not videos:
            return 0

        term = f"#{tag}"
        trend = get_or_create_trend(session, term, self.name, cat.id)
        n = 0
        for day, value in aggregate_daily(videos, metric):
            exists = session.scalar(
                select(TrendObservation.id).where(
                    TrendObservation.trend_id == trend.id,
                    TrendObservation.country_code.is_(None),
                    TrendObservation.observed_at == day,
                    TrendObservation.source == self.name,
                )
            )
            if exists:
                continue
            session.add(
                TrendObservation(
                    trend_id=trend.id,
                    country_code=None,  # TikTok hashtag data is global
                    observed_at=day,
                    value=value,
                    source=self.name,
                )
            )
            n += 1
        session.flush()
        return n
