"""In-app notifications.

The marketplace only moves when someone acts — an admin confirms a transfer,
a client approves a delivery, a freelancer ships work. Nobody should have to
open a page speculatively to discover it's their turn, so every hand-off
raises a notification for whoever it now waits on.

Creating one must never be the reason an action fails: a payout that went
through but couldn't be announced is still a payout. Every helper here
swallows its own errors for that reason.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.database import Notification, User

# Kinds are stable strings so the frontend can pick an icon per event.
PROPOSAL_RECEIVED = "proposal_received"
PROPOSAL_ACCEPTED = "proposal_accepted"
PROPOSAL_REJECTED = "proposal_rejected"
MESSAGE_RECEIVED = "message_received"
PAYMENT_SUBMITTED = "payment_submitted"      # → admin
MILESTONE_FUNDED = "milestone_funded"
MILESTONE_DELIVERED = "milestone_delivered"
MILESTONE_APPROVED = "milestone_approved"    # → admin: payout is due
MILESTONE_RELEASED = "milestone_released"
REVIEW_RECEIVED = "review_received"
VERIFICATION_SUBMITTED = "verification_submitted"   # → admin
VERIFICATION_REVIEWED = "verification_reviewed"

# Kinds an admin should also get by email — the ones where money is waiting on
# them and a missed in-app badge means someone is left hanging.
EMAIL_KINDS = {PAYMENT_SUBMITTED, MILESTONE_APPROVED}


def notify(db: Session, user_id: int, kind: str, title: str, body: str = "", link: str = "") -> None:
    """Raise one notification. Never raises."""
    try:
        db.add(Notification(user_id=user_id, kind=kind, title=title, body=body, link=link))
        db.flush()
    except Exception as e:
        print(f"⚠️  notification skipped ({kind}): {e}")


def notify_admins(db: Session, kind: str, title: str, body: str = "", link: str = "") -> None:
    """Raise the same notification for every admin, and email them when the
    event is one where money is sitting waiting."""
    try:
        admins = db.query(User).filter(User.role == "admin", User.is_active.is_(True)).all()
        for a in admins:
            notify(db, a.id, kind, title, body, link)
        if kind in EMAIL_KINDS:
            _email_admins(admins, title, body, link)
    except Exception as e:
        print(f"⚠️  admin notification skipped ({kind}): {e}")


def _email_admins(admins, title: str, body: str, link: str) -> None:
    """Best-effort email. Silent on failure — the in-app copy already landed."""
    try:
        import os
        from app.services.email_service import send_email

        frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
        url = f"{frontend}{link}" if frontend and link else ""
        html = (
            f"<p>{body}</p>"
            + (f'<p><a href="{url}">Open it in Archon</a></p>' if url else "")
        )
        for a in admins:
            if a.email:
                send_email(to_email=a.email, subject=f"Archon — {title}", html_body=html, text_body=body)
    except Exception as e:
        print(f"⚠️  admin email skipped: {e}")


def unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
        .count()
    )


def mark_all_read(db: Session, user_id: int) -> int:
    n = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
        .update({Notification.read_at: datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return n or 0


def to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "read": n.read_at is not None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
