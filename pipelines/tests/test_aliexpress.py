from rsi.connectors.aliexpress import parse_sold


def test_parse_sold_variants():
    assert parse_sold("5 sold") == 5.0
    assert parse_sold("1,000+ sold") == 1000.0
    assert parse_sold("2.5k sold") == 2500.0
    assert parse_sold("1M sold") == 1_000_000.0


def test_parse_sold_bad():
    assert parse_sold(None) == 0.0
    assert parse_sold("") == 0.0
    assert parse_sold("sold") == 0.0
    assert parse_sold(42) == 0.0
