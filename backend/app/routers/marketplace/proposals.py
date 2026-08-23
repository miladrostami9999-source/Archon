from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Project, Proposal, Contract, Milestone, User
from app.routers.auth import require_marketplace_beta
from app.services.marketplace_access import get_user_rating
from .schemas import ProposalCreate, ProposalAccept

router = APIRouter(tags=["marketplace-proposals"])


def _proposal_to_dict(pr: Proposal, db: Session) -> dict:
    freelancer = db.query(User).filter(User.id == pr.freelancer_id).first()
    rating = get_user_rating(db, pr.freelancer_id)
    return {
        "id": pr.id,
        "project_id": pr.project_id,
        "freelancer_id": pr.freelancer_id,
        "freelancer_name": freelancer.name if freelancer else None,
        "freelancer_rating": rating["avg_rating"],
        "freelancer_review_count": rating["review_count"],
        "cover_letter": pr.cover_letter,
        "proposed_amount": pr.proposed_amount,
        "proposed_days": pr.proposed_days,
        "status": pr.status,
        "created_at": pr.created_at.isoformat() if pr.created_at else None,
    }


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
    proposal = Proposal(
        project_id=project_id,
        freelancer_id=current_user.id,
        cover_letter=data.cover_letter,
        proposed_amount=data.proposed_amount,
        proposed_days=data.proposed_days,
        status="pending",
    )
    db.add(proposal)
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

    db.commit()
    db.refresh(contract)
    return {"message": "Proposal accepted, contract created", "contract_id": contract.id}
