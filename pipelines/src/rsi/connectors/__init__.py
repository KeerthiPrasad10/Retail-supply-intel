"""Ingestion connectors for demand and supply signals."""

from .aliexpress import AliExpressTrendsConnector
from .amazon import AmazonBestsellersConnector
from .base import Connector
from .comtrade import ComtradeConnector
from .google_trends import GoogleTrendsConnector
from .instagram import InstagramTrendsConnector
from .pinterest import PinterestTrendsConnector
from .tiktok import TikTokTrendsConnector
from .wikipedia import WikipediaConnector

CONNECTORS: dict[str, type[Connector]] = {
    WikipediaConnector.name: WikipediaConnector,
    GoogleTrendsConnector.name: GoogleTrendsConnector,
    ComtradeConnector.name: ComtradeConnector,
    TikTokTrendsConnector.name: TikTokTrendsConnector,
    InstagramTrendsConnector.name: InstagramTrendsConnector,
    PinterestTrendsConnector.name: PinterestTrendsConnector,
    AmazonBestsellersConnector.name: AmazonBestsellersConnector,
    AliExpressTrendsConnector.name: AliExpressTrendsConnector,
}

# Connectors run by a bare `rsi ingest` (free sources). Opt-in connectors (the
# Apify-backed TikTok/Instagram/Pinterest/Amazon ones, which spend credits) set
# ``default = False`` and must be named, e.g. `rsi ingest instagram`.
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
    "InstagramTrendsConnector",
    "PinterestTrendsConnector",
    "AmazonBestsellersConnector",
    "AliExpressTrendsConnector",
]
