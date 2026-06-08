"""Shared helpers for Apify-backed connectors (TikTok, Instagram, Pinterest,
Amazon). All of these run an actor synchronously, then either bucket dated items
into a daily ``trend_observations`` series or record a single snapshot point.

Token comes from ``RSI_APIFY_TOKEN`` (env only, never committed). Every Apify
connector is opt-in (``default = False``) and consumes Apify credits.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ProductCategory, TrendObservation

_RUN_SYNC = "https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"

# Cleaner hashtags than the raw keyword for the well-known categories (shared by
# the TikTok + Instagram connectors).
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


def apify_client() -> httpx.Client:
    # Actor runs can take 1–2 min; generous timeout, tolerate failures upstream.
    return httpx.Client(timeout=300.0, headers={"User-Agent": get_settings().user_agent})


def run_actor_items(client: httpx.Client, actor: str, token: str, payload: dict) -> list[dict]:
    """Run an actor synchronously and return its dataset items (``[]`` on any error)."""
    try:
        resp = client.post(_RUN_SYNC.format(actor=actor), params={"token": token}, json=payload)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []
    return data if isinstance(data, list) else []


def parse_dt(value: object) -> datetime | None:
    """Parse a timestamp from unix seconds, ISO-8601, or RFC-2822 — else None."""
    if value is None:
        return None
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip().isdigit()):
        try:
            return datetime.fromtimestamp(int(value), tz=UTC)
        except (ValueError, OSError, OverflowError):
            return None
    if isinstance(value, str):
        v = value.strip()
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            pass
        try:
            dt = parsedate_to_datetime(v)
            return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
        except (TypeError, ValueError):
            return None
    return None


def bucket_daily(
    items: Iterable[dict],
    time_keys: list[str],
    metric_fn: Callable[[dict], float],
) -> list[tuple[datetime, float]]:
    """Bucket items by calendar day (UTC), summing ``metric_fn``. Pure + testable."""
    buckets: dict[datetime, float] = defaultdict(float)
    for it in items:
        ts: datetime | None = None
        for k in time_keys:
            ts = parse_dt(it.get(k))
            if ts:
                break
        if ts is None:
            continue
        day = datetime(ts.year, ts.month, ts.day, tzinfo=UTC)
        try:
            buckets[day] += float(metric_fn(it) or 0.0)
        except (TypeError, ValueError):
            continue
    return sorted(buckets.items())


def write_daily(
    session: Session,
    trend_id: int,
    source: str,
    country: str | None,
    points: list[tuple[datetime, float]],
) -> int:
    """Persist daily points as ``trend_observations`` (idempotent). Returns rows written."""
    country_cond = (
        TrendObservation.country_code.is_(None)
        if country is None
        else TrendObservation.country_code == country
    )
    n = 0
    for day, value in points:
        exists = session.scalar(
            select(TrendObservation.id).where(
                TrendObservation.trend_id == trend_id,
                country_cond,
                TrendObservation.observed_at == day,
                TrendObservation.source == source,
            )
        )
        if exists:
            continue
        session.add(
            TrendObservation(
                trend_id=trend_id,
                country_code=country,
                observed_at=day,
                value=value,
                source=source,
            )
        )
        n += 1
    session.flush()
    return n
