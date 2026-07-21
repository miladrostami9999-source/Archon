from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, UserCompanyState, User
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/map/data")
def get_map_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Shared catalog, with this user's own status/heat layered on
    state_by_company = {
        s.company_id: s for s in db.query(UserCompanyState).filter(UserCompanyState.user_id == current_user.id).all()
    }
    companies = db.query(Company).filter(Company.country != None).all()

    country_data = {}
    for c in companies:
        country = (c.country or "").strip()
        if not country:
            continue
        st = state_by_company.get(c.id)
        status = (st.status if st else None) or "new"
        heat = (st.heat_level if st else None) or "cold"

        if country not in country_data:
            country_data[country] = {
                "name": country, "count": 0, "total_score": 0,
                "companies": [], "statuses": {}, "hot": 0,
            }
        d = country_data[country]
        d["count"] += 1
        d["total_score"] += c.opportunity_score or 0
        d["companies"].append({
            "id": c.id,
            "name": c.name,
            "status": status,
            "score": c.opportunity_score,
            "heat_level": heat,
            "industry": c.industry,
        })
        d["statuses"][status] = d["statuses"].get(status, 0) + 1
        if heat == "hot":
            d["hot"] += 1

    result = []
    for country, d in country_data.items():
        result.append({
            "name": d["name"],
            "count": d["count"],
            "avg_score": round(d["total_score"] / d["count"]) if d["count"] > 0 else 0,
            "hot": d["hot"],
            "statuses": d["statuses"],
            "companies": sorted(d["companies"], key=lambda x: x["score"], reverse=True),
        })

    return sorted(result, key=lambda x: x["count"], reverse=True)
