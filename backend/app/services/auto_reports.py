"""Calendar-driven refresh for Daily Tasks and the Weekly AI Report.

Both used to be purely user-triggered: tasks just sat there until someone
clicked Generate, and the weekly report page could show a report from weeks
ago forever if nobody happened to click Generate again. This runs both on a
fixed Iran-midnight cadence (via services/digest_scheduler.py) so every
active user gets a fresh one automatically — daily for tasks, weekly for the
report — without having to ask for it.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.database import Company, DailyTask, User, UserCompanyState
from app.services.timezone_utils import iran_day_start_utc


def run_daily_tasks(db: Session) -> dict:
    from app.services.claude import generate_daily_tasks
    from app.routers.companies.utils import company_to_dict

    today_start = iran_day_start_utc()
    users = db.query(User).filter(User.is_active.is_(True), User.plan_status == "active").all()
    generated, skipped, failed = 0, 0, 0

    for user in users:
        rows = db.query(Company, UserCompanyState).join(
            UserCompanyState,
            (UserCompanyState.company_id == Company.id) & (UserCompanyState.user_id == user.id),
        ).all()
        company_list = [company_to_dict(c, s) for c, s in rows]
        if not company_list:
            skipped += 1
            continue
        try:
            tasks = generate_daily_tasks(company_list, lang="en")
        except Exception as e:
            print(f"⚠️  auto daily-tasks failed for user {user.id}: {e}")
            failed += 1
            continue

        db.query(DailyTask).filter(
            DailyTask.date >= today_start, DailyTask.user_id == user.id,
        ).delete()
        for t in tasks:
            db.add(DailyTask(
                user_id=user.id, task_type=t.get("type", "review"),
                description=f"{t.get('title', '')} — {t.get('description', '')}",
                priority=t.get("priority", 3), is_done=False, date=datetime.utcnow(),
            ))
        db.commit()
        generated += 1

    return {"users": len(users), "generated": generated, "skipped": skipped, "failed": failed}


def run_weekly_reports(db: Session) -> dict:
    from app.routers.companies.reports import build_and_save_report

    users = db.query(User).filter(User.is_active.is_(True), User.plan_status == "active").all()
    generated, skipped, failed = 0, 0, 0

    for user in users:
        has_pipeline = db.query(UserCompanyState).filter(UserCompanyState.user_id == user.id).first() is not None
        if not has_pipeline:
            skipped += 1
            continue
        try:
            build_and_save_report(db, user, lang="en")
            generated += 1
        except Exception as e:
            print(f"⚠️  auto weekly-report failed for user {user.id}: {e}")
            failed += 1

    return {"users": len(users), "generated": generated, "skipped": skipped, "failed": failed}
