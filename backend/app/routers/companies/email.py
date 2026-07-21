import base64
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Campaign, User
from app.routers.auth import get_current_user
from app.services.email_service import send_email as resend_send_email
from .schemas import SendEmailRequest

router = APIRouter()

MAX_ATTACHMENTS_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB total, matches Gmail's own limit headroom


@router.post("/send-email")
def send_email(req: SendEmailRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not req.to_email or "@" not in req.to_email:
        raise HTTPException(status_code=400, detail="Invalid recipient email")

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

    if req.campaign_id:
        campaign = db.query(Campaign).filter(
            Campaign.id == req.campaign_id, Campaign.user_id == current_user.id
        ).first()
        if campaign:
            campaign.status = "sent"
            campaign.sent_at = datetime.utcnow()
            db.commit()

    return {"message": "Email sent successfully", "to": req.to_email}
