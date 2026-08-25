"""Revenue aggregation — a payment counts as revenue the moment an admin
approves it (see PaymentRequest's docstring: "approving it activates the
plan"), so every query here filters status=='approved' and groups by
reviewed_at (the approval timestamp), not created_at.
"""
import json
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.database import PaymentRequest, RevenueSnapshot
from app.services.exchange import get_usd_to_toman

PLAN_ORDER = ["trial", "basic", "pro", "agency"]


def _to_usd(db: Session, amount: float | None, currency: str | None) -> float:
    if not amount:
        return 0.0
    if (currency or "IRR").upper() == "USD":
        return amount
    rate = get_usd_to_toman(db)["rate"]
    return amount / rate if rate else 0.0


def compute_revenue_for_period(db: Session, start: datetime, end: datetime) -> dict:
    rows = db.query(PaymentRequest).filter(
        PaymentRequest.status == "approved",
        PaymentRequest.reviewed_at >= start,
        PaymentRequest.reviewed_at < end,
    ).all()

    breakdown = {p: 0.0 for p in PLAN_ORDER}
    total = 0.0
    for r in rows:
        usd = _to_usd(db, r.amount, r.currency)
        total += usd
        breakdown[r.plan] = breakdown.get(r.plan, 0.0) + usd

    return {
        "total_usd": round(total, 2),
        "breakdown": {k: round(v, 2) for k, v in breakdown.items()},
        "approved_count": len(rows),
    }


def get_summary(db: Session) -> dict:
    now = datetime.utcnow()
    week_start = now - timedelta(days=now.weekday())  # Monday 00:00, same-day precision is fine here
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    all_time = db.query(PaymentRequest).filter(PaymentRequest.status == "approved").all()
    all_time_usd = round(sum(_to_usd(db, r.amount, r.currency) for r in all_time), 2)

    this_week = compute_revenue_for_period(db, week_start, now + timedelta(seconds=1))
    this_month = compute_revenue_for_period(db, month_start, now + timedelta(seconds=1))

    # Rough MRR: latest approved payment per active-plan user, summed at that
    # plan's current USD price — good enough for a dashboard estimate, not
    # meant to be an exact accounting figure.
    from app.models.database import PlanLimit
    plan_prices = {p.plan: p.price_usd for p in db.query(PlanLimit).all()}
    active_users_per_plan = {}
    from app.models.database import User
    for u in db.query(User).filter(User.is_active.is_(True), User.plan_status == "active").all():
        active_users_per_plan[u.plan] = active_users_per_plan.get(u.plan, 0) + 1
    mrr = round(sum(count * plan_prices.get(plan, 0) for plan, count in active_users_per_plan.items()), 2)

    return {
        "all_time_usd": all_time_usd,
        "this_week_usd": this_week["total_usd"],
        "this_month_usd": this_month["total_usd"],
        "mrr_usd": mrr,
    }


def snapshot_period(db: Session, period_type: str) -> RevenueSnapshot:
    """Finalizes the previous full week/month and stores it. Safe to call
    more than once for the same period — updates the existing row instead of
    duplicating it, so a retried cron run can't skew the trend chart."""
    now = datetime.utcnow()
    if period_type == "week":
        this_week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        start = this_week_start - timedelta(days=7)
        end = this_week_start
    elif period_type == "month":
        this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = this_month_start
        start = (this_month_start - timedelta(days=1)).replace(day=1)
    else:
        raise ValueError("period_type must be 'week' or 'month'")

    data = compute_revenue_for_period(db, start, end)

    existing = db.query(RevenueSnapshot).filter(
        RevenueSnapshot.period_type == period_type,
        RevenueSnapshot.period_start == start,
    ).first()
    row = existing or RevenueSnapshot(period_type=period_type, period_start=start, period_end=end)
    row.period_end = end
    row.total_usd = data["total_usd"]
    row.breakdown_json = json.dumps(data["breakdown"])
    row.approved_count = data["approved_count"]
    if not existing:
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_timeseries(db: Session, period_type: str, limit: int = 12) -> list[dict]:
    rows = (
        db.query(RevenueSnapshot)
        .filter(RevenueSnapshot.period_type == period_type)
        .order_by(RevenueSnapshot.period_start.desc())
        .limit(limit)
        .all()
    )
    out = [{
        "period_start": r.period_start.isoformat() if r.period_start else None,
        "period_end": r.period_end.isoformat() if r.period_end else None,
        "total_usd": r.total_usd,
        "breakdown": json.loads(r.breakdown_json) if r.breakdown_json else {},
        "approved_count": r.approved_count,
    } for r in rows]
    out.reverse()
    return out
