"""Instagram connector — social-demand momentum via the Apify actor platform.

Runs `apify/instagram-hashtag-scraper` for a hashtag per category, buckets posts
by day and sums engagement (likes + comments) into a daily ``trend_observations``
series. Opt-in (``default = False``; run via ``rsi ingest instagram``); no-ops
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

ACTOR = "apify~instagram-hashtag-scraper"


def _engagement(post: dict) -> float:
    return float(post.get("likesCount") or 0) + float(post.get("commentsCount") or 0)


class InstagramTrendsConnector:
    name: ClassVar[str] = "instagram"
    default: ClassVar[bool] = False  # opt-in: consumes paid Apify credits

    def run(self, session: Session, results_limit: int = 30, **_: object) -> int:
        token = get_settings().apify_token
        if not token:
            return 0
        written = 0
        with apify_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                tag = hashtag_for(cat)
                items = run_actor_items(
                    client,
                    ACTOR,
                    token,
                    {"hashtags": [tag], "resultsType": "posts", "resultsLimit": results_limit},
                )
                if not items:
                    continue
                points = bucket_daily(items, ["timestamp"], _engagement)
                trend = get_or_create_trend(session, f"#{tag}", self.name, cat.id)
                written += write_daily(session, trend.id, self.name, None, points)
        return written
