"""Email reputation score.

There's no bounce/spam webhook wired up (Resend isn't configured with one),
so this is deliberately approximate: it's built from signals the app already
has — how often a user's sends get a reply — plus an admin's own manual
record when a send is known to have failed. It's a health signal for the
user, not a delivery guarantee.
"""
from sqlalchemy.orm import Session

from app.models.database import EmailReputationEvent

SENT = "sent"
REPLIED = "replied"
BOUNCED_MANUAL = "bounced_manual"


def log_event(db: Session, user_id: int, event_type: str, campaign_id: int = None) -> None:
    """Record one event. Never raises — a missed reputation row is never a
    reason a send or a reply fails."""
    try:
        db.add(EmailReputationEvent(user_id=user_id, campaign_id=campaign_id, event_type=event_type))
        db.flush()
    except Exception as e:
        print(f"⚠️  reputation event skipped ({event_type}): {e}")


def score_for_user(db: Session, user_id: int) -> dict:
    events = db.query(EmailReputationEvent).filter(EmailReputationEvent.user_id == user_id).all()
    sent = sum(1 for e in events if e.event_type == SENT)
    replied = sum(1 for e in events if e.event_type == REPLIED)
    bounced = sum(1 for e in events if e.event_type == BOUNCED_MANUAL)
    reply_rate = (replied / sent) if sent else 0.0
    score = max(0, min(100, round(reply_rate * 100 - bounced * 10)))
    return {
        "sent": sent,
        "replied": replied,
        "reply_rate": round(reply_rate, 3),
        "bounced_manual": bounced,
        "score": score,
    }
