from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db, Company

router = APIRouter()


@router.get("/map/data")
def get_map_data(db: Session = Depends(get_db)):
    companies = db.query(Company).filter(Company.country != None).all()

    country_data = {}
    for c in companies:
        country = c.country.strip()
        if not country:
            continue
        if country not in country_data:
            country_data[country] = {
                "name": country,
                "count": 0,
                "total_score": 0,
                "companies": [],
                "statuses": {},
                "hot": 0,
            }
        d = country_data[country]
        d["count"] += 1
        d["total_score"] += c.opportunity_score or 0
        d["companies"].append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "score": c.opportunity_score,
            "heat_level": c.heat_level,
            "industry": c.industry,
        })
        d["statuses"][c.status] = d["statuses"].get(c.status, 0) + 1
        if c.heat_level == "hot":
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
