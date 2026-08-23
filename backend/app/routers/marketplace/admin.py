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
    db.commit()

    contract = db.query(Contract).filter(Contract.id == m.contract_id).first()
    if contract:
        siblings = db.query(Milestone).filter(Milestone.contract_id == contract.id).all()
        if siblings and all(s.status == "released" for s in siblings):
            contract.status = "completed"
            db.commit()
    return {"message": "Payout recorded — milestone released"}
