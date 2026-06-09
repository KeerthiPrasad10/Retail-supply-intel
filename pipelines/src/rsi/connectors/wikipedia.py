"""Wikimedia Pageviews connector — reliable, free, no API key.

Daily pageviews for a representative article per category are a robust proxy
for consumer interest momentum. English Wikipedia gives a global signal; a few
language editions are queried as a rough per-country proxy (de->DE, fr->FR ...).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ProductCategory, TrendObservation
from ..repository import get_or_create_trend
from .base import http_client

_API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"

# Representative, reliably-existing article per category.
CATEGORY_ARTICLES: dict[str, str] = {
    "Beauty & Cosmetics": "Cosmetics",
    "Tea & Matcha": "Matcha",
    "Coffee": "Coffee",
    "Footwear": "Sneakers",
    "Knitwear & Apparel": "Sweater",
    "Toys & Collectibles": "Stuffed toy",
    "Small Kitchen Appliances": "Air fryer",
    "Drinkware & Tumblers": "Vacuum flask",
    "Candles & Home Fragrance": "Candle",
    "Audio & Earbuds": "Headphones",
    "Pet Care": "Pet food",
}

# Wikipedia language edition -> country proxy.
PROJECT_COUNTRY: dict[str, str | None] = {
    "en.wikipedia": None,  # global signal
    "de.wikipedia": "DE",
    "fr.wikipedia": "FR",
    "es.wikipedia": "ES",
    "it.wikipedia": "IT",
    "nl.wikipedia": "NL",
    "pl.wikipedia": "PL",
}


class WikipediaConnector:
    name: ClassVar[str] = "wikipedia"
    # Off by default: pageviews are attention/reference interest, not purchase
    # demand, so they're a poor sourcing-trend signal. Kept for opt-in use only.
    default: ClassVar[bool] = False

    def run(self, session: Session, days: int = 60, **_: object) -> int:
        end = datetime.now(tz=UTC).date() - timedelta(days=2)  # API lags ~1d
        start = end - timedelta(days=days)
        written = 0
        with http_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                article = CATEGORY_ARTICLES.get(cat.name)
                if not article:
                    continue
                for project, country in PROJECT_COUNTRY.items():
                    written += self._fetch_article(
                        session, client, cat, article, project, country, start, end
                    )
        return written

    def _fetch_article(
        self, session, client, cat, article, project, country, start, end
    ) -> int:
        title = article.replace(" ", "_")
        url = (
            f"{_API}/{project}.org/all-access/all-agents/{title}/daily/"
            f"{start:%Y%m%d}/{end:%Y%m%d}"
        )
        try:
            resp = client.get(url)
            if resp.status_code == 404:  # article missing in this edition
                return 0
            resp.raise_for_status()
            items = resp.json().get("items", [])
        except Exception:
            return 0

        term = f"{cat.name} ({project.split('.')[0]})"
        trend = get_or_create_trend(session, term, self.name, cat.id)
        n = 0
        for it in items:
            ts = datetime.strptime(it["timestamp"], "%Y%m%d%H").replace(
                tzinfo=UTC
            )
            exists = session.scalar(
                select(TrendObservation.id).where(
                    TrendObservation.trend_id == trend.id,
                    TrendObservation.country_code == country,
                    TrendObservation.observed_at == ts,
                    TrendObservation.source == self.name,
                )
            )
            if exists:
                continue
            session.add(
                TrendObservation(
                    trend_id=trend.id,
                    country_code=country,
                    observed_at=ts,
                    value=float(it["views"]),
                    source=self.name,
                )
            )
            n += 1
        session.flush()
        return n
