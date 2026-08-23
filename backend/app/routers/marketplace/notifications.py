from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Notification, User
from app.routers.auth import get_current_user
from app.services import notifications as notif

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    limit: int = 30,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    rows = q.order_by(Notification.created_at.desc()).limit(min(limit, 100)).all()
    return {
        "unread": notif.unread_count(db, current_user.id),
        "items": [notif.to_dict(n) for n in rows],
    }


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Drives the bell badge. Deliberately on plain get_current_user rather
    than the marketplace gate — notifications cover the whole app."""
    return {"count": notif.unread_count(db, current_user.id)}


@router.post("/read-all")
def read_all(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"marked": notif.mark_all_read(db, current_user.id)}


@router.post("/{notification_id}/read")
def read_one(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    if not n.read_at:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"message": "Marked read"}
