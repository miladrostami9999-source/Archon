from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, class_mapper
from sqlalchemy import or_
from typing import Optional
import smtplib
import os
import json
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from app.models.database import get_db, Company, History, Note, Campaign, Contact, User, DailyTask, WeeklyReport
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


@router.delete("/{company_id}/notes/{note_id}")
def delete_note(company_id: int, note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.company_id == company_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}


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
    """
    AI Research — searches the web for the real company, verifies it,
    and fills in any missing fields (email, website, linkedin, instagram,
    industry, company_size) from what it actually finds. The opportunity
    score is computed from these real, verified fields — not guessed.
    Existing values the user already entered are never overwritten.
    """
    from app.services.claude import research_company

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company_dict = to_dict(company)
    try:
        result = research_company(company_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI research failed: {str(e)}")

    # Only fill fields that are currently empty — never overwrite user-entered data
    if not company.email and result.get("email"):
        company.email = result["email"]
    if not company.website and result.get("website"):
        company.website = result["website"]
    if not company.linkedin and result.get("linkedin"):
        company.linkedin = result["linkedin"]
    if not company.instagram and result.get("instagram"):
        company.instagram = result["instagram"]
    if not company.industry and result.get("industry"):
        company.industry = result["industry"]
    if not company.company_size and result.get("company_size"):
        company.company_size = result["company_size"]

    company.ai_summary = result.get("summary", "")

    # Score comes from AI's grounded assessment when it found real data,
    # falling back to the rule-based calculator if the search came up empty.
    if result.get("verified") and isinstance(result.get("score"), (int, float)):
        company.opportunity_score = max(0.0, min(100.0, float(result["score"])))
    else:
        company.opportunity_score = calculate_score(company)

    company.last_checked = datetime.utcnow()
    db.commit()
    db.refresh(company)

    return {
        "summary": company.ai_summary,
        "verified": result.get("verified", False),
        "score_reasoning": result.get("score_reasoning", ""),
        "company": to_dict(company),
    }


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

# ─────────────────────────────────────────
# DAILY TASKS
# ─────────────────────────────────────────
from app.models.database import DailyTask

class TaskGenerateRequest(BaseModel):
    lang: str = "en"

@router.post("/tasks/generate")
def generate_tasks(data: TaskGenerateRequest, db: Session = Depends(get_db)):
    from app.services.claude import generate_daily_tasks
    companies = db.query(Company).all()
    company_list = [to_dict(c) for c in companies]

    try:
        tasks = generate_daily_tasks(company_list, lang=data.lang)
    except Exception as e:
        import traceback
        print("TASK ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    db.query(DailyTask).filter(
        DailyTask.date >= today_start
    ).delete()

    saved = []
    for t in tasks:
        task = DailyTask(
            task_type=t.get("type", "review"),
            description=f"{t.get('title', '')} — {t.get('description', '')}",
            priority=t.get("priority", 3),
            is_done=False,
            date=datetime.utcnow()
        )
        db.add(task)
        db.flush()
        saved.append({
            "id": task.id,
            "task_type": t.get("type"),
            "priority": t.get("priority"),
            "title": t.get("title"),
            "description": t.get("description"),
            "is_done": False
        })

    db.commit()
    return saved


@router.get("/tasks/today")
def get_today_tasks(db: Session = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tasks = db.query(DailyTask).filter(
        DailyTask.date >= today_start
    ).order_by(DailyTask.priority).all()
    return [to_dict(t) for t in tasks]


@router.patch("/tasks/{task_id}/done")
def mark_task_done(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_done = not task.is_done
    db.commit()
    return to_dict(task)

class PersonalTaskCreate(BaseModel):
    title: str
    description: str = ""

@router.post("/tasks/personal")
def add_personal_task(data: PersonalTaskCreate, db: Session = Depends(get_db)):
    task = DailyTask(
        task_type="personal",
        description=data.description,
        priority=99,
        is_done=False,
        date=datetime.utcnow()
    )
    db.add(task)
    db.flush()

    result = to_dict(task)
    result['title'] = data.title
    result['description'] = data.description

    db.commit()
    return result

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}

    # ─────────────────────────────────────────
# EXPORT CSV
# ─────────────────────────────────────────
from fastapi.responses import StreamingResponse
import csv
import io

@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.opportunity_score.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'Name', 'Domain', 'Website', 'Email', 'Country', 'City',
        'Industry', 'Size', 'LinkedIn', 'Instagram', 'Status',
        'Heat Level', 'Score', 'Tags', 'AI Summary', 'Updated At'
    ])

    # Rows
    for c in companies:
        writer.writerow([
            c.name, c.domain, c.website, c.email, c.country, c.city,
            c.industry, c.company_size, c.linkedin, c.instagram, c.status,
            c.heat_level, c.opportunity_score, c.tags, c.ai_summary, c.updated_at
        ])

    output.seek(0)
    filename = f"archon_export_{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ─────────────────────────────────────────
# WEEKLY AI REPORT — with server-side 7-day lock
# ─────────────────────────────────────────
import json as _json
from app.models.database import WeeklyReport

REPORT_LOCK_DAYS = 7

class ReportRequest(BaseModel):
    lang: str = "en"


def _report_status(db: Session):
    """Returns the most recent report + whether generation is currently locked."""
    last = db.query(WeeklyReport).order_by(WeeklyReport.generated_at.desc()).first()
    if not last:
        return {"locked": False, "report": None, "generated_at": None, "next_available_at": None}

    elapsed = datetime.utcnow() - last.generated_at
    remaining = timedelta(days=REPORT_LOCK_DAYS) - elapsed
    locked = remaining.total_seconds() > 0

    return {
        "locked": locked,
        "report": _json.loads(last.report_json),
        "lang": last.lang,
        "generated_at": last.generated_at.isoformat(),
        "next_available_at": (last.generated_at + timedelta(days=REPORT_LOCK_DAYS)).isoformat() if locked else None,
    }


@router.get("/report/weekly/status")
def get_weekly_report_status(db: Session = Depends(get_db)):
    """Frontend calls this on page load to know whether to show the last report
    and whether the Generate button should be locked."""
    return _report_status(db)


@router.post("/report/weekly")
def generate_weekly_report(request: ReportRequest, db: Session = Depends(get_db)):
    from app.services.claude import generate_weekly_report as gen_report

    status = _report_status(db)
    if status["locked"]:
        raise HTTPException(
            status_code=429,
            detail=f"Weekly report already generated. Next one available after {status['next_available_at']}."
        )

    companies = db.query(Company).all()
    companies_list = [to_dict(c) for c in companies]

    status_counts = {}
    for c in companies_list:
        s = c.get('status', 'new')
        status_counts[s] = status_counts.get(s, 0) + 1

    campaigns = db.query(Campaign).all()
    emails_sent = len([c for c in campaigns if c.status in ['sent', 'replied']])
    emails_replied = len([c for c in campaigns if c.status == 'replied'])
    reply_rate = round((emails_replied / emails_sent * 100)) if emails_sent > 0 else 0
    favorites = len([c for c in companies_list if c.get('is_favorite')])

    data = {
        "total": len(companies_list),
        "favorites": favorites,
        "status_counts": status_counts,
        "emails_sent": emails_sent,
        "emails_replied": emails_replied,
        "reply_rate": reply_rate,
        "companies": companies_list,
    }

    report = gen_report(data, lang=request.lang)

    # Persist so the lock survives refresh, logout, and works across devices
    saved = WeeklyReport(report_json=_json.dumps(report), lang=request.lang)
    db.add(saved)
    db.commit()

    return report


# ─────────────────────────────────────────
# MARKET INTELLIGENCE MAP
# ─────────────────────────────────────────
@router.get("/map/data")
def get_map_data(db: Session = Depends(get_db)):
    from sqlalchemy import func
    companies = db.query(Company).filter(Company.country != None).all()
    
    country_data = {}
    for c in companies:
        country = c.country.strip()
        if not country:
            continue
        if country not in country_data:
            country_data[country] = {
                "name": country,
                "count": 0,
                "total_score": 0,
                "companies": [],
                "statuses": {},
                "hot": 0,
            }
        d = country_data[country]
        d["count"] += 1
        d["total_score"] += c.opportunity_score or 0
        d["companies"].append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "score": c.opportunity_score,
            "heat_level": c.heat_level,
            "industry": c.industry,
        })
        d["statuses"][c.status] = d["statuses"].get(c.status, 0) + 1
        if c.heat_level == "hot":
            d["hot"] += 1

    result = []
    for country, d in country_data.items():
        result.append({
            "name": d["name"],
            "count": d["count"],
            "avg_score": round(d["total_score"] / d["count"]) if d["count"] > 0 else 0,
            "hot": d["hot"],
            "statuses": d["statuses"],
            "companies": sorted(d["companies"], key=lambda x: x["score"], reverse=True),
        })

    return sorted(result, key=lambda x: x["count"], reverse=True)


# ─────────────────────────────────────────
# DIRECT EMAIL SENDING (SMTP)
# ─────────────────────────────────────────
class EmailAttachment(BaseModel):
    filename: str
    content_base64: str  # base64-encoded file content
    mime_type: str = "application/octet-stream"

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    campaign_id: Optional[int] = None
    attachments: Optional[list[EmailAttachment]] = None

@router.post("/send-email")
def send_email(req: SendEmailRequest, db: Session = Depends(get_db)):
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_APP_PASSWORD")
    sender_name = os.getenv("SMTP_SENDER_NAME", "Armila Design")

    if not smtp_email or not smtp_password:
        raise HTTPException(status_code=500, detail="Email credentials not configured on server")

    if not req.to_email or "@" not in req.to_email:
        raise HTTPException(status_code=400, detail="Invalid recipient email")

    try:
        # Outer container: mixed (allows attachments alongside the message body)
        msg = MIMEMultipart("mixed")
        msg["From"] = f"{sender_name} <{smtp_email}>"
        msg["To"] = req.to_email
        msg["Subject"] = req.subject

        # Inner container: alternative (plain text + HTML) — critical for spam filters
        body_container = MIMEMultipart("alternative")

        plain_body = req.body  # already plain text from the editable textarea
        html_body = req.body.replace("\n", "<br>")

        body_container.attach(MIMEText(plain_body, "plain", "utf-8"))
        body_container.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(body_container)

        # Attachments (e.g. portfolio PDF, images)
        if req.attachments:
            for att in req.attachments:
                try:
                    file_data = base64.b64decode(att.content_base64)
                except Exception:
                    raise HTTPException(status_code=400, detail=f"Invalid attachment data: {att.filename}")
                part = MIMEApplication(file_data, Name=att.filename)
                part["Content-Disposition"] = f'attachment; filename="{att.filename}"'
                msg.attach(part)

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, req.to_email, msg.as_string())

    except HTTPException:
        raise
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=500, detail="Email authentication failed. Check App Password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    if req.campaign_id:
        campaign = db.query(Campaign).filter(Campaign.id == req.campaign_id).first()
        if campaign:
            campaign.status = "sent"
            campaign.sent_at = datetime.utcnow()
            db.commit()

    return {"message": "Email sent successfully", "to": req.to_email}


# ─────────────────────────────────────────
# MANUAL / AUTOMATIC BACKUP
# ─────────────────────────────────────────
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backups")

# Tables included in every backup. Password reset tokens are intentionally
# excluded — they're short-lived and shouldn't be restored across backups.
BACKUP_MODELS = [
    ("users", User),
    ("companies", Company),
    ("contacts", Contact),
    ("notes", Note),
    ("campaigns", Campaign),
    ("history", History),
    ("daily_tasks", DailyTask),
    ("weekly_reports", WeeklyReport),
]


def _row_to_dict(row):
    result = {}
    for col in row.__table__.columns:
        value = getattr(row, col.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        result[col.name] = value
    return result


@router.post("/backup/run")
def run_backup(db: Session = Depends(get_db)):
    os.makedirs(BACKUP_DIR, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"archon_backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)

    backup_data = {
        "created_at": datetime.utcnow().isoformat(),
        "tables": {},
    }

    row_counts = {}
    for table_name, model in BACKUP_MODELS:
        rows = db.query(model).all()
        backup_data["tables"][table_name] = [_row_to_dict(r) for r in rows]
        row_counts[table_name] = len(rows)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2, ensure_ascii=False)

    size_kb = round(os.path.getsize(filepath) / 1024, 1)

    return {
        "message": "Backup completed successfully",
        "filename": filename,
        "created_at": backup_data["created_at"],
        "size_kb": size_kb,
        "row_counts": row_counts,
    }


@router.get("/backup/list")
def list_backups():
    if not os.path.isdir(BACKUP_DIR):
        return []

    backups = []
    for fname in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(BACKUP_DIR, fname)
        stat = os.stat(fpath)
        backups.append({
            "filename": fname,
            "size_kb": round(stat.st_size / 1024, 1),
            "created_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
        })
    return backups[:20]  # most recent 20
