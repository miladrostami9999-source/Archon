from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.database import (
    get_db, MilestonePayment, MilestonePayout, Milestone, Contract, Project, User,
)
from app.routers.auth import require_admin
from app.services.marketplace_access import serialize_contract
from app.services import notifications as notif
from .schemas import MilestonePaymentReview, MilestonePayoutRequest

router = APIRouter(prefix="/admin", tags=["marketplace-admin"])


def _payment_to_dict(p: MilestonePayment, db: Session) -> dict:
    m = db.query(Milestone).filter(Milestone.id == p.milestone_id).first()
    c = db.query(Contract).filter(Contract.id == m.contract_id).first() if m else None
    client = db.query(User).filter(User.id == c.client_id).first() if c else None
    return {
        "id": p.id,
        "milestone_id": p.milestone_id,
        "milestone_title": m.title if m else None,
        "contract_id": c.id if c else None,
        "client_name": client.name if client else None,
        "amount": p.amount,
        "currency": p.currency,
        "method": p.method,
        "reference": p.reference,
        "receipt_url": p.receipt_url,
        "note": p.note,
        "status": p.status,
        "admin_note": p.admin_note,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
    }


class MarketplaceSettingsUpdate(BaseModel):
    max_contract_usd: float


@router.get("/settings")
def get_marketplace_settings(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.services.marketplace_limits import get_contract_cap_usd
    return {"max_contract_usd": get_contract_cap_usd(db)}


@router.put("/settings")
def update_marketplace_settings(
    data: MarketplaceSettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Raise or lift the beta contract ceiling without a deploy. 0 = no limit."""
    from app.models.database import AppSetting
    from app.services.marketplace_limits import CAP_KEY

    if data.max_contract_usd < 0:
        raise HTTPException(status_code=400, detail="The cap can't be negative (use 0 for no limit)")
    row = db.query(AppSetting).filter(AppSetting.key == CAP_KEY).first()
    if row:
        row.value = str(data.max_contract_usd)
    else:
        db.add(AppSetting(key=CAP_KEY, value=str(data.max_contract_usd)))
    db.commit()
    return {"message": "Marketplace settings saved", "max_contract_usd": data.max_contract_usd}


@router.get("/payments")
def list_payments(status: Optional[str] = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(MilestonePayment)
    if status:
        q = q.filter(MilestonePayment.status == status)
    rows = q.order_by(MilestonePayment.created_at.desc()).all()
    return [_payment_to_dict(p, db) for p in rows]


@router.get("/pending-count")
def pending_count(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Badge count for the sidebar — payments awaiting review."""
    return {"count": db.query(MilestonePayment).filter(MilestonePayment.status == "pending").count()}


@router.post("/payments/{payment_id}/approve")
def approve_payment(payment_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.query(MilestonePayment).filter(MilestonePayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.status != "pending":
        raise HTTPException(status_code=400, detail="This payment was already reviewed")
    m = db.query(Milestone).filter(Milestone.id == p.milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    p.status = "approved"
    p.reviewed_at = datetime.utcnow()
    m.status = "funded"
    c = db.query(Contract).filter(Contract.id == m.contract_id).first()
    if c:
        notif.notify(db, c.freelancer_id, notif.MILESTONE_FUNDED,
                     "Milestone funded",
                     f"“{m.title}” is funded — you can start and mark it delivered when ready.",
                     f"/contracts/{c.id}")
        notif.notify(db, c.client_id, notif.MILESTONE_FUNDED,
                     "Your payment was confirmed",
                     f"“{m.title}” is now funded and the freelancer has been told.",
                     f"/contracts/{c.id}")
    db.commit()
    return {"message": "Payment approved — milestone is now funded"}


@router.post("/payments/{payment_id}/reject")
def reject_payment(
    payment_id: int,
    data: MilestonePaymentReview,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    p = db.query(MilestonePayment).filter(MilestonePayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.status != "pending":
        raise HTTPException(status_code=400, detail="This payment was already reviewed")
    p.status = "rejected"
    p.admin_note = data.admin_note
    p.reviewed_at = datetime.utcnow()
    m = db.query(Milestone).filter(Milestone.id == p.milestone_id).first()
    c = db.query(Contract).filter(Contract.id == m.contract_id).first() if m else None
    if c:
        notif.notify(db, c.client_id, notif.PAYMENT_SUBMITTED,
                     "Payment couldn't be confirmed",
                     data.admin_note or "We couldn't match your transfer. Please check and resubmit.",
                     f"/contracts/{c.id}")
    db.commit()
    return {"message": "Payment rejected"}


@router.get("/projects")
def list_all_projects(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Project).order_by(Project.created_at.desc()).all()
    return [
        {
            "id": p.id, "title": p.title, "status": p.status,
            "client_id": p.client_id, "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in rows
    ]


@router.get("/contracts")
def list_all_contracts(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Contract).order_by(Contract.created_at.desc()).all()
    return [serialize_contract(c, admin.id, db) for c in rows]


@router.get("/contracts/{contract_id}")
def contract_detail(
    contract_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Everything an admin needs on one screen to act on a contract: where each
    milestone stands, what's been claimed and confirmed, and — when a payout is
    actually due — the freelancer's bank details to transfer to."""
    from app.models.database import MilestonePayout, UserVerification

    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")

    data = serialize_contract(c, admin.id, db)
    milestones = db.query(Milestone).filter(Milestone.contract_id == c.id).order_by(Milestone.order_index).all()

    detail = []
    for m in milestones:
        pays = db.query(MilestonePayment).filter(MilestonePayment.milestone_id == m.id).order_by(MilestonePayment.created_at.desc()).all()
        outs = db.query(MilestonePayout).filter(MilestonePayout.milestone_id == m.id).all()
        detail.append({
            "id": m.id, "title": m.title, "amount": m.amount, "status": m.status,
            "deliverable_url": m.deliverable_url,
            "delivered_at": m.delivered_at.isoformat() if m.delivered_at else None,
            "approved_at": m.approved_at.isoformat() if m.approved_at else None,
            # What the admin is being asked to do about this milestone, if anything.
            "awaiting_admin": m.status == "approved" or any(p.status == "pending" for p in pays),
            "payments": [_payment_to_dict(p, db) for p in pays],
            "payouts": [{"id": o.id, "amount": o.amount, "method": o.method,
                         "reference": o.reference, "admin_note": o.admin_note,
                         "paid_at": o.paid_at.isoformat() if o.paid_at else None} for o in outs],
        })

    def payout_info(user_id: int) -> dict:
        u = db.query(User).filter(User.id == user_id).first()
        v = db.query(UserVerification).filter(UserVerification.user_id == user_id).first()
        base = {"id": user_id, "name": u.name if u else None, "email": u.email if u else None,
                "verification_status": (v.status if v else "unverified")}
        if v:
            base.update({
                "legal_name": v.legal_name or "", "national_id": v.national_id or "",
                "phone": v.phone or "", "address": v.address or "", "city": v.city or "",
                "bank_name": v.bank_name or "", "account_holder": v.account_holder or "",
                "card_number": v.card_number or "", "iban": v.iban or "",
            })
        return base

    data["milestone_detail"] = detail
    data["freelancer"] = payout_info(c.freelancer_id)
    data["client"] = payout_info(c.client_id)
    data["payout_due"] = [m["id"] for m in detail if m["status"] == "approved"]
    return data


@router.post("/payouts")
def create_payout(
    data: MilestonePayoutRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin's record of manually paying the freelancer out — the mirror
    image of fund_milestone. Releasing the last milestone on a contract
    marks the whole contract completed."""
    m = db.query(Milestone).filter(Milestone.id == data.milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if m.status != "approved":
        raise HTTPException(status_code=400, detail="The client must approve delivery before payout")
    payout = MilestonePayout(
        milestone_id=m.id, amount=data.amount, method=data.method,
        reference=data.reference, admin_note=data.admin_note,
    )
    db.add(payout)
    m.status = "released"

    contract = db.query(Contract).filter(Contract.id == m.contract_id).first()
    if contract:
        notif.notify(db, contract.freelancer_id, notif.MILESTONE_RELEASED,
                     "You've been paid",
                     f"{data.amount:,.0f} {contract.currency} was sent for “{m.title}”.",
                     f"/contracts/{contract.id}")
        siblings = db.query(Milestone).filter(Milestone.contract_id == contract.id).all()
        if siblings and all(s.status == "released" for s in siblings):
            contract.status = "completed"
            for uid in (contract.client_id, contract.freelancer_id):
                notif.notify(db, uid, notif.MILESTONE_RELEASED,
                             "Contract complete",
                             "Every milestone is paid out. You can leave a review now.",
                             f"/contracts/{contract.id}")
    db.commit()
    return {"message": "Payout recorded — milestone released"}
