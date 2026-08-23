"""Weekly digest — a short, system-triggered highlights email.

Deliberately not the same thing as the on-demand Weekly Report
(routers/companies/reports.py): that's a user-requested, Claude-generated
deep summary with its own 7-day lock. This is a lightweight mailed nudge —
counts only, no AI call — sent automatically once a week to every active user.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.database import Campaign, User, WeeklyDigestLog
from app.services.email_service import send_email

DIGEST_INTERVAL_DAYS = 7


def _already_sent_this_week(db: Session, user_id: int) -> bool:
    cutoff = datetime.utcnow() - timedelta(days=DIGEST_INTERVAL_DAYS)
    return db.query(WeeklyDigestLog).filter(
        WeeklyDigestLog.user_id == user_id,
        WeeklyDigestLog.sent_at >= cutoff,
        WeeklyDigestLog.status == "sent",
    ).first() is not None


def compose_and_send_digest(db: Session, user: User) -> bool:
    """Builds and sends one user's digest. Returns True if it sent (or was
    already sent this week — treated as a no-op success), False on failure."""
    if _already_sent_this_week(db, user.id):
        return True
    if not user.email:
        return False

    since = datetime.utcnow() - timedelta(days=DIGEST_INTERVAL_DAYS)

    campaigns = db.query(Campaign).filter(Campaign.user_id == user.id, Campaign.created_at >= since).all()
    sent = len([c for c in campaigns if c.status in ("sent", "replied") and c.sent_at and c.sent_at >= since])
    replied = len([c for c in campaigns if c.status == "replied" and c.replied_at and c.replied_at >= since])

    if sent == 0 and replied == 0:
        # Nothing happened — skip the email rather than mail an empty digest,
        # but still log it so we don't re-check this user again mid-week.
        db.add(WeeklyDigestLog(user_id=user.id, status="sent"))
        db.commit()
        return True

    html = f"""
    <p>Here's your week on Archon:</p>
    <ul>
      <li><strong>{sent}</strong> email{'s' if sent != 1 else ''} sent</li>
      <li><strong>{replied}</strong> repl{'ies' if replied != 1 else 'y'} received</li>
    </ul>
    <p><a href="{_frontend_link()}">Open your dashboard</a></p>
    """
    text = f"This week: {sent} emails sent, {replied} replies received."

    try:
        send_email(to_email=user.email, subject="Your week on Archon", html_body=html, text_body=text)
        db.add(WeeklyDigestLog(user_id=user.id, status="sent"))
        db.commit()
        return True
    except Exception as e:
        print(f"⚠️  weekly digest failed for user {user.id}: {e}")
        db.add(WeeklyDigestLog(user_id=user.id, status="failed"))
        db.commit()
        return False


def _frontend_link() -> str:
    import os
    return os.getenv("FRONTEND_URL", "").rstrip("/") or "#"


def run_weekly_digest(db: Session) -> dict:
    """Entry point for the scheduler: send to every active, active-plan user."""
    users = db.query(User).filter(User.is_active.is_(True), User.plan_status == "active").all()
    sent, failed = 0, 0
    for u in users:
        if compose_and_send_digest(db, u):
            sent += 1
        else:
            failed += 1
    return {"users": len(users), "sent": sent, "failed": failed}
