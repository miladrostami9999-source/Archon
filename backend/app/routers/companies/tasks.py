from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, DailyTask
from .schemas import TaskGenerateRequest, PersonalTaskCreate
from .utils import to_dict

router = APIRouter()


@router.post("/tasks/generate")
def generate_tasks(data: TaskGenerateRequest, db: Session = Depends(get_db)):
    from app.services.claude import generate_daily_tasks
    companies = db.query(Company).all()
    company_list = [to_dict(c) for c in companies]

    try:
        tasks = generate_daily_tasks(company_list, lang=data.lang)
    except Exception as e:
        import traceback
        print("TASK ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    db.query(DailyTask).filter(
        DailyTask.date >= today_start
    ).delete()

    saved = []
    for t in tasks:
        task = DailyTask(
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
def get_today_tasks(db: Session = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tasks = db.query(DailyTask).filter(
        DailyTask.date >= today_start
    ).order_by(DailyTask.priority).all()
    return [to_dict(t) for t in tasks]


@router.patch("/tasks/{task_id}/done")
def mark_task_done(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_done = not task.is_done
    db.commit()
    return to_dict(task)


@router.post("/tasks/personal")
def add_personal_task(data: PersonalTaskCreate, db: Session = Depends(get_db)):
    task = DailyTask(
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
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}
