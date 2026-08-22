from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Milestone, Contract, MilestonePayment, User
from app.routers.auth import require_marketplace_beta
from .schemas import MilestoneFundRequest, MilestoneDeliverRequest

router = APIRouter(prefix="/milestones", tags=["marketplace-milestones"])


def _get_milestone_and_contract(db: Session, milestone_id: int):
    m = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    c = db.query(Contract).filter(Contract.id == m.contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return m, c


@router.post("/{milestone_id}/fund")
def fund_milestone(
    milestone_id: int,
    data: MilestoneFundRequest,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Client's claim of having paid — mirrors the plan billing flow. Does
    not move the milestone to `funded` itself; an admin approving the
    payment (marketplace/admin.py) is what does that, same as PaymentRequest
    approval activates a plan."""
    m, c = _get_milestone_and_contract(db, milestone_id)
    if c.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client on this contract can fund it")
    if m.status != "pending":
        raise HTTPException(status_code=400, detail="This milestone isn't awaiting funding")
    payment = MilestonePayment(
        milestone_id=m.id, amount=data.amount, currency=data.currency, method=data.method,
        reference=data.reference, receipt_url=data.receipt_url, note=data.note, status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"message": "Payment submitted for review", "id": payment.id}


@router.post("/{milestone_id}/deliver")
def deliver_milestone(
    milestone_id: int,
    data: MilestoneDeliverRequest,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    m, c = _get_milestone_and_contract(db, milestone_id)
    if c.freelancer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the freelancer on this contract can deliver it")
    if m.status != "funded":
        raise HTTPException(status_code=400, detail="This milestone hasn't been funded yet")
    m.deliverable_url = data.deliverable_url
    m.status = "delivered"
    m.delivered_at = datetime.utcnow()
    db.commit()
    return {"message": "Delivery submitted"}


@router.post("/{milestone_id}/approve")
def approve_milestone(
    milestone_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    m, c = _get_milestone_and_contract(db, milestone_id)
    if c.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the client on this contract can approve delivery")
    if m.status != "delivered":
        raise HTTPException(status_code=400, detail="This milestone hasn't been delivered yet")
    m.status = "approved"
    m.approved_at = datetime.utcnow()
    db.commit()
    return {"message": "Delivery approved — the admin will process payout to the freelancer"}
