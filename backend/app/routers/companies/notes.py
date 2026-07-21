from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Note, User
from app.routers.auth import get_current_user
from .schemas import NoteCreate, NoteUpdate
from .utils import to_dict

router = APIRouter()


@router.get("/{company_id}/notes")
def get_notes(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notes = db.query(Note).filter(
        Note.company_id == company_id,
        Note.user_id == current_user.id,
    ).order_by(Note.pinned.desc(), Note.created_at.desc()).all()
    return [to_dict(n) for n in notes]


@router.post("/{company_id}/notes")
def add_note(company_id: int, data: NoteCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = Note(company_id=company_id, user_id=current_user.id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return to_dict(note)


@router.patch("/{company_id}/notes/{note_id}")
def update_note(company_id: int, note_id: int, data: NoteUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.company_id == company_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.pinned = data.pinned
    db.commit()
    return to_dict(note)


@router.delete("/{company_id}/notes/{note_id}")
def delete_note(company_id: int, note_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.company_id == company_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}
