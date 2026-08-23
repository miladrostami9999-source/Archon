from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, DailyTask, User, UserCompanyState
from app.routers.auth import get_current_user, require_active_plan
from app.services.timezone_utils import iran_day_start_utc
from .schemas import TaskGenerateRequest, PersonalTaskCreate
from .utils import to_dict, company_to_dict

router = APIRouter()


@router.post("/tasks/generate")
def generate_tasks(data: TaskGenerateRequest, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    from app.services.claude import generate_daily_tasks

    # Only the user's own unlocked companies. Feeding the whole catalog to
    # Claude and handing back the summary was a way to read rows the plan
    # hasn't paid for — and it billed us for tokens on companies the user
    # can't act on anyway.
    rows = db.query(Company, UserCompanyState).join(
        UserCompanyState,
        (UserCompanyState.company_id == Company.id) & (UserCompanyState.user_id == current_user.id),
    ).all()
    company_list = [company_to_dict(c, s) for c, s in rows]
    if not company_list:
        raise HTTPException(
            status_code=400,
            detail="Unlock a few companies first — daily tasks are built from the ones in your pipeline.",
        )

    try:
        tasks = generate_daily_tasks(company_list, lang=data.lang)
    except Exception as e:
        import traceback
        print("TASK ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    # Only replace this user's own tasks for today (Iran calendar day — the
    # business runs on Tehran time, and generating right after Iran midnight
    # must count as "today", not spill into what UTC still calls yesterday).
    today_start = iran_day_start_utc()
    db.query(DailyTask).filter(
        DailyTask.date >= today_start,
        DailyTask.user_id == current_user.id,
    ).delete()

    saved = []
    for t in tasks:
        task = DailyTask(
            user_id=current_user.id,
            task_type=t.get("type", "review"),
            description=f"{t.get('title', '')} — {t.get('description', '')}",
            priority=t.get("priority", 3),
            is_done=False,
            date=datetime.utcnow()
        )
        db.add(task)
        db.flush()
        saved.append({
            "id": task.id,
            "task_type": t.get("type"),
            "priority": t.get("priority"),
            "title": t.get("title"),
            "description": t.get("description"),
            "is_done": False
        })

    db.commit()
    return saved


@router.get("/tasks/today")
def get_today_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today_start = iran_day_start_utc()
    tasks = db.query(DailyTask).filter(
        DailyTask.date >= today_start,
        DailyTask.user_id == current_user.id,
    ).order_by(DailyTask.priority).all()
    return [to_dict(t) for t in tasks]


@router.patch("/tasks/{task_id}/done")
def mark_task_done(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id, DailyTask.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_done = not task.is_done
    db.commit()
    return to_dict(task)


@router.post("/tasks/personal")
def add_personal_task(data: PersonalTaskCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = DailyTask(
        user_id=current_user.id,
        task_type="personal",
        description=data.description,
        priority=99,
        is_done=False,
        date=datetime.utcnow()
    )
    db.add(task)
    db.flush()

    result = to_dict(task)
    result['title'] = data.title
    result['description'] = data.description

    db.commit()
    return result


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id, DailyTask.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}
