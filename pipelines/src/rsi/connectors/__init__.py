"""Ingestion connectors for demand and supply signals."""

from .base import Connector
from .comtrade import ComtradeConnector
from .google_trends import GoogleTrendsConnector
from .wikipedia import WikipediaConnector

CONNECTORS: dict[str, type[Connector]] = {
    WikipediaConnector.name: WikipediaConnector,
    GoogleTrendsConnector.name: GoogleTrendsConnector,
    ComtradeConnector.name: ComtradeConnector,
}

__all__ = [
    "Connector",
    "CONNECTORS",
    "WikipediaConnector",
    "GoogleTrendsConnector",
    "ComtradeConnector",
]
