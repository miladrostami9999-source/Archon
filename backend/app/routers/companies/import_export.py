import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models.database import get_db, Company, History, User
from app.routers.auth import get_current_user, require_admin
from .utils import calculate_score

router = APIRouter()


@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), admin: User = Depends(require_admin), db: Session = Depends(get_db)):
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
                user_id=admin.id,
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


@router.get("/export/csv")
def export_csv(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
