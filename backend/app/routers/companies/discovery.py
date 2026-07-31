"""Lead Hunter — admin-only sourcing of new companies for the shared catalog.

Everything here writes to the catalog every account reads, so it is admin-only
throughout. Nothing is saved automatically: a hunt returns candidates with a
citation each, and the admin picks which ones become real rows.
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import (
    get_db, Company, History, User, DiscoveryHunt, DiscoveryRun,
)
from app.routers.auth import require_admin
from app.services import discovery_sources
from .schemas import HuntRequest, HuntSaveRequest, SavedHuntCreate
from .utils import calculate_score

router = APIRouter()


def _normalise_domain(website: str | None) -> str | None:
    if not website:
        return None
    return (
        website.replace("https://", "").replace("http://", "")
        .split("/")[0].strip().lower().removeprefix("www.")
    ) or None


@router.get("/discovery/sources")
def list_sources(admin: User = Depends(require_admin)):
    """The source/segment/signal picker. Data-driven so adding a source to
    `discovery_sources.py` shows up in the UI without a frontend change."""
    return discovery_sources.catalog()


@router.post("/discovery/hunt")
def run_hunt(data: HuntRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Search the chosen sources and return candidates for review."""
    from app.services.claude import hunt_leads

    criteria = data.model_dump()
    run = DiscoveryRun(
        user_id=admin.id, hunt_id=data.hunt_id,
        criteria_json=json.dumps(criteria),
    )

    # Everything already known, so Claude is told what to skip and we can filter
    # again on the way back — the model's own de-duplication is a hint, not a
    # guarantee.
    existing = db.query(Company.name, Company.domain, Company.website).all()
    known_names = {(n or "").strip().lower() for n, _, _ in existing if n}
    known_domains = set()
    for _, d, w in existing:
        for candidate in (d, _normalise_domain(w)):
            if candidate:
                known_domains.add(candidate.strip().lower().removeprefix("www."))

    try:
        found = hunt_leads(sorted(known_names)[:200], criteria)
    except Exception as e:
        run.error = str(e)[:500]
        db.add(run)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Hunt failed: {e}")

    fresh, duplicates = [], 0
    for item in found:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        domain = _normalise_domain(item.get("website"))
        if name.lower() in known_names or (domain and domain in known_domains):
            duplicates += 1
            continue
        item["domain"] = domain
        fresh.append(item)
        known_names.add(name.lower())
        if domain:
            known_domains.add(domain)

    run.found = len(found)
    run.fresh = len(fresh)
    db.add(run)

    if data.hunt_id:
        hunt = db.query(DiscoveryHunt).filter(DiscoveryHunt.id == data.hunt_id).first()
        if hunt:
            hunt.last_run_at = datetime.utcnow()
            hunt.runs = (hunt.runs or 0) + 1
            hunt.found_total = (hunt.found_total or 0) + len(fresh)
    db.commit()
    db.refresh(run)

    return {
        "run_id": run.id,
        "suggestions": fresh,
        "found": len(found),
        "new": len(fresh),
        "duplicates": duplicates,
    }


@router.post("/discovery/save")
def save_hunted(data: HuntSaveRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Add reviewed candidates to the shared catalog."""
    added, skipped = 0, 0
    for item in data.companies:
        name = (item.name or "").strip()
        if not name:
            continue
        if db.query(Company).filter(Company.name.ilike(name)).first():
            skipped += 1
            continue
        domain = _normalise_domain(item.website)
        if domain and db.query(Company).filter(Company.domain == domain).first():
            skipped += 1
            continue

        company = Company(
            name=name, website=item.website or None, email=item.email or None,
            country=item.country or None, city=item.city or None,
            industry=item.industry or None, company_size=item.company_size or None,
            linkedin=item.linkedin or None, instagram=item.instagram or None,
            domain=domain,
            # Keep the citation on the row. Six months from now "where did this
            # come from and is it still true" is the question that matters.
            discovery_source=(item.source or "ai_hunt")[:200],
            ai_summary=item.evidence or None,
        )
        company.opportunity_score = calculate_score(company)
        db.add(company)
        db.flush()
        db.add(History(
            company_id=company.id, user_id=admin.id,
            event_type="discovered",
            description=f"Found by Lead Hunter — {item.source or 'AI search'}"
                        + (f" ({item.source_url})" if item.source_url else ""),
        ))
        added += 1

    if data.run_id:
        run = db.query(DiscoveryRun).filter(DiscoveryRun.id == data.run_id).first()
        if run:
            run.added = (run.added or 0) + added
            if run.hunt_id:
                hunt = db.query(DiscoveryHunt).filter(DiscoveryHunt.id == run.hunt_id).first()
                if hunt:
                    hunt.added_total = (hunt.added_total or 0) + added
    db.commit()
    return {"added": added, "skipped": skipped, "message": f"Added {added} companies, skipped {skipped} duplicates"}


# ── Saved hunts ────────────────────────────────────────────────────────────
@router.get("/discovery/hunts")
def list_hunts(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    hunts = db.query(DiscoveryHunt).order_by(DiscoveryHunt.created_at.desc()).all()
    return [{
        "id": h.id, "name": h.name, "criteria": json.loads(h.criteria_json or "{}"),
        "runs": h.runs or 0, "found_total": h.found_total or 0, "added_total": h.added_total or 0,
        "last_run_at": h.last_run_at.isoformat() if h.last_run_at else None,
    } for h in hunts]


@router.post("/discovery/hunts")
def create_hunt(data: SavedHuntCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the hunt a name.")
    hunt = DiscoveryHunt(
        user_id=admin.id, name=name,
        criteria_json=json.dumps(data.criteria or {}),
    )
    db.add(hunt); db.commit(); db.refresh(hunt)
    return {"id": hunt.id, "name": hunt.name}


@router.delete("/discovery/hunts/{hunt_id}")
def delete_hunt(hunt_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    hunt = db.query(DiscoveryHunt).filter(DiscoveryHunt.id == hunt_id).first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")
    # Runs outlive the hunt so the history stays honest; just detach them.
    db.query(DiscoveryRun).filter(DiscoveryRun.hunt_id == hunt_id).update({"hunt_id": None})
    db.delete(hunt); db.commit()
    return {"message": "Hunt deleted"}


@router.get("/discovery/runs")
def list_runs(limit: int = 20, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    runs = db.query(DiscoveryRun).order_by(DiscoveryRun.created_at.desc()).limit(min(limit, 100)).all()
    return [{
        "id": r.id,
        "criteria": json.loads(r.criteria_json or "{}"),
        "found": r.found or 0, "fresh": r.fresh or 0, "added": r.added or 0,
        "error": r.error,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in runs]
