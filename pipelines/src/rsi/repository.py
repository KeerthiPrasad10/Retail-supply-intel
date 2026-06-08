"""Lightweight data-access helpers shared by connectors and the engine."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import reference
from .models import (
    Competitor,
    CompetitorSourcing,
    Country,
    ProductCategory,
    Supplier,
    Trend,
)


def seed_reference(session: Session) -> None:
    """Insert reference data if absent (idempotent).

    Seeds countries, product categories, the top-10 competitors, and the
    best-effort (researched, unverified) Asian supplier + competitor-sourcing
    links used by the market-intelligence views.
    """
    existing_countries = {c for c in session.scalars(select(Country.code))}
    for code, iso3, name, region in reference.COUNTRIES:
        if code not in existing_countries:
            session.add(Country(code=code, iso3=iso3, name=name, region=region))

    existing_cats = {c for c in session.scalars(select(ProductCategory.name))}
    for name, hs_code, keywords in reference.CATEGORIES:
        if name not in existing_cats:
            session.add(ProductCategory(name=name, hs_code=hs_code, keywords=keywords))
    session.flush()

    _seed_competitors(session)
    _seed_suppliers(session)
    _seed_competitor_sourcing(session)
    session.flush()


def _seed_competitors(session: Session) -> None:
    existing = {c for c in session.scalars(select(Competitor.name))}
    for name, home in reference.COMPETITORS:
        if name not in existing:
            session.add(Competitor(name=name, home_country=home))


def _seed_suppliers(session: Session) -> None:
    cat_ids = dict(session.execute(select(ProductCategory.name, ProductCategory.id)).all())
    existing = {(s.name, s.category_id) for s in session.scalars(select(Supplier))}
    for name, country, category in reference.SUPPLIERS:
        cat_id = cat_ids.get(category)
        if cat_id is None or (name, cat_id) in existing:
            continue
        session.add(
            Supplier(
                name=name,
                country_code=country,
                category_id=cat_id,
                source="research",
            )
        )


def _seed_competitor_sourcing(session: Session) -> None:
    session.flush()
    comp_ids = dict(session.execute(select(Competitor.name, Competitor.id)).all())
    cat_ids = dict(session.execute(select(ProductCategory.name, ProductCategory.id)).all())
    existing = {
        (cs.competitor_id, cs.category_id, cs.partner_code)
        for cs in session.scalars(select(CompetitorSourcing))
    }
    for competitor, category, partner in reference.COMPETITOR_SOURCING:
        comp_id = comp_ids.get(competitor)
        cat_id = cat_ids.get(category)
        if comp_id is None or cat_id is None or (comp_id, cat_id, partner) in existing:
            continue
        session.add(
            CompetitorSourcing(
                competitor_id=comp_id,
                category_id=cat_id,
                partner_code=partner,
                signal=1.0,
                source="research",
            )
        )


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
