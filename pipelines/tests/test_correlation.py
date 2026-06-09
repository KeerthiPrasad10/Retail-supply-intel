from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from rsi.correlation import category_sources, run_correlation
from rsi.db import session_scope
from rsi.models import ProductCategory, TradeFlow, Trend, TrendObservation, Trigger
from rsi.trends import compute_scores


def _beauty_id(session):
    return session.scalar(
        select(ProductCategory.id).where(ProductCategory.name == "Beauty & Cosmetics")
    )


def test_emerging_supplier_detection(db_ready):
    with session_scope() as session:
        cat = _beauty_id(session)
        # CN: large but flat (110 vs 100 = +10%). VN: small but surging (+400%).
        session.add_all(
            [
                TradeFlow(reporter_code="DE", partner_code="CN", category_id=cat,
                          hs_code="3304", period="2022", trade_value=100.0),
                TradeFlow(reporter_code="DE", partner_code="CN", category_id=cat,
                          hs_code="3304", period="2023", trade_value=110.0),
                TradeFlow(reporter_code="DE", partner_code="VN", category_id=cat,
                          hs_code="3304", period="2022", trade_value=10.0),
                TradeFlow(reporter_code="DE", partner_code="VN", category_id=cat,
                          hs_code="3304", period="2023", trade_value=50.0),
            ]
        )

    with session_scope() as session:
        sources = category_sources(session, _beauty_id(session))
        by_partner = {s["partner_code"]: s for s in sources}
        assert by_partner["VN"]["emerging"] is True
        assert by_partner["CN"]["emerging"] is False


def test_sources_scoped_to_asia_by_default(db_ready):
    """LKA sources only from Asia: non-Asian customs partners are excluded, and
    a noisy non-Asian re-export spike never becomes a recommended origin."""
    with session_scope() as session:
        cat = _beauty_id(session)
        session.add_all(
            [
                # Real Asian origin (China), large and stable.
                TradeFlow(reporter_code="DE", partner_code="CN", category_id=cat,
                          hs_code="3304", period="2022", trade_value=100.0),
                TradeFlow(reporter_code="DE", partner_code="CN", category_id=cat,
                          hs_code="3304", period="2023", trade_value=110.0),
                # Non-Asian re-export noise (Great Britain) surging off ~0 — the
                # kind of partner that used to headline "source from UK".
                TradeFlow(reporter_code="DE", partner_code="GB", category_id=cat,
                          hs_code="3304", period="2022", trade_value=1.0),
                TradeFlow(reporter_code="DE", partner_code="GB", category_id=cat,
                          hs_code="3304", period="2023", trade_value=80.0),
            ]
        )

    with session_scope() as session:
        cat = _beauty_id(session)
        codes = {s["partner_code"] for s in category_sources(session, cat)}
        assert "GB" not in codes  # non-Asian partner excluded
        assert "CN" in codes
        # Explicit override still lets a caller widen the scope.
        widened = {s["partner_code"] for s in category_sources(session, cat, origins=["CN", "GB"])}
        assert {"CN", "GB"} <= widened


def test_run_correlation_produces_ranked_triggers(db_ready):
    with session_scope() as session:
        cat = _beauty_id(session)
        trend = Trend(term="glass skin (DE)", platform="google_trends", category_id=cat)
        session.add(trend)
        session.flush()

        base = datetime(2026, 1, 1, tzinfo=UTC)
        for i in range(40):  # steadily rising demand in DE
            session.add(
                TrendObservation(
                    trend_id=trend.id, country_code="DE",
                    observed_at=base + timedelta(days=i),
                    value=float(10 + i * 3), source="google_trends",
                )
            )
        session.add_all(
            [
                TradeFlow(reporter_code="DE", partner_code="CN", category_id=cat,
                          hs_code="3304", period="2022", trade_value=100.0),
                TradeFlow(reporter_code="DE", partner_code="CN", category_id=cat,
                          hs_code="3304", period="2023", trade_value=110.0),
                TradeFlow(reporter_code="DE", partner_code="VN", category_id=cat,
                          hs_code="3304", period="2022", trade_value=10.0),
                TradeFlow(reporter_code="DE", partner_code="VN", category_id=cat,
                          hs_code="3304", period="2023", trade_value=50.0),
            ]
        )

    with session_scope() as session:
        assert compute_scores(session) > 0

    with session_scope() as session:
        n = run_correlation(session)
        assert n >= 1

    with session_scope() as session:
        triggers = list(session.scalars(select(Trigger).order_by(Trigger.score.desc())))
        assert triggers
        top = triggers[0]
        assert top.partner_code == "VN"  # the emerging origin is the focus
        assert "Beauty" in top.rationale
        assert "Vietnam" in top.rationale
        # Scores are sorted descending.
        assert all(
            triggers[i].score >= triggers[i + 1].score for i in range(len(triggers) - 1)
        )
