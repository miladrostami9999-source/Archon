from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.database import get_db, Contract, Milestone, User
from app.routers.auth import require_marketplace_beta
from app.services.marketplace_access import serialize_contract, milestone_to_dict
from app.services import notifications as notif
from .schemas import MilestoneInput

router = APIRouter(tags=["marketplace-contracts"])


@router.get("/info")
def marketplace_info(
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """What the beta banner needs: the current contract ceiling and who to
    contact when something goes wrong. Shown rather than hidden, so nobody
    discovers the limit only when their accept button fails."""
    from app.models.database import AppSetting
    from app.services.marketplace_limits import get_contract_cap_usd

    settings = {s.key: s.value for s in db.query(AppSetting).all()}
    return {
        "max_contract_usd": get_contract_cap_usd(db),
        "support_email": settings.get("support_email", ""),
        "support_phone": settings.get("support_phone", ""),
    }


@router.get("/contracts")
def list_contracts(
    status: Optional[str] = None,
    role: Optional[str] = None,  # 'client' | 'freelancer' — scope to one dashboard's contracts
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Every contract this account is party to, as either client or
    freelancer — the two roles share one inbox rather than two separate
    lists, since a single account can be both. `role` narrows that to just
    one side, for the Client dashboard (which has no business showing a
    contract this account is the freelancer on) and vice versa."""
    if role == "client":
        query = db.query(Contract).filter(Contract.client_id == current_user.id)
    elif role == "freelancer":
        query = db.query(Contract).filter(Contract.freelancer_id == current_user.id)
    else:
        query = db.query(Contract).filter(
            or_(Contract.client_id == current_user.id, Contract.freelancer_id == current_user.id)
        )
    if status:
        query = query.filter(Contract.status == status)
    rows = query.order_by(Contract.created_at.desc()).all()
    return [serialize_contract(c, current_user.id, db) for c in rows]


@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if current_user.id not in (contract.client_id, contract.freelancer_id) and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Contract not found")
    return serialize_contract(contract, current_user.id, db)


@router.post("/contracts/{contract_id}/approve")
def approve_contract(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """The freelancer signing off on the contract — including whatever
    milestone breakdown the client chose at accept time — before anything
    is fundable. Nothing moves until this happens."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.freelancer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the freelancer on this contract can confirm it")
    if contract.status != "pending_approval":
        raise HTTPException(status_code=400, detail="This contract isn't awaiting your approval")
    contract.status = "active"
    notif.notify(
        db, contract.client_id, notif.CONTRACT_APPROVED,
        "Contract confirmed",
        f"{current_user.name} confirmed the contract — work can start.",
        f"/contracts/{contract.id}",
    )
    db.commit()
    return {"message": "Contract confirmed"}


@router.post("/contracts/{contract_id}/decline")
def decline_contract(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """The freelancer walking away before work starts — e.g. the client's
    milestone split isn't what they agreed to. The project reopens so the
    client can hire someone else."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.freelancer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the freelancer on this contract can decline it")
    if contract.status != "pending_approval":
        raise HTTPException(status_code=400, detail="This contract isn't awaiting your approval")
    contract.status = "declined"
    from app.models.database import Project
    project = db.query(Project).filter(Project.id == contract.project_id).first()
    if project:
        project.status = "open"
    notif.notify(
        db, contract.client_id, notif.CONTRACT_DECLINED,
        "Contract declined",
        f"{current_user.name} declined the contract for “{project.title if project else 'your project'}”. The project is open again.",
        f"/projects/{contract.project_id}",
    )
    db.commit()
    return {"message": "Contract declined"}


@router.post("/contracts/{contract_id}/milestones")
def propose_milestone(
    contract_id: int,
    data: MilestoneInput,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Either party can propose adding scope mid-contract — a chat request
    turned into something the other side has to explicitly agree to before
    any money moves, rather than a line item one side can just impose."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if current_user.id not in (contract.client_id, contract.freelancer_id):
        raise HTTPException(status_code=403, detail="Only the two parties on this contract can propose milestones")
    if contract.status != "active":
        raise HTTPException(status_code=400, detail="This contract isn't active")
    if (data.amount or 0) <= 0:
        raise HTTPException(status_code=400, detail="The milestone needs an amount above zero")

    max_order = db.query(Milestone).filter(Milestone.contract_id == contract.id).count()
    milestone = Milestone(
        contract_id=contract.id,
        title=data.title,
        description=data.description,
        amount=data.amount,
        due_date=data.due_date,
        order_index=max_order,
        status="proposed",
        proposed_by=current_user.id,
    )
    db.add(milestone)
    db.flush()

    other_id = contract.freelancer_id if current_user.id == contract.client_id else contract.client_id
    notif.notify(
        db, other_id, notif.MILESTONE_PROPOSED,
        "New milestone proposed",
        f"{current_user.name} proposed “{milestone.title}” — {milestone.amount:,.0f} {contract.currency}.",
        f"/contracts/{contract.id}",
    )
    db.commit()
    db.refresh(milestone)
    return milestone_to_dict(milestone)
