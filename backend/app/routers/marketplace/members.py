"""In-app member profiles.

`/u/{username}` is the profile someone chooses to put on the open web, so it
respects `is_public`. But inside the marketplace the identity of whoever you're
bidding against or hiring can't be optional — a client comparing proposals has
to be able to look at the person behind each one. This is that view: available
to any signed-in account, and carrying only what's already fair game (name,
bio, portfolio, reputation) — never the identity or payout details, which stay
between the owner and an admin.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Contract, Review, User
from app.routers.auth import get_current_user
from app.services.marketplace_access import get_user_rating

router = APIRouter(prefix="/members", tags=["marketplace-members"])


@router.get("/{user_id}")
def member_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Member not found")

    data = {}
    if user.profile_json:
        try:
            data = json.loads(user.profile_json)
        except Exception:
            data = {}

    rating = get_user_rating(db, user.id)
    review_rows = (
        db.query(Review, User)
        .join(User, User.id == Review.reviewer_id)
        .filter(Review.reviewee_id == user.id)
        .order_by(Review.created_at.desc())
        .limit(20)
        .all()
    )
    completed = (
        db.query(Contract)
        .filter(
            ((Contract.freelancer_id == user.id) | (Contract.client_id == user.id)),
            Contract.status == "completed",
        )
        .count()
    )

    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "is_public": bool(user.is_public),
        "account_mode": user.account_mode or "freelancer",
        "avatar": data.get("avatar", ""),
        "bio": data.get("bio", ""),
        "location": data.get("location", ""),
        "website": data.get("website", ""),
        "company": data.get("company", ""),
        "skills": data.get("skills", []),
        "customSkills": data.get("customSkills", []),
        "portfolio": data.get("portfolio", []),
        "rating": rating["avg_rating"],
        "review_count": rating["review_count"],
        "satisfaction": round((rating["avg_rating"] / 5) * 100) if rating["avg_rating"] else None,
        "completed_contracts": completed,
        "reviews": [{
            "rating": r.rating,
            "comment": r.comment,
            "reviewer_name": reviewer.name,
            "reviewer_id": reviewer.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r, reviewer in review_rows],
        "is_me": user.id == current_user.id,
    }
