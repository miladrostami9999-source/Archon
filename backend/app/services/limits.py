"""Plan-limit lookups and usage counting.

Quotas live in the `plan_limits` table (admin-editable), so nothing here is
hardcoded. -1 always means unlimited.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.database import (
    PlanLimit, UserCompanyState, Campaign, DEFAULT_PLAN_LIMITS,
)

UNLIMITED = -1


def get_plan_limit(db: Session, plan: str) -> dict:
    row = db.query(PlanLimit).filter(PlanLimit.plan == plan).first()
    if row:
        return {
            "max_companies": row.max_companies,
            "max_emails_per_month": row.max_emails_per_month,
            "period_days": row.period_days,
        }
    # Fall back to defaults for an unknown plan
    return DEFAULT_PLAN_LIMITS.get(plan, DEFAULT_PLAN_LIMITS["basic"])


def _period_start(user, period_days: int) -> datetime:
    """Start of the current usage window. Anchored to plan_started_at when set,
    otherwise a rolling window ending now."""
    if user.plan_started_at:
        return user.plan_started_at
    return datetime.utcnow() - timedelta(days=period_days)


def get_usage(db: Session, user) -> dict:
    """Current usage vs. limits for a user, shaped for the dashboard widget."""
    limits = get_plan_limit(db, user.plan)

    companies_used = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == user.id
    ).count()

    start = _period_start(user, limits["period_days"])
    emails_used = db.query(Campaign).filter(
        Campaign.user_id == user.id,
        Campaign.status.in_(["sent", "replied"]),
        Campaign.sent_at.isnot(None),
        Campaign.sent_at >= start,
    ).count()

    def remaining(used, cap):
        return None if cap == UNLIMITED else max(0, cap - used)

    return {
        "plan": user.plan,
        "companies_used": companies_used,
        "companies_limit": limits["max_companies"],
        "companies_remaining": remaining(companies_used, limits["max_companies"]),
        "emails_used": emails_used,
        "emails_limit": limits["max_emails_per_month"],
        "emails_remaining": remaining(emails_used, limits["max_emails_per_month"]),
        "period_days": limits["period_days"],
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
    }


def can_add_company(db: Session, user) -> bool:
    limits = get_plan_limit(db, user.plan)
    cap = limits["max_companies"]
    if cap == UNLIMITED:
        return True
    used = db.query(UserCompanyState).filter(UserCompanyState.user_id == user.id).count()
    return used < cap


def can_send_email(db: Session, user) -> bool:
    limits = get_plan_limit(db, user.plan)
    cap = limits["max_emails_per_month"]
    if cap == UNLIMITED:
        return True
    start = _period_start(user, limits["period_days"])
    used = db.query(Campaign).filter(
        Campaign.user_id == user.id,
        Campaign.status.in_(["sent", "replied"]),
        Campaign.sent_at.isnot(None),
        Campaign.sent_at >= start,
    ).count()
    return used < cap
