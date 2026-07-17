import base64
import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Campaign
from .schemas import SendEmailRequest

router = APIRouter()


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
