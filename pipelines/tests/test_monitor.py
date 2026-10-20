"""Monitor engine: user-chosen terms and markets through RSI's connectors, offline."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from rsi import monitor
from rsi.connectors import google_trends as gt
from rsi.models import ProductCategory
from rsi.repository import get_or_create_trend

DAY0 = datetime(2026, 7, 1, tzinfo=UTC)


def _days(values):
    return [(DAY0 + timedelta(days=i), v) for i, v in enumerate(values)]


class FakeTrends:
    """Per-market interest: flat for the first term, surging for the second."""

    seen_geos: list = []

    def run(self, session, geos=None, **_):
        FakeTrends.seen_geos = list(geos or [])
        from rsi.connectors.apify_base import write_daily

        for cat in session.scalars(select(ProductCategory)):
            kw = cat.keywords[0]
            series = [50.0] * 40 if kw == "matcha" else [5.0] * 20 + [60.0] * 20
            for geo in geos or [None]:
                trend = get_or_create_trend(session, f"{kw} ({geo})", "google_trends", cat.id)
                write_daily(session, trend.id, "google_trends", geo, _days(series))
        return 1


class FakeSnapshot:
    """One point per run, like AliExpress units sold."""

    def run(self, session, **_):
        from rsi.connectors.apify_base import write_daily

        for cat in session.scalars(select(ProductCategory)):
            trend = get_or_create_trend(
                session, f"{cat.keywords[0]} (aliexpress)", "aliexpress", cat.id
            )
            write_daily(session, trend.id, "aliexpress", None, [(DAY0 + timedelta(days=40), 900.0)])
        return 1


class Boom:
    def run(self, session, **_):
        raise RuntimeError("actor down")


def test_terms_by_market_are_scored_with_rsi_momentum():
    out = monitor.collect(
        ["matcha", "hojicha"],
        ["de", "GB"],
        ["google_trends"],
        connectors={"google_trends": FakeTrends},
    )
    assert FakeTrends.seen_geos == ["DE", "GB"]
    assert {(s["term"], s["market"]) for s in out} == {
        ("matcha", "DE"),
        ("matcha", "GB"),
        ("hojicha", "DE"),
        ("hojicha", "GB"),
    }
    top = out[0]
    assert top["term"] == "hojicha" and top["rising"] and top["growth"] > 1
    flat = next(s for s in out if s["term"] == "matcha")
    assert abs(flat["growth"]) < 1e-6 and not flat["rising"]
    assert len(top["points"]) == 40 and top["new_points"] == 40


def test_history_carries_snapshot_sources_across_runs():
    history = [
        {
            "term": "matcha",
            "platform": "aliexpress",
            "market": None,
            "points": [[(DAY0 + timedelta(days=i)).date().isoformat(), 100.0] for i in range(30)],
        }
    ]
    out = monitor.collect(
        ["matcha"], [], ["aliexpress"], history=history, connectors={"aliexpress": FakeSnapshot}
    )
    (s,) = out
    assert len(s["points"]) == 31 and s["new_points"] == 1
    assert s["points"][-1] == ["2026-08-10", 900.0]
    assert s["growth"] > 0


def test_a_failing_source_keeps_history_and_the_others():
    history = [
        {
            "term": "matcha",
            "platform": "aliexpress",
            "market": None,
            "points": [["2026-07-01", 10.0]],
        }
    ]
    out = monitor.collect(
        ["matcha"],
        ["DE"],
        ["aliexpress", "google_trends", "tiktok"],
        history=history,
        connectors={"aliexpress": Boom, "google_trends": FakeTrends, "tiktok": Boom},
    )
    assert {s["platform"] for s in out} == {"aliexpress", "google_trends"}
    ali = next(s for s in out if s["platform"] == "aliexpress")
    assert ali["new_points"] == 0 and ali["points"] == [["2026-07-01", 10.0]]


def test_limits_and_unknown_platforms():
    assert monitor.collect([], ["DE"]) == []
    assert monitor.collect(["x"], [], ["amazon"]) == []  # not a monitor platform
    out = monitor.collect(
        ["a", "b", "c", "d"], ["DE"], ["google_trends"], connectors={"google_trends": FakeTrends}
    )
    assert {s["term"] for s in out} == {"a", "b", "c"}  # MAX_TERMS


def test_apify_google_trends_per_geo(monkeypatch, db_ready):
    from rsi.db import session_scope

    calls = []

    def fake_run(client, actor, token, payload):
        calls.append(payload)
        return [
            {
                "searchTerm": t,
                "interestOverTime_timelineData": [{"time": "1751328000", "value": [7]}],
            }
            for t in payload["searchTerms"]
        ]

    monkeypatch.setattr("rsi.connectors.apify_base.run_actor_items", fake_run)
    with session_scope() as session:
        n = gt.GoogleTrendsConnector()._run_apify(session, "tok", "today 3-m", ["DE", "FR"])
        assert n > 0
        assert {c["geo"] for c in calls} == {"DE", "FR"}
        calls.clear()
        gt.GoogleTrendsConnector()._run_apify(session, "tok", "today 3-m")
        assert {c["geo"] for c in calls} == {""}  # the scheduled pipeline stays worldwide
