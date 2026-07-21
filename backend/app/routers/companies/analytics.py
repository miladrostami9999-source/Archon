from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import get_db, Company, Campaign, UserCompanyState, User
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/analytics/summary")
def get_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Catalog-level facts are shared
    total = db.query(Company).count()
    industries = db.query(
        Company.industry, func.count(Company.id)
    ).filter(Company.industry != None).group_by(Company.industry).all()
    countries = db.query(
        Company.country, func.count(Company.id)
    ).filter(Company.country != None).group_by(Company.country).order_by(func.count(Company.id).desc()).limit(10).all()

    # Pipeline stats are this user's own. Companies the user hasn't touched
    # count as "new", so status_counts still sums to the full catalog size.
    uid = current_user.id
    statuses = ["new", "reviewed", "ready", "sent", "waiting", "replied", "meeting", "client", "archive"]
    state_counts = dict(
        db.query(UserCompanyState.status, func.count(UserCompanyState.id))
        .filter(UserCompanyState.user_id == uid)
        .group_by(UserCompanyState.status).all()
    )
    touched = sum(state_counts.values())
    status_counts = {s: int(state_counts.get(s, 0)) for s in statuses}
    status_counts["new"] += max(0, total - touched)  # untouched companies are "new" for this user

    favorites = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == uid, UserCompanyState.is_favorite.is_(True)
    ).count()

    total_emails = db.query(Campaign).filter(Campaign.user_id == uid).count()
    sent_emails = db.query(Campaign).filter(Campaign.user_id == uid, Campaign.status == "sent").count()
    replied_emails = db.query(Campaign).filter(Campaign.user_id == uid, Campaign.status == "replied").count()

    return {
        "total_companies": total,
        "favorites": favorites,
        "status_counts": status_counts,
        "industries": [{"name": i[0], "count": i[1]} for i in industries],
        "top_countries": [{"name": c[0], "count": c[1]} for c in countries],
        "emails": {
            "total": total_emails,
            "sent": sent_emails,
            "replied": replied_emails
        }
    }
