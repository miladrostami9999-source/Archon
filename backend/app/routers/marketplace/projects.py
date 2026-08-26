import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.database import get_db, Contract, Project, ProjectSave, Proposal, User
from app.routers.auth import require_marketplace_beta
from app.services.marketplace_access import get_user_rating, is_verified
from .schemas import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["marketplace-projects"])


def _project_to_dict(p: Project, db: Session, viewer_id: int) -> dict:
    from datetime import datetime

    client = db.query(User).filter(User.id == p.client_id).first()
    proposal_count = db.query(Proposal).filter(Proposal.project_id == p.id).count()
    my_proposal = (
        db.query(Proposal)
        .filter(Proposal.project_id == p.id, Proposal.freelancer_id == viewer_id)
        .first()
    )
    posted_projects_count = db.query(Project).filter(Project.client_id == p.client_id).count()
    try:
        skills = json.loads(p.skills) if p.skills else []
    except Exception:
        skills = []
    days_open = (datetime.utcnow() - p.created_at).days if p.created_at else 0
    deadline_days_left = (p.deadline - datetime.utcnow()).days if p.deadline else None

    # "$X+ spent" — the client's hiring track record, the same signal Upwork
    # leads with. Counted from contracts that at least started (active or
    # completed), not merely proposed.
    client_rating = get_user_rating(db, p.client_id)
    client_total_spent = (
        db.query(Contract)
        .filter(Contract.client_id == p.client_id, Contract.status.in_(["active", "completed"]))
        .with_entities(Contract.total_amount)
        .all()
    )
    client_total_spent = sum((row[0] or 0) for row in client_total_spent)

    is_saved = (
        db.query(ProjectSave)
        .filter(ProjectSave.project_id == p.id, ProjectSave.user_id == viewer_id)
        .first()
        is not None
    )

    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "category": p.category,
        "budget_min": p.budget_min,
        "budget_max": p.budget_max,
        "currency": p.currency,
        "deadline": p.deadline.isoformat() if p.deadline else None,
        "deadline_days_left": deadline_days_left,
        "status": p.status,
        "skills": skills,
        "experience_level": p.experience_level,
        "location": p.location,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "days_open": days_open,
        "client_id": p.client_id,
        "client_name": client.name if client else None,
        "client_verified": is_verified(db, p.client_id),
        "client_posted_projects_count": posted_projects_count,
        "client_member_since": client.created_at.isoformat() if client and client.created_at else None,
        "client_rating": client_rating["avg_rating"],
        "client_review_count": client_rating["review_count"],
        "client_total_spent": client_total_spent,
        "is_owner": p.client_id == viewer_id,
        "is_saved": is_saved,
        "proposal_count": proposal_count,
        "my_proposal_status": my_proposal.status if my_proposal else None,
        "my_proposal_id": my_proposal.id if my_proposal else None,
    }


@router.post("")
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    project = Project(
        client_id=current_user.id,
        title=data.title,
        description=data.description,
        category=data.category,
        budget_min=data.budget_min,
        budget_max=data.budget_max,
        currency=data.currency,
        deadline=data.deadline,
        skills=json.dumps(data.skills) if data.skills else None,
        experience_level=data.experience_level,
        location=data.location,
        status="open",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_dict(project, db, current_user.id)


@router.get("")
def list_projects(
    mine: bool = False,
    status: Optional[str] = None,
    saved: bool = False,
    q: Optional[str] = None,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Open project board by default; `mine=true` lists projects this account
    posted as a client, regardless of status; `saved=true` lists the ones
    this account bookmarked; `q` filters by a keyword against title,
    description, category and skills."""
    if saved:
        saved_ids = [
            row[0] for row in
            db.query(ProjectSave.project_id).filter(ProjectSave.user_id == current_user.id).all()
        ]
        query = db.query(Project).filter(Project.id.in_(saved_ids)) if saved_ids else db.query(Project).filter(False)
    else:
        query = db.query(Project)
        if mine:
            query = query.filter(Project.client_id == current_user.id)
        elif status:
            query = query.filter(Project.status == status)
        else:
            query = query.filter(Project.status == "open")

    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            Project.title.ilike(like),
            Project.description.ilike(like),
            Project.category.ilike(like),
            Project.skills.ilike(like),
        ))

    projects = query.order_by(Project.created_at.desc()).all()
    return [_project_to_dict(p, db, current_user.id) for p in projects]


@router.post("/{project_id}/save")
def toggle_save_project(
    project_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    existing = (
        db.query(ProjectSave)
        .filter(ProjectSave.project_id == project_id, ProjectSave.user_id == current_user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False}
    db.add(ProjectSave(project_id=project_id, user_id=current_user.id))
    db.commit()
    return {"saved": True}


@router.get("/{project_id}")
def get_project(
    project_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_dict(project, db, current_user.id)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Withdraw a project.

    Only possible while no contract has come out of it — once work is agreed,
    the freelancer has a claim on it and the project has to be seen through or
    settled, not made to disappear. Anyone who had bid is told, since their
    proposal vanishes with it.
    """
    from app.services import notifications as notif

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the project owner can delete it")

    if db.query(Contract).filter(Contract.project_id == project_id).first():
        raise HTTPException(
            status_code=400,
            detail="This project already has a contract, so it can't be deleted. Cancel the contract instead.",
        )

    for p in db.query(Proposal).filter(Proposal.project_id == project_id, Proposal.status == "pending").all():
        notif.notify(
            db, p.freelancer_id, notif.PROPOSAL_REJECTED,
            "A project you bid on was withdrawn",
            f"“{project.title}” was taken down by the client.",
            "/projects",
        )
    db.query(Proposal).filter(Proposal.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectSave).filter(ProjectSave.project_id == project_id).delete(synchronize_session=False)
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}


@router.patch("/{project_id}")
def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the project owner can edit it")
    for field in ("title", "description", "category", "budget_min", "budget_max", "currency", "deadline", "status", "experience_level", "location"):
        value = getattr(data, field)
        if value is not None:
            setattr(project, field, value)
    if data.skills is not None:
        project.skills = json.dumps(data.skills)
    db.commit()
    db.refresh(project)
    return _project_to_dict(project, db, current_user.id)
