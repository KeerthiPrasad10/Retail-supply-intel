"""Snapshot enrichment: market-intelligence sections build from seeded data."""

from __future__ import annotations

from rsi.db import session_scope
from rsi.models import TradeFlow
from rsi.snapshot import build_snapshot


def test_snapshot_has_market_intelligence_sections(db_ready):
    with session_scope() as session:
        snap = build_snapshot(session)

    # Reference-seeded sections are present.
    assert len(snap["competitors"]) == 10
    assert {c["name"] for c in snap["competitors"]} >= {"Aldi", "Tesco", "Carrefour"}
    assert "Kaufland" not in {c["name"] for c in snap["competitors"]}  # part of LKA
    assert snap["suppliers"], "best-effort suppliers should be seeded"
    assert all(s["source"] == "research" for s in snap["suppliers"])

    # Countries carry centroids + origin flag for the map.
    by_code = {c["code"]: c for c in snap["countries"]}
    assert by_code["CN"]["is_origin"] is True
    assert by_code["DE"]["is_origin"] is False
    assert by_code["VN"]["lat"] is not None

    # New keys always exist.
    assert "flows" in snap and "leading_indicators" in snap


def test_snapshot_flows_are_asia_to_market(db_ready):
    from sqlalchemy import select

    from rsi.models import ProductCategory

    with session_scope() as session:
        cat = session.scalar(
            select(ProductCategory.id).where(ProductCategory.name == "Footwear")
        )
        session.add_all(
            [
                TradeFlow(reporter_code="DE", partner_code="VN", category_id=cat,
                          hs_code="6404", period="2022", trade_value=100.0),
                TradeFlow(reporter_code="DE", partner_code="VN", category_id=cat,
                          hs_code="6404", period="2023", trade_value=160.0),
                # An intra-EU flow that must NOT appear as an Asian origin edge.
                TradeFlow(reporter_code="DE", partner_code="FR", category_id=cat,
                          hs_code="6404", period="2023", trade_value=500.0),
            ]
        )

    with session_scope() as session:
        flows = build_snapshot(session)["flows"]

    edges = {(f["market_code"], f["origin_code"]) for f in flows}
    assert ("DE", "VN") in edges
    assert ("DE", "FR") not in edges  # FR is not an Asian origin
    vn = next(f for f in flows if f["origin_code"] == "VN")
    assert vn["growth"] > 0 and vn["emerging"] is True
