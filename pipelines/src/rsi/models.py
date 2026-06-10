"""SQLAlchemy ORM models — the single source of truth for the data model.

These run unchanged on SQLite (local dev) and Postgres/Supabase (prod).
``rsi schema --dialect postgres`` emits matching DDL for the Supabase migration.

Conceptually the schema spans three layers:

* **Reference**   — ``countries``, ``product_categories``
* **Demand**      — ``trends`` + ``trend_observations`` -> ``trend_scores``
* **Supply**      — ``suppliers``, ``trade_flows``, ``competitors``,
                    ``competitor_sourcing``
* **Output**      — ``triggers`` (demand x supply correlation results)
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(tz=UTC)


class Base(DeclarativeBase):
    pass


# --------------------------------------------------------------------------- #
# Reference
# --------------------------------------------------------------------------- #
class Country(Base):
    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(String(2), primary_key=True)  # ISO-3166 alpha-2
    iso3: Mapped[str | None] = mapped_column(String(3))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    region: Mapped[str | None] = mapped_column(String(64))


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    # Harmonized System code (HS2/HS4) — the bridge between social trends and
    # customs/trade data.
    hs_code: Mapped[str | None] = mapped_column(String(6), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    # Search terms used to map free-text trends onto this category.
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)


# --------------------------------------------------------------------------- #
# Demand signals
# --------------------------------------------------------------------------- #
class Trend(Base):
    __tablename__ = "trends"
    __table_args__ = (UniqueConstraint("term", "platform", name="uq_trend_term_platform"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    term: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    # one of: google_trends | tiktok | instagram | pinterest | amazon | aliexpress
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    observations: Mapped[list[TrendObservation]] = relationship(
        back_populates="trend", cascade="all, delete-orphan"
    )


class TrendObservation(Base):
    __tablename__ = "trend_observations"
    __table_args__ = (
        UniqueConstraint(
            "trend_id", "country_code", "observed_at", "source", name="uq_obs"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trend_id: Mapped[int] = mapped_column(ForeignKey("trends.id"), nullable=False)
    country_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)  # interest / pageviews
    source: Mapped[str] = mapped_column(String(32), nullable=False)

    trend: Mapped[Trend] = relationship(back_populates="observations")


class TrendScore(Base):
    """Per-(trend, country) momentum snapshot, recomputed by the scoring step."""

    __tablename__ = "trend_scores"
    __table_args__ = (
        UniqueConstraint("trend_id", "country_code", "as_of", name="uq_score"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trend_id: Mapped[int] = mapped_column(ForeignKey("trends.id"), nullable=False)
    country_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    momentum: Mapped[float] = mapped_column(Float, nullable=False)
    growth_rate: Mapped[float] = mapped_column(Float, default=0.0)
    volume: Mapped[float] = mapped_column(Float, default=0.0)
    # Growth-of-growth: positive = demand is accelerating (leading indicator of
    # what is about to trend). Computed by the scoring step.
    acceleration: Mapped[float] = mapped_column(Float, default=0.0)
    rank: Mapped[int | None] = mapped_column(Integer)


# --------------------------------------------------------------------------- #
# Supply signals
# --------------------------------------------------------------------------- #
class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    country_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    external_id: Mapped[str | None] = mapped_column(String(128))
    source: Mapped[str | None] = mapped_column(String(32))


class TradeFlow(Base):
    """Aggregate customs/trade flow: reporter imports `category` from partner.

    Sourced from UN Comtrade. ``partner_code`` is the country of origin — the
    answer to "where is this bought from".
    """

    __tablename__ = "trade_flows"
    __table_args__ = (
        UniqueConstraint(
            "reporter_code", "partner_code", "hs_code", "period", "flow",
            name="uq_trade_flow",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reporter_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    partner_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    hs_code: Mapped[str | None] = mapped_column(String(6), index=True)
    period: Mapped[str] = mapped_column(String(8), nullable=False)  # YYYY or YYYYMM
    flow: Mapped[str] = mapped_column(String(8), default="import")  # import|export
    trade_value: Mapped[float] = mapped_column(Float, default=0.0)  # USD
    qty: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(32), default="comtrade")


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    home_country: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))


class CompetitorSourcing(Base):
    """Signal that a competitor sources a category from a supplier / origin.

    For the MVP this is sparse (seeded / bill-of-lading where available); it is
    the hook for Phase-2 per-company import data.
    """

    __tablename__ = "competitor_sourcing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    competitor_id: Mapped[int] = mapped_column(ForeignKey("competitors.id"), nullable=False)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    partner_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    period: Mapped[str | None] = mapped_column(String(8))
    signal: Mapped[float] = mapped_column(Float, default=1.0)
    source: Mapped[str | None] = mapped_column(String(32))


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
class Trigger(Base):
    """A ranked, explainable sourcing opportunity produced by correlation."""

    __tablename__ = "triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    trend_id: Mapped[int | None] = mapped_column(ForeignKey("trends.id"))
    country_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    partner_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    score: Mapped[float] = mapped_column(Float, nullable=False)
    rationale: Mapped[str] = mapped_column(String(1024), default="")
    status: Mapped[str] = mapped_column(String(16), default="new")  # new|seen|actioned|dismissed
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class Insight(Base):
    """A procurement decision recommendation for the buying team.

    Produced by the orchestrator: it fuses every signal for a (category, market)
    — multi-platform demand momentum, marketplace + supply-side activity, trade
    origins/emerging and competitor moves — into a ranked, explainable
    recommendation ("procure X, source from Y, because …"). ``narrative`` is the
    buyer-facing write-up (Claude when configured, deterministic fallback else).
    """

    __tablename__ = "insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_categories.id"))
    market_code: Mapped[str | None] = mapped_column(ForeignKey("countries.code"))
    action: Mapped[str] = mapped_column(String(16), default="WATCH")  # PROCURE|WATCH|HOLD
    score: Mapped[float] = mapped_column(Float, default=0.0)  # 0..100 opportunity
    confidence: Mapped[float] = mapped_column(Float, default=0.0)  # 0..1 signal corroboration
    headline: Mapped[str] = mapped_column(String(512), default="")
    narrative: Mapped[str] = mapped_column(String(4096), default="")
    narrator: Mapped[str] = mapped_column(String(16), default="rule")  # rule|llm
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="new")


class Snapshot(Base):
    """Published read-model the dashboard consumes (the `rsi export` output).

    One row per export; the web reads the most recent. Keeping the aggregation
    in Python (``build_snapshot``) and storing the result here avoids
    re-implementing it in the frontend when reading from Supabase.
    """

    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


# --------------------------------------------------------------------------- #
# Ingest telemetry
# --------------------------------------------------------------------------- #
class SourceStatus(Base):
    """Last-run telemetry for one ingestion connector (a "signal source").

    Upserted by ``rsi ingest`` after each connector runs (keyed by
    ``Connector.name``) so the dashboard can show which feeds are live, when
    each last produced a signal, and how many rows it wrote on its last run.
    """

    __tablename__ = "source_status"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    last_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # ok = wrote rows · empty = ran but no new data · error = the run raised.
    status: Mapped[str] = mapped_column(String(16), default="ok")
    rows: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[str | None] = mapped_column(String(256))
