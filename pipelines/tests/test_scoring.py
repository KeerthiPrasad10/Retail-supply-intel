from rsi.trends import series_momentum


def test_empty_series_is_zero():
    assert series_momentum([]) == (0.0, 0.0, 0.0)


def test_rising_series_has_positive_momentum():
    values = [float(x) for x in range(1, 41)]  # steadily increasing
    momentum, growth, volume = series_momentum(values, window=10)
    assert growth > 0
    assert momentum > 0
    assert volume > 0


def test_flat_series_has_near_zero_growth():
    momentum, growth, _ = series_momentum([50.0] * 40, window=10)
    assert abs(growth) < 1e-6
    assert abs(momentum) < 1e-6


def test_volume_weighting_prefers_high_baseline_surge():
    # Same +50% growth, but a much higher baseline -> larger momentum.
    small = series_momentum([2.0] * 10 + [3.0] * 10, window=10)[0]
    big = series_momentum([200.0] * 10 + [300.0] * 10, window=10)[0]
    assert big > small
