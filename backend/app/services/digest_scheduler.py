"""In-process cron for everything that used to only refresh when a user
clicked a button: the weekly digest email, Daily Tasks, and the Weekly AI
Report. No external scheduler exists in this repo (no Railway cron, no
separate worker), so this all runs inside the FastAPI process itself via
APScheduler, started once at app startup.

Daily Tasks and the Weekly Report run on Iran (Asia/Tehran) midnight —
that's the business's actual day/week boundary — while the digest email
keeps its original UTC Monday slot, unrelated to that cadence.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler = None


def _run(label: str, fn):
    from app.models.database import SessionLocal

    db = SessionLocal()
    try:
        result = fn(db)
        print(f"📨 {label} run: {result}")
    except Exception as e:
        print(f"⚠️  {label} run failed: {e}")
    finally:
        db.close()


def _digest_job():
    from app.services.digest import run_weekly_digest
    _run("weekly digest", run_weekly_digest)


def _daily_tasks_job():
    from app.services.auto_reports import run_daily_tasks
    _run("daily tasks reset", run_daily_tasks)


def _weekly_report_job():
    from app.services.auto_reports import run_weekly_reports
    _run("weekly report reset", run_weekly_reports)


def start():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    # Monday 08:00 UTC — matches the "start of week" cadence used elsewhere in the app.
    _scheduler.add_job(_digest_job, CronTrigger(day_of_week="mon", hour=8, minute=0), id="weekly_digest")
    # Every day at 00:00 Iran time — the business runs on Tehran time, not UTC.
    _scheduler.add_job(_daily_tasks_job, CronTrigger(hour=0, minute=0, timezone="Asia/Tehran"), id="daily_tasks_reset")
    # Every Saturday at 00:00 Iran time — start of the Iranian calendar week.
    _scheduler.add_job(_weekly_report_job, CronTrigger(day_of_week="sat", hour=0, minute=0, timezone="Asia/Tehran"), id="weekly_report_reset")
    _scheduler.start()


def shutdown():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
