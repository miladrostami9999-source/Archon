"""USD → Toman exchange rate.

Iran's official rate and its free-market rate differ by a lot, and the market
rate is what users actually pay with, so TGJU (a standard Iranian market
reference) is tried first. Everything is cached and falls back to a rate the
admin can set by hand, so pricing never breaks if a source goes down.
"""
import json
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.models.database import AppSetting

CACHE_KEY = "usd_toman_rate_cache"      # {"rate":…, "source":…, "fetched_at":…}
MANUAL_KEY = "usd_toman_rate_manual"    # admin-set fallback / override
CACHE_TTL = timedelta(hours=6)


def _from_tgju() -> float | None:
    """Free-market USD rate in Rial; row is [open, low, high, close, …]."""
    r = httpx.get(
        "https://api.tgju.org/v1/market/indicator/summary-table-data/price_dollar_rl",
        timeout=8, headers={"User-Agent": "Mozilla/5.0"},
    )
    r.raise_for_status()
    rows = r.json().get("data") or []
    if not rows:
        return None
    rial = float(str(rows[0][3]).replace(",", ""))
    return rial / 10  # Rial → Toman


def _from_er_api() -> float | None:
    r = httpx.get("https://open.er-api.com/v6/latest/USD", timeout=8)
    r.raise_for_status()
    rial = r.json().get("rates", {}).get("IRR")
    return float(rial) / 10 if rial else None


SOURCES = [("tgju", _from_tgju), ("er-api", _from_er_api)]


def _get_setting(db: Session, key: str) -> str | None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else None


def _set_setting(db: Session, key: str, value: str):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        row = AppSetting(key=key)
        db.add(row)
    row.value = value


def get_usd_to_toman(db: Session, force: bool = False) -> dict:
    """Returns {rate, source, fetched_at}. Never raises — falls back to the
    cached value, then to the admin's manual rate."""
    manual = _get_setting(db, MANUAL_KEY)

    if not force:
        cached_raw = _get_setting(db, CACHE_KEY)
        if cached_raw:
            try:
                cached = json.loads(cached_raw)
                fetched = datetime.fromisoformat(cached["fetched_at"])
                if datetime.utcnow() - fetched < CACHE_TTL:
                    return cached
            except Exception:
                pass

    for name, fn in SOURCES:
        try:
            rate = fn()
            if rate and rate > 0:
                result = {"rate": round(rate), "source": name,
                          "fetched_at": datetime.utcnow().isoformat()}
                _set_setting(db, CACHE_KEY, json.dumps(result))
                db.commit()
                return result
        except Exception as e:
            print(f"Exchange source {name} failed: {e}")

    # Every source failed — serve a stale cache if we have one, else the manual rate
    stale = _get_setting(db, CACHE_KEY)
    if stale:
        try:
            out = json.loads(stale)
            out["source"] = f"{out.get('source', 'cache')} (stale)"
            return out
        except Exception:
            pass
    if manual:
        try:
            return {"rate": round(float(manual)), "source": "manual",
                    "fetched_at": datetime.utcnow().isoformat()}
        except ValueError:
            pass
    return {"rate": None, "source": "unavailable", "fetched_at": None}
