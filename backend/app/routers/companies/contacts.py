from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Contact
from .schemas import ContactCreate
from .utils import to_dict

router = APIRouter()


@router.get("/{company_id}/contacts")
def get_contacts(company_id: int, db: Session = Depends(get_db)):
    contacts = db.query(Contact).filter(
        Contact.company_id == company_id
    ).order_by(Contact.is_primary.desc()).all()
    return [to_dict(c) for c in contacts]


@router.post("/{company_id}/contacts")
def add_contact(company_id: int, data: ContactCreate, db: Session = Depends(get_db)):
    contact = Contact(company_id=company_id, **data.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return to_dict(contact)


@router.delete("/{company_id}/contacts/{contact_id}")
def delete_contact(company_id: int, contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.company_id == company_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact deleted"}
