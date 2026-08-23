"""Operational limits for the marketplace while it's in beta.

Archon takes the client's money and pays the freelancer out by hand, so
every open contract is an obligation carried personally until it settles.
A cap on contract size keeps that exposure bounded while the flow is still
being proven, and it's a setting rather than a constant so it can be raised
without a deploy as confidence grows.
"""
from sqlalchemy.orm import Session

from app.models.database import AppSetting

CAP_KEY = "marketplace_max_contract_usd"
DEFAULT_CAP_USD = 500.0


def _setting(db: Session, key: str) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return (row.value or "") if row else ""


def get_contract_cap_usd(db: Session) -> float:
    """The per-contract ceiling in USD. 0 means no limit."""
    raw = _setting(db, CAP_KEY).strip()
    if raw == "":
        return DEFAULT_CAP_USD
    try:
        return max(0.0, float(raw))
    except ValueError:
        return DEFAULT_CAP_USD


def to_usd(db: Session, amount: float, currency: str) -> float:
    """Best-effort conversion so one cap can cover every currency offered.

    IRR uses the same live/manual Toman rate the pricing pages already run
    on. EUR has no rate source wired up, so it's compared as if it were USD
    — which errs on the strict side, since a euro is worth a bit more.
    """
    cur = (currency or "USD").upper()
    if cur == "IRR":
        from app.services.exchange import get_usd_to_toman
        rate = (get_usd_to_toman(db) or {}).get("rate") or 0
        return amount / rate if rate else amount
    return amount


def check_contract_amount(db: Session, amount: float, currency: str) -> None:
    """Raise a 400 if this contract would exceed the beta ceiling."""
    from fastapi import HTTPException

    cap = get_contract_cap_usd(db)
    if not cap:
        return
    if to_usd(db, amount or 0, currency) > cap:
        raise HTTPException(
            status_code=400,
            detail=(
                f"While the marketplace is in beta, a single contract is capped at "
                f"${cap:,.0f}. Split the work into a smaller contract, or contact "
                f"support to have the limit raised for your account."
            ),
        )
