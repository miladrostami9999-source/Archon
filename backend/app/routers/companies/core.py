from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, case
from typing import Optional
from datetime import datetime

from app.models.database import get_db, Company, History, User, UserCompanyState
from app.routers.auth import get_current_user, require_admin
from .schemas import CompanyCreate, CompanyUpdate
from .utils import (
    to_dict, calculate_score, company_to_dict, get_or_create_state,
    user_shuffle_key, STATE_FIELDS, _SHUFFLE_MODULUS,
)

router = APIRouter()


@router.get("/")
def get_companies(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    country: Optional[str] = None,
    industry: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    heat_level: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "smart",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List the shared catalog with this user's own pipeline state layered on.

    `sort` options:
      smart — hot/high-opportunity first, shuffled per user within a tier so
              two accounts don't work the exact same rows (the default)
      new   — most recently added first
      score — strict opportunity score, identical for everyone
    """
    # LEFT JOIN so companies this user has never touched still appear
    state_join = and_(
        UserCompanyState.company_id == Company.id,
        UserCompanyState.user_id == current_user.id,
    )
    query = db.query(Company, UserCompanyState).outerjoin(UserCompanyState, state_join)

    # Filters on per-user state fall back to the defaults for untouched rows
    if status:
        if status == "new":
            query = query.filter(or_(UserCompanyState.status == "new", UserCompanyState.status.is_(None)))
        else:
            query = query.filter(UserCompanyState.status == status)
    if heat_level:
        if heat_level == "cold":
            query = query.filter(or_(UserCompanyState.heat_level == "cold", UserCompanyState.heat_level.is_(None)))
        else:
            query = query.filter(UserCompanyState.heat_level == heat_level)
    if is_favorite is not None:
        if is_favorite:
            query = query.filter(UserCompanyState.is_favorite.is_(True))
        else:
            query = query.filter(or_(UserCompanyState.is_favorite.is_(False), UserCompanyState.is_favorite.is_(None)))

    # Filters on the shared catalog
    if country:
        query = query.filter(Company.country == country)
    if industry:
        query = query.filter(Company.industry == industry)
    if search:
        query = query.filter(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.country.ilike(f"%{search}%"),
                Company.city.ilike(f"%{search}%"),
                Company.industry.ilike(f"%{search}%"),
            )
        )

    total = query.count()

    if sort == "new":
        query = query.order_by(Company.created_at.desc(), Company.id.desc())
    elif sort == "score":
        query = query.order_by(Company.opportunity_score.desc())
    else:
        # Coarse tier keeps the strongest leads near the top, then a per-user
        # permutation varies the order inside each tier.
        tier = case((Company.opportunity_score >= 70, 3), (Company.opportunity_score >= 40, 2), else_=1)
        shuffle = (Company.id * user_shuffle_key(current_user.id)) % _SHUFFLE_MODULUS
        query = query.order_by(tier.desc(), shuffle)

    rows = query.offset(skip).limit(limit).all()
    return {"total": total, "companies": [company_to_dict(c, s) for c, s in rows]}


@router.get("/{company_id}")
def get_company(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    state = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == current_user.id,
        UserCompanyState.company_id == company_id,
    ).first()
    return company_to_dict(company, state)


@router.post("/")
def create_company(data: CompanyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.limits import can_add_company, get_plan_limit
    if not can_add_company(db, current_user):
        cap = get_plan_limit(db, current_user.plan)["max_companies"]
        raise HTTPException(status_code=403, detail=f"You've reached your plan's limit of {cap} companies. Upgrade to add more.")
    if data.domain:
        existing = db.query(Company).filter(Company.domain == data.domain).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Company with domain '{data.domain}' already exists (ID: {existing.id})"
            )
    company = Company(**data.model_dump())
    company.opportunity_score = calculate_score(company)
    db.add(company)
    db.commit()
    db.refresh(company)

    state = get_or_create_state(db, current_user.id, company.id)
    db.add(History(
        company_id=company.id,
        user_id=current_user.id,
        event_type="discovered",
        description="Company added manually",
    ))
    db.commit()
    return company_to_dict(company, state)


@router.patch("/{company_id}")
def update_company(company_id: int, data: CompanyUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = data.model_dump(exclude_unset=True)

    # Pipeline fields belong to this user; the rest edit the shared catalog
    state = None
    state_updates = {k: v for k, v in update_data.items() if k in STATE_FIELDS}
    if state_updates:
        state = get_or_create_state(db, current_user.id, company_id)
        for key, value in state_updates.items():
            setattr(state, key, value)

    catalog_updates = {k: v for k, v in update_data.items() if k not in STATE_FIELDS}
    if catalog_updates:
        for key, value in catalog_updates.items():
            setattr(company, key, value)
        company.opportunity_score = calculate_score(company)
        company.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(company)
    if state is None:
        state = db.query(UserCompanyState).filter(
            UserCompanyState.user_id == current_user.id,
            UserCompanyState.company_id == company_id,
        ).first()
    return company_to_dict(company, state)


def _guard_new_engagement(db, user, company_id):
    """Adding a shared company to your pipeline (first status/favorite on it)
    counts against the company quota, so a trial user can only work N of them."""
    from app.services.limits import can_add_company, get_plan_limit
    exists = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == user.id, UserCompanyState.company_id == company_id
    ).first()
    if not exists and not can_add_company(db, user):
        cap = get_plan_limit(db, user.plan)["max_companies"]
        raise HTTPException(status_code=403, detail=f"You've reached your plan's limit of {cap} companies. Upgrade to work with more.")


@router.patch("/{company_id}/status")
def update_status(company_id: int, status: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    _guard_new_engagement(db, current_user, company_id)
    state = get_or_create_state(db, current_user.id, company_id)
    old_status = state.status or "new"
    state.status = status
    db.add(History(
        company_id=company_id,
        user_id=current_user.id,
        event_type="status_changed",
        description=f"Status: {old_status} -> {status}",
    ))
    db.commit()
    return {"id": company_id, "status": status}


@router.patch("/{company_id}/favorite")
def toggle_favorite(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    _guard_new_engagement(db, current_user, company_id)
    state = get_or_create_state(db, current_user.id, company_id)
    state.is_favorite = not bool(state.is_favorite)
    db.commit()
    return {"id": company_id, "is_favorite": state.is_favorite}


@router.delete("/{company_id}")
def delete_company(company_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin only — the catalog is shared, so deleting removes it for everyone."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.query(UserCompanyState).filter(UserCompanyState.company_id == company_id).delete()
    db.delete(company)
    db.commit()
    return {"message": f"Company {company_id} deleted"}


@router.get("/{company_id}/history")
def get_history(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(History).filter(
        History.company_id == company_id,
        History.user_id == current_user.id,
    ).order_by(History.created_at.desc()).all()
    return [to_dict(h) for h in items]
