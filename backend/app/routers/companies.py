from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, class_mapper
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.models.database import get_db, Company, History, Note

router = APIRouter(prefix="/companies", tags=["companies"])


# ─────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────
def to_dict(obj):
    result = {}
    for column in class_mapper(obj.__class__).columns:
        value = getattr(obj, column.key)
        if hasattr(value, 'isoformat'):
            value = value.isoformat()
        result[column.key] = value
    return result


# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────
class CompanyCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    is_favorite: Optional[bool] = None
    heat_level: Optional[str] = None
    ai_summary: Optional[str] = None
    opportunity_score: Optional[float] = None

class NoteCreate(BaseModel):
    content: str
    language: str = "en"
    pinned: bool = False

class NoteUpdate(BaseModel):
    pinned: bool


# ─────────────────────────────────────────
# GET ALL
# ─────────────────────────────────────────
@router.get("/")
def get_companies(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    country: Optional[str] = None,
    industry: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    heat_level: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Company)
    if status:
        query = query.filter(Company.status == status)
    if country:
        query = query.filter(Company.country == country)
    if industry:
        query = query.filter(Company.industry == industry)
    if is_favorite is not None:
        query = query.filter(Company.is_favorite == is_favorite)
    if heat_level:
        query = query.filter(Company.heat_level == heat_level)
    if search:
        query = query.filter(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.country.ilike(f"%{search}%"),
                Company.city.ilike(f"%{search}%"),
                Company.industry.ilike(f"%{search}%"),
            )
        )
    total = query.count()
    companies = query.order_by(Company.opportunity_score.desc()).offset(skip).limit(limit).all()
    return {"total": total, "companies": [to_dict(c) for c in companies]}


# ─────────────────────────────────────────
# GET ONE
# ─────────────────────────────────────────
@router.get("/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return to_dict(company)


# ─────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────
@router.post("/")
def create_company(data: CompanyCreate, db: Session = Depends(get_db)):
    if data.domain:
        existing = db.query(Company).filter(Company.domain == data.domain).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Company with domain '{data.domain}' already exists (ID: {existing.id})"
            )
    company = Company(**data.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    history = History(
        company_id=company.id,
        event_type="discovered",
        description="Company added manually"
    )
    db.add(history)
    db.commit()
    return to_dict(company)


# ─────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────
@router.patch("/{company_id}")
def update_company(company_id: int, data: CompanyUpdate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)
    company.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(company)
    return to_dict(company)


# ─────────────────────────────────────────
# UPDATE STATUS
# ─────────────────────────────────────────
@router.patch("/{company_id}/status")
def update_status(company_id: int, status: str, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    old_status = company.status
    company.status = status
    company.updated_at = datetime.utcnow()
    history = History(
        company_id=company_id,
        event_type="status_changed",
        description=f"Status: {old_status} → {status}"
    )
    db.add(history)
    db.commit()
    return {"id": company_id, "status": status}


# ─────────────────────────────────────────
# TOGGLE FAVORITE
# ─────────────────────────────────────────
@router.patch("/{company_id}/favorite")
def toggle_favorite(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_favorite = not company.is_favorite
    db.commit()
    return {"id": company_id, "is_favorite": company.is_favorite}


# ─────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────
@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
    return {"message": f"Company {company_id} deleted"}


# ─────────────────────────────────────────
# NOTES
# ─────────────────────────────────────────
@router.get("/{company_id}/notes")
def get_notes(company_id: int, db: Session = Depends(get_db)):
    notes = db.query(Note).filter(
        Note.company_id == company_id
    ).order_by(Note.pinned.desc(), Note.created_at.desc()).all()
    return [to_dict(n) for n in notes]

@router.post("/{company_id}/notes")
def add_note(company_id: int, data: NoteCreate, db: Session = Depends(get_db)):
    note = Note(company_id=company_id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return to_dict(note)

@router.patch("/{company_id}/notes/{note_id}")
def update_note(company_id: int, note_id: int, data: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.company_id == company_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.pinned = data.pinned
    db.commit()
    return to_dict(note)


# ─────────────────────────────────────────
# HISTORY
# ─────────────────────────────────────────
@router.get("/{company_id}/history")
def get_history(company_id: int, db: Session = Depends(get_db)):
    items = db.query(History).filter(
        History.company_id == company_id
    ).order_by(History.created_at.desc()).all()
    return [to_dict(h) for h in items]