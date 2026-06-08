"""TikTok connector — social-demand momentum via the Apify actor platform.

Runs `clockworks/tiktok-hashtag-scraper` for a hashtag per category, buckets the
returned videos by day and sums play counts into a daily ``trend_observations``
series. Opt-in (``default = False``; run via ``rsi ingest tiktok``); no-ops
without ``RSI_APIFY_TOKEN``.
"""

from __future__ import annotations

from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory
from ..repository import get_or_create_trend
from .apify_base import apify_client, bucket_daily, hashtag_for, run_actor_items, write_daily

ACTOR = "clockworks~tiktok-hashtag-scraper"


def aggregate_daily(videos: list[dict], metric: str = "playCount"):
    """Daily-bucketed engagement for scraped TikTok videos (thin wrapper)."""
    return bucket_daily(videos, ["createTimeISO", "createTime"], lambda v: v.get(metric) or 0.0)


class TikTokTrendsConnector:
    name: ClassVar[str] = "tiktok"
    default: ClassVar[bool] = False  # opt-in: consumes paid Apify credits

    def run(
        self, session: Session, results_per_page: int = 50, metric: str = "playCount", **_: object
    ) -> int:
        token = get_settings().apify_token
        if not token:
            return 0
        written = 0
        with apify_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                tag = hashtag_for(cat)
                items = run_actor_items(
                    client, ACTOR, token, {"hashtags": [tag], "resultsPerPage": results_per_page}
                )
                if not items:
                    continue
                points = aggregate_daily(items, metric)
                trend = get_or_create_trend(session, f"#{tag}", self.name, cat.id)
                written += write_daily(session, trend.id, self.name, None, points)
        return written
