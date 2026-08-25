from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.database import PlatformLog

# How long a log entry survives before the daily cleanup cron removes it —
# keeps the table from growing forever while still covering "what broke
# yesterday" style debugging.
RETENTION_DAYS = 14


def log_event(db: Session, level: str, source: str, message: str, detail: str = "") -> None:
    """Record one platform-wide diagnostic event. Never raises."""
    try:
        db.add(PlatformLog(level=level, source=source, message=message[:2000], detail=detail[:8000]))
        db.flush()
    except Exception as e:
        print(f"⚠️  platform log skipped ({source}): {e}")


def cleanup_old_logs(db: Session) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    deleted = db.query(PlatformLog).filter(PlatformLog.created_at < cutoff).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}
