from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, case
from typing import Optional
from datetime import datetime, timedelta

from app.models.database import get_db, Company, History, User, UserCompanyState
from app.routers.auth import get_current_user, require_admin, require_active_plan
from app.services.access import access_state
from .schemas import CompanyCreate, CompanyUpdate, BulkDeleteRequest, MergeCountryRequest, MarketplaceInviteRequest
from .utils import (
    to_dict, calculate_score, company_to_dict, get_or_create_state,
    user_shuffle_key, STATE_FIELDS, _SHUFFLE_MODULUS,
)

router = APIRouter()


def apply_country_scope(query, access):
    """Restrict a Company query to the countries this plan may browse.

    Applied in SQL rather than after the fact so `total`, pagination and the
    map all agree — a filtered-out company must not even be counted, or the
    user can infer the size of what they're missing.
    """
    countries = access.get("countries")
    if countries:
        query = query.filter(Company.country.in_(countries))
    return query


@router.get("/")
def get_companies(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    country: Optional[str] = None,
    industry: Optional[str] = None,
    company_size: Optional[str] = None,
    discovery_source: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    heat_level: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "smart",
    sort_dir: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List the shared catalog with this user's own pipeline state layered on.

    `sort` options:
      smart  — hot/high-opportunity first, shuffled per user within a tier so
               two accounts don't work the exact same rows (the default)
      recent — most recently added first (alias: new)
      score  — strict opportunity score, identical for everyone
      name / country / date — plain column sorts, honouring `sort_dir`
    """
    access = access_state(db, current_user)

    # LEFT JOIN so companies this user has never touched still appear
    state_join = and_(
        UserCompanyState.company_id == Company.id,
        UserCompanyState.user_id == current_user.id,
    )
    query = db.query(Company, UserCompanyState).outerjoin(UserCompanyState, state_join)
    query = apply_country_scope(query, access)

    # Filters on per-user state fall back to the defaults for untouched rows
    if status:
        if status == "new":
            query = query.filter(or_(UserCompanyState.status == "new", UserCompanyState.status.is_(None)))
        else:
            query = query.filter(UserCompanyState.status == status)
    if heat_level:
        # Heat is derived rather than read straight off the column, so the
        # filter has to reproduce `services.scoring.heat_for` in SQL. If the two
        # ever drift, the filter returns rows whose badge says something else.
        from app.services.scoring import URGENT_SIGNALS, HOT_STATUSES, WARM_STATUSES

        # Every column here needs a coalesce. `signals` and `status` are NULL on
        # untouched rows, and NULL ILIKE / NULL IN (…) evaluate to NULL rather
        # than false — which poisons the surrounding AND/OR and silently drops
        # rows from every branch at once.
        sig_col = func.coalesce(Company.signals, "")
        status_col = func.coalesce(UserCompanyState.status, "new")
        score_col = func.coalesce(Company.opportunity_score, 0)

        has_urgent = or_(*[sig_col.ilike(f"%{s}%") for s in URGENT_SIGNALS])
        engaged = status_col.in_(HOT_STATUSES | WARM_STATUSES)

        # Matches company_to_dict: a stored "cold" can't be told apart from the
        # column default, so it gets recomputed rather than trusted.
        derivable = or_(
            UserCompanyState.heat_level.is_(None),
            UserCompanyState.heat_level == "cold",
        )
        stored = and_(UserCompanyState.heat_level == heat_level, ~derivable)

        # heat_for is a priority chain — hot wins over warm, warm over cold —
        # so the bands have to be made mutually exclusive here too. Testing
        # each independently put a hot company in the warm results as well.
        is_hot = or_(
            status_col.in_(HOT_STATUSES),
            and_(~engaged, has_urgent, score_col >= 70),
        )
        is_warm = or_(
            status_col.in_(WARM_STATUSES),
            and_(~engaged, or_(has_urgent, score_col >= 65)),
        )

        if heat_level == "hot":
            derived = and_(derivable, is_hot)
        elif heat_level == "warm":
            derived = and_(derivable, ~is_hot, is_warm)
        else:
            derived = and_(derivable, ~is_hot, ~is_warm)
        query = query.filter(or_(stored, derived))
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
    if company_size:
        query = query.filter(Company.company_size == company_size)
    if discovery_source:
        query = query.filter(Company.discovery_source == discovery_source)
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

    # Sorting has to happen in SQL. Doing it in the browser only reordered the
    # rows already on screen, so "sort by score" over 3,000 companies quietly
    # meant "sort these 20 by score".
    desc = sort_dir != "asc"

    def ordered(col):
        return query.order_by(col.desc() if desc else col.asc())

    if sort in ("new", "recent"):
        query = query.order_by(Company.created_at.desc(), Company.id.desc()) if desc \
            else query.order_by(Company.created_at.asc(), Company.id.asc())
    elif sort == "score":
        query = ordered(Company.opportunity_score)
    elif sort == "name":
        query = ordered(func.lower(Company.name))
    elif sort == "country":
        query = ordered(func.lower(Company.country))
    elif sort == "date":
        query = ordered(Company.updated_at)
    else:
        # Coarse tier keeps the strongest leads near the top, then a per-user
        # permutation varies the order inside each tier.
        tier = case((Company.opportunity_score >= 70, 3), (Company.opportunity_score >= 40, 2), else_=1)
        shuffle = (Company.id * user_shuffle_key(current_user.id)) % _SHUFFLE_MODULUS
        query = query.order_by(tier.desc(), shuffle)

    rows = query.offset(skip).limit(limit).all()
    return {
        "total": total,
        "access": access,
        "companies": [company_to_dict(c, s, access) for c, s in rows],
    }


@router.get("/{company_id}")
def get_company(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    access = access_state(db, current_user)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    # A company outside the plan's country scope must be indistinguishable from
    # one that doesn't exist, or the plan boundary is trivially probed by id.
    if access.get("countries") and company.country not in access["countries"]:
        raise HTTPException(status_code=404, detail="Company not found")
    state = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == current_user.id,
        UserCompanyState.company_id == company_id,
    ).first()
    return company_to_dict(company, state, access)


@router.post("/{company_id}/unlock")
def unlock_company(company_id: int, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    """Spend one company credit to reveal a company's contact details.

    Unlocking *is* creating the per-user state row, so the existing
    `max_companies` quota counts unlocks with no extra bookkeeping. Already
    unlocked companies are a no-op rather than an error, which keeps the button
    idempotent if the user double-clicks.
    """
    from app.services.limits import can_add_company, get_plan_limit

    access = access_state(db, current_user)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if access.get("countries") and company.country not in access["countries"]:
        raise HTTPException(status_code=404, detail="Company not found")

    existing = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == current_user.id,
        UserCompanyState.company_id == company_id,
    ).first()
    if not existing and not can_add_company(db, current_user):
        cap = get_plan_limit(db, current_user.plan)["max_companies"]
        raise HTTPException(
            status_code=403,
            detail=f"You've unlocked all {cap} companies your plan allows. Upgrade to unlock more.",
        )

    state = existing or get_or_create_state(db, current_user.id, company_id)
    if not existing:
        db.add(History(
            company_id=company_id,
            user_id=current_user.id,
            event_type="unlocked",
            description="Company unlocked",
        ))
    db.commit()
    db.refresh(company)
    return company_to_dict(company, state, access_state(db, current_user))


@router.post("/")
def create_company(data: CompanyCreate, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    from app.services.limits import can_add_company, get_plan_limit
    if not can_add_company(db, current_user):
        cap = get_plan_limit(db, current_user.plan)["max_companies"]
        raise HTTPException(status_code=403, detail=f"You've reached your plan's limit of {cap} companies. Upgrade to add more.")
    from app.services.country_normalize import normalize_country
    normalized_country = normalize_country(data.country)

    # Adding a company the plan can't browse would create a row the user is
    # immediately filtered out of — say so instead of losing their work.
    access = access_state(db, current_user)
    if access.get("countries") and (normalized_country or "") not in access["countries"]:
        raise HTTPException(
            status_code=403,
            detail=f"Your plan covers {', '.join(access['countries'])}. Upgrade to add companies from other countries.",
        )
    if data.domain:
        existing = db.query(Company).filter(Company.domain == data.domain).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Company with domain '{data.domain}' already exists (ID: {existing.id})"
            )
    payload = data.model_dump()
    payload["country"] = normalized_country
    company = Company(**payload)
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
def update_company(company_id: int, data: CompanyUpdate, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = data.model_dump(exclude_unset=True)

    # Pipeline fields belong to this user; the rest edit the shared catalog
    state = None
    state_updates = {k: v for k, v in update_data.items() if k in STATE_FIELDS}
    if state_updates:
        _guard_new_engagement(db, current_user, company_id)
        state = get_or_create_state(db, current_user.id, company_id)
        for key, value in state_updates.items():
            setattr(state, key, value)

    catalog_updates = {k: v for k, v in update_data.items() if k not in STATE_FIELDS}
    if catalog_updates:
        # The catalog is shared by every account, so a member editing it would
        # rewrite what everyone else sees — including the score their own quota
        # is spent against. Objective facts are the admin's to curate.
        if current_user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Company details are shared across all accounts and can only be edited by an admin. Use notes for your own record.",
            )
        if "country" in catalog_updates:
            from app.services.country_normalize import normalize_country
            catalog_updates["country"] = normalize_country(catalog_updates["country"])
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
    return company_to_dict(company, state, access_state(db, current_user))


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


def assert_in_scope(db, user, company):
    """404 for a company outside the plan's country scope, matching what the
    list endpoint shows — a different status code would leak its existence."""
    access = access_state(db, user)
    if access.get("countries") and company.country not in access["countries"]:
        raise HTTPException(status_code=404, detail="Company not found")
    return access


@router.patch("/{company_id}/status")
def update_status(company_id: int, status: str, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    assert_in_scope(db, current_user, company)
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
def toggle_favorite(company_id: int, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    assert_in_scope(db, current_user, company)
    _guard_new_engagement(db, current_user, company_id)
    state = get_or_create_state(db, current_user.id, company_id)
    state.is_favorite = not bool(state.is_favorite)
    db.commit()
    return {"id": company_id, "is_favorite": state.is_favorite}


@router.post("/{company_id}/invite-to-marketplace")
def invite_to_marketplace(
    company_id: int,
    data: MarketplaceInviteRequest,
    current_user: User = Depends(require_active_plan),
    db: Session = Depends(get_db),
):
    """The bridge between the CRM and the marketplace: a lead who replied
    gets an email invite to sign up as a marketplace client, instead of a
    reply dead-ending outside the product. See MarketplaceInvite's
    docstring for why this is its own table rather than a History row.

    A second, admin-only mode (`invite_type="freelancer"`) invites a
    catalog company onto the marketplace's supply side instead — kept
    admin-gated since it's a strategic call (the invited company may well
    be a competitor studio), not something any CRM user should trigger on
    their own leads."""
    import secrets
    from app.models.database import Contact, MarketplaceInvite
    from app.services.email_service import send_email

    invite_type = data.invite_type if data.invite_type in ("client", "freelancer") else "client"
    if invite_type == "freelancer" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only an admin can invite a company as a freelancer")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    assert_in_scope(db, current_user, company)

    contact_email = (data.contact_email or "").strip()
    contact_name = (data.contact_name or "").strip()
    if not contact_email:
        primary = db.query(Contact).filter(
            Contact.company_id == company_id, Contact.is_primary == True  # noqa: E712
        ).first()
        if primary and primary.email:
            contact_email = primary.email
            contact_name = contact_name or primary.full_name or ""
        elif company.email:
            contact_email = company.email
    if not contact_email:
        raise HTTPException(status_code=400, detail="No contact email on file — enter one to send the invite")

    # Don't spam the same lead with a second invite while one is still
    # outstanding — a week is long enough that a second nudge is fair.
    # Scoped per invite_type so a client-invite and a freelancer-invite to
    # the same company don't block each other.
    recent = (
        db.query(MarketplaceInvite)
        .filter(
            MarketplaceInvite.company_id == company_id,
            MarketplaceInvite.invite_type == invite_type,
            MarketplaceInvite.status == "sent",
            MarketplaceInvite.created_at >= datetime.utcnow() - timedelta(days=7),
        )
        .first()
    )
    if recent:
        raise HTTPException(status_code=400, detail="An invite was already sent to this company in the last 7 days")

    token = secrets.token_urlsafe(24)
    invite = MarketplaceInvite(
        company_id=company_id,
        invited_by_user_id=current_user.id,
        invite_type=invite_type,
        contact_name=contact_name,
        contact_email=contact_email,
        token=token,
    )
    db.add(invite)

    import os
    signup_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/") + f"/signup?invite={token}"
    greeting = f"Hi {contact_name}," if contact_name else "Hi,"
    note = f"<p>{data.message}</p>" if data.message else ""
    if invite_type == "freelancer":
        subject = f"{current_user.name} invited you to join Archon's freelancer network"
        pitch = "would like to invite your studio to take on marketplace projects — build a profile, browse open work, and send proposals."
        cta = "Set up your free freelancer account →"
    else:
        subject = f"{current_user.name} invited you to post a project on Archon"
        pitch = "would like to work with you through Archon's marketplace — post a project, review proposals, and hire directly."
        cta = "Set up your free client account →"
    try:
        send_email(
            to_email=contact_email,
            subject=subject,
            html_body=(
                f"<p>{greeting}</p>"
                f"<p>{current_user.name} {pitch}</p>"
                f"{note}"
                f'<p><a href="{signup_url}">{cta}</a></p>'
            ),
            text_body=f"{greeting}\n\n{current_user.name} invited you to Archon's marketplace. Set up your account: {signup_url}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not send the invite email: {e}")

    db.add(History(
        company_id=company_id,
        user_id=current_user.id,
        event_type="marketplace_invited",
        description=f"Invited {contact_email} to the marketplace as a {invite_type}",
    ))
    db.commit()
    return {"message": f"Invite sent to {contact_email}"}


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


@router.post("/bulk-delete")
def bulk_delete_companies(
    data: BulkDeleteRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete many companies at once, by explicit id list or by filter — the
    fast path for clearing out a bad hunt batch or a country/segment the admin
    no longer wants, without clicking delete hundreds of times.
    """
    query = db.query(Company.id)
    if data.ids:
        query = query.filter(Company.id.in_(data.ids))
    else:
        filters_given = any([data.country, data.industry, data.company_size, data.discovery_source, data.search])
        if not filters_given and not data.confirm_all:
            raise HTTPException(
                status_code=400,
                detail="Add at least one filter, or set confirm_all to delete the entire catalog.",
            )
        if data.country:
            query = query.filter(Company.country == data.country)
        if data.industry:
            query = query.filter(Company.industry == data.industry)
        if data.company_size:
            query = query.filter(Company.company_size == data.company_size)
        if data.discovery_source:
            query = query.filter(Company.discovery_source == data.discovery_source)
        if data.search:
            query = query.filter(
                or_(Company.name.ilike(f"%{data.search}%"), Company.city.ilike(f"%{data.search}%"))
            )

    ids = [row[0] for row in query.all()]
    if not ids:
        return {"message": "No companies matched", "deleted": 0}

    db.query(UserCompanyState).filter(UserCompanyState.company_id.in_(ids)).delete(synchronize_session=False)
    db.query(Company).filter(Company.id.in_(ids)).delete(synchronize_session=False)
    from app.services.audit import log_admin_action
    log_admin_action(db, admin, "companies.bulk_delete", target=f"{len(ids)} companies")
    db.commit()
    return {"message": f"Deleted {len(ids)} companies", "deleted": len(ids)}


@router.post("/countries/merge")
def merge_country(
    data: MergeCountryRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Fold every company under one country spelling into another — fixes a
    catalog that already has both e.g. "USA" and "United States" as separate
    entries. `country_normalize.py` stops new duplicates; this cleans up the
    ones that got in before that existed."""
    from_name, to_name = data.from_name.strip(), data.to_name.strip()
    if not from_name or not to_name or from_name == to_name:
        raise HTTPException(status_code=400, detail="from_name and to_name must be different, non-empty country names")
    moved = (
        db.query(Company)
        .filter(Company.country == from_name)
        .update({Company.country: to_name}, synchronize_session=False)
    )
    from app.services.audit import log_admin_action
    log_admin_action(db, admin, "countries.merge", target=f"{from_name} -> {to_name}", detail=f"moved={moved}")
    db.commit()
    return {"message": f"Moved {moved} companies from '{from_name}' to '{to_name}'", "moved": moved}


@router.get("/{company_id}/history")
def get_history(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(History).filter(
        History.company_id == company_id,
        History.user_id == current_user.id,
    ).order_by(History.created_at.desc()).all()
    return [to_dict(h) for h in items]
