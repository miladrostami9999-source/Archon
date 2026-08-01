from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Company, UserCompanyState, User
from app.routers.auth import require_admin, require_feature
from .schemas import SearchRequest
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
    """Re-score the whole catalog with the current weights.

    Reads each company's stored signals rather than scoring from bare fields —
    without that, re-scoring quietly stripped the signal points off every
    hunted company and pushed the best leads down the list.
    """
    from app.services.scoring import parse_signals, band_for_headcount

    companies = db.query(Company).all()
    graded = {"A": 0, "B": 0, "C": 0, "D": 0}
    for company in companies:
        # Keep the band honest. A row can end up labelled "large" with a
        # headcount of 14 if the two were set at different times, and the card
        # would then read "Large · 14".
        band = band_for_headcount(company.employee_count)
        if band:
            company.company_size = band
        company.opportunity_score = calculate_score(
            company, signals=parse_signals(company.signals),
        )
        for cut, letter in ((80, "A"), (65, "B"), (48, "C"), (0, "D")):
            if company.opportunity_score >= cut:
                graded[letter] += 1
                break
    db.commit()
    return {
        "message": f"Re-scored {len(companies)} companies",
        "grades": graded,
    }


@router.post("/recalculate-heat")
def recalculate_heat(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Recompute heat for the caller's own pipeline.

    Heat is per-user state, so this only touches rows this account already has
    — it never creates one, because creating a state row is what spends a
    company credit. Companies with no row get their heat derived on read
    instead (see `company_to_dict`), so the catalog is consistent either way.
    """
    from app.services.scoring import heat_for, parse_signals

    rows = (
        db.query(UserCompanyState, Company)
        .join(Company, Company.id == UserCompanyState.company_id)
        .filter(UserCompanyState.user_id == admin.id)
        .all()
    )
    counts = {"hot": 0, "warm": 0, "cold": 0}
    changed = 0
    for state, company in rows:
        new_heat = heat_for(
            state.status, company.opportunity_score,
            parse_signals(company.signals), state.updated_at,
        )
        if (state.heat_level or "cold") != new_heat:
            state.heat_level = new_heat
            changed += 1
        counts[new_heat] = counts.get(new_heat, 0) + 1
    db.commit()
    return {
        "message": f"Recalculated heat for {len(rows)} companies — {changed} changed",
        "counts": counts,
        "changed": changed,
    }


@router.post("/search/smart")
def smart_search(data: SearchRequest, current_user: User = Depends(require_feature("ai_search")), db: Session = Depends(get_db)):
    from app.services.claude import smart_search as claude_smart_search
    from app.services.access import access_state

    # AI search reads the whole catalog, so it has to respect the same country
    # scope and masking as the list — otherwise it's a way to ask Claude for the
    # rows the plan can't see.
    access = access_state(db, current_user)
    query = db.query(Company)
    if access.get("countries"):
        query = query.filter(Company.country.in_(access["countries"]))
    companies = query.all()
    state_by_company = {
        s.company_id: s for s in db.query(UserCompanyState).filter(UserCompanyState.user_id == current_user.id).all()
    }
    company_list = [company_to_dict(c, state_by_company.get(c.id), access) for c in companies]
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


# Lead sourcing lives in `discovery.py` now — the old single-shot /discover
# endpoints were superseded by the staged scout → enrich → save flow.
