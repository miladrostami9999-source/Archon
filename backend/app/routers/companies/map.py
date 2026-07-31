from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, UserCompanyState, User
from app.routers.auth import require_feature
from app.services.access import access_state, mask_name

router = APIRouter()


@router.get("/map/data")
def get_map_data(current_user: User = Depends(require_feature("market_map")), db: Session = Depends(get_db)):
    # Shared catalog, with this user's own status/heat layered on
    access = access_state(db, current_user)
    state_by_company = {
        s.company_id: s for s in db.query(UserCompanyState).filter(UserCompanyState.user_id == current_user.id).all()
    }
    query = db.query(Company).filter(Company.country != None)
    # The map is a second window onto the same catalog, so it has to honour the
    # plan's country scope — otherwise the trial lock is bypassed by opening /map.
    if access.get("countries"):
        query = query.filter(Company.country.in_(access["countries"]))
    companies = query.all()

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
        # Counts and averages are aggregate and safe to show; a company name is
        # identifying, so a locked account gets the same mask as in the list.
        d["companies"].append({
            "id": c.id,
            "name": mask_name(c.name) if access.get("locked") else c.name,
            "status": status,
            "score": c.opportunity_score,
            "heat_level": heat,
            "industry": c.industry,
            "locked": bool(access.get("locked")) or st is None,
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
            "companies": sorted(d["companies"], key=lambda x: x["score"] or 0, reverse=True),
        })

    return sorted(result, key=lambda x: x["count"], reverse=True)
