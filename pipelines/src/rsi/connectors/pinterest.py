"""Pinterest connector — search-intent momentum via the Apify actor platform.

Runs `scrapapi/pinterest-pins-videos-search-scraper` for a keyword per category,
then buckets returned pins by creation day and sums reaction counts into a daily
``trend_observations`` series. Opt-in (``default = False``; run via
``rsi ingest pinterest``); no-ops without ``RSI_APIFY_TOKEN``.

Pins are returned by relevance (not recency), so the daily series is a coarse
engagement-by-creation-date proxy — a best-effort social signal.
"""

from __future__ import annotations

from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory
from ..repository import get_or_create_trend
from .apify_base import apify_client, bucket_daily, run_actor_items, write_daily

ACTOR = "scrapapi~pinterest-pins-videos-search-scraper"


def _reactions(pin: dict) -> float:
    counts = pin.get("reaction_counts") or {}
    if not isinstance(counts, dict):
        return 0.0
    return sum(float(v or 0) for v in counts.values())


class PinterestTrendsConnector:
    name: ClassVar[str] = "pinterest"
    default: ClassVar[bool] = False  # opt-in: consumes paid Apify credits

    def run(self, session: Session, max_items: int = 40, **_: object) -> int:
        token = get_settings().apify_token
        if not token:
            return 0
        written = 0
        with apify_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                term = (cat.keywords or [cat.name])[0]
                payload = {"searchTerms": [term], "maxItems": max_items, "filtre": "All"}
                items = run_actor_items(client, ACTOR, token, payload)
                if not items:
                    continue
                points = bucket_daily(items, ["created_at"], _reactions)
                trend = get_or_create_trend(session, f"{term} (pinterest)", self.name, cat.id)
                written += write_daily(session, trend.id, self.name, None, points)
        return written
