"""UN Comtrade connector — international trade flows by HS commodity.

Answers "where is this category bought from": for each retail market (reporter)
it pulls import value broken down by partner (country of origin), per HS4
category. The free *preview* endpoint needs no key (capped, recent periods);
set ``RSI_COMTRADE_API_KEY`` to use the full data endpoint.
"""

from __future__ import annotations

import datetime
import time
from typing import ClassVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import reference
from ..config import get_settings
from ..models import ProductCategory, TradeFlow
from .base import http_client

_PREVIEW = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
_FULL = "https://comtradeapi.un.org/data/v1/get/C/A/HS"

# Default reporters (importing markets). Covers Lidl's core EU markets plus every
# top-10 competitor's home market (DE/GB/FR/ES/NL + US), so "what each Asian
# origin exports to competitor X" is read off X's home-market import records.
DEFAULT_REPORTERS = ["DE", "GB", "FR", "ES", "NL", "PL", "IT", "US"]


def _recent_years(n: int = 4) -> list[str]:
    """The last ``n`` calendar years (most recent last). Annual customs data for the
    current year isn't published yet, so we end at last year and reach back ``n``.
    Keeping several years lets the engine compare the latest *complete* year YoY."""
    this_year = datetime.date.today().year
    return [str(y) for y in range(this_year - n, this_year)]


DEFAULT_PERIODS = _recent_years()

_ISO3_TO_A2 = {iso3: a2 for a2, iso3, _, _ in reference.COUNTRIES}
_A2_TO_M49 = {
    a2: reference.ISO3_TO_M49[iso3]
    for a2, iso3, _, _ in reference.COUNTRIES
    if iso3 in reference.ISO3_TO_M49
}


class ComtradeConnector:
    name: ClassVar[str] = "comtrade"

    def run(
        self,
        session: Session,
        reporters: list[str] | None = None,
        periods: list[str] | None = None,
        pause: float = 1.0,
        **_: object,
    ) -> int:
        reporters = reporters or DEFAULT_REPORTERS
        period_param = ",".join(periods or DEFAULT_PERIODS)
        key = get_settings().comtrade_api_key
        written = 0

        with http_client() as client:
            for cat in session.scalars(select(ProductCategory)):
                if not cat.hs_code:
                    continue
                for market in reporters:
                    m49 = _A2_TO_M49.get(market)
                    if not m49:
                        continue
                    written += self._fetch(
                        session, client, cat, market, m49, period_param, key
                    )
                    time.sleep(pause)
        return written

    def _fetch(self, session, client, cat, market, m49, period_param, key) -> int:
        url = _FULL if key else _PREVIEW
        params = {
            "reporterCode": m49,
            "period": period_param,
            "cmdCode": cat.hs_code,
            "flowCode": "M",  # imports
        }
        headers = {"Ocp-Apim-Subscription-Key": key} if key else {}
        try:
            resp = client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            rows = resp.json().get("data", []) or []
        except Exception:
            return 0

        n = 0
        for row in rows:
            partner_m49 = str(row.get("partnerCode", "")).zfill(3)
            if partner_m49 in ("000", "0"):  # World aggregate
                continue
            partner_iso3 = reference.M49_TO_ISO3.get(partner_m49)
            partner_a2 = _ISO3_TO_A2.get(partner_iso3) if partner_iso3 else None
            if not partner_a2:  # keep FK valid; only known origins
                continue
            period = str(row.get("period", ""))
            value = float(row.get("primaryValue") or 0.0)
            if value <= 0:
                continue
            exists = session.scalar(
                select(TradeFlow.id).where(
                    TradeFlow.reporter_code == market,
                    TradeFlow.partner_code == partner_a2,
                    TradeFlow.hs_code == cat.hs_code,
                    TradeFlow.period == period,
                    TradeFlow.flow == "import",
                )
            )
            if exists:
                continue
            session.add(
                TradeFlow(
                    reporter_code=market,
                    partner_code=partner_a2,
                    category_id=cat.id,
                    hs_code=cat.hs_code,
                    period=period,
                    flow="import",
                    trade_value=value,
                    qty=float(row["netWgt"]) if row.get("netWgt") else None,
                    source=self.name,
                )
            )
            n += 1
        session.flush()
        return n
