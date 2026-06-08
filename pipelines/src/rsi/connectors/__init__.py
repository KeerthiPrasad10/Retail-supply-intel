"""Ingestion connectors for demand and supply signals."""

from .base import Connector
from .comtrade import ComtradeConnector
from .google_trends import GoogleTrendsConnector
from .tiktok import TikTokTrendsConnector
from .wikipedia import WikipediaConnector

CONNECTORS: dict[str, type[Connector]] = {
    WikipediaConnector.name: WikipediaConnector,
    GoogleTrendsConnector.name: GoogleTrendsConnector,
    ComtradeConnector.name: ComtradeConnector,
    TikTokTrendsConnector.name: TikTokTrendsConnector,
}

# Connectors run by a bare `rsi ingest` (free sources). Opt-in connectors
# (e.g. TikTok via Apify, which spends credits) set ``default = False`` and must
# be named explicitly, e.g. `rsi ingest tiktok`.
DEFAULT_CONNECTORS: list[str] = [
    name for name, cls in CONNECTORS.items() if getattr(cls, "default", True)
]

__all__ = [
    "Connector",
    "CONNECTORS",
    "DEFAULT_CONNECTORS",
    "WikipediaConnector",
    "GoogleTrendsConnector",
    "ComtradeConnector",
    "TikTokTrendsConnector",
]
