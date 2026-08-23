"""Messaging.

Threads are Conversations between exactly two accounts. Most are attached to
a contract, but people also need to talk before any contract exists — a client
sounding out whether a freelancer is even free — so a conversation can stand
on its own.

The contract-scoped routes are kept as they were, since the contract page
addresses a thread by contract id and shouldn't have to know a conversation id.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.database import (
    get_db, Contract, ContractMessage, Conversation, Project, User,
)
from app.routers.auth import require_marketplace_beta
from app.services import notifications as notif

router = APIRouter(tags=["marketplace-chat"])


class MessageCreate(BaseModel):
    body: Optional[str] = None
    attachment_url: Optional[str] = None


class StartConversation(BaseModel):
    user_id: int


def _get_contract_for_party(db: Session, contract_id: int, user: User) -> Contract:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.id not in (contract.client_id, contract.freelancer_id) and user.role != "admin":
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


def get_or_create_conversation(db: Session, a_id: int, b_id: int, contract_id: int | None = None) -> Conversation:
    """Pairs are stored low-id-first so (a,b) and (b,a) can't both exist."""
    a, b = sorted((a_id, b_id))
    q = db.query(Conversation).filter(Conversation.user_a_id == a, Conversation.user_b_id == b)
    q = q.filter(Conversation.contract_id == contract_id) if contract_id else q.filter(Conversation.contract_id.is_(None))
    convo = q.first()
    if not convo:
        convo = Conversation(user_a_id=a, user_b_id=b, contract_id=contract_id)
        db.add(convo)
        db.flush()
    return convo


def _conversation_for_party(db: Session, conversation_id: int, user: User) -> Conversation:
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo or user.id not in (convo.user_a_id, convo.user_b_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return convo


def _avatar(u: User | None) -> str:
    if not u or not u.profile_json:
        return ""
    try:
        return json.loads(u.profile_json).get("avatar", "") or ""
    except Exception:
        return ""


def _message_to_dict(m: ContractMessage, db: Session) -> dict:
    sender = db.query(User).filter(User.id == m.sender_id).first()
    return {
        "id": m.id,
        "contract_id": m.contract_id,
        "conversation_id": m.conversation_id,
        "sender_id": m.sender_id,
        "sender_name": sender.name if sender else None,
        "body": m.body,
        "attachment_url": m.attachment_url,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _send(db: Session, convo: Conversation, sender: User, data: MessageCreate) -> dict:
    if not (data.body or "").strip() and not data.attachment_url:
        raise HTTPException(status_code=400, detail="A message needs text or an attachment")
    message = ContractMessage(
        contract_id=convo.contract_id,
        conversation_id=convo.id,
        sender_id=sender.id,
        body=(data.body or "").strip() or None,
        attachment_url=data.attachment_url,
    )
    db.add(message)
    db.flush()

    other_id = convo.user_b_id if sender.id == convo.user_a_id else convo.user_a_id
    preview = (message.body or "Sent an attachment")[:90]
    notif.notify(db, other_id, notif.MESSAGE_RECEIVED,
                 f"Message from {sender.name}", preview, "/messages")

    db.commit()
    db.refresh(message)
    return _message_to_dict(message, db)


def _read_thread(db: Session, convo: Conversation, user: User) -> list[dict]:
    rows = (
        db.query(ContractMessage)
        .filter(ContractMessage.conversation_id == convo.id)
        .order_by(ContractMessage.created_at.asc())
        .all()
    )
    unread = [m for m in rows if m.sender_id != user.id and m.read_at is None]
    if unread:
        now = datetime.utcnow()
        for m in unread:
            m.read_at = now
        db.commit()
    return [_message_to_dict(m, db) for m in rows]


# ── totals & inbox ───────────────────────────────────────────────────────
@router.get("/messages/unread-count")
def total_unread(
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Unread across every thread, for the sidebar badge."""
    count = (
        db.query(ContractMessage)
        .join(Conversation, Conversation.id == ContractMessage.conversation_id)
        .filter(
            or_(Conversation.user_a_id == current_user.id, Conversation.user_b_id == current_user.id),
            ContractMessage.sender_id != current_user.id,
            ContractMessage.read_at.is_(None),
        )
        .count()
    )
    return {"count": count}


@router.get("/conversations")
def list_conversations(
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """One row per thread — the inbox behind the Messages page. Newest first,
    with threads that have no messages yet after them."""
    convos = (
        db.query(Conversation)
        .filter(or_(Conversation.user_a_id == current_user.id, Conversation.user_b_id == current_user.id))
        .all()
    )
    rows = []
    for cv in convos:
        other_id = cv.user_b_id if current_user.id == cv.user_a_id else cv.user_a_id
        other = db.query(User).filter(User.id == other_id).first()
        last = (
            db.query(ContractMessage)
            .filter(ContractMessage.conversation_id == cv.id)
            .order_by(ContractMessage.created_at.desc())
            .first()
        )
        unread = (
            db.query(ContractMessage)
            .filter(
                ContractMessage.conversation_id == cv.id,
                ContractMessage.sender_id != current_user.id,
                ContractMessage.read_at.is_(None),
            )
            .count()
        )
        contract = db.query(Contract).filter(Contract.id == cv.contract_id).first() if cv.contract_id else None
        project = db.query(Project).filter(Project.id == contract.project_id).first() if contract else None

        rows.append({
            "conversation_id": cv.id,
            "contract_id": cv.contract_id,
            "project_title": project.title if project else "Direct message",
            "contract_status": contract.status if contract else None,
            "other_party_id": other_id,
            "other_party_name": other.name if other else None,
            "other_party_avatar": _avatar(other),
            "other_party_username": (other.username if other and other.is_public else None),
            "viewer_role": (
                ("client" if current_user.id == contract.client_id else "freelancer")
                if contract else "peer"
            ),
            "last_message": (last.body or ("📎 Attachment" if last.attachment_url else "")) if last else None,
            "last_message_at": last.created_at.isoformat() if last and last.created_at else None,
            "last_message_mine": (last.sender_id == current_user.id) if last else None,
            "unread": unread,
        })
    rows.sort(key=lambda r: r["last_message_at"] or "", reverse=True)
    return rows


@router.post("/conversations/start")
def start_conversation(
    data: StartConversation,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    """Open (or reopen) a direct thread with someone — the Message button on a
    profile. Idempotent: messaging the same person twice reuses the thread."""
    if data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't message yourself")
    other = db.query(User).filter(User.id == data.user_id, User.is_active.is_(True)).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    convo = get_or_create_conversation(db, current_user.id, other.id)
    db.commit()
    return {"conversation_id": convo.id, "other_party_name": other.name}


# ── a thread by conversation id (direct messages) ────────────────────────
@router.get("/conversations/{conversation_id}/messages")
def list_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    convo = _conversation_for_party(db, conversation_id, current_user)
    return _read_thread(db, convo, current_user)


@router.post("/conversations/{conversation_id}/messages")
def send_conversation_message(
    conversation_id: int,
    data: MessageCreate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    convo = _conversation_for_party(db, conversation_id, current_user)
    return _send(db, convo, current_user, data)


# ── the same thread addressed by contract id (contract page) ─────────────
@router.get("/contracts/{contract_id}/messages")
def list_messages(
    contract_id: int,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    contract = _get_contract_for_party(db, contract_id, current_user)
    convo = get_or_create_conversation(db, contract.client_id, contract.freelancer_id, contract.id)
    db.commit()
    return _read_thread(db, convo, current_user)


@router.post("/contracts/{contract_id}/messages")
def send_message(
    contract_id: int,
    data: MessageCreate,
    current_user: User = Depends(require_marketplace_beta),
    db: Session = Depends(get_db),
):
    contract = _get_contract_for_party(db, contract_id, current_user)
    convo = get_or_create_conversation(db, contract.client_id, contract.freelancer_id, contract.id)
    return _send(db, convo, current_user, data)


@router.get("/contracts/{contract_id}/messages/unread-count")
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
