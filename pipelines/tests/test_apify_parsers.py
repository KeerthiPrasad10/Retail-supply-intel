from datetime import UTC, datetime

from rsi.connectors.apify_base import bucket_daily, parse_dt


def test_parse_dt_iso():
    assert parse_dt("2026-06-08T10:14:27.000Z") == datetime(2026, 6, 8, 10, 14, 27, tzinfo=UTC)


def test_parse_dt_unix():
    assert parse_dt(1778353222) == datetime.fromtimestamp(1778353222, tz=UTC)
    assert parse_dt("1778353222") == datetime.fromtimestamp(1778353222, tz=UTC)


def test_parse_dt_rfc2822_pinterest():
    # Pinterest created_at format
    expected = datetime(2026, 3, 3, 8, 32, 37, tzinfo=UTC)
    assert parse_dt("Tue, 03 Mar 2026 08:32:37 +0000") == expected


def test_parse_dt_bad():
    assert parse_dt(None) is None
    assert parse_dt("not a date") is None


def test_bucket_daily_sums_per_day():
    items = [
        {"ts": "2026-05-09T01:00:00Z", "v": 10},
        {"ts": "2026-05-09T20:00:00Z", "v": 5},
        {"ts": "2026-05-10T00:00:00Z", "v": 7},
        {"ts": "bad", "v": 100},  # skipped
    ]
    out = bucket_daily(items, ["ts"], lambda it: it["v"])
    assert out == [
        (datetime(2026, 5, 9, tzinfo=UTC), 15.0),
        (datetime(2026, 5, 10, tzinfo=UTC), 7.0),
    ]
