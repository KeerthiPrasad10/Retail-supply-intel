"""Connector contract and shared HTTP helper."""

from __future__ import annotations

from typing import ClassVar, Protocol, runtime_checkable

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings


@runtime_checkable
class Connector(Protocol):
    """A data source. ``run`` fetches, persists, and returns rows written."""

    name: ClassVar[str]

    def run(self, session: Session, **kwargs: object) -> int: ...


def http_client() -> httpx.Client:
    s = get_settings()
    return httpx.Client(
        timeout=s.http_timeout,
        headers={"User-Agent": s.user_agent},
        follow_redirects=True,
    )
