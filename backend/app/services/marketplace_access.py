"""Role-based serialization for marketplace objects.

A Contract is shared between exactly two accounts — client and freelancer —
who see the same underlying row but need different framing (whose name is
"you", which actions apply to which side). This mirrors the client vs
freelancer distinction the plan called for; the milestone fund/deliver/
approve actions themselves land in a later phase, but the shape here is
built to carry them without a rework.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import Contract, Milestone, Project, User, Review


def _milestone_to_dict(m: Milestone) -> dict:
    return {
        "id": m.id,
        "title": m.title,
        "description": m.description,
        "amount": m.amount,
        "due_date": m.due_date.isoformat() if m.due_date else None,
        "order_index": m.order_index,
        "status": m.status,
        "deliverable_url": m.deliverable_url,
        "delivered_at": m.delivered_at.isoformat() if m.delivered_at else None,
        "approved_at": m.approved_at.isoformat() if m.approved_at else None,
    }


def get_user_rating(db: Session, user_id: int) -> dict:
    """Average rating and count of reviews this account received as either
    client or freelancer — one reputation, not two, since the same person
    plays both roles across different contracts."""
    row = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.reviewee_id == user_id)
        .first()
    )
    avg, count = row if row else (None, 0)
    return {"avg_rating": round(avg, 1) if avg else None, "review_count": count or 0}


def serialize_contract(contract: Contract, viewer_id: int, db: Session) -> dict:
    client = db.query(User).filter(User.id == contract.client_id).first()
    freelancer = db.query(User).filter(User.id == contract.freelancer_id).first()
    project = db.query(Project).filter(Project.id == contract.project_id).first()
    milestones = (
        db.query(Milestone)
        .filter(Milestone.contract_id == contract.id)
        .order_by(Milestone.order_index)
        .all()
    )
    if viewer_id == contract.client_id:
        viewer_role = "client"
    elif viewer_id == contract.freelancer_id:
        viewer_role = "freelancer"
    else:
        viewer_role = "observer"  # e.g. an admin looking in, not a party to it
    return {
        "id": contract.id,
        "project_id": contract.project_id,
        "project_title": project.title if project else None,
        "client_id": contract.client_id,
        "client_name": client.name if client else None,
        "freelancer_id": contract.freelancer_id,
        "freelancer_name": freelancer.name if freelancer else None,
        "total_amount": contract.total_amount,
        "currency": contract.currency,
        "status": contract.status,
        "created_at": contract.created_at.isoformat() if contract.created_at else None,
        "viewer_role": viewer_role,
        "milestones": [_milestone_to_dict(m) for m in milestones],
    }
