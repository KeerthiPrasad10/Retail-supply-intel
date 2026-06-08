"""Lightweight data-access helpers shared by connectors and the engine."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import reference
from .models import Country, ProductCategory, Trend


def seed_reference(session: Session) -> None:
    """Insert reference countries and product categories if absent (idempotent)."""
    existing_countries = {c for c in session.scalars(select(Country.code))}
    for code, iso3, name, region in reference.COUNTRIES:
        if code not in existing_countries:
            session.add(Country(code=code, iso3=iso3, name=name, region=region))

    existing_cats = {c for c in session.scalars(select(ProductCategory.name))}
    for name, hs_code, keywords in reference.CATEGORIES:
        if name not in existing_cats:
            session.add(ProductCategory(name=name, hs_code=hs_code, keywords=keywords))
    session.flush()


def category_for_term(session: Session, term: str) -> ProductCategory | None:
    """Map a free-text trend term onto a product category via keyword match.

    A deliberately simple substring matcher for the MVP; the architecture doc
    describes the embedding-based classifier that replaces it in Phase 2.
    """
    needle = term.lower()
    best: ProductCategory | None = None
    best_len = 0
    for cat in session.scalars(select(ProductCategory)):
        for kw in cat.keywords or []:
            k = kw.lower()
            if (k in needle or needle in k) and len(k) > best_len:
                best, best_len = cat, len(k)
    return best


def get_or_create_trend(
    session: Session, term: str, platform: str, category_id: int | None = None
) -> Trend:
    trend = session.scalar(
        select(Trend).where(Trend.term == term, Trend.platform == platform)
    )
    if trend is None:
        trend = Trend(term=term, platform=platform, category_id=category_id)
        session.add(trend)
        session.flush()
    elif category_id and trend.category_id is None:
        trend.category_id = category_id
    return trend
