from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Company, UserCompanyState, User, History
from app.routers.auth import get_current_user, require_admin
from .schemas import SearchRequest, DiscoverRequest, DiscoverSaveRequest
from .utils import to_dict, calculate_score, company_to_dict

router = APIRouter()


@router.post("/{company_id}/generate-summary")
def gen_summary(company_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """
    AI Research — searches the web for the real company, verifies it,
    and fills in any missing fields (email, website, linkedin, instagram,
    industry, company_size) from what it actually finds. The opportunity
    score is computed from these real, verified fields — not guessed.
    Existing values the user already entered are never overwritten.
    """
    from app.services.claude import research_company

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company_dict = to_dict(company)
    try:
        result = research_company(company_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI research failed: {str(e)}")

    # Only fill fields that are currently empty — never overwrite user-entered data
    if not company.email and result.get("email"):
        company.email = result["email"]
    if not company.website and result.get("website"):
        company.website = result["website"]
    if not company.linkedin and result.get("linkedin"):
        company.linkedin = result["linkedin"]
    if not company.instagram and result.get("instagram"):
        company.instagram = result["instagram"]
    if not company.industry and result.get("industry"):
        company.industry = result["industry"]
    if not company.company_size and result.get("company_size"):
        company.company_size = result["company_size"]

    company.ai_summary = result.get("summary", "")

    # Score comes from AI's grounded assessment when it found real data,
    # falling back to the rule-based calculator if the search came up empty.
    if result.get("verified") and isinstance(result.get("score"), (int, float)):
        company.opportunity_score = max(0.0, min(100.0, float(result["score"])))
    else:
        company.opportunity_score = calculate_score(company)

    company.last_checked = datetime.utcnow()
    db.commit()
    db.refresh(company)

    state = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == admin.id, UserCompanyState.company_id == company_id
    ).first()
    return {
        "summary": company.ai_summary,
        "verified": result.get("verified", False),
        "score_reasoning": result.get("score_reasoning", ""),
        "company": company_to_dict(company, state),
    }


@router.post("/recalculate-scores")
def recalculate_scores(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    companies = db.query(Company).all()
    for company in companies:
        company.opportunity_score = calculate_score(company)
    db.commit()
    return {"message": f"Recalculated scores for {len(companies)} companies"}


@router.post("/search/smart")
def smart_search(data: SearchRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.claude import smart_search as claude_smart_search
    companies = db.query(Company).all()
    state_by_company = {
        s.company_id: s for s in db.query(UserCompanyState).filter(UserCompanyState.user_id == current_user.id).all()
    }
    company_list = [company_to_dict(c, state_by_company.get(c.id)) for c in companies]
    try:
        result_ids = claude_smart_search(data.query, company_list)
        filtered = [c for c in company_list if c['id'] in result_ids]
        return {"companies": filtered, "total": len(filtered), "query": data.query}
    except Exception as e:
        search = data.query.lower()
        filtered = [c for c in company_list if
            search in (c.get('name') or '').lower() or
            search in (c.get('country') or '').lower() or
            search in (c.get('industry') or '').lower() or
            search in (c.get('city') or '').lower()
        ]
        return {"companies": filtered, "total": len(filtered), "query": data.query}


@router.post("/discover")
def discover_leads(data: DiscoverRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Ask Claude to find new companies worth adding to the shared catalog.

    Admin-only because it writes to the catalog everyone sees. Suggestions are
    returned for review rather than saved directly, and anything already known
    (by name or domain) is filtered out first.
    """
    from app.services.claude import discover_leads as ai_discover

    existing = db.query(Company.name, Company.domain, Company.website).all()
    existing_names = [e[0] for e in existing if e[0]]
    known_names = {n.strip().lower() for n in existing_names}
    known_domains = {(d or "").strip().lower() for _, d, _ in existing if d}
    for _, _, w in existing:
        if w:
            known_domains.add(w.replace("https://", "").replace("http://", "").strip("/").lower())

    try:
        found = ai_discover(existing_names, {
            "country": data.country, "industry": data.industry, "count": data.count,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lead discovery failed: {str(e)}")

    fresh = []
    for item in found:
        name = (item.get("name") or "").strip()
        if not name or name.lower() in known_names:
            continue
        site = (item.get("website") or "").replace("https://", "").replace("http://", "").strip("/").lower()
        if site and site in known_domains:
            continue
        fresh.append(item)
        known_names.add(name.lower())

    return {"suggestions": fresh, "found": len(found), "new": len(fresh)}


@router.post("/discover/save")
def save_discovered(data: DiscoverSaveRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Add reviewed suggestions to the catalog."""
    added, skipped = 0, 0
    for item in data.companies:
        name = (item.name or "").strip()
        if not name:
            continue
        if db.query(Company).filter(Company.name.ilike(name)).first():
            skipped += 1
            continue
        domain = (item.website or "").replace("https://", "").replace("http://", "").strip("/") or None
        if domain and db.query(Company).filter(Company.domain == domain).first():
            skipped += 1
            continue
        company = Company(
            name=name, website=item.website or None, email=item.email or None,
            country=item.country or None, city=item.city or None,
            industry=item.industry or None, company_size=item.company_size or None,
            linkedin=item.linkedin or None, instagram=item.instagram or None,
            domain=domain, discovery_source="ai_discovery",
        )
        company.opportunity_score = calculate_score(company)
        db.add(company)
        db.flush()
        db.add(History(
            company_id=company.id, user_id=admin.id,
            event_type="discovered", description="Found by AI lead discovery",
        ))
        added += 1
    db.commit()
    return {"added": added, "skipped": skipped, "message": f"Added {added} companies, skipped {skipped} duplicates"}
