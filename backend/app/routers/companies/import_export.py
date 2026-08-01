import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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

            website = row.get('website', '').strip() or None
            domain = (row.get('domain', '').strip() or None)
            if not domain and website:
                domain = (
                    website.replace('https://', '').replace('http://', '')
                    .split('/')[0].strip().lower().removeprefix('www.')
                ) or None

            # Duplicate check on both keys. Domain alone missed anything
            # imported without one, which let the same studio in repeatedly
            # from different source lists.
            if domain and db.query(Company).filter(Company.domain == domain).first():
                skipped += 1
                continue
            if db.query(Company).filter(Company.name.ilike(name)).first():
                skipped += 1
                continue

            company = Company(
                name=name,
                domain=domain,
                website=website,
                email=row.get('email', '').strip() or None,
                phone=row.get('phone', '').strip() or None,
                country=row.get('country', '').strip() or None,
                city=row.get('city', '').strip() or None,
                industry=row.get('industry', '').strip() or None,
                company_size=row.get('company_size', '').strip() or None,
                linkedin=row.get('linkedin', '').strip() or None,
                instagram=row.get('instagram', '').strip() or None,
                tags=row.get('tags', '').strip() or None,
                # Optional columns from the Lead Hunter CSV, so a hunted row
                # imported by hand scores the same as one added in-app rather
                # than losing its signals and landing at the bottom.
                discovery_source=(row.get('source', '').strip() or 'csv_import')[:200],
                ai_summary=row.get('evidence', '').strip() or None,
            )
            signals = [s.strip() for s in (row.get('signals') or '').replace(',', ';').split(';') if s.strip()]
            company.signals = ", ".join(signals) if signals else None
            try:
                company.employee_count = int(float(row.get('employee_count') or 0)) or None
            except ValueError:
                company.employee_count = None
            # Keep the band consistent with the headcount so the label and the
            # score can never disagree.
            from app.services.scoring import band_for_headcount
            company.company_size = band_for_headcount(company.employee_count) or company.company_size
            try:
                style_fit = int(float(row.get('style_fit') or 0))
            except ValueError:
                style_fit = 0
            company.opportunity_score = calculate_score(company, signals=signals, style_fit=style_fit)
            db.add(company)
            db.flush()

            history = History(
                company_id=company.id,
                user_id=admin.id,
                event_type="discovered",
                description=f"Imported from CSV — {row.get('source', '').strip() or 'manual list'}"
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
    """Export the caller's own unlocked companies.

    This used to dump the entire catalog — every name, email and phone number —
    to any authenticated account, which made a free trial a one-click way to
    walk off with the whole database. A member now exports exactly what they
    unlocked and paid for; only an admin gets the full catalog.
    """
    from app.models.database import UserCompanyState
    from app.services.access import access_state

    query = db.query(Company)
    if current_user.role != "admin":
        access = access_state(db, current_user)
        if access.get("locked"):
            raise HTTPException(status_code=403, detail=access.get("message") or "Export unavailable on this plan.")
        query = query.join(
            UserCompanyState,
            (UserCompanyState.company_id == Company.id) & (UserCompanyState.user_id == current_user.id),
        )
        if access.get("countries"):
            query = query.filter(Company.country.in_(access["countries"]))
    companies = query.order_by(Company.opportunity_score.desc()).all()

    # This user's own pipeline state — the shared `companies.status` column is a
    # pre-multi-tenancy leftover and reflects whatever the original admin did.
    states = {
        s.company_id: s for s in db.query(UserCompanyState).filter(
            UserCompanyState.user_id == current_user.id
        ).all()
    }

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
        st = states.get(c.id)
        writer.writerow([
            c.name, c.domain, c.website, c.email, c.country, c.city,
            c.industry, c.company_size, c.linkedin, c.instagram,
            (st.status if st else None) or 'new',
            (st.heat_level if st else None) or 'cold',
            c.opportunity_score, (st.tags if st else None), c.ai_summary, c.updated_at
        ])

    output.seek(0)
    filename = f"archon_export_{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
