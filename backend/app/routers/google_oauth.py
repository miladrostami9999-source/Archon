"""Send-only Gmail connect flow. Kept out of auth.py (already large) since
this is a self-contained, optional feature — a user works fine without ever
touching it, and the whole app works fine without GOOGLE_CLIENT_ID set."""
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db, User
from app.routers.auth import get_current_user, create_token
from app.services.crypto import encrypt
from app.services.gmail_service import GMAIL_SCOPES

router = APIRouter(prefix="/auth/google", tags=["google-oauth"])


def _redirect_uri() -> str:
    base = os.getenv("BACKEND_URL", "").rstrip("/")
    if not base:
        raise HTTPException(status_code=500, detail="BACKEND_URL is not configured on the server")
    return f"{base}/auth/google/callback"


def _flow() -> Flow:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Gmail connect isn't configured on this server yet.")
    return Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GMAIL_SCOPES,
        redirect_uri=_redirect_uri(),
    )


@router.get("/authorize")
def authorize(current_user: User = Depends(get_current_user)):
    """Returns the Google consent URL. The frontend redirects the browser
    here; the user id rides through as `state` (a signed JWT, reusing the
    same mechanism as login) so the callback knows who to attach the
    connection to without needing a session on this route."""
    flow = _flow()
    state = create_token({"user_id": current_user.id, "purpose": "google_oauth_state"})
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",  # forces a refresh_token even on a re-connect
        state=state,
    )
    return {"authorize_url": auth_url}


@router.get("/callback")
def callback(code: str, state: str, db: Session = Depends(get_db)):
    from app.routers.auth import decode_token

    payload = decode_token(state)
    if not payload or payload.get("purpose") != "google_oauth_state":
        raise HTTPException(status_code=400, detail="This connect link expired — try again from your profile.")

    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    if not creds.refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google didn't return a refresh token — disconnect any prior grant in your Google account and try again.",
        )

    import httpx
    userinfo = httpx.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {creds.token}"},
    ).json()

    user.google_refresh_token_encrypted = encrypt(creds.refresh_token)
    user.google_email = userinfo.get("email")
    user.google_connected_at = datetime.utcnow()
    db.commit()

    frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
    return RedirectResponse(f"{frontend}/profile?gmail=connected" if frontend else "/")


@router.post("/disconnect")
def disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.google_refresh_token_encrypted = None
    current_user.google_email = None
    current_user.google_connected_at = None
    db.commit()
    return {"message": "Gmail disconnected"}
