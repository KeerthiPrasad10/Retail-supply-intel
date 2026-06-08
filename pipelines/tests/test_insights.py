from rsi.insights import score_insight


def test_strong_demand_with_emerging_supply_is_procure():
    action, score, conf = score_insight(
        max_momentum=12.0, max_accel=0.5, rising=4, total_platforms=5,
        has_emerging=True, has_recommended=True,
    )
    assert action == "PROCURE"
    assert score > 60
    assert conf > 0.6


def test_accelerating_but_modest_is_watch():
    action, _, _ = score_insight(
        max_momentum=0.2, max_accel=0.3, rising=1, total_platforms=5,
        has_emerging=False, has_recommended=True,
    )
    assert action == "WATCH"


def test_flat_demand_is_hold():
    action, score, conf = score_insight(
        max_momentum=0.0, max_accel=0.0, rising=0, total_platforms=5,
        has_emerging=False, has_recommended=False,
    )
    assert action == "HOLD"
    assert score == 0.0
    assert conf == 0.0


def test_confidence_rises_with_corroboration():
    low = score_insight(1.0, 0.0, 1, 5, False, True)[2]
    high = score_insight(1.0, 0.3, 4, 5, True, True)[2]
    assert high > low
