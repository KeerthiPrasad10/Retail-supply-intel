"""Amazon Best Sellers connector — retail-demand snapshot via Apify.

Runs `junglee/amazon-bestsellers` over a best-seller category page per product
category/market and records ONE daily snapshot point per (category, market):
the summed review count of the current best-sellers, a demand-magnitude proxy.
Unlike the social connectors there's no per-item date, so momentum builds up over
repeated (scheduled) runs rather than within a single run.

Category → best-seller URL mapping is coarse (Amazon's browse tree ≠ our HS
categories) and best-effort. Opt-in (``default = False``; run via
``rsi ingest amazon``); no-ops without ``RSI_APIFY_TOKEN``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory
from ..repository import get_or_create_trend
from .apify_base import apify_client, run_actor_items, write_daily

ACTOR = "junglee~amazon-bestsellers"

# Best-effort: our category -> {market: Amazon best-seller category URL}.
_DE = "https://www.amazon.de/gp/bestsellers"
BESTSELLER_URLS: dict[str, dict[str, str]] = {
    "Small Kitchen Appliances": {"DE": f"{_DE}/kitchen/"},
    "Drinkware & Tumblers": {"DE": f"{_DE}/kitchen/"},
    "Beauty & Cosmetics": {"DE": f"{_DE}/beauty/"},
    "Audio & Earbuds": {"DE": f"{_DE}/electronics/"},
    "Footwear": {"DE": f"{_DE}/shoes/"},
    "Coffee": {"DE": f"{_DE}/grocery/"},
    "Tea & Matcha": {"DE": f"{_DE}/grocery/"},
    "Pet Care": {"DE": f"{_DE}/pet-supplies/"},
    "Candles & Home Fragrance": {"DE": f"{_DE}/home/"},
    "Knitwear & Apparel": {"DE": f"{_DE}/fashion/"},
    "Toys & Collectibles": {"DE": f"{_DE}/toys/"},
}


class AmazonBestsellersConnector:
    name: ClassVar[str] = "amazon"
    default: ClassVar[bool] = False  # opt-in: consumes paid Apify credits

    def run(self, session: Session, max_items: int = 20, **_: object) -> int:
        token = get_settings().apify_token
        if not token:
            return 0
        now = datetime.now(tz=UTC)
        today = datetime(now.year, now.month, now.day, tzinfo=UTC)
        written = 0
        with apify_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                for market, url in BESTSELLER_URLS.get(cat.name, {}).items():
                    payload = {"categoryUrls": [url], "maxItemsPerStartUrl": max_items}
                    items = run_actor_items(client, ACTOR, token, payload)
                    if not items:
                        continue
                    value = sum(float(it.get("reviewsCount") or 0) for it in items)
                    term = f"{cat.name} (amazon {market})"
                    trend = get_or_create_trend(session, term, self.name, cat.id)
                    written += write_daily(session, trend.id, self.name, market, [(today, value)])
        return written
