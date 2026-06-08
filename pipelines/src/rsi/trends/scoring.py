"""Trend momentum scoring.

For each (trend, country) observation series we compare a recent window against
the preceding one to derive a growth rate, a volume level, and a combined
``momentum`` used for ranking. Pure logic lives in :func:`series_momentum` so it
is unit-testable independently of the database.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import TrendObservation, TrendScore

_EPS = 1e-9


def series_momentum(values: list[float], window: int = 14) -> tuple[float, float, float]:
    """Return ``(momentum, growth_rate, volume)`` for a time-ordered series.

    * ``volume``      — mean of the most recent ``window`` points.
    * ``growth_rate`` — relative change of the recent window vs the prior one.
    * ``momentum``    — growth weighted by ``log1p(volume)`` so spikes on tiny
      baselines do not outrank genuine, high-volume surges.
    """
    if not values:
        return 0.0, 0.0, 0.0
    if len(values) < 2:
        return 0.0, 0.0, float(values[-1])

    w = max(1, min(window, len(values) // 2))
    recent = values[-w:]
    prior = values[-2 * w : -w] or values[:-w] or recent

    recent_mean = sum(recent) / len(recent)
    prior_mean = sum(prior) / len(prior)
    growth = (recent_mean - prior_mean) / (abs(prior_mean) + _EPS)
    momentum = growth * math.log1p(max(recent_mean, 0.0))
    return momentum, growth, recent_mean


def compute_scores(session: Session, window: int = 14, as_of: datetime | None = None) -> int:
    """Recompute :class:`TrendScore` rows from observations. Returns rows written."""
    as_of = as_of or datetime.now(tz=UTC)

    series: dict[tuple[int, str | None], list[tuple[datetime, float]]] = defaultdict(list)
    rows = session.execute(
        select(
            TrendObservation.trend_id,
            TrendObservation.country_code,
            TrendObservation.observed_at,
            TrendObservation.value,
        )
    )
    for trend_id, country, observed_at, value in rows:
        series[(trend_id, country)].append((observed_at, value))

    # Replace the prior snapshot for this as_of.
    session.execute(delete(TrendScore).where(TrendScore.as_of == as_of))

    computed: list[TrendScore] = []
    for (trend_id, country), points in series.items():
        points.sort(key=lambda p: p[0])
        values = [v for _, v in points]
        momentum, growth, volume = series_momentum(values, window=window)
        computed.append(
            TrendScore(
                trend_id=trend_id,
                country_code=country,
                as_of=as_of,
                momentum=momentum,
                growth_rate=growth,
                volume=volume,
            )
        )

    # Dense rank by momentum within each country.
    by_country: dict[str | None, list[TrendScore]] = defaultdict(list)
    for s in computed:
        by_country[s.country_code].append(s)
    for scores in by_country.values():
        scores.sort(key=lambda s: s.momentum, reverse=True)
        for i, s in enumerate(scores, start=1):
            s.rank = i

    session.add_all(computed)
    session.flush()
    return len(computed)
