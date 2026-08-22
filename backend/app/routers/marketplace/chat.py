from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.database import get_db, Contract, ContractMessage, User
from app.routers.auth import require_marketplace_beta
from pydantic import BaseModel

router = APIRouter(prefix="/contracts", tags=["marketplace-chat"])


class MessageCreate(BaseModel):
    body: Optional[str] = None
    attachment_url: Optional[str] = None


def _get_contract_for_party(db: Session, contract_id: int, user: User) -> Contract:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.id not in (contract.client_id, contract.freelancer_id) and user.role != "admin":
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


def _message_to_dict(m: ContractMessage, db: Session) -> dict:
    sender = db.query(User).filter(User.id == m.sender_id).first()
    return {
        "id": m.id,
        "contract_id": m.contract_id,
        "sender_id": m.sender_id,
        "sender_name": sender.name if sender else None,
        "body": m.body,
        "attachment_url": m.attachment_url,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/{contract_id}/messages")
def list_messages(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    _get_contract_for_party(db, contract_id, current_user)
    rows = (
        db.query(ContractMessage)
        .filter(ContractMessage.contract_id == contract_id)
        .order_by(ContractMessage.created_at.asc())
        .all()
    )
    # Read receipts: anything not sent by the viewer is now considered read,
    # since they're looking at the thread. Only stamped once, so it doesn't
    # keep rewriting rows that already have a read_at.
    unread = [m for m in rows if m.sender_id != current_user.id and m.read_at is None]
    if unread:
        now = datetime.utcnow()
        for m in unread:
            m.read_at = now
        db.commit()
    return [_message_to_dict(m, db) for m in rows]


@router.post("/{contract_id}/messages")
def send_message(
    contract_id: int,
    data: MessageCreate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    _get_contract_for_party(db, contract_id, current_user)
    if not (data.body or "").strip() and not data.attachment_url:
        raise HTTPException(status_code=400, detail="A message needs text or an attachment")
    message = ContractMessage(
        contract_id=contract_id,
        sender_id=current_user.id,
        body=(data.body or "").strip() or None,
        attachment_url=data.attachment_url,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _message_to_dict(message, db)


@router.get("/{contract_id}/messages/unread-count")
def unread_count(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    _get_contract_for_party(db, contract_id, current_user)
    count = (
        db.query(ContractMessage)
        .filter(
            ContractMessage.contract_id == contract_id,
            ContractMessage.sender_id != current_user.id,
            ContractMessage.read_at.is_(None),
        )
        .count()
    )
    return {"count": count}
