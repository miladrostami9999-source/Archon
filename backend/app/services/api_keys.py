"""Data API credential generation, lookup, and usage-quota counting.

Same conventions as the rest of the plan-limit system in services/limits.py:
quotas live in PlanLimit (admin-editable, -1-style sentinels), usage is
counted from a timestamped table rather than an in-memory counter so it
survives a restart and needs no new infra (Redis, etc).
"""
import hashlib
import secrets
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.database import ApiKey, ApiRequestLog, PlanLimit, DEFAULT_PLAN_LIMITS, User
from app.services.limits import _period_start


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, key_hash, key_prefix). The raw key is shown to the
    caller exactly once — only the hash is ever persisted, so it can't be
    recovered later, same as a GitHub personal access token."""
    raw = "ak_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, key_hash, raw[:10]


def get_user_from_api_key(db: Session, raw_key: str) -> User | None:
    if not raw_key or not raw_key.startswith("ak_"):
        return None
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    row = db.query(ApiKey).filter(ApiKey.key_hash == key_hash).first()
    if not row or row.revoked_at is not None:
        return None
    row.last_used_at = datetime.utcnow()
    db.commit()
    return db.query(User).filter(User.id == row.user_id).first()


def _api_quota(db: Session, plan: str) -> int:
    row = db.query(PlanLimit).filter(PlanLimit.plan == plan).first()
    if row is not None:
        return row.max_api_requests
    return DEFAULT_PLAN_LIMITS.get(plan, {}).get("max_api_requests", 0)


def can_make_api_request(db: Session, user: User) -> bool:
    cap = _api_quota(db, user.plan)
    if cap <= 0:
        return False  # 0 means "no Data API access on this plan" — never unlimited here
    limit_row = db.query(PlanLimit).filter(PlanLimit.plan == user.plan).first()
    period_days = limit_row.period_days if limit_row else 30
    start = _period_start(user, period_days)
    used = db.query(ApiRequestLog).filter(
        ApiRequestLog.user_id == user.id, ApiRequestLog.created_at >= start
    ).count()
    return used < cap


def record_api_request(db: Session, user: User):
    db.add(ApiRequestLog(user_id=user.id))
    db.commit()


def get_api_usage(db: Session, user: User) -> dict:
    cap = _api_quota(db, user.plan)
    limit_row = db.query(PlanLimit).filter(PlanLimit.plan == user.plan).first()
    period_days = limit_row.period_days if limit_row else 30
    start = _period_start(user, period_days)
    used = db.query(ApiRequestLog).filter(
        ApiRequestLog.user_id == user.id, ApiRequestLog.created_at >= start
    ).count()
    return {
        "plan": user.plan,
        "requests_used": used,
        "requests_limit": cap,
        "requests_remaining": max(0, cap - used) if cap > 0 else 0,
        "period_days": period_days,
    }
