"""AliExpress connector — supply-side demand proxy via the Apify actor platform.

Runs `piotrv1001/aliexpress-listings-scraper` for a search per category and
records ONE daily snapshot point per category: the summed "units sold" across
the returned listings — a proxy for how much of that category is being pushed /
moved by (mostly Chinese) manufacturers. A *supply-side* signal that complements
the consumer-demand connectors and fits the sourcing thesis.

Listings carry no per-item date, so momentum builds over repeated (scheduled)
runs. Opt-in (``default = False``; run via ``rsi ingest aliexpress``); no-ops
without ``RSI_APIFY_TOKEN``.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory
from ..repository import get_or_create_trend
from .apify_base import apify_client, run_actor_items, write_daily

ACTOR = "piotrv1001~aliexpress-listings-scraper"


def parse_sold(text: object) -> float:
    """Parse AliExpress 'units sold' strings: '5 sold', '1,000+ sold', '2.5k sold'."""
    if not isinstance(text, str):
        return 0.0
    t = text.lower().replace(",", "").replace("+", "").replace("sold", "").strip()
    if not t:
        return 0.0
    mult = 1.0
    if t.endswith("k"):
        mult, t = 1_000.0, t[:-1]
    elif t.endswith("m"):
        mult, t = 1_000_000.0, t[:-1]
    m = re.match(r"[\d.]+", t.strip())
    if not m:
        return 0.0
    try:
        return float(m.group()) * mult
    except ValueError:
        return 0.0


class AliExpressTrendsConnector:
    name: ClassVar[str] = "aliexpress"
    default: ClassVar[bool] = False  # opt-in: consumes paid Apify credits

    def run(self, session: Session, **_: object) -> int:
        token = get_settings().apify_token
        if not token:
            return 0
        now = datetime.now(tz=UTC)
        today = datetime(now.year, now.month, now.day, tzinfo=UTC)
        written = 0
        with apify_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                keyword = (cat.keywords or [cat.name])[0]
                slug = "-".join(keyword.lower().split())
                url = f"https://www.aliexpress.com/w/wholesale-{slug}.html"
                items = run_actor_items(client, ACTOR, token, {"searchUrls": [url]})
                if not items:
                    continue
                value = sum(parse_sold(it.get("totalSold")) for it in items)
                trend = get_or_create_trend(session, f"{keyword} (aliexpress)", self.name, cat.id)
                written += write_daily(session, trend.id, self.name, None, [(today, value)])
        return written
