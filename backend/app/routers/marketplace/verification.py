"""Identity and payout details.

Money leaves Archon by hand, so before anyone can be paid there has to be a
real name, a real card and a way to reach them. The owner and admins are the
only ones who ever see this — nothing here is exposed on a public profile.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.database import get_db, User, UserVerification
from app.routers.auth import get_current_user, require_admin
from app.services import notifications as notif

router = APIRouter(prefix="/verification", tags=["verification"])


class VerificationUpdate(BaseModel):
    legal_name: Optional[str] = None
    national_id: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    id_document_url: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    card_number: Optional[str] = None
    iban: Optional[str] = None


class VerificationReview(BaseModel):
    admin_note: Optional[str] = None


# Everything needed before a payout can actually be made.
REQUIRED = ("legal_name", "national_id", "phone", "address", "city", "card_number", "iban")


def get_or_create(db: Session, user_id: int) -> UserVerification:
    row = db.query(UserVerification).filter(UserVerification.user_id == user_id).first()
    if not row:
        row = UserVerification(user_id=user_id, status="unverified")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _to_dict(v: UserVerification, *, redact: bool = False) -> dict:
    """`redact` masks the payout numbers for contexts where the full value
    isn't needed — the owner's own read gets them in full, so they can check
    what they entered."""
    def mask(value: str | None) -> str:
        if not value:
            return ""
        tail = value[-4:]
        return f"•••• {tail}"

    missing = [f for f in REQUIRED if not (getattr(v, f) or "").strip()]
    return {
        "status": v.status or "unverified",
        "legal_name": v.legal_name or "",
        "national_id": mask(v.national_id) if redact else (v.national_id or ""),
        "phone": v.phone or "",
        "address": v.address or "",
        "city": v.city or "",
        "country": v.country or "",
        "postal_code": v.postal_code or "",
        "id_document_url": v.id_document_url or "",
        "bank_name": v.bank_name or "",
        "account_holder": v.account_holder or "",
        "card_number": mask(v.card_number) if redact else (v.card_number or ""),
        "iban": mask(v.iban) if redact else (v.iban or ""),
        "admin_note": v.admin_note or "",
        "submitted_at": v.submitted_at.isoformat() if v.submitted_at else None,
        "reviewed_at": v.reviewed_at.isoformat() if v.reviewed_at else None,
        "missing_fields": missing,
        "is_complete": not missing,
    }


@router.get("/me")
def my_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _to_dict(get_or_create(db, current_user.id))


@router.put("/me")
def save_my_verification(
    data: VerificationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a draft. Editing an already-verified record sends it back for
    review — otherwise someone could get verified and then swap the card
    number for someone else's."""
    v = get_or_create(db, current_user.id)
    changed = False
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None and getattr(v, field) != value:
            setattr(v, field, value)
            changed = True
    if changed and v.status in ("verified", "rejected"):
        v.status = "unverified"
        v.admin_note = None
    db.commit()
    db.refresh(v)
    return _to_dict(v)


@router.post("/me/submit")
def submit_for_review(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = get_or_create(db, current_user.id)
    missing = [f for f in REQUIRED if not (getattr(v, f) or "").strip()]
    if missing:
        pretty = ", ".join(f.replace("_", " ") for f in missing)
        raise HTTPException(status_code=400, detail=f"Still missing: {pretty}")
    if v.status == "pending":
        raise HTTPException(status_code=400, detail="Your details are already awaiting review")
    if v.status == "verified":
        raise HTTPException(status_code=400, detail="You're already verified")

    v.status = "pending"
    v.submitted_at = datetime.utcnow()
    notif.notify_admins(
        db, notif.VERIFICATION_SUBMITTED,
        "Identity details to review",
        f"{current_user.name} submitted their identity and payout details.",
        "/marketplace-admin",
    )
    db.commit()
    return {"message": "Submitted — we'll review it shortly", "status": v.status}


# ── admin ────────────────────────────────────────────────────────────────
@router.get("/admin/pending")
def list_pending(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(UserVerification, User)
        .join(User, User.id == UserVerification.user_id)
        .filter(UserVerification.status == "pending")
        .order_by(UserVerification.submitted_at)
        .all()
    )
    return [{**_to_dict(v), "user_id": u.id, "user_name": u.name, "user_email": u.email}
            for v, u in rows]


@router.get("/admin/pending-count")
def pending_count(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {"count": db.query(UserVerification).filter(UserVerification.status == "pending").count()}


@router.get("/admin/{user_id}")
def read_user_verification(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Full payout details for one account — this is what the admin reads off
    when making a transfer."""
    v = db.query(UserVerification).filter(UserVerification.user_id == user_id).first()
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if not v:
        return {"status": "unverified", "user_id": u.id, "user_name": u.name,
                "user_email": u.email, "is_complete": False, "missing_fields": list(REQUIRED)}
    return {**_to_dict(v), "user_id": u.id, "user_name": u.name, "user_email": u.email}


@router.post("/admin/{user_id}/approve")
def approve(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    v = db.query(UserVerification).filter(UserVerification.user_id == user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Nothing submitted for this account")
    v.status = "verified"
    v.reviewed_at = datetime.utcnow()
    v.admin_note = None
    notif.notify(db, user_id, notif.VERIFICATION_REVIEWED,
                 "You're verified", "Your identity and payout details were approved.", "/verification")
    db.commit()
    return {"message": "Verified"}


@router.post("/admin/{user_id}/reject")
def reject(
    user_id: int,
    data: VerificationReview,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    v = db.query(UserVerification).filter(UserVerification.user_id == user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Nothing submitted for this account")
    v.status = "rejected"
    v.reviewed_at = datetime.utcnow()
    v.admin_note = data.admin_note
    notif.notify(db, user_id, notif.VERIFICATION_REVIEWED,
                 "Your details need a change",
                 data.admin_note or "Please review and resubmit your details.", "/verification")
    db.commit()
    return {"message": "Rejected"}
