from sqlalchemy.orm import Session

from app.models.database import AdminActivityLog, User


def log_admin_action(db: Session, admin: User, action: str, target: str = "", detail: str = "") -> None:
    """Record one admin mutation. Never raises."""
    try:
        db.add(AdminActivityLog(admin_id=admin.id, admin_name=admin.name, action=action, target=target, detail=detail))
        db.flush()
    except Exception as e:
        print(f"⚠️  admin activity log skipped ({action}): {e}")
