from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Contact, User
from app.routers.auth import get_current_user, require_admin
from .schemas import ContactCreate
from .utils import to_dict

router = APIRouter()

# Contacts are objective facts about a company (who works there), so they live
# in the shared catalog: everyone reads them, but only an admin may change them
# — a member editing them would change what every other account sees.


@router.get("/{company_id}/contacts")
def get_contacts(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contacts = db.query(Contact).filter(
        Contact.company_id == company_id
    ).order_by(Contact.is_primary.desc()).all()
    return [to_dict(c) for c in contacts]


@router.post("/{company_id}/contacts")
def add_contact(company_id: int, data: ContactCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    contact = Contact(company_id=company_id, **data.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return to_dict(contact)


@router.delete("/{company_id}/contacts/{contact_id}")
def delete_contact(company_id: int, contact_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.company_id == company_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact deleted"}
