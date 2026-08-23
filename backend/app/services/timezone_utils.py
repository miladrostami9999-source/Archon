"""Iran-calendar day boundaries.

Everything in this database is stored as naive UTC, and "today" for a daily
reset has to mean Iran's calendar day (Asia/Tehran, UTC+3:30) — not UTC's,
which would flip over mid-afternoon Iran time and make a same-day reset look
like it happened "yesterday" once queried a few hours later.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

IRAN_TZ = ZoneInfo("Asia/Tehran")


def iran_day_start_utc(now: datetime | None = None) -> datetime:
    """The start (00:00) of the current Iran calendar day, as a naive UTC
    datetime — comparable directly against the naive-UTC columns in the DB."""
    now = now or datetime.now(IRAN_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=ZoneInfo("UTC")).astimezone(IRAN_TZ)
    else:
        now = now.astimezone(IRAN_TZ)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
