from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.database import get_db, Contract, User
from app.routers.auth import require_marketplace_beta
from app.services.marketplace_access import serialize_contract

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
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Every contract this account is party to, as either client or
    freelancer — the two roles share one inbox rather than two separate
    lists, since a single account can be both."""
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
