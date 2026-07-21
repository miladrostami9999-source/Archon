import os
import json
import re
import secrets as _secrets
from app.services.email_service import send_email
from app.services import storage
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List, Any
import bcrypt
from app.models.database import get_db, User, PasswordResetToken, WaitlistEntry

router = APIRouter(prefix="/auth", tags=["auth"])

# ─────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────
# JWT secret key — loaded from environment (.env), never hardcoded
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set in your .env file. "
        "Add a line like: JWT_SECRET_KEY=your-random-secret-here"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 60  # 60 days — extended for long gaps between sessions
bearer = HTTPBearer(auto_error=False)

# ─────────────────────────────────────────
# PLAN LIMITS
# ─────────────────────────────────────────
PLAN_LIMITS = {
    "basic": {
        "max_companies": 50,
        "max_emails_per_month": 30,
        "ai_search": False,
        "weekly_report": False,
        "market_map": False,
    },
    "pro": {
        "max_companies": 500,
        "max_emails_per_month": 300,
        "ai_search": True,
        "weekly_report": True,
        "market_map": True,
    },
    "agency": {
        "max_companies": 999999,
        "max_emails_per_month": 999999,
        "ai_search": True,
        "weekly_report": True,
        "market_map": True,
    },
}

# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    plan: str = "basic"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None

# ─────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_token({"user_id": user.id, "email": user.email, "role": user.role, "plan": user.plan})
    return {
        "token": token,
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "role": user.role, "plan": user.plan,
            "limits": PLAN_LIMITS.get(user.plan, PLAN_LIMITS["basic"]),
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id, "name": current_user.name,
        "email": current_user.email, "role": current_user.role,
        "plan": current_user.plan, "is_active": current_user.is_active,
        "created_at": current_user.created_at, "last_login": current_user.last_login,
        "limits": PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["basic"]),
    }

@router.post("/change-password")
def change_password(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(data.get("old_password", ""), current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(data.get("new_password", ""))
    db.commit()
    return {"message": "Password changed successfully"}

@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [{
        "id": u.id, "name": u.name, "email": u.email,
        "role": u.role, "plan": u.plan, "is_active": u.is_active,
        "created_at": u.created_at, "last_login": u.last_login,
    } for u in users]

@router.post("/users")
def create_user(req: RegisterRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name, email=req.email,
        password_hash=hash_password(req.password),
        plan=req.plan, role="member", is_active=True,
    )
    db.add(user); db.commit(); db.refresh(user)
    return {"message": "User created", "id": user.id}

@router.patch("/users/{user_id}")
def update_user(
    user_id: int, data: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.name is not None: user.name = data.name
    if data.role is not None: user.role = data.role
    if data.plan is not None: user.plan = data.plan
    if data.is_active is not None: user.is_active = data.is_active
    db.commit()
    return {"message": "User updated"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    db.delete(user); db.commit()
    return {"message": "User deleted"}

@router.get("/plans")
def get_plans():
    return PLAN_LIMITS
# ─────────────────────────────────────────
# PUBLIC PROFILE
# ─────────────────────────────────────────
class PortfolioImage(BaseModel):
    id: str
    data: str      # base64 image
    name: str = ""

class PortfolioItem(BaseModel):
    id: str
    title: str
    desc: Optional[str] = ""
    url: Optional[str] = ""
    images: List[PortfolioImage] = []

class ProfileUpdate(BaseModel):
    bio: Optional[str] = ""
    location: Optional[str] = ""
    website: Optional[str] = ""
    company: Optional[str] = ""
    phone: Optional[str] = ""
    avatar: Optional[str] = ""              # base64 image
    skills: List[str] = []
    customSkills: List[str] = []
    portfolio: List[PortfolioItem] = []
    is_public: Optional[bool] = None
    username: Optional[str] = None


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text)
    return text.strip("-") or "user"


def ensure_unique_username(db: Session, desired: str, user_id: int) -> str:
    base = slugify(desired)
    candidate = base
    i = 1
    while True:
        existing = db.query(User).filter(User.username == candidate, User.id != user_id).first()
        if not existing:
            return candidate
        i += 1
        candidate = f"{base}-{i}"


@router.get("/profile/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    data = json.loads(current_user.profile_json) if current_user.profile_json else {}
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan,
        "role": current_user.role,
        "username": current_user.username,
        "is_public": current_user.is_public,
        **data,
    }


@router.put("/profile/me")
def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Handle username slug (only if explicitly provided)
    if payload.username:
        current_user.username = ensure_unique_username(db, payload.username, current_user.id)
    elif not current_user.username:
        # First save — auto-generate from name so a public URL exists immediately
        current_user.username = ensure_unique_username(db, current_user.name, current_user.id)

    if payload.is_public is not None:
        current_user.is_public = payload.is_public

    profile_data = {
        "bio": payload.bio,
        "location": payload.location,
        "website": payload.website,
        "company": payload.company,
        "phone": payload.phone,
        "avatar": payload.avatar,
        "skills": payload.skills,
        "customSkills": payload.customSkills,
        "portfolio": [p.dict() for p in payload.portfolio],
    }
    current_user.profile_json = json.dumps(profile_data)
    db.commit()

    return {
        "message": "Profile saved",
        "username": current_user.username,
        "is_public": current_user.is_public,
        "public_url": f"/u/{current_user.username}" if current_user.is_public else None,
    }


@router.get("/profile/public/{username}")
def get_public_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_public or not user.is_active:
        raise HTTPException(status_code=404, detail="Profile not found")

    data = json.loads(user.profile_json) if user.profile_json else {}

    # Only expose safe, public-facing fields — never email, phone, plan, role
    return {
        "name": user.name,
        "username": user.username,
        "avatar": data.get("avatar", ""),
        "bio": data.get("bio", ""),
        "location": data.get("location", ""),
        "website": data.get("website", ""),
        "company": data.get("company", ""),
        "skills": data.get("skills", []),
        "customSkills": data.get("customSkills", []),
        "portfolio": data.get("portfolio", []),
    }


# ─────────────────────────────────────────
# PUBLIC SIGNUP → WAITLIST
# (Companies data is still shared across users until per-user multi-tenancy
#  lands in Phase 5, so public signup collects interest rather than granting
#  immediate access. Admin reviews and provisions accounts manually.)
# ─────────────────────────────────────────
class WaitlistSignup(BaseModel):
    name: str
    email: str
    password: str
    plan: Optional[str] = "basic"
    company: Optional[str] = None
    note: Optional[str] = None


@router.post("/signup")
def signup_waitlist(req: WaitlistSignup, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # If an account already exists for this email, they should just sign in.
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    # Idempotent: if this email already applied, don't create a duplicate.
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
    if existing:
        return {"message": "You're already on the list — we'll be in touch soon.", "already": True}

    entry = WaitlistEntry(
        name=req.name.strip(),
        email=email,
        password_hash=hash_password(req.password),
        plan=(req.plan or "basic"),
        company=(req.company or "").strip() or None,
        note=(req.note or "").strip() or None,
    )
    db.add(entry)
    db.commit()

    # Notify the admin (best-effort — never fail the signup if email is down)
    admin_email = os.getenv("ADMIN_NOTIFY_EMAIL") or os.getenv("RESEND_FROM_EMAIL")
    if admin_email:
        try:
            send_email(
                to_email=admin_email,
                subject=f"New Archon waitlist signup: {entry.name}",
                html_body=(
                    f"<p><strong>{entry.name}</strong> ({entry.email}) joined the waitlist.</p>"
                    f"<p>Plan: {entry.plan}<br>Company: {entry.company or '—'}<br>"
                    f"Note: {entry.note or '—'}</p>"
                ),
                text_body=f"{entry.name} ({entry.email}) joined the waitlist. Plan: {entry.plan}.",
            )
        except Exception as e:
            print(f"Waitlist admin notification failed: {e}")

    return {"message": "You're on the list! We'll email you when your account is ready.", "already": False}


@router.get("/waitlist")
def list_waitlist(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    entries = db.query(WaitlistEntry).order_by(WaitlistEntry.created_at.desc()).all()
    return [{
        "id": e.id, "name": e.name, "email": e.email, "plan": e.plan,
        "company": e.company, "note": e.note, "status": e.status,
        "created_at": e.created_at,
    } for e in entries]


@router.get("/waitlist/pending-count")
def waitlist_pending_count(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Cheap count for the sidebar notification badge."""
    count = db.query(WaitlistEntry).filter(WaitlistEntry.status == "pending").count()
    return {"count": count}


@router.post("/waitlist/{entry_id}/approve")
def approve_waitlist(entry_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Turn a waitlist entry into a real account using the password the user
    chose at signup, then email them that their account is now active. Legacy
    entries without a stored password fall back to a generated temp password."""
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    if db.query(User).filter(User.email == entry.email).first():
        entry.status = "approved"
        db.commit()
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    # Prefer the password the user set at signup; only generate one for old
    # entries created before signup collected a password.
    temp_password = None
    if entry.password_hash:
        password_hash = entry.password_hash
    else:
        temp_password = _secrets.token_urlsafe(9)
        password_hash = hash_password(temp_password)

    user = User(
        name=entry.name,
        email=entry.email,
        password_hash=password_hash,
        plan=entry.plan or "basic",
        role="member",
        is_active=True,
    )
    db.add(user)
    entry.status = "approved"
    db.commit()
    db.refresh(user)

    # Best-effort notification (never fail the approval if email is down)
    login_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/") + "/login"
    if temp_password:
        html = (
            f"<p>Hi {entry.name},</p>"
            f"<p>Your Archon account has been approved. Sign in with:</p>"
            f"<p><strong>Email:</strong> {entry.email}<br>"
            f"<strong>Temporary password:</strong> {temp_password}</p>"
            f"<p><a href=\"{login_url}\">Sign in</a> and change your password from Profile → Security.</p>"
            f"<p>— Archon, by Armila Design</p>"
        )
        text = f"Your Archon account is ready. Email: {entry.email}  Temp password: {temp_password}  Sign in: {login_url}"
    else:
        html = (
            f"<p>Hi {entry.name},</p>"
            f"<p>Good news — your Archon account has been approved and is now active. "
            f"You can sign in with the email and password you chose when you signed up.</p>"
            f"<p><a href=\"{login_url}\">Sign in to Archon</a></p>"
            f"<p>— Archon, by Armila Design</p>"
        )
        text = f"Your Archon account is approved. Sign in with your chosen password: {login_url}"

    try:
        send_email(to_email=entry.email, subject="Your Archon account is ready", html_body=html, text_body=text)
        emailed = True
    except Exception as e:
        print(f"Approval email failed: {e}")
        emailed = False

    return {
        "message": "Account approved",
        "user_id": user.id,
        "email": entry.email,
        "temp_password": temp_password,  # null when the user set their own password
        "emailed": emailed,
    }


@router.delete("/waitlist/{entry_id}")
def delete_waitlist(entry_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Waitlist entry removed"}


# ─────────────────────────────────────────
# IMAGE UPLOAD (avatar + portfolio) → Cloudflare R2
# ─────────────────────────────────────────
@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a single image to R2 and return its public URL. Used for avatar
    and portfolio images so they no longer bloat the database as base64."""
    if not storage.is_configured():
        raise HTTPException(status_code=503, detail="Image storage is not configured on the server")

    content = await file.read()
    try:
        url = storage.upload_image(content, file.content_type or "", prefix=f"users/{current_user.id}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    return {"url": url}


# ─────────────────────────────────────────
# FORGOT / RESET PASSWORD
# ─────────────────────────────────────────
RESET_TOKEN_EXPIRE_MINUTES = 30

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _send_reset_email(to_email: str, reset_link: str, user_name: str):
    plain = (
        f"Hi {user_name},\n\n"
        f"We received a request to reset your Archon password.\n"
        f"Click the link below to choose a new one. This link expires in {RESET_TOKEN_EXPIRE_MINUTES} minutes.\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— Archon, by Armila Design"
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <p>Hi {user_name},</p>
      <p>We received a request to reset your Archon password. This link expires in {RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
      <p style="margin:24px 0">
        <a href="{reset_link}" style="background:linear-gradient(135deg,#4F7BF7,#7C3AED);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
      </p>
      <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#888;font-size:13px">— Archon, by Armila Design</p>
    </div>
    """
    try:
        send_email(
            to_email=to_email,
            subject="Reset your Archon password",
            html_body=html,
            text_body=plain,
            from_name="Archon (via Armila Design)",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send reset email: {str(e)}")


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()

    # Always return the same generic response, whether or not the email exists —
    # prevents leaking which emails are registered (standard security practice).
    generic_response = {"message": "If an account exists with that email, a reset link has been sent."}

    if not user or not user.is_active:
        return generic_response

    token = _secrets.token_urlsafe(32)
    reset_entry = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    )
    db.add(reset_entry)
    db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    try:
        _send_reset_email(user.email, reset_link, user.name)
    except Exception as e:
        # Don't leak SMTP errors to the client — log-style detail stays server-side
        print(f"Failed to send reset email: {e}")

    return generic_response


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    entry = db.query(PasswordResetToken).filter(PasswordResetToken.token == req.token).first()

    if not entry or entry.used or entry.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = db.query(User).filter(User.id == entry.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(req.new_password)
    entry.used = True
    db.commit()

    return {"message": "Password has been reset successfully."}
