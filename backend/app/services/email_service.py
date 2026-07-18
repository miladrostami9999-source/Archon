import os
from typing import Optional

import httpx

RESEND_API_URL = "https://api.resend.com/emails"


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    attachments: Optional[list[dict]] = None,
    from_name: Optional[str] = None,
) -> dict:
    """Send an email via Resend's HTTPS API.

    Used instead of raw SMTP because cloud hosts like Railway commonly
    block outbound SMTP ports (25/465/587) to prevent spam abuse — HTTPS
    on port 443 is never blocked.
    """
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not from_email:
        raise RuntimeError("RESEND_API_KEY / RESEND_FROM_EMAIL not configured on server")

    sender_name = from_name or os.getenv("SMTP_SENDER_NAME", "Armila Design")
    payload = {
        "from": f"{sender_name} <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }
    if text_body:
        payload["text"] = text_body
    if attachments:
        # Resend expects [{"filename": ..., "content": <base64 string, no data: prefix>}]
        payload["attachments"] = attachments

    resp = httpx.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Resend API error {resp.status_code}: {resp.text}")
    return resp.json()
