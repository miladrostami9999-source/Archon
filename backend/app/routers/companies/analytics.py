from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import get_db, Company, Campaign

router = APIRouter()


@router.get("/analytics/summary")
def get_analytics(db: Session = Depends(get_db)):
    total = db.query(Company).count()
    statuses = ["new", "reviewed", "ready", "sent", "waiting", "replied", "meeting", "client", "archive"]
    status_counts = {}
    for s in statuses:
        status_counts[s] = db.query(Company).filter(Company.status == s).count()
    industries = db.query(
        Company.industry, func.count(Company.id)
    ).filter(Company.industry != None).group_by(Company.industry).all()
    countries = db.query(
        Company.country, func.count(Company.id)
    ).filter(Company.country != None).group_by(Company.country).order_by(func.count(Company.id).desc()).limit(10).all()
    total_emails = db.query(Campaign).count()
    sent_emails = db.query(Campaign).filter(Campaign.status == "sent").count()
    replied_emails = db.query(Campaign).filter(Campaign.status == "replied").count()
    favorites = db.query(Company).filter(Company.is_favorite == True).count()
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
