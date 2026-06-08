"""Claude narrative layer for procurement insights.

Turns a fused evidence bundle into a concise, buyer-facing recommendation via
the Anthropic API. Entirely optional: if ``RSI_ANTHROPIC_API_KEY`` is unset or
the SDK/network is unavailable, callers fall back to the deterministic narrative.
"""

from __future__ import annotations

import json

from ..config import get_settings

SYSTEM = (
    "You are a sourcing analyst advising Lidl's buying team. Given fused demand "
    "and supply signals for a product category, write a concise (2-3 sentence) "
    "procurement recommendation: what to procure, from which origin(s), and why. "
    "Be specific and decisive, ground every claim ONLY in the provided evidence, "
    "and never invent suppliers, numbers, or origins. Lead with the action."
)


def available() -> bool:
    return bool(get_settings().anthropic_api_key)


def narrate(headline: str, evidence: dict) -> str | None:
    """Return a Claude-written recommendation, or None to use the fallback."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic
    except ImportError:
        return None
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model=settings.insights_model,
            max_tokens=320,
            system=SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Headline: {headline}\n\n"
                        f"Evidence (JSON):\n{json.dumps(evidence, indent=2)}"
                    ),
                }
            ],
        )
        text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
        return text.strip() or None
    except Exception:
        return None
