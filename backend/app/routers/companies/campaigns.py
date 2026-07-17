from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Company, Campaign, History
from app.services.claude import generate_email as claude_generate_email
from .schemas import EmailRequest
from .utils import to_dict

router = APIRouter()


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
