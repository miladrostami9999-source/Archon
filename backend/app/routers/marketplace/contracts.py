from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.database import get_db, Contract, User
from app.routers.auth import require_marketplace_beta
from app.services.marketplace_access import serialize_contract

router = APIRouter(prefix="/contracts", tags=["marketplace-contracts"])


@router.get("")
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


@router.get("/{contract_id}")
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
