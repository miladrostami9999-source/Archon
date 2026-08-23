import json as _json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, Campaign, WeeklyReport, UserCompanyState, User
from app.routers.auth import get_current_user, require_feature
from .schemas import ReportRequest
from .utils import to_dict, company_to_dict

router = APIRouter()

REPORT_LOCK_DAYS = 7


def _report_status(db: Session, user_id: int):
    """This user's most recent report + whether generation is currently locked."""
    last = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == user_id
    ).order_by(WeeklyReport.generated_at.desc()).first()
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
def get_weekly_report_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Frontend calls this on page load to know whether to show the last report
    and whether the Generate button should be locked."""
    return _report_status(db, current_user.id)


def build_and_save_report(db: Session, user: User, lang: str = "en") -> dict:
    """Everything from 'gather this user's pipeline' to 'report saved and
    the 7-day lock reset' — shared by the manual Generate button and the
    automatic weekly regeneration job so the two can never drift apart."""
    from app.services.claude import generate_weekly_report as gen_report

    # The report covers this user's own pipeline — the companies they unlocked.
    # It used to run over the entire catalog, which both leaked names the plan
    # hadn't paid for and made the report meaningless once the catalog grew.
    rows = db.query(Company, UserCompanyState).join(
        UserCompanyState,
        (UserCompanyState.company_id == Company.id) & (UserCompanyState.user_id == user.id),
    ).all()
    companies_list = [company_to_dict(c, s) for c, s in rows]

    status_counts = {}
    for c in companies_list:
        s = c.get('status', 'new')
        status_counts[s] = status_counts.get(s, 0) + 1

    campaigns = db.query(Campaign).filter(Campaign.user_id == user.id).all()
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

    report = gen_report(data, lang=lang)

    # Persist per-user so the lock survives refresh/logout and is isolated
    saved = WeeklyReport(user_id=user.id, report_json=_json.dumps(report), lang=lang)
    db.add(saved)
    db.commit()

    return report


@router.post("/report/weekly")
def generate_weekly_report(request: ReportRequest, current_user: User = Depends(require_feature("weekly_report")), db: Session = Depends(get_db)):
    status = _report_status(db, current_user.id)
    if status["locked"]:
        raise HTTPException(
            status_code=429,
            detail=f"Weekly report already generated. Next one available after {status['next_available_at']}."
        )
    return build_and_save_report(db, current_user, request.lang)
