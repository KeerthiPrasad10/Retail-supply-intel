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

# Presentation metadata for the dashboard's "signal sources" panel. ``kind`` is
# which side of the demand×supply model the feed informs; ``label`` is the
# human name. Order here is the order the panel lists them (core feeds first,
# then the opt-in social/marketplace ones).
SOURCE_META: dict[str, dict[str, str]] = {
    "wikipedia": {"label": "Wikipedia", "kind": "demand"},
    "google_trends": {"label": "Google Trends", "kind": "demand"},
    "comtrade": {"label": "UN Comtrade", "kind": "supply"},
    "tiktok": {"label": "TikTok", "kind": "demand"},
    "instagram": {"label": "Instagram", "kind": "demand"},
    "pinterest": {"label": "Pinterest", "kind": "demand"},
    "amazon": {"label": "Amazon", "kind": "demand"},
    "aliexpress": {"label": "AliExpress", "kind": "demand"},
}

__all__ = [
    "Connector",
    "CONNECTORS",
    "DEFAULT_CONNECTORS",
    "SOURCE_META",
    "WikipediaConnector",
    "GoogleTrendsConnector",
    "ComtradeConnector",
    "TikTokTrendsConnector",
    "InstagramTrendsConnector",
    "PinterestTrendsConnector",
    "AmazonBestsellersConnector",
    "AliExpressTrendsConnector",
]
