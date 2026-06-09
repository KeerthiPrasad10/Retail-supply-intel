"""``rsi`` command-line interface.

Typical flow:

    rsi db init            # create schema + seed reference data
    rsi ingest             # pull all free sources (wikipedia, google_trends, comtrade)
    rsi score              # compute trend momentum
    rsi correlate          # generate sourcing triggers
    rsi export             # write web/lib/snapshot.json

`rsi run` chains all of the above.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import typer

from .config import get_settings
from .connectors import CONNECTORS, DEFAULT_CONNECTORS
from .correlation import run_correlation
from .db import init_db, session_scope
from .insights import build_insights
from .repository import seed_reference
from .snapshot import DEFAULT_SNAPSHOT_PATH, build_snapshot
from .trends import compute_scores

app = typer.Typer(help="Retail Supply Intel pipelines", no_args_is_help=True)
db_app = typer.Typer(help="Database management")
app.add_typer(db_app, name="db")


@db_app.command("init")
def db_init(drop: bool = typer.Option(False, help="Drop existing tables first")) -> None:
    """Create the schema and seed reference data."""
    init_db(drop=drop)
    with session_scope() as session:
        seed_reference(session)
    typer.echo(f"Schema ready at {get_settings().resolved_database_url()}")


@app.command()
def schema(dialect: str = typer.Option("postgres", help="postgres|sqlite")) -> None:
    """Print CREATE TABLE DDL (used to regenerate the Supabase migration)."""
    from sqlalchemy.dialects import postgresql, sqlite
    from sqlalchemy.schema import CreateTable

    from .models import Base

    d = {"postgres": postgresql.dialect(), "sqlite": sqlite.dialect()}[dialect]
    for table in Base.metadata.sorted_tables:
        typer.echo(str(CreateTable(table).compile(dialect=d)).strip() + ";\n")


def _record_source_status(session, name: str, rows: int, status: str, detail: str | None) -> None:
    """Upsert the last-run telemetry row for a connector (see SourceStatus)."""
    from .models import SourceStatus

    row = session.get(SourceStatus, name)
    now = datetime.now(tz=UTC)
    if row is None:
        session.add(
            SourceStatus(name=name, last_run_at=now, status=status, rows=rows, detail=detail)
        )
    else:
        row.last_run_at, row.status, row.rows, row.detail = now, status, rows, detail


@app.command()
def ingest(
    connectors: list[str] = typer.Argument(None, help="Subset of connectors; default all"),
    days: int = typer.Option(60, help="Lookback window for time-series sources"),
) -> None:
    """Run ingestion connectors against their (free) data sources."""
    names = connectors or DEFAULT_CONNECTORS
    with session_scope() as session:
        seed_reference(session)
        for name in names:
            cls = CONNECTORS.get(name)
            if cls is None:
                typer.secho(f"  ! unknown connector: {name}", fg=typer.colors.RED)
                continue
            typer.echo(f"  → {name} ...")
            try:
                written = cls().run(session, days=days)
                status, detail = ("ok" if written > 0 else "empty"), None
            except Exception as exc:  # never let one flaky source abort the run
                written, status, detail = 0, "error", str(exc)[:256]
                typer.secho(f"    ! {name} failed: {exc}", fg=typer.colors.RED)
            _record_source_status(session, name, written, status, detail)
            # Durably persist this connector's rows + status before the next one, so a
            # cancelled/killed run never rolls back data already scraped (and paid for).
            session.commit()
            color = {"ok": typer.colors.GREEN, "empty": typer.colors.YELLOW}.get(
                status, typer.colors.RED
            )
            typer.secho(f"    {written} rows [{status}]", fg=color)


@app.command()
def score(window: int = typer.Option(14, help="Window size for momentum")) -> None:
    """Recompute trend momentum scores."""
    with session_scope() as session:
        n = compute_scores(session, window=window)
    typer.secho(f"scored {n} trend/country series", fg=typer.colors.GREEN)


@app.command()
def correlate(
    top_n: int = typer.Option(100, help="Max triggers to keep"),
    min_momentum: float = typer.Option(0.0, help="Momentum floor"),
) -> None:
    """Generate sourcing triggers from the latest scores + trade flows."""
    with session_scope() as session:
        n = run_correlation(session, top_n=top_n, min_momentum=min_momentum)
    typer.secho(f"generated {n} triggers", fg=typer.colors.GREEN)


@app.command("seed-competitors")
def seed_competitors() -> None:
    """(Re)seed competitor + supplier + sourcing reference data (idempotent)."""
    from sqlalchemy import func, select

    from .models import Competitor

    with session_scope() as session:
        seed_reference(session)
        n = session.scalar(select(func.count()).select_from(Competitor))
    typer.secho(f"{n} competitors seeded", fg=typer.colors.GREEN)


@app.command()
def insights(no_llm: bool = typer.Option(False, help="Skip the Claude narrative layer")) -> None:
    """Fuse all signals into ranked procurement recommendations for the buyers."""
    with session_scope() as session:
        n = build_insights(session, use_llm=not no_llm)
    settings = get_settings()
    narr = "Claude" if (settings.anthropic_api_key and not no_llm) else "deterministic"
    typer.secho(f"generated {n} insights ({narr} narratives)", fg=typer.colors.GREEN)


@app.command()
def export(
    out: Path = typer.Option(DEFAULT_SNAPSHOT_PATH, help="Snapshot output path"),
    publish: bool = typer.Option(True, help="Also store the snapshot row in the database"),
) -> None:
    """Write the JSON snapshot for the dashboard (file + a `snapshots` DB row)."""
    from .models import Snapshot

    with session_scope() as session:
        snap = build_snapshot(session)
        if publish:
            session.add(Snapshot(data=snap))  # read-model row the web can query
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snap, indent=2, default=str))
    typer.secho(
        f"wrote snapshot ({len(snap['trends'])} trends, {len(snap['triggers'])} triggers, "
        f"{len(snap.get('insights', []))} insights) -> {out}",
        fg=typer.colors.GREEN,
    )


@app.command()
def stats() -> None:
    """Print row counts for each table."""
    from sqlalchemy import func, select

    from .models import Base

    with session_scope() as session:
        for table in Base.metadata.sorted_tables:
            n = session.scalar(select(func.count()).select_from(table))
            typer.echo(f"  {table.name:24} {n}")


@app.command()
def run(days: int = typer.Option(60), window: int = typer.Option(14)) -> None:
    """Full pipeline: db init → ingest → score → correlate → insights → export."""
    init_db()
    with session_scope() as session:
        seed_reference(session)
    ingest(connectors=None, days=days)
    score(window=window)
    correlate(top_n=100, min_momentum=0.0)
    insights(no_llm=False)
    export(out=DEFAULT_SNAPSHOT_PATH)
    typer.secho("pipeline complete", fg=typer.colors.GREEN, bold=True)


@app.command()
def orchestrate(
    days: int = typer.Option(60, help="Lookback for time-series sources"),
    window: int = typer.Option(14, help="Momentum window"),
    apify: bool = typer.Option(False, help="Also run paid Apify connectors (needs the token)"),
    no_llm: bool = typer.Option(False, help="Skip the Claude narrative layer"),
) -> None:
    """Orchestrate every source into procurement insights, then export.

    Chains: db init → ingest (free, +Apify with --apify) → score → correlate →
    insights → export. This is the end-to-end driver behind the dashboard.
    """
    init_db()
    with session_scope() as session:
        seed_reference(session)
    ingest(connectors=None, days=days)  # free sources
    if apify:
        opt_in = [n for n, c in CONNECTORS.items() if not getattr(c, "default", True)]
        typer.echo(f"  (apify) {', '.join(opt_in)}")
        ingest(connectors=opt_in, days=days)
    score(window=window)
    correlate(top_n=100, min_momentum=0.0)
    insights(no_llm=no_llm)
    export(out=DEFAULT_SNAPSHOT_PATH)
    typer.secho("orchestration complete", fg=typer.colors.GREEN, bold=True)


if __name__ == "__main__":
    app()
