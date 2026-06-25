from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, class_mapper
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.models.database import get_db, Company, History, Note, Campaign, Contact
from app.services.claude import generate_email as claude_generate_email
from app.services.claude import generate_summary as claude_generate_summary

router = APIRouter(prefix="/companies", tags=["companies"])


def to_dict(obj):
    result = {}
    for column in class_mapper(obj.__class__).columns:
        value = getattr(obj, column.key)
        if hasattr(value, 'isoformat'):
            value = value.isoformat()
        result[column.key] = value
    return result


def calculate_score(company) -> float:
    score = 0.0
    if company.email:
        score += 25
    if company.website:
        score += 10
    if company.linkedin:
        score += 10
    size_scores = {"solo": 15, "small": 20, "medium": 15, "large": 10}
    score += size_scores.get(company.company_size or "", 0)
    relevant = ["CGI", "Visualization", "Architecture", "Interior Design", "Real Estate", "Animation"]
    if company.industry in relevant:
        score += 20
    if company.ai_summary:
        score += 5
    return min(score, 100.0)


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

class EmailRequest(BaseModel):
    tone: str = "friendly"

class ContactCreate(BaseModel):
    full_name: str
    role: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    is_primary: bool = False

class SearchRequest(BaseModel):
    query: str


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


@router.get("/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return to_dict(company)


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
    company.opportunity_score = calculate_score(company)
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


@router.patch("/{company_id}")
def update_company(company_id: int, data: CompanyUpdate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)
    company.opportunity_score = calculate_score(company)
    company.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(company)
    return to_dict(company)


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
        description=f"Status: {old_status} -> {status}"
    )
    db.add(history)
    db.commit()
    return {"id": company_id, "status": status}


@router.patch("/{company_id}/favorite")
def toggle_favorite(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_favorite = not company.is_favorite
    db.commit()
    return {"id": company_id, "is_favorite": company.is_favorite}


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
    return {"message": f"Company {company_id} deleted"}


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


@router.get("/{company_id}/history")
def get_history(company_id: int, db: Session = Depends(get_db)):
    items = db.query(History).filter(
        History.company_id == company_id
    ).order_by(History.created_at.desc()).all()
    return [to_dict(h) for h in items]


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


@router.get("/{company_id}/campaigns")
def get_campaigns(company_id: int, db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(
        Campaign.company_id == company_id
    ).order_by(Campaign.created_at.desc()).all()
    return [to_dict(c) for c in campaigns]


@router.patch("/{company_id}/campaigns/{campaign_id}")
def update_campaign(company_id: int, campaign_id: int, status: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.company_id == company_id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = status
    if status == "sent":
        campaign.sent_at = datetime.utcnow()
    elif status == "replied":
        campaign.replied_at = datetime.utcnow()
    db.commit()
    history = History(
        company_id=company_id,
        event_type="email_" + status,
        description=f"Email '{campaign.subject}' marked as {status}"
    )
    db.add(history)
    db.commit()
    return to_dict(campaign)


@router.post("/{company_id}/generate-email")
def gen_email(company_id: int, data: EmailRequest, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company_dict = to_dict(company)
    try:
        result = claude_generate_email(company_dict, data.tone)
    except Exception as e:
        import traceback
        print("EMAIL ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    campaign = Campaign(
        company_id=company_id,
        subject=result["subject"],
        body=result["body"],
        tone=data.tone,
        status="draft"
    )
    db.add(campaign)
    history = History(
        company_id=company_id,
        event_type="email_generated",
        description=f"Email generated with tone: {data.tone}"
    )
    db.add(history)
    db.commit()
    return result


@router.post("/{company_id}/generate-summary")
def gen_summary(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company_dict = to_dict(company)
    try:
        summary = claude_generate_summary(company_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    company.ai_summary = summary
    company.opportunity_score = calculate_score(company)
    db.commit()
    return {"summary": summary}


@router.post("/recalculate-scores")
def recalculate_scores(db: Session = Depends(get_db)):
    companies = db.query(Company).all()
    for company in companies:
        company.opportunity_score = calculate_score(company)
    db.commit()
    return {"message": f"Recalculated scores for {len(companies)} companies"}


@router.post("/search/smart")
def smart_search(data: SearchRequest, db: Session = Depends(get_db)):
    from app.services.claude import smart_search as claude_smart_search
    companies = db.query(Company).all()
    company_list = [to_dict(c) for c in companies]
    try:
        result_ids = claude_smart_search(data.query, company_list)
        filtered = [c for c in company_list if c['id'] in result_ids]
        return {"companies": filtered, "total": len(filtered), "query": data.query}
    except Exception as e:
        search = data.query.lower()
        filtered = [c for c in company_list if
            search in (c.get('name') or '').lower() or
            search in (c.get('country') or '').lower() or
            search in (c.get('industry') or '').lower() or
            search in (c.get('city') or '').lower()
        ]
        return {"companies": filtered, "total": len(filtered), "query": data.query}


@router.get("/analytics/summary")
def get_analytics(db: Session = Depends(get_db)):
    from sqlalchemy import func
    total = db.query(Company).count()
    statuses = ["new", "reviewed", "ready", "sent", "waiting", "replied", "meeting", "client", "archive"]
    status_counts = {}
    for s in statuses:
        status_counts[s] = db.query(Company).filter(Company.status == s).count()
    industries = db.query(
        Company.industry, func.count(Company.id)
    ).filter(Company.industry != None).group_by(Company.industry).all()
    countries = db.query(
        Company.country, func.count(Company.id)
    ).filter(Company.country != None).group_by(Company.country).order_by(func.count(Company.id).desc()).limit(10).all()
    total_emails = db.query(Campaign).count()
    sent_emails = db.query(Campaign).filter(Campaign.status == "sent").count()
    replied_emails = db.query(Campaign).filter(Campaign.status == "replied").count()
    favorites = db.query(Company).filter(Company.is_favorite == True).count()
    return {
        "total_companies": total,
        "favorites": favorites,
        "status_counts": status_counts,
        "industries": [{"name": i[0], "count": i[1]} for i in industries],
        "top_countries": [{"name": c[0], "count": c[1]} for c in countries],
        "emails": {
            "total": total_emails,
            "sent": sent_emails,
            "replied": replied_emails
        }
    }

    # ─────────────────────────────────────────
# IMPORT CSV
# ─────────────────────────────────────────
from fastapi import UploadFile, File
import csv
import io

@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))

    added = 0
    skipped = 0
    errors = []

    for row in reader:
        try:
            name = row.get('name', '').strip()
            if not name:
                continue

            domain = row.get('domain', '').strip() or None

            # duplicate check
            if domain:
                existing = db.query(Company).filter(Company.domain == domain).first()
                if existing:
                    skipped += 1
                    continue

            company = Company(
                name=name,
                domain=domain,
                website=row.get('website', '').strip() or None,
                email=row.get('email', '').strip() or None,
                country=row.get('country', '').strip() or None,
                city=row.get('city', '').strip() or None,
                industry=row.get('industry', '').strip() or None,
                company_size=row.get('company_size', '').strip() or None,
                linkedin=row.get('linkedin', '').strip() or None,
                instagram=row.get('instagram', '').strip() or None,
                tags=row.get('tags', '').strip() or None,
            )
            company.opportunity_score = calculate_score(company)
            db.add(company)
            db.flush()

            history = History(
                company_id=company.id,
                event_type="discovered",
                description="Company imported from CSV"
            )
            db.add(history)
            added += 1

        except Exception as e:
            errors.append(str(e))
            continue

    db.commit()
    return {
        "added": added,
        "skipped": skipped,
        "errors": errors,
        "message": f"✅ {added} companies imported, {skipped} skipped (duplicates)"
    }