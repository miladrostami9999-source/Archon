import json as _json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, Campaign, WeeklyReport
from .schemas import ReportRequest
from .utils import to_dict

router = APIRouter()

REPORT_LOCK_DAYS = 7


def _report_status(db: Session):
    """Returns the most recent report + whether generation is currently locked."""
    last = db.query(WeeklyReport).order_by(WeeklyReport.generated_at.desc()).first()
    if not last:
        return {"locked": False, "report": None, "generated_at": None, "next_available_at": None}

    elapsed = datetime.utcnow() - last.generated_at
    remaining = timedelta(days=REPORT_LOCK_DAYS) - elapsed
    locked = remaining.total_seconds() > 0

    return {
        "locked": locked,
        "report": _json.loads(last.report_json),
        "lang": last.lang,
        "generated_at": last.generated_at.isoformat(),
        "next_available_at": (last.generated_at + timedelta(days=REPORT_LOCK_DAYS)).isoformat() if locked else None,
    }


@router.get("/report/weekly/status")
def get_weekly_report_status(db: Session = Depends(get_db)):
    """Frontend calls this on page load to know whether to show the last report
    and whether the Generate button should be locked."""
    return _report_status(db)


@router.post("/report/weekly")
def generate_weekly_report(request: ReportRequest, db: Session = Depends(get_db)):
    from app.services.claude import generate_weekly_report as gen_report

    status = _report_status(db)
    if status["locked"]:
        raise HTTPException(
            status_code=429,
            detail=f"Weekly report already generated. Next one available after {status['next_available_at']}."
        )

    companies = db.query(Company).all()
    companies_list = [to_dict(c) for c in companies]

    status_counts = {}
    for c in companies_list:
        s = c.get('status', 'new')
        status_counts[s] = status_counts.get(s, 0) + 1

    campaigns = db.query(Campaign).all()
    emails_sent = len([c for c in campaigns if c.status in ['sent', 'replied']])
    emails_replied = len([c for c in campaigns if c.status == 'replied'])
    reply_rate = round((emails_replied / emails_sent * 100)) if emails_sent > 0 else 0
    favorites = len([c for c in companies_list if c.get('is_favorite')])

    data = {
        "total": len(companies_list),
        "favorites": favorites,
        "status_counts": status_counts,
        "emails_sent": emails_sent,
        "emails_replied": emails_replied,
        "reply_rate": reply_rate,
        "companies": companies_list,
    }

    report = gen_report(data, lang=request.lang)

    # Persist so the lock survives refresh, logout, and works across devices
    saved = WeeklyReport(report_json=_json.dumps(report), lang=request.lang)
    db.add(saved)
    db.commit()

    return report
