from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import get_db, Company, Campaign, UserCompanyState, User, DailyTask
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/analytics/summary")
def get_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.access import access_state

    # Catalog-level facts are shared, but scoped to the countries this plan can
    # browse — otherwise the totals here describe a catalog the user can't open.
    access = access_state(db, current_user)
    scope = access.get("countries")

    def catalog(q):
        return q.filter(Company.country.in_(scope)) if scope else q

    total = catalog(db.query(Company)).count()
    industries = catalog(db.query(
        Company.industry, func.count(Company.id)
    ).filter(Company.industry != None)).group_by(Company.industry).all()
    countries = catalog(db.query(
        Company.country, func.count(Company.id)
    ).filter(Company.country != None)).group_by(Company.country).order_by(func.count(Company.id).desc()).limit(10).all()

    # Pipeline stats are this user's own. Companies the user hasn't touched
    # count as "new", so status_counts still sums to the full catalog size.
    uid = current_user.id
    statuses = ["new", "reviewed", "ready", "sent", "waiting", "replied", "meeting", "client", "archive"]
    state_counts = dict(
        db.query(UserCompanyState.status, func.count(UserCompanyState.id))
        .filter(UserCompanyState.user_id == uid)
        .group_by(UserCompanyState.status).all()
    )
    touched = sum(state_counts.values())
    status_counts = {s: int(state_counts.get(s, 0)) for s in statuses}
    status_counts["new"] += max(0, total - touched)  # untouched companies are "new" for this user

    favorites = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == uid, UserCompanyState.is_favorite.is_(True)
    ).count()

    total_emails = db.query(Campaign).filter(Campaign.user_id == uid).count()
    sent_emails = db.query(Campaign).filter(Campaign.user_id == uid, Campaign.status == "sent").count()
    replied_emails = db.query(Campaign).filter(Campaign.user_id == uid, Campaign.status == "replied").count()

    # ── Heat distribution — hot/warm/cold across this user's own pipeline ──
    # Derived live with the same heat_for() the rest of the app uses (see
    # company_to_dict), not read straight off the stored column: a stored
    # non-cold value only gets overwritten by the "Recalculate Heat" admin
    # tool, so reading it directly here showed numbers that silently drifted
    # out of sync with what recalculating (or any other page) actually shows.
    from app.services.scoring import heat_for, parse_signals

    heat_counts = {"hot": 0, "warm": 0, "cold": 0}
    pipeline_rows = db.query(
        UserCompanyState.status, UserCompanyState.updated_at,
        Company.opportunity_score, Company.signals,
    ).join(Company, Company.id == UserCompanyState.company_id).filter(UserCompanyState.user_id == uid).all()
    for status, updated_at, score, signals in pipeline_rows:
        live_heat = heat_for(status, score, parse_signals(signals), updated_at)
        heat_counts[live_heat] = heat_counts.get(live_heat, 0) + 1

    # ── Score distribution — where this user's touched companies land ──
    touched_ids = [r[0] for r in db.query(UserCompanyState.company_id).filter(UserCompanyState.user_id == uid).all()]
    score_buckets = {"poor": 0, "fair": 0, "good": 0, "great": 0}
    if touched_ids:
        for (score,) in db.query(Company.opportunity_score).filter(Company.id.in_(touched_ids)).all():
            s = score or 0
            if s < 40:
                score_buckets["poor"] += 1
            elif s < 60:
                score_buckets["fair"] += 1
            elif s < 80:
                score_buckets["good"] += 1
            else:
                score_buckets["great"] += 1

    # ── Pipeline velocity — average days a moved company has sat in its
    # current stage. "new" is excluded since it's the untouched default. ──
    moved_rows = db.query(UserCompanyState.created_at, UserCompanyState.updated_at).filter(
        UserCompanyState.user_id == uid, UserCompanyState.status != "new"
    ).all()
    pipeline_velocity_days = None
    if moved_rows:
        days = [(u - c).total_seconds() / 86400 for c, u in moved_rows if c and u]
        if days:
            pipeline_velocity_days = round(sum(days) / len(days), 1)

    # ── Task completion — last 30 days, this user ──
    since_30 = datetime.utcnow() - timedelta(days=30)
    task_rows = db.query(DailyTask.is_done).filter(DailyTask.user_id == uid, DailyTask.date >= since_30).all()
    task_completion = {
        "done": sum(1 for (d,) in task_rows if d),
        "total": len(task_rows),
    }

    # ── Reply rate by tone ──
    tone_rows = db.query(Campaign.tone, Campaign.status).filter(
        Campaign.user_id == uid, Campaign.tone.isnot(None), Campaign.status.in_(["sent", "replied"])
    ).all()
    tone_agg: dict = {}
    for tone, status in tone_rows:
        t = tone or "unspecified"
        agg = tone_agg.setdefault(t, {"sent": 0, "replied": 0})
        agg["sent"] += 1
        if status == "replied":
            agg["replied"] += 1
    tone_performance = [
        {"tone": t, "sent": v["sent"], "replied": v["replied"],
         "reply_rate": round((v["replied"] / v["sent"]) * 100) if v["sent"] else 0}
        for t, v in sorted(tone_agg.items(), key=lambda kv: kv[1]["sent"], reverse=True)
    ]

    return {
        "total_companies": total,
        "favorites": favorites,
        "status_counts": status_counts,
        "industries": [{"name": i[0], "count": i[1]} for i in industries],
        "top_countries": [{"name": c[0], "count": c[1]} for c in countries],
        "emails": {
            "total": total_emails,
            "sent": sent_emails,
            "replied": replied_emails
        },
        "heat_counts": heat_counts,
        "score_buckets": score_buckets,
        "pipeline_velocity_days": pipeline_velocity_days,
        "task_completion": task_completion,
        "tone_performance": tone_performance,
    }


@router.get("/analytics/reply-trend")
def get_reply_trend(interval: str = "day", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sent/replied counts bucketed by day, week or month, from real
    EmailReputationEvent rows — a true trend, not a point-in-time ratio.

    Buckets are computed in Python (not a DB-side date-trunc) — same approach
    as GET /auth/admin/growth, which avoids a cast(DateTime, Date) crash that
    already happened once on SQLite.
    """
    from app.models.database import EmailReputationEvent

    if interval not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="interval must be 'day', 'week', or 'month'")

    now = datetime.utcnow()
    if interval == "day":
        since = now - timedelta(days=31)
    elif interval == "week":
        since = now - timedelta(weeks=12)
    else:
        since = now - timedelta(days=366)

    def bucket_key(dt: datetime) -> str:
        if interval == "day":
            return dt.strftime("%Y-%m-%d")
        if interval == "week":
            monday = dt - timedelta(days=dt.weekday())
            return monday.strftime("%Y-%m-%d")
        return dt.strftime("%Y-%m")

    sent_by_bucket: dict = {}
    replied_by_bucket: dict = {}
    rows = db.query(EmailReputationEvent.event_type, EmailReputationEvent.created_at).filter(
        EmailReputationEvent.user_id == current_user.id,
        EmailReputationEvent.created_at >= since,
        EmailReputationEvent.event_type.in_(["sent", "replied"]),
    ).all()
    for event_type, dt in rows:
        if not dt:
            continue
        k = bucket_key(dt)
        if event_type == "sent":
            sent_by_bucket[k] = sent_by_bucket.get(k, 0) + 1
        else:
            replied_by_bucket[k] = replied_by_bucket.get(k, 0) + 1

    points = []
    if interval == "day":
        cursor = since.date()
        end = now.date()
        while cursor <= end:
            k = cursor.strftime("%Y-%m-%d")
            points.append({"date": k, "label": cursor.strftime("%b %d"), "sent": sent_by_bucket.get(k, 0), "replied": replied_by_bucket.get(k, 0)})
            cursor += timedelta(days=1)
    elif interval == "week":
        cursor = (since - timedelta(days=since.weekday())).date()
        end_monday = (now - timedelta(days=now.weekday())).date()
        while cursor <= end_monday:
            k = cursor.strftime("%Y-%m-%d")
            points.append({"date": k, "label": f"Week of {cursor.strftime('%b %d')}", "sent": sent_by_bucket.get(k, 0), "replied": replied_by_bucket.get(k, 0)})
            cursor += timedelta(weeks=1)
    else:
        y, m = since.year, since.month
        while (y, m) <= (now.year, now.month):
            k = f"{y:04d}-{m:02d}"
            points.append({"date": k, "label": datetime(y, m, 1).strftime("%b %Y"), "sent": sent_by_bucket.get(k, 0), "replied": replied_by_bucket.get(k, 0)})
            m += 1
            if m > 12:
                m = 1; y += 1

    return {"interval": interval, "points": points}
