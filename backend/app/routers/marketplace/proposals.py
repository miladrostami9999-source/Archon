import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.database import get_db, Project, Proposal, Contract, Conversation, Milestone, User
from app.routers.auth import require_marketplace_beta
from app.services.marketplace_access import get_user_rating, is_verified
from app.services import notifications as notif
from .schemas import ProposalCreate, ProposalUpdate, ProposalAccept

MAX_ATTACHMENTS = 10

router = APIRouter(tags=["marketplace-proposals"])


def _proposal_to_dict(pr: Proposal, db: Session) -> dict:
    """A proposal plus enough of the bidder to judge it.

    Hiring decisions are made from this list, so it carries the freelancer's
    face, reputation and a way through to their portfolio — otherwise the
    client is picking between anonymous numbers.
    """
    freelancer = db.query(User).filter(User.id == pr.freelancer_id).first()
    rating = get_user_rating(db, pr.freelancer_id)

    avatar, headline = "", ""
    if freelancer and freelancer.profile_json:
        try:
            data = json.loads(freelancer.profile_json)
            avatar = data.get("avatar", "") or ""
            headline = (data.get("company") or data.get("location") or "").strip()
        except Exception:
            pass  # a malformed profile must never break the proposal list

    completed = (
        db.query(Contract)
        .filter(Contract.freelancer_id == pr.freelancer_id, Contract.status == "completed")
        .count()
    )
    try:
        highlighted_portfolio = json.loads(pr.highlighted_portfolio) if pr.highlighted_portfolio else []
    except Exception:
        highlighted_portfolio = []
    try:
        attachment_urls = json.loads(pr.attachment_urls) if pr.attachment_urls else []
    except Exception:
        attachment_urls = []
    if not attachment_urls and pr.attachment_url:
        attachment_urls = [pr.attachment_url]  # legacy single-attachment rows
    return {
        "id": pr.id,
        "project_id": pr.project_id,
        "freelancer_id": pr.freelancer_id,
        "freelancer_name": freelancer.name if freelancer else None,
        "freelancer_verified": is_verified(db, pr.freelancer_id),
        "freelancer_avatar": avatar,
        "freelancer_headline": headline,
        # Only linkable when the freelancer opted their profile public.
        "freelancer_username": (freelancer.username if freelancer and freelancer.is_public else None),
        "freelancer_rating": rating["avg_rating"],
        "freelancer_review_count": rating["review_count"],
        "freelancer_completed_contracts": completed,
        "cover_letter": pr.cover_letter,
        "attachment_urls": attachment_urls,
        "highlighted_portfolio": highlighted_portfolio,
        "proposed_amount": pr.proposed_amount,
        "proposed_days": pr.proposed_days,
        "status": pr.status,
        "seen_at": pr.seen_at.isoformat() if pr.seen_at else None,
        "created_at": pr.created_at.isoformat() if pr.created_at else None,
    }


def _project_row_to_dict(pr: Proposal, project: Project, db: Session) -> dict:
    """A proposal dict with the project it's for stapled on — what the
    client's cross-project Proposals inbox needs that a single-project list
    doesn't."""
    d = _proposal_to_dict(pr, db)
    d["project_title"] = project.title
    d["project_currency"] = project.currency
    d["project_status"] = project.status
    return d


@router.get("/proposals/pending-count")
def pending_proposal_count(
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Unseen pending proposals, for the sidebar badge — opening one in the
    inbox drawer clears it from this count, the same way an unread message
    disappears once you've read it. `pending` status alone would never
    shrink until a decision is made, which reads as a stuck badge."""
    count = (
        db.query(Proposal)
        .join(Project, Project.id == Proposal.project_id)
        .filter(Project.client_id == current_user.id, Proposal.status == "pending", Proposal.seen_at.is_(None))
        .count()
    )
    return {"count": count}


@router.post("/proposals/{proposal_id}/seen")
def mark_proposal_seen(
    proposal_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    project = db.query(Project).filter(Project.id == proposal.project_id).first()
    if not project or project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can view this proposal")
    if not proposal.seen_at:
        from datetime import datetime
        proposal.seen_at = datetime.utcnow()
        db.commit()
    return {"message": "Marked as seen"}


@router.post("/projects/{project_id}/proposals")
def submit_proposal(
    project_id: int,
    data: ProposalCreate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != "open":
        raise HTTPException(status_code=400, detail="This project is no longer accepting proposals")
    if project.client_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't propose on your own project")
    existing = (
        db.query(Proposal)
        .filter(Proposal.project_id == project_id, Proposal.freelancer_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already submitted a proposal for this project")
    highlights = (data.highlighted_portfolio or [])[:4]
    attachments = (data.attachment_urls or [])[:MAX_ATTACHMENTS]
    proposal = Proposal(
        project_id=project_id,
        freelancer_id=current_user.id,
        cover_letter=data.cover_letter,
        attachment_urls=json.dumps(attachments) if attachments else None,
        highlighted_portfolio=json.dumps([h.dict() for h in highlights]) if highlights else None,
        proposed_amount=data.proposed_amount,
        proposed_days=data.proposed_days,
        status="pending",
    )
    db.add(proposal)
    db.flush()
    notif.notify(
        db, project.client_id, notif.PROPOSAL_RECEIVED,
        "New proposal",
        f"{current_user.name} proposed {data.proposed_amount:,.0f} {project.currency} on “{project.title}”.",
        f"/projects/{project.id}",
    )
    db.commit()
    db.refresh(proposal)
    return _proposal_to_dict(proposal, db)


@router.get("/projects/{project_id}/proposals")
def list_proposals(
    project_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the project owner can see its proposals")
    proposals = (
        db.query(Proposal)
        .filter(Proposal.project_id == project_id)
        .order_by(Proposal.created_at.desc())
        .all()
    )
    return [_proposal_to_dict(p, db) for p in proposals]


@router.get("/proposals/inbox")
def proposals_inbox(
    status: str = Query("pending"),  # pending | all | accepted | rejected | withdrawn
    sort: str = Query("newest"),     # newest | price_asc | price_desc | best_match
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Every proposal received across every project this account posted as a
    client — the single inbox Milad asked for, instead of having to open
    each project and scroll to the bottom to find its proposals."""
    query = (
        db.query(Proposal, Project)
        .join(Project, Project.id == Proposal.project_id)
        .filter(Project.client_id == current_user.id)
    )
    if status != "all":
        query = query.filter(Proposal.status == status)

    if sort == "price_asc":
        query = query.order_by(Proposal.proposed_amount.asc())
    elif sort == "price_desc":
        query = query.order_by(Proposal.proposed_amount.desc())
    else:
        # Also the base ordering for "best_match" below, re-sorted in Python
        # once ratings are looked up — newest is still a sane fallback order.
        query = query.order_by(Proposal.created_at.desc())

    rows = query.all()

    if sort == "best_match":
        # No real matching model yet — approximated from the same signals a
        # client would actually weigh: rated freelancers first, then a track
        # record of finished contracts, newest as the final tiebreaker.
        def score(pr: Proposal):
            rating = get_user_rating(db, pr.freelancer_id)
            completed = (
                db.query(Contract)
                .filter(Contract.freelancer_id == pr.freelancer_id, Contract.status == "completed")
                .count()
            )
            return (rating["avg_rating"] or 0, completed, pr.created_at)
        rows = sorted(rows, key=lambda row: score(row[0]), reverse=True)

    return [_project_row_to_dict(pr, project, db) for pr, project in rows]


@router.get("/proposals/{proposal_id}")
def get_proposal(
    proposal_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    project = db.query(Project).filter(Project.id == proposal.project_id).first()
    is_owner_freelancer = proposal.freelancer_id == current_user.id
    is_project_client = project and project.client_id == current_user.id
    if not (is_owner_freelancer or is_project_client or current_user.role == "admin"):
        raise HTTPException(status_code=404, detail="Proposal not found")
    return _proposal_to_dict(proposal, db)


@router.patch("/proposals/{proposal_id}")
def update_proposal(
    proposal_id: int,
    data: ProposalUpdate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """The freelancer revising their own bid — price, cover letter,
    attachments or highlights — while it's still pending. Once a client has
    acted on it (accepted/rejected) or it was withdrawn, it's locked."""
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.freelancer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your proposal")
    if proposal.status != "pending":
        raise HTTPException(status_code=400, detail="Only a pending proposal can be edited")

    if data.cover_letter is not None:
        proposal.cover_letter = data.cover_letter
    if data.proposed_amount is not None:
        proposal.proposed_amount = data.proposed_amount
    if data.proposed_days is not None:
        proposal.proposed_days = data.proposed_days
    if data.attachment_urls is not None:
        attachments = data.attachment_urls[:MAX_ATTACHMENTS]
        proposal.attachment_urls = json.dumps(attachments) if attachments else None
        proposal.attachment_url = None  # fully superseded by the list now
    if data.highlighted_portfolio is not None:
        highlights = data.highlighted_portfolio[:4]
        proposal.highlighted_portfolio = json.dumps([h.dict() for h in highlights]) if highlights else None

    db.commit()
    db.refresh(proposal)
    return _proposal_to_dict(proposal, db)


@router.post("/proposals/{proposal_id}/withdraw")
def withdraw_proposal(
    proposal_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.freelancer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your proposal")
    if proposal.status != "pending":
        raise HTTPException(status_code=400, detail="Only a pending proposal can be withdrawn")
    proposal.status = "withdrawn"
    db.commit()
    return {"message": "Proposal withdrawn"}


@router.post("/proposals/{proposal_id}/reject")
def reject_proposal(
    proposal_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    project = db.query(Project).filter(Project.id == proposal.project_id).first()
    if not project or (project.client_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=403, detail="Only the project owner can reject proposals")
    if proposal.status != "pending":
        raise HTTPException(status_code=400, detail="Only a pending proposal can be rejected")
    proposal.status = "rejected"
    db.commit()
    return {"message": "Proposal rejected"}


@router.post("/proposals/{proposal_id}/accept")
def accept_proposal(
    proposal_id: int,
    data: ProposalAccept,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    project = db.query(Project).filter(Project.id == proposal.project_id).first()
    if not project or (project.client_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=403, detail="Only the project owner can accept proposals")
    if proposal.status != "pending":
        raise HTTPException(status_code=400, detail="Only a pending proposal can be accepted")
    if project.status != "open":
        raise HTTPException(status_code=400, detail="This project already has an accepted proposal")

    # Accepting is the moment money is committed, so the beta ceiling is
    # enforced here rather than at posting time — a project's budget range is
    # only an estimate, but a contract total is real.
    from app.services.marketplace_limits import check_contract_amount
    check_contract_amount(db, proposal.proposed_amount or 0, project.currency)

    # Milestones are what actually get funded, so they have to add up to the
    # figure that was just capped — otherwise the ceiling is trivially
    # sidestepped by splitting a big job into oversized milestones.
    if data.milestones:
        if any((m.amount or 0) <= 0 for m in data.milestones):
            raise HTTPException(status_code=400, detail="Every milestone needs an amount above zero")
        total = sum(m.amount or 0 for m in data.milestones)
        if abs(total - (proposal.proposed_amount or 0)) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Milestones add up to {total:,.2f} but the agreed amount is {proposal.proposed_amount:,.2f}.",
            )

    proposal.status = "accepted"
    project.status = "in_progress"
    # Every other pending proposal on this project is now moot.
    others = (
        db.query(Proposal)
        .filter(Proposal.project_id == project.id, Proposal.id != proposal.id, Proposal.status == "pending")
        .all()
    )
    for other in others:
        other.status = "rejected"

    contract = Contract(
        project_id=project.id,
        proposal_id=proposal.id,
        client_id=project.client_id,
        freelancer_id=proposal.freelancer_id,
        total_amount=proposal.proposed_amount,
        currency=project.currency,
        status="active",
    )
    db.add(contract)
    db.flush()

    milestones = data.milestones or []
    if not milestones:
        db.add(Milestone(
            contract_id=contract.id,
            title="Full project",
            amount=proposal.proposed_amount,
            order_index=0,
            status="pending",
        ))
    else:
        for i, m in enumerate(milestones):
            db.add(Milestone(
                contract_id=contract.id,
                title=m.title,
                description=m.description,
                amount=m.amount,
                due_date=m.due_date,
                order_index=i,
                status="pending",
            ))

    # Open the thread with the contract rather than lazily on first message,
    # so it's already in both inboxes the moment work starts.
    a, b = sorted((contract.client_id, contract.freelancer_id))
    if not db.query(Conversation).filter(Conversation.contract_id == contract.id).first():
        db.add(Conversation(contract_id=contract.id, user_a_id=a, user_b_id=b))

    notif.notify(
        db, proposal.freelancer_id, notif.PROPOSAL_ACCEPTED,
        "Your proposal was accepted",
        f"“{project.title}” is yours — the contract is open.",
        f"/contracts/{contract.id}",
    )
    for other in others:
        notif.notify(
            db, other.freelancer_id, notif.PROPOSAL_REJECTED,
            "Proposal not selected",
            f"“{project.title}” went to another freelancer.",
            "/projects",
        )

    db.commit()
    db.refresh(contract)
    return {"message": "Proposal accepted, contract created", "contract_id": contract.id}
