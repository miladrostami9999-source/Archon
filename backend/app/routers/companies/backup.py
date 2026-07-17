import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db, User, Company, Contact, Note, Campaign, History, DailyTask, WeeklyReport
from .utils import row_to_dict

router = APIRouter()

# On Railway (and any container with an ephemeral filesystem), the default
# path below is wiped on every redeploy/restart. Set BACKUP_DIR to a mounted
# Railway Volume path (e.g. /data/backups) in production so backups survive.
_default_backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "backups")
BACKUP_DIR = os.getenv("BACKUP_DIR", _default_backup_dir)

# Tables included in every backup. Password reset tokens are intentionally
# excluded — they're short-lived and shouldn't be restored across backups.
BACKUP_MODELS = [
    ("users", User),
    ("companies", Company),
    ("contacts", Contact),
    ("notes", Note),
    ("campaigns", Campaign),
    ("history", History),
    ("daily_tasks", DailyTask),
    ("weekly_reports", WeeklyReport),
]


@router.post("/backup/run")
def run_backup(db: Session = Depends(get_db)):
    os.makedirs(BACKUP_DIR, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"archon_backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)

    backup_data = {
        "created_at": datetime.utcnow().isoformat(),
        "tables": {},
    }

    row_counts = {}
    for table_name, model in BACKUP_MODELS:
        rows = db.query(model).all()
        backup_data["tables"][table_name] = [row_to_dict(r) for r in rows]
        row_counts[table_name] = len(rows)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2, ensure_ascii=False)

    size_kb = round(os.path.getsize(filepath) / 1024, 1)

    return {
        "message": "Backup completed successfully",
        "filename": filename,
        "created_at": backup_data["created_at"],
        "size_kb": size_kb,
        "row_counts": row_counts,
    }


@router.get("/backup/list")
def list_backups():
    if not os.path.isdir(BACKUP_DIR):
        return []

    backups = []
    for fname in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(BACKUP_DIR, fname)
        stat = os.stat(fpath)
        backups.append({
            "filename": fname,
            "size_kb": round(stat.st_size / 1024, 1),
            "created_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
        })
    return backups[:20]  # most recent 20
