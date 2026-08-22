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
from app.services.country_normalize import normalize_country
from .schemas import HuntRequest, HuntSaveRequest, SavedHuntCreate, EnrichRequest
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
    from app.services import websearch

    data = discovery_sources.catalog()
    # Which search backends this deployment can use, and which one a hunt gets
    # by default — so the cost of pressing Scout is never a surprise.
    default = websearch.provider()
    data["search"] = {
        "default": default or "anthropic",
        "cheap": bool(default),
        "options": [
            {"key": k, **websearch.PROVIDER_INFO[k]} for k in websearch.available()
        ],
        "note": (
            None if default else
            "No search key set, so hunts fall back to Claude's built-in web search — "
            "around $0.50 per 5 companies. Add SERPER_API_KEY on the server to cut "
            "that by ~30x (serper.dev gives 2,500 free queries, no card needed)."
        ),
    }
    return data


def _known_index(db):
    """Names and domains already in the catalog, for de-duplication.

    Claude is told what to skip, but that's a hint — a returned lead is always
    checked again here before it reaches the admin.
    """
    existing = db.query(Company.name, Company.domain, Company.website).all()
    names = {(n or "").strip().lower() for n, _, _ in existing if n}
    domains = set()
    for _, d, w in existing:
        for candidate in (d, _normalise_domain(w)):
            if candidate:
                domains.add(candidate.strip().lower().removeprefix("www."))
    return names, domains


# ── Stage 1: scout ─────────────────────────────────────────────────────────
@router.post("/discovery/scout")
def scout(data: HuntRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Find who exists. Cheap and wide — no research, no emails, no scoring.

    Most of what comes back gets rejected, so researching everything up front
    is the expensive way round. The admin picks survivors, then stage 2 spends
    real tokens on those only.
    """
    from app.services.claude import scout_leads

    criteria = data.model_dump()
    run = DiscoveryRun(
        user_id=admin.id, hunt_id=data.hunt_id, stage="scout",
        criteria_json=json.dumps(criteria),
    )
    known_names, known_domains = _known_index(db)

    try:
        found, usage = scout_leads(sorted(known_names)[:200], criteria)
    except Exception as e:
        run.error = str(e)[:500]
        db.add(run); db.commit()
        raise HTTPException(status_code=500, detail=f"Scout failed: {e}")

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

    run.found, run.fresh = len(found), len(fresh)
    run.input_tokens, run.output_tokens = usage["input_tokens"], usage["output_tokens"]
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
        "run_id": run.id, "candidates": fresh,
        "found": len(found), "new": len(fresh), "duplicates": duplicates,
        "usage": usage,
    }


# ── Stage 2: enrich + score ────────────────────────────────────────────────
ENRICH_BATCH = 6   # companies per Claude call — one wide call beats N narrow ones
MAX_ENRICH = 30    # a hard ceiling so one click can't run away with the budget


@router.post("/discovery/enrich")
def enrich(data: EnrichRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Research the approved candidates and score them.

    Claude returns facts; `services/scoring.py` turns those into the number.
    Keeping the arithmetic out of the model means the same company always
    scores the same, and re-tuning a weight re-scores everything consistently.
    """
    from app.services.claude import enrich_leads
    from app.services.scoring import score_lead

    picks = data.companies[:MAX_ENRICH]
    if not picks:
        raise HTTPException(status_code=400, detail="Select at least one company to research.")

    criteria = data.criteria or {}
    run = DiscoveryRun(
        user_id=admin.id, hunt_id=data.hunt_id, stage="enrich",
        criteria_json=json.dumps({"criteria": criteria, "count": len(picks)}),
    )

    enriched: list[dict] = []
    tokens = {"input_tokens": 0, "output_tokens": 0}
    raw = [p.model_dump() for p in picks]

    for start in range(0, len(raw), ENRICH_BATCH):
        batch = raw[start:start + ENRICH_BATCH]
        try:
            results, usage = enrich_leads(batch, criteria)
        except Exception as e:
            # One bad batch shouldn't throw away the batches that worked.
            run.error = str(e)[:500]
            continue
        tokens["input_tokens"] += usage["input_tokens"]
        tokens["output_tokens"] += usage["output_tokens"]

        by_name = {(r.get("name") or "").strip().lower(): r for r in results}
        for scouted in batch:
            found = by_name.get((scouted.get("name") or "").strip().lower())
            merged = {**scouted, **{k: v for k, v in (found or {}).items() if v not in (None, "", [])}}
            scored = score_lead(
                segment=merged.get("segment"),
                industry=merged.get("industry"),
                company_size=merged.get("company_size"),
                country=merged.get("country"),
                email=merged.get("email"),
                website=merged.get("website"),
                linkedin=merged.get("linkedin"),
                instagram=merged.get("instagram"),
                signals=merged.get("signals") or [],
                style_fit=merged.get("style_fit") or 0,
            )
            merged.update(scored)
            merged["domain"] = _normalise_domain(merged.get("website"))
            merged["enriched"] = found is not None
            # The optional rules from the setup form apply here, where the facts
            # they talk about finally exist. Flagged rather than dropped — the
            # admin decides, and a silently shortened list is confusing.
            fails = []
            if criteria.get("require_email") and not merged.get("email"):
                fails.append("no published email")
            if criteria.get("require_website") and not merged.get("website"):
                fails.append("no website")
            min_score = int(criteria.get("min_score") or 0)
            if min_score and (merged.get("score") or 0) < min_score:
                fails.append(f"below your minimum score of {min_score}")
            merged["fails_rules"] = fails
            enriched.append(merged)

    enriched.sort(key=lambda c: c.get("score") or 0, reverse=True)

    run.found = len(picks)
    run.fresh = sum(1 for c in enriched if c.get("enriched"))
    run.input_tokens, run.output_tokens = tokens["input_tokens"], tokens["output_tokens"]
    db.add(run); db.commit(); db.refresh(run)

    return {"run_id": run.id, "companies": enriched, "usage": tokens}


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
            phone=item.phone or None,
            country=normalize_country(item.country) or None, city=item.city or None,
            industry=item.industry or None, company_size=item.company_size or None,
            linkedin=item.linkedin or None, instagram=item.instagram or None,
            employee_count=item.employee_count or None,
            # Persisted so a later re-score keeps the signal points instead of
            # silently dropping this company down the list.
            signals=", ".join(item.signals) if item.signals else None,
            domain=domain,
            # Keep the citation on the row. Six months from now "where did this
            # come from and is it still true" is the question that matters.
            discovery_source=(item.source or "ai_hunt")[:200],
            ai_summary=item.evidence or None,
        )
        # Re-score server-side rather than trusting the number the client sent
        # back — the browser had the payload in hand and could have edited it.
        company.opportunity_score = calculate_score(
            company, signals=item.signals or [], style_fit=item.style_fit or 0,
        )
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
        "stage": r.stage or "scout",
        "criteria": json.loads(r.criteria_json or "{}"),
        "found": r.found or 0, "fresh": r.fresh or 0, "added": r.added or 0,
        "input_tokens": r.input_tokens or 0, "output_tokens": r.output_tokens or 0,
        "error": r.error,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in runs]
