import base64
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Campaign, User
from app.routers.auth import require_active_plan, require_admin
from app.services.email_service import send_email as resend_send_email
from app.services import reputation
from .schemas import SendEmailRequest

router = APIRouter()

MAX_ATTACHMENTS_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB total, matches Gmail's own limit headroom


@router.post("/send-email")
def send_email(req: SendEmailRequest, current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    if not req.to_email or "@" not in req.to_email:
        raise HTTPException(status_code=400, detail="Invalid recipient email")

    from app.services.limits import can_send_email, get_plan_limit
    if not can_send_email(db, current_user):
        cap = get_plan_limit(db, current_user.plan)["max_emails_per_month"]
        raise HTTPException(status_code=403, detail=f"You've used all {cap} email sends for this period. Upgrade or wait for it to reset.")

    plain_body = req.body  # already plain text from the editable textarea
    html_body = req.body.replace("\n", "<br>")

    resend_attachments = None
    if req.attachments:
        total_size = 0
        resend_attachments = []
        for att in req.attachments:
            try:
                file_data = base64.b64decode(att.content_base64)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid attachment data: {att.filename}")
            total_size += len(file_data)
            resend_attachments.append({"filename": att.filename, "content": att.content_base64})

        if total_size > MAX_ATTACHMENTS_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Attachments too large: {round(total_size / 1024 / 1024, 1)}MB "
                       f"(limit is {MAX_ATTACHMENTS_SIZE_BYTES // 1024 // 1024}MB total)"
            )

    # A connected Gmail account is tried first (so replies land in the user's
    # own inbox), but only when there's nothing it can't carry — it doesn't
    # support attachments today. Any Gmail failure falls back to Resend
    # rather than failing the send outright.
    sent_via_gmail = False
    if current_user.google_refresh_token_encrypted and not resend_attachments:
        try:
            from app.services.gmail_service import send_email_via_gmail
            send_email_via_gmail(current_user, req.to_email, req.subject, html_body, plain_body)
            sent_via_gmail = True
        except Exception as e:
            print(f"⚠️  Gmail send failed for user {current_user.id}, falling back to Resend: {e}")

    if not sent_via_gmail:
        try:
            resend_send_email(
                to_email=req.to_email,
                subject=req.subject,
                html_body=html_body,
                text_body=plain_body,
                attachments=resend_attachments,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    campaign = None
    if req.campaign_id:
        campaign = db.query(Campaign).filter(
            Campaign.id == req.campaign_id, Campaign.user_id == current_user.id
        ).first()
        if campaign:
            campaign.status = "sent"
            campaign.sent_at = datetime.utcnow()

    reputation.log_event(db, current_user.id, reputation.SENT, campaign.id if campaign else None)
    db.commit()

    return {"message": "Email sent successfully", "to": req.to_email}


@router.get("/email/reputation")
def my_reputation(current_user: User = Depends(require_active_plan), db: Session = Depends(get_db)):
    return reputation.score_for_user(db, current_user.id)


@router.get("/admin/reputation/{user_id}")
def user_reputation(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return reputation.score_for_user(db, user_id)


@router.post("/email/{campaign_id}/mark-bounced")
def mark_bounced(campaign_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    reputation.log_event(db, campaign.user_id, reputation.BOUNCED_MANUAL, campaign.id)
    db.commit()
    return {"message": "Marked as bounced"}
