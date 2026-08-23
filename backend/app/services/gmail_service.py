"""Send an email through a user's own connected Gmail account, using the
send-only OAuth token stored on their User row. This is a swap-in
alternative to the shared Resend sender (services/email_service.py) — it's
tried first when a user is connected, with Resend as the fallback."""
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app.models.database import User
from app.services.crypto import decrypt

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def _credentials_for(user: User) -> Credentials:
    import os

    if not user.google_refresh_token_encrypted:
        raise RuntimeError("This user hasn't connected Gmail.")
    creds = Credentials(
        token=None,
        refresh_token=decrypt(user.google_refresh_token_encrypted),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=GMAIL_SCOPES,
    )
    creds.refresh(Request())
    return creds


def send_email_via_gmail(user: User, to_email: str, subject: str, html_body: str, text_body: str = None) -> None:
    creds = _credentials_for(user)
    service = build("gmail", "v1", credentials=creds)

    message = MIMEMultipart("alternative")
    message["to"] = to_email
    message["subject"] = subject
    if text_body:
        message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
