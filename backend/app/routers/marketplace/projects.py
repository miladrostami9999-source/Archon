from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.models.database import get_db, Project, Proposal, User
from app.routers.auth import require_marketplace_beta
from .schemas import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["marketplace-projects"])


def _project_to_dict(p: Project, db: Session, viewer_id: int) -> dict:
    client = db.query(User).filter(User.id == p.client_id).first()
    proposal_count = db.query(Proposal).filter(Proposal.project_id == p.id).count()
    my_proposal = (
        db.query(Proposal)
        .filter(Proposal.project_id == p.id, Proposal.freelancer_id == viewer_id)
        .first()
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
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "client_id": p.client_id,
        "client_name": client.name if client else None,
        "is_owner": p.client_id == viewer_id,
        "proposal_count": proposal_count,
        "my_proposal_status": my_proposal.status if my_proposal else None,
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
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Open project board by default; `mine=true` lists projects this account
    posted as a client, regardless of status."""
    query = db.query(Project)
    if mine:
        query = query.filter(Project.client_id == current_user.id)
    elif status:
        query = query.filter(Project.status == status)
    else:
        query = query.filter(Project.status == "open")
    projects = query.order_by(Project.created_at.desc()).all()
    return [_project_to_dict(p, db, current_user.id) for p in projects]


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
    for field in ("title", "description", "category", "budget_min", "budget_max", "currency", "deadline", "status"):
        value = getattr(data, field)
        if value is not None:
            setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _project_to_dict(project, db, current_user.id)
