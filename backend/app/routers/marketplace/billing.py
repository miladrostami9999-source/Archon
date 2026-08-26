"""A client's own view of what they've paid — the piece that was missing for
the Client Dashboard: every milestone payment claim across every contract
this account is the client on, in one place, instead of having to open each
contract separately to see its own history."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db, Contract, Milestone, MilestonePayment, Project, User
from app.routers.auth import require_marketplace_beta

router = APIRouter(prefix="/billing", tags=["marketplace-billing"])


@router.get("/history")
def billing_history(
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MilestonePayment, Milestone, Contract, Project)
        .join(Milestone, Milestone.id == MilestonePayment.milestone_id)
        .join(Contract, Contract.id == Milestone.contract_id)
        .join(Project, Project.id == Contract.project_id)
        .filter(Contract.client_id == current_user.id)
        .order_by(MilestonePayment.created_at.desc())
        .all()
    )
    payments = [
        {
            "id": payment.id,
            "milestone_id": milestone.id,
            "milestone_title": milestone.title,
            "contract_id": contract.id,
            "project_title": project.title,
            "amount": payment.amount,
            "currency": payment.currency,
            "method": payment.method,
            "status": payment.status,
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
            "reviewed_at": payment.reviewed_at.isoformat() if payment.reviewed_at else None,
        }
        for payment, milestone, contract, project in rows
    ]
    approved_total = sum(p["amount"] or 0 for p in payments if p["status"] == "approved")
    pending_total = sum(p["amount"] or 0 for p in payments if p["status"] == "pending")
    return {"payments": payments, "approved_total": approved_total, "pending_total": pending_total}
