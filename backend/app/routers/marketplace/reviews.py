from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.models.database import get_db, Contract, Review, User
from app.routers.auth import require_marketplace_beta

router = APIRouter(tags=["marketplace-reviews"])


class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


def _review_to_dict(r: Review, db: Session) -> dict:
    reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
    return {
        "id": r.id,
        "contract_id": r.contract_id,
        "reviewer_id": r.reviewer_id,
        "reviewer_name": reviewer.name if reviewer else None,
        "reviewee_id": r.reviewee_id,
        "rating": r.rating,
        "comment": r.comment,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/contracts/{contract_id}/reviews")
def list_reviews(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if current_user.id not in (contract.client_id, contract.freelancer_id) and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Contract not found")
    rows = db.query(Review).filter(Review.contract_id == contract_id).all()
    return [_review_to_dict(r, db) for r in rows]


@router.post("/contracts/{contract_id}/review")
def submit_review(
    contract_id: int,
    data: ReviewCreate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    if not 1 <= data.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if current_user.id not in (contract.client_id, contract.freelancer_id):
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status != "completed":
        raise HTTPException(status_code=400, detail="You can review once every milestone has been paid out")

    existing = (
        db.query(Review)
        .filter(Review.contract_id == contract_id, Review.reviewer_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this contract")

    reviewee_id = contract.freelancer_id if current_user.id == contract.client_id else contract.client_id
    review = Review(
        contract_id=contract_id, reviewer_id=current_user.id, reviewee_id=reviewee_id,
        rating=data.rating, comment=data.comment,
    )
    db.add(review)
    db.flush()
    from app.services import notifications as notif
    notif.notify(
        db, reviewee_id, notif.REVIEW_RECEIVED,
        f"{current_user.name} left you a review",
        f"{'★' * data.rating}{'☆' * (5 - data.rating)}" + (f" — “{data.comment}”" if data.comment else ""),
        f"/contracts/{contract_id}",
    )
    db.commit()
    db.refresh(review)
    return _review_to_dict(review, db)


@router.get("/users/{user_id}/reviews")
def user_reviews(
    user_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Everything said about one account, for the reputation tab on a profile."""
    from app.services.marketplace_access import get_user_rating
    rows = (
        db.query(Review)
        .filter(Review.reviewee_id == user_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return {**get_user_rating(db, user_id), "items": [_review_to_dict(r, db) for r in rows]}
