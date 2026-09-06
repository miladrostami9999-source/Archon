"""The Data API — programmatic, key-authenticated access to the company
catalog. Enterprise-only (see PlanLimit.max_api_requests: every other plan
is 0, meaning no access at all, not a small quota).

Authenticated with `X-API-Key`, deliberately not `Authorization: Bearer` —
that header is reserved for the human-login JWT (get_current_user), and
mixing the two credential types on one header invites a client sending the
wrong one silently succeeding or failing in a confusing way.

Every response goes through the exact same access_state()/company_to_dict()
pipeline the in-app company list uses, so the API can't be used to bypass
the per-company unlock economy or a plan's country restriction — it sees
exactly what that account would see clicking around the UI.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, User, UserCompanyState
from app.services.access import access_state
from app.services.api_keys import get_user_from_api_key, can_make_api_request, record_api_request, get_api_usage
from app.routers.companies.core import apply_country_scope
from app.routers.companies.utils import company_to_dict

router = APIRouter(prefix="/api/v1", tags=["data-api"])


def get_api_key_user(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> User:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    user = get_user_from_api_key(db, x_api_key)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    if user.plan != "enterprise":
        # The key still exists but its owner downgraded — matches how a
        # feature flag revocation should behave: the credential itself
        # isn't deleted, it just stops working until they're back on plan.
        raise HTTPException(status_code=403, detail="Data API access requires the Enterprise plan")
    if not can_make_api_request(db, user):
        raise HTTPException(status_code=429, detail="Monthly API request quota exceeded")
    record_api_request(db, user)
    return user


@router.get("/companies")
def api_list_companies(
    limit: int = 50,
    offset: int = 0,
    country: Optional[str] = None,
    industry: Optional[str] = None,
    q: Optional[str] = None,
    user: User = Depends(get_api_key_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 200))
    access = access_state(db, user)

    state_join = and_(UserCompanyState.company_id == Company.id, UserCompanyState.user_id == user.id)
    query = db.query(Company, UserCompanyState).outerjoin(UserCompanyState, state_join)
    query = apply_country_scope(query, access)
    if country:
        query = query.filter(Company.country == country)
    if industry:
        query = query.filter(Company.industry == industry)
    if q:
        like = f"%{q}%"
        query = query.filter(Company.name.ilike(like))

    total = query.count()
    rows = query.order_by(Company.opportunity_score.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": [company_to_dict(c, s, access) for c, s in rows],
    }


@router.get("/companies/{company_id}")
def api_get_company(
    company_id: int,
    user: User = Depends(get_api_key_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    access = access_state(db, user)
    if access.get("countries") and company.country not in access["countries"]:
        raise HTTPException(status_code=404, detail="Company not found")
    state = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == user.id, UserCompanyState.company_id == company_id
    ).first()
    return company_to_dict(company, state, access)


@router.get("/usage")
def api_usage(user: User = Depends(get_api_key_user), db: Session = Depends(get_db)):
    # Counts against the quota like any other call — simplest to reason
    # about, and checking usage occasionally is cheap relative to the quota.
    return get_api_usage(db, user)
