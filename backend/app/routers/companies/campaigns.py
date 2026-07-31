from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, Company, Campaign, History, User
from app.routers.auth import get_current_user, require_active_plan
from app.services.claude import generate_email as claude_generate_email
from .schemas import EmailRequest
from .utils import to_dict

router = APIRouter()


@router.get("/{company_id}/campaigns")
def get_campaigns(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(
        Campaign.company_id == company_id,
        Campaign.user_id == current_user.id,
    ).order_by(Campaign.created_at.desc()).all()
    return [to_dict(c) for c in campaigns]


@router.patch("/{company_id}/campaigns/{campaign_id}")
def update_campaign(company_id: int, campaign_id: int, status: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.company_id == company_id,
        Campaign.user_id == current_user.id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Email quota counts campaigns in sent/replied, so moving one back to draft
    # handed the user their send back — free sends on repeat. A send is a fact
    # about the world; it can only move forward to "replied".
    if campaign.status in ("sent", "replied") and status not in ("sent", "replied"):
        raise HTTPException(
            status_code=400,
            detail="A sent email can't be moved back — mark it as replied instead.",
        )

    campaign.status = status
    if status == "sent" and not campaign.sent_at:
        campaign.sent_at = datetime.utcnow()
    elif status == "replied":
        campaign.replied_at = datetime.utcnow()
        # A reply still counts against the send quota, so keep the timestamp
        # the period window is measured from.
        if not campaign.sent_at:
            campaign.sent_at = datetime.utcnow()
    db.add(History(
        company_id=company_id,
        user_id=current_user.id,
        event_type="email_" + status,
        description=f"Email '{campaign.subject}' marked as {status}",
    ))
    db.commit()
    return to_dict(campaign)


@router.post("/{company_id}/generate-email")
def gen_email(company_id: int, data: EmailRequest, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    from app.models.database import UserCompanyState
    from app.services.access import access_state
    from app.services.limits import can_send_email, get_plan_limit

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if current_user.role != "admin":
        access = access_state(db, current_user)
        if access.get("countries") and company.country not in access["countries"]:
            raise HTTPException(status_code=404, detail="Company not found")
        # Writing an email needs the company's real details, so it needs the
        # company unlocked — otherwise Claude would happily read out the name
        # and website the user hasn't paid for.
        unlocked = db.query(UserCompanyState).filter(
            UserCompanyState.user_id == current_user.id,
            UserCompanyState.company_id == company_id,
        ).first()
        if not unlocked:
            raise HTTPException(
                status_code=403,
                detail="Unlock this company first — that's what lets Archon write to them.",
            )
        # Generation is the expensive Claude call. With no sends left there's
        # nothing to do with the draft, and it was previously unlimited and free.
        if not can_send_email(db, current_user):
            cap = get_plan_limit(db, current_user.plan)["max_emails_per_month"]
            raise HTTPException(
                status_code=403,
                detail=f"You've used all {cap} emails for this period. Upgrade or wait for it to reset.",
            )

    company_dict = to_dict(company)
    try:
        result = claude_generate_email(company_dict, data.tone)
    except Exception as e:
        import traceback
        print("EMAIL ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    campaign = Campaign(
        company_id=company_id,
        user_id=current_user.id,
        subject=result["subject"],
        body=result["body"],
        tone=data.tone,
        status="draft",
    )
    db.add(campaign)
    db.add(History(
        company_id=company_id,
        user_id=current_user.id,
        event_type="email_generated",
        description=f"Email generated with tone: {data.tone}",
    ))
    db.commit()
    return result
