"""Test fixtures: a throwaway SQLite database per test."""

from __future__ import annotations

import pytest


@pytest.fixture()
def db_ready(tmp_path, monkeypatch):
    """Point the pipeline at a fresh SQLite file, create schema + reference."""
    monkeypatch.setenv("RSI_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")

    from rsi import config, db
    from rsi.repository import seed_reference

    config.get_settings.cache_clear()
    db._engine = None
    db._Session = None

    db.init_db(drop=True)
    with db.session_scope() as session:
        seed_reference(session)
    yield
