from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Milestone, Contract, MilestonePayment, User
from app.routers.auth import require_marketplace_beta
from app.services import notifications as notif
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


@router.post("/{milestone_id}/accept-proposal")
def accept_milestone_proposal(
    milestone_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """The other party signing off on a mid-contract milestone someone
    proposed — folds its amount into the contract total (re-checked against
    the beta cap, same as at contract creation) and makes it fundable."""
    from app.services.marketplace_limits import check_contract_amount

    m, c = _get_milestone_and_contract(db, milestone_id)
    if current_user.id not in (c.client_id, c.freelancer_id):
        raise HTTPException(status_code=403, detail="Only the two parties on this contract can decide on it")
    if m.status != "proposed":
        raise HTTPException(status_code=400, detail="This milestone isn't awaiting a decision")
    if current_user.id == m.proposed_by:
        raise HTTPException(status_code=400, detail="You can't accept your own proposal — the other party has to")

    new_total = (c.total_amount or 0) + m.amount
    check_contract_amount(db, new_total, c.currency)
    c.total_amount = new_total
    m.status = "pending"
    notif.notify(
        db, m.proposed_by, notif.MILESTONE_PROPOSAL_DECIDED,
        "Milestone accepted",
        f"“{m.title}” was accepted and added to the contract.",
        f"/contracts/{c.id}",
    )
    db.commit()
    return {"message": "Milestone accepted"}


@router.post("/{milestone_id}/reject-proposal")
def reject_milestone_proposal(
    milestone_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    m, c = _get_milestone_and_contract(db, milestone_id)
    if current_user.id not in (c.client_id, c.freelancer_id):
        raise HTTPException(status_code=403, detail="Only the two parties on this contract can decide on it")
    if m.status != "proposed":
        raise HTTPException(status_code=400, detail="This milestone isn't awaiting a decision")
    if current_user.id == m.proposed_by:
        raise HTTPException(status_code=400, detail="You can't decide on your own proposal — the other party has to")

    notif.notify(
        db, m.proposed_by, notif.MILESTONE_PROPOSAL_DECIDED,
        "Milestone declined",
        f"“{m.title}” was declined.",
        f"/contracts/{c.id}",
    )
    db.delete(m)
    db.commit()
    return {"message": "Milestone proposal declined"}


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
    # The claimed figure has to be the milestone's own — an admin still eyeballs
    # the receipt, but they shouldn't have to catch arithmetic too, and a
    # short payment approved by mistake would leave the freelancer owed money.
    if abs((data.amount or 0) - (m.amount or 0)) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"This milestone is {m.amount:,.2f} {c.currency}. Enter that amount to fund it.",
        )
    payment = MilestonePayment(
        milestone_id=m.id, amount=data.amount, currency=data.currency, method=data.method,
        reference=data.reference, receipt_url=data.receipt_url, note=data.note, status="pending",
    )
    db.add(payment)
    db.flush()
    notif.notify_admins(
        db, notif.PAYMENT_SUBMITTED,
        "Payment to verify",
        f"{current_user.name} says they sent {data.amount:,.0f} {data.currency} for “{m.title}”. "
        f"Confirm it landed, then approve to fund the milestone.",
        "/marketplace-admin",
    )
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
    notif.notify(
        db, c.client_id, notif.MILESTONE_DELIVERED,
        "Work delivered",
        f"“{m.title}” is ready for your review.",
        f"/contracts/{c.id}",
    )
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
    freelancer = db.query(User).filter(User.id == c.freelancer_id).first()
    # The one event nothing else can move past: money is now owed and only an
    # admin can send it, so this goes out by email as well as in-app.
    notif.notify_admins(
        db, notif.MILESTONE_APPROVED,
        "Payout due",
        f"{freelancer.name if freelancer else 'The freelancer'} is owed "
        f"{m.amount:,.0f} {c.currency} for “{m.title}” — the client approved the delivery.",
        f"/marketplace-admin?contract={c.id}",
    )
    notif.notify(
        db, c.freelancer_id, notif.MILESTONE_APPROVED,
        "Delivery approved",
        f"“{m.title}” was approved. Payout is being processed.",
        f"/contracts/{c.id}",
    )
    db.commit()
    return {"message": "Delivery approved — the admin will process payout to the freelancer"}
