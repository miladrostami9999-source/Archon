"""In-process cron for the weekly digest. No external scheduler exists in
this repo (no Railway cron, no separate worker), so this runs inside the
FastAPI process itself via APScheduler, started once at app startup."""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler = None


def _job():
    from app.models.database import SessionLocal
    from app.services.digest import run_weekly_digest

    db = SessionLocal()
    try:
        result = run_weekly_digest(db)
        print(f"📨 weekly digest run: {result}")
    except Exception as e:
        print(f"⚠️  weekly digest run failed: {e}")
    finally:
        db.close()


def start():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    # Monday 08:00 UTC — matches the "start of week" cadence used elsewhere in the app.
    _scheduler.add_job(_job, CronTrigger(day_of_week="mon", hour=8, minute=0), id="weekly_digest")
    _scheduler.start()


def shutdown():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
