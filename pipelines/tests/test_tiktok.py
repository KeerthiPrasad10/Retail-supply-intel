from datetime import UTC, datetime

from rsi.connectors.tiktok import aggregate_daily, hashtag_for


class _Cat:
    def __init__(self, name, keywords):
        self.name = name
        self.keywords = keywords


def test_hashtag_override_and_derivation():
    assert hashtag_for(_Cat("Coffee", ["coffee"])) == "coffee"
    assert hashtag_for(_Cat("Drinkware & Tumblers", ["stanley cup"])) == "stanleycup"
    # unknown category -> derived from first keyword, alphanumerics only
    assert hashtag_for(_Cat("New Thing", ["lip oil"])) == "lipoil"


def test_aggregate_daily_buckets_and_sums():
    videos = [
        {"createTimeISO": "2026-05-09T19:00:22.000Z", "playCount": 100},
        {"createTimeISO": "2026-05-09T02:00:00.000Z", "playCount": 50},   # same day
        {"createTimeISO": "2026-05-10T12:00:00.000Z", "playCount": 30},
        {"createTime": 1778353222, "playCount": 7},  # unix fallback, also 2026-05-09
    ]
    out = dict(aggregate_daily(videos))
    assert out[datetime(2026, 5, 9, tzinfo=UTC)] == 157.0  # 100 + 50 + 7 (unix fallback)
    assert out[datetime(2026, 5, 10, tzinfo=UTC)] == 30.0


def test_aggregate_daily_skips_bad_rows_and_returns_sorted():
    videos = [
        {"playCount": 5},                                  # no timestamp
        {"createTimeISO": "not-a-date", "playCount": 9},   # unparseable
        {"createTimeISO": "2026-05-08T00:00:00.000Z", "playCount": 12},
    ]
    out = aggregate_daily(videos)
    assert out == [(datetime(2026, 5, 8, tzinfo=UTC), 12.0)]


def test_aggregate_daily_empty():
    assert aggregate_daily([]) == []
