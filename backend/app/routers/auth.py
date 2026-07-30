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
    "trial": {
        "max_companies": 10,
        "max_emails_per_month": 10,
        "ai_search": False,
        "weekly_report": False,
        "market_map": False,
    },
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
    # Subscription expiry — admins never expire; everyone else is blocked once
    # their plan window has passed until it's renewed.
    if user.role != "admin" and user.plan_expires_at and user.plan_expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Your subscription has expired. Please renew to continue.")
    return user

def _purge_user_data(db: Session, user: User):
    """Remove everything that points at a user before deleting them.

    Since multi-tenancy, a user owns rows in several tables; Postgres enforces
    those foreign keys, so deleting the user directly fails. The shared company
    catalog is deliberately left alone — only this user's own work is removed.
    """
    from app.models.database import (
        UserCompanyState, Note, Campaign, History, DailyTask,
        WeeklyReport, PaymentRequest,
    )
    for model in (UserCompanyState, Note, Campaign, History, DailyTask,
                  WeeklyReport, PaymentRequest, PasswordResetToken):
        db.query(model).filter(model.user_id == user.id).delete(synchronize_session=False)
    db.flush()


def activate_plan(db: Session, user: User, plan: str | None = None):
    """Mark a plan paid-for and start a fresh period."""
    from app.services.limits import get_plan_limit
    if plan:
        user.plan = plan
    now = datetime.utcnow()
    user.plan_status = "active"
    user.plan_started_at = now
    user.plan_expires_at = now + timedelta(days=get_plan_limit(db, user.plan)["period_days"])
    return user


def require_active_plan(current_user: User = Depends(get_current_user)) -> User:
    """Gate for features that consume quota. A pending account can sign in and
    look around, but can't add companies or send email until payment clears."""
    if current_user.role != "admin" and current_user.plan_status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Your plan is awaiting confirmation. You can explore Archon meanwhile — this unlocks once we confirm your payment.",
        )
    return current_user


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
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Feature flags come from the static map; the numeric quotas come from the
    # admin-editable plan_limits table so edits show up here immediately.
    from app.services.limits import get_plan_limit
    limits = dict(PLAN_LIMITS.get(current_user.plan, PLAN_LIMITS["basic"]))
    limits.update(get_plan_limit(db, current_user.plan))
    return {
        "id": current_user.id, "name": current_user.name,
        "email": current_user.email, "role": current_user.role,
        "plan": current_user.plan, "is_active": current_user.is_active,
        "created_at": current_user.created_at, "last_login": current_user.last_login,
        "plan_expires_at": current_user.plan_expires_at.isoformat() if current_user.plan_expires_at else None,
        "plan_status": current_user.plan_status or "active",
        "limits": limits,
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
        "plan_status": u.plan_status or "active",
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
    if data.plan is not None:
        # Setting a plan (even re-selecting the same one) acts as a renewal:
        # a fresh billing window is stamped so an expired user regains access.
        activate_plan(db, user, data.plan)
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
    _purge_user_data(db, user)
    db.delete(user); db.commit()
    return {"message": "User deleted"}


@router.post("/me/deactivate")
def deactivate_my_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Self-service pause: keeps the data, blocks sign-in until an admin
    re-enables the account."""
    if current_user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts can't be deactivated.")
    current_user.is_active = False
    db.commit()
    return {"message": "Your account has been deactivated."}


class DeleteAccountRequest(BaseModel):
    password: str


@router.post("/me/delete")
def delete_my_account(data: DeleteAccountRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Self-service permanent delete. Password-confirmed, since it's not
    reversible and wipes the user's whole pipeline."""
    if current_user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts can't be deleted from here.")
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect.")
    _purge_user_data(db, current_user)
    db.delete(current_user); db.commit()
    return {"message": "Your account and all of its data have been deleted."}

@router.get("/plans")
def get_plans():
    return PLAN_LIMITS


# ─────────────────────────────────────────
# PLAN LIMITS + USAGE
# ─────────────────────────────────────────
@router.get("/usage")
def get_my_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Powers the dashboard credit widget — how much of the user's quota is left."""
    from app.services.limits import get_usage
    return get_usage(db, current_user)


@router.get("/plan-limits")
def list_plan_limits(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.database import PlanLimit
    rows = db.query(PlanLimit).all()
    return [{
        "plan": r.plan,
        "max_companies": r.max_companies,
        "max_emails_per_month": r.max_emails_per_month,
        "period_days": r.period_days,
        "price_usd": r.price_usd or 0,
        "price_irr": r.price_irr or 0,
    } for r in rows]


class PlanLimitUpdate(BaseModel):
    max_companies: int
    max_emails_per_month: int
    period_days: int
    price_usd: Optional[float] = None
    price_irr: Optional[float] = None


@router.put("/plan-limits/{plan}")
def update_plan_limit(plan: str, data: PlanLimitUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin edits a plan's quotas — takes effect immediately for everyone on it."""
    from app.models.database import PlanLimit, DEFAULT_PLAN_LIMITS
    if plan not in DEFAULT_PLAN_LIMITS:
        raise HTTPException(status_code=400, detail="Unknown plan")
    for field in ("max_companies", "max_emails_per_month"):
        if getattr(data, field) < -1:
            raise HTTPException(status_code=400, detail="Limit must be -1 (unlimited) or a positive number")
    if data.period_days < 1:
        raise HTTPException(status_code=400, detail="Period must be at least 1 day")

    row = db.query(PlanLimit).filter(PlanLimit.plan == plan).first()
    if not row:
        row = PlanLimit(plan=plan)
        db.add(row)
    row.max_companies = data.max_companies
    row.max_emails_per_month = data.max_emails_per_month
    row.period_days = data.period_days
    if data.price_usd is not None:
        row.price_usd = max(0, data.price_usd)
    if data.price_irr is not None:
        row.price_irr = max(0, data.price_irr)
    db.commit()
    return {"message": f"Updated {plan} limits", "plan": plan}


# ─────────────────────────────────────────
# UPGRADES / MANUAL PAYMENTS
# No automated gateway is usable yet (Stripe et al. don't serve Iran; Iranian
# gateways need an Iranian legal entity), so upgrades run as an offline payment
# the admin verifies. Adding a real gateway later means adding a `method` here.
# ─────────────────────────────────────────
@router.get("/billing/plans")
def get_billing_plans(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Purchasable plans with prices + payment instructions, for the upgrade page."""
    from app.models.database import PlanLimit, AppSetting
    rows = db.query(PlanLimit).all()
    order = ["trial", "basic", "pro", "agency"]
    plans = sorted(
        [{
            "plan": r.plan,
            "max_companies": r.max_companies,
            "max_emails_per_month": r.max_emails_per_month,
            "period_days": r.period_days,
            "price_usd": r.price_usd or 0,
            "price_irr": r.price_irr or 0,
        } for r in rows if (r.price_usd or 0) > 0 or (r.price_irr or 0) > 0],
        key=lambda p: order.index(p["plan"]) if p["plan"] in order else 99,
    )
    settings = {s.key: s.value for s in db.query(AppSetting).all()}
    from app.services.exchange import get_usd_to_toman
    return {
        "current_plan": current_user.plan,
        "plans": plans,
        "instructions_en": settings.get("payment_instructions_en", ""),
        "instructions_fa": settings.get("payment_instructions_fa", ""),
        "card_number": settings.get("pay_card_number", ""),
        "card_holder": settings.get("pay_card_holder", ""),
        "paypal_email": settings.get("pay_paypal_email", ""),
        "support_email": settings.get("support_email", ""),
        "support_phone": settings.get("support_phone", ""),
        "exchange": get_usd_to_toman(db),
    }


@router.get("/billing/exchange-rate")
def exchange_rate(refresh: bool = False, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Live USD→Toman rate so Toman prices track the market instead of being
    stale numbers typed in by hand."""
    from app.services.exchange import get_usd_to_toman
    return get_usd_to_toman(db, force=refresh)


class PaymentRequestCreate(BaseModel):
    plan: str
    amount: Optional[float] = None
    currency: str = "IRR"
    method: Optional[str] = None
    reference: Optional[str] = None
    receipt_url: Optional[str] = None
    note: Optional[str] = None


@router.post("/billing/requests")
def create_payment_request(data: PaymentRequestCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.database import PaymentRequest
    if data.plan not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail="Unknown plan")
    # Either proof is enough — a receipt image is as verifiable as a tracking number
    if not (data.reference or "").strip() and not (data.receipt_url or "").strip():
        raise HTTPException(status_code=400, detail="Attach the receipt or enter a tracking number so we can verify the payment.")

    pending = db.query(PaymentRequest).filter(
        PaymentRequest.user_id == current_user.id, PaymentRequest.status == "pending"
    ).first()
    if pending:
        raise HTTPException(status_code=400, detail="You already have a payment awaiting review.")

    pr = PaymentRequest(
        user_id=current_user.id,
        plan=data.plan,
        amount=data.amount,
        currency=(data.currency or "IRR").upper(),
        method=(data.method or "").strip() or None,
        reference=(data.reference or "").strip() or "—",
        receipt_url=(data.receipt_url or "").strip() or None,
        note=(data.note or "").strip() or None,
    )
    db.add(pr)
    db.commit()

    # Confirm to the payer that we have it and it's being checked
    try:
        send_email(
            to_email=current_user.email,
            subject="We received your payment — verifying now",
            html_body=(
                f"<p>Hi {current_user.name},</p>"
                f"<p>Thanks — we've received your payment details for the "
                f"<strong>{data.plan}</strong> plan and are verifying them now. "
                f"You'll get another email the moment your plan is active (usually within a few hours).</p>"
                f"<p>Reference: {pr.reference}</p>"
                f"<p>— Archon, by Armila Design</p>"
            ),
            text_body=f"We received your payment for the {data.plan} plan (ref {pr.reference}) and are verifying it.",
        )
    except Exception as e:
        print(f"Payer confirmation email failed: {e}")

    admin_email = os.getenv("ADMIN_NOTIFY_EMAIL") or os.getenv("RESEND_FROM_EMAIL")
    if admin_email:
        try:
            send_email(
                to_email=admin_email,
                subject=f"Archon payment to verify: {current_user.name} → {data.plan}",
                html_body=(
                    f"<p><strong>{current_user.name}</strong> ({current_user.email}) submitted a payment.</p>"
                    f"<p>Plan: {data.plan}<br>Amount: {data.amount or '—'} {pr.currency}<br>"
                    f"Method: {pr.method or '—'}<br>Reference: {pr.reference}</p>"
                ),
                text_body=f"{current_user.name} paid for {data.plan}. Ref: {pr.reference}",
            )
        except Exception as e:
            print(f"Payment notification failed: {e}")

    return {"message": "Payment submitted — we'll verify and activate your plan shortly.", "id": pr.id}


@router.get("/billing/requests/mine")
def my_payment_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.database import PaymentRequest
    rows = db.query(PaymentRequest).filter(
        PaymentRequest.user_id == current_user.id
    ).order_by(PaymentRequest.created_at.desc()).all()
    return [{
        "id": r.id, "plan": r.plan, "amount": r.amount, "currency": r.currency,
        "reference": r.reference, "status": r.status, "admin_note": r.admin_note,
        "created_at": r.created_at,
    } for r in rows]


@router.get("/billing/requests")
def list_payment_requests(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.database import PaymentRequest
    rows = db.query(PaymentRequest).order_by(PaymentRequest.created_at.desc()).all()
    users = {u.id: u for u in db.query(User).all()}
    return [{
        "id": r.id, "plan": r.plan, "amount": r.amount, "currency": r.currency,
        "method": r.method, "reference": r.reference, "note": r.note,
        "receipt_url": r.receipt_url,
        "status": r.status, "created_at": r.created_at,
        "user_name": users[r.user_id].name if r.user_id in users else "—",
        "user_email": users[r.user_id].email if r.user_id in users else "—",
    } for r in rows]


@router.get("/billing/requests/pending-count")
def pending_payments_count(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.database import PaymentRequest
    return {"count": db.query(PaymentRequest).filter(PaymentRequest.status == "pending").count()}


@router.post("/billing/requests/{request_id}/approve")
def approve_payment(request_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Confirm the payment landed and activate the plan with a fresh period."""
    from app.models.database import PaymentRequest
    from app.services.limits import get_plan_limit
    pr = db.query(PaymentRequest).filter(PaymentRequest.id == request_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if pr.status != "pending":
        raise HTTPException(status_code=400, detail=f"Already {pr.status}")

    user = db.query(User).filter(User.id == pr.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.utcnow()
    activate_plan(db, user, pr.plan)
    pr.status = "approved"
    pr.reviewed_at = now
    db.commit()

    try:
        send_email(
            to_email=user.email,
            subject=f"Your Archon {pr.plan.capitalize()} plan is active",
            html_body=(
                f"<p>Hi {user.name},</p>"
                f"<p>We've confirmed your payment — your <strong>{pr.plan}</strong> plan is now active "
                f"until {user.plan_expires_at.strftime('%d %b %Y')}.</p>"
                f"<p>— Archon, by Armila Design</p>"
            ),
            text_body=f"Your {pr.plan} plan is active until {user.plan_expires_at.strftime('%d %b %Y')}.",
        )
    except Exception as e:
        print(f"Activation email failed: {e}")

    return {"message": "Payment approved and plan activated", "plan": pr.plan,
            "expires_at": user.plan_expires_at.isoformat()}


class PaymentReject(BaseModel):
    admin_note: Optional[str] = None


@router.post("/billing/requests/{request_id}/reject")
def reject_payment(request_id: int, data: PaymentReject, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.database import PaymentRequest
    pr = db.query(PaymentRequest).filter(PaymentRequest.id == request_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if pr.status != "pending":
        raise HTTPException(status_code=400, detail=f"Already {pr.status}")
    pr.status = "rejected"
    pr.admin_note = (data.admin_note or "").strip() or None
    pr.reviewed_at = datetime.utcnow()
    db.commit()
    return {"message": "Payment request rejected"}


@router.get("/settings/payment")
def get_payment_settings(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.database import AppSetting
    settings = {s.key: s.value for s in db.query(AppSetting).all()}
    return {
        "instructions_en": settings.get("payment_instructions_en", ""),
        "instructions_fa": settings.get("payment_instructions_fa", ""),
        "card_number": settings.get("pay_card_number", ""),
        "card_holder": settings.get("pay_card_holder", ""),
        "paypal_email": settings.get("pay_paypal_email", ""),
        "support_email": settings.get("support_email", ""),
        "support_phone": settings.get("support_phone", ""),
        "manual_rate": settings.get("usd_toman_rate_manual", ""),
    }


class PaymentSettingsUpdate(BaseModel):
    instructions_en: str
    instructions_fa: str
    card_number: Optional[str] = None
    card_holder: Optional[str] = None
    paypal_email: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    manual_rate: Optional[str] = None


@router.put("/settings/payment")
def update_payment_settings(data: PaymentSettingsUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.database import AppSetting
    pairs = [("payment_instructions_en", data.instructions_en),
             ("payment_instructions_fa", data.instructions_fa)]
    for key, value in (("pay_card_number", data.card_number),
                       ("pay_card_holder", data.card_holder),
                       ("pay_paypal_email", data.paypal_email),
                       ("support_email", data.support_email),
                       ("support_phone", data.support_phone),
                       ("usd_toman_rate_manual", data.manual_rate)):
        if value is not None:
            pairs.append((key, value.strip()))
    for key, value in pairs:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if not row:
            row = AppSetting(key=key)
            db.add(row)
        row.value = value
    db.commit()
    return {"message": "Payment instructions updated"}


# ─────────────────────────────────────────
# PUBLIC PROFILE
# ─────────────────────────────────────────
class PortfolioImage(BaseModel):
    id: str
    data: str      # image URL (R2) — or a base64 data URI for legacy uploads
    name: str = ""
    alt: str = ""  # short per-image caption / alt text

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
# Plans a visitor can activate without admin review. Paid plans stay on the
# waitlist until Stripe exists — otherwise picking "pro" would hand out a paid
# tier for free.
SELF_SERVE_PLANS = {"trial"}


def _notify_admin_signup(name, email, plan, company, note, instant: bool):
    """Best-effort admin notification — never fails the signup."""
    admin_email = os.getenv("ADMIN_NOTIFY_EMAIL") or os.getenv("RESEND_FROM_EMAIL")
    if not admin_email:
        return
    what = "started a free trial" if instant else "joined the waitlist"
    try:
        send_email(
            to_email=admin_email,
            subject=f"New Archon signup: {name} ({plan})",
            html_body=(
                f"<p><strong>{name}</strong> ({email}) {what}.</p>"
                f"<p>Plan: {plan}<br>Company: {company or '—'}<br>Note: {note or '—'}</p>"
            ),
            text_body=f"{name} ({email}) {what}. Plan: {plan}.",
        )
    except Exception as e:
        print(f"Signup admin notification failed: {e}")


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
    if req.plan and req.plan not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail="Unknown plan.")

    # If an account already exists for this email, they should just sign in.
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    # Idempotent: if this email already applied, don't create a duplicate.
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
    if existing:
        return {"message": "You're already on the list — we'll be in touch soon.", "already": True}

    # Everyone gets an account and can sign in straight away — per-user data is
    # isolated, so exploring is harmless. The free trial is usable immediately;
    # paid plans start "pending" and unlock quota features once an admin
    # confirms payment, which keeps them from getting a paid tier for free.
    from app.services.limits import get_plan_limit
    plan = req.plan or "basic"
    instant_use = plan in SELF_SERVE_PLANS
    now = datetime.utcnow()

    user = User(
        name=req.name.strip(),
        email=email,
        password_hash=hash_password(req.password),
        plan=plan,
        role="member",
        is_active=True,
        plan_status="active" if instant_use else "pending",
        plan_started_at=now if instant_use else None,
        plan_expires_at=now + timedelta(days=get_plan_limit(db, plan)["period_days"]) if instant_use else None,
    )
    db.add(user)
    # Mirror into the waitlist so the admin has one list of every signup, with
    # paid plans left pending for approval.
    db.add(WaitlistEntry(
        name=user.name, email=email, password_hash=user.password_hash, plan=plan,
        company=(req.company or "").strip() or None,
        note=(req.note or "").strip() or None,
        status="approved" if instant_use else "pending",
    ))
    db.commit()
    db.refresh(user)

    _notify_admin_signup(user.name, email, plan, req.company, req.note, instant=instant_use)
    return {
        "message": (
            "Your account is ready — signing you in…" if instant_use
            else "Your account is ready. You can explore now; we'll unlock your plan once payment is confirmed."
        ),
        "already": False,
        "instant": True,
        "plan_status": user.plan_status,
        "token": create_token({"user_id": user.id, "email": user.email, "role": user.role}),
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "plan": user.plan},
    }


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

    # Signups now create the account up front, so approving usually means
    # activating an existing pending user rather than creating one.
    existing = db.query(User).filter(User.email == entry.email).first()
    if existing:
        activate_plan(db, existing, entry.plan or existing.plan)
        entry.status = "approved"
        db.commit()
        login_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/") + "/login"
        emailed = False
        try:
            send_email(
                to_email=existing.email,
                subject="Your Archon plan is active",
                html_body=(
                    f"<p>Hi {existing.name},</p>"
                    f"<p>Your <strong>{existing.plan}</strong> plan is now active — everything is unlocked.</p>"
                    f"<p><a href=\"{login_url}\">Open Archon</a></p>"
                    f"<p>— Archon, by Armila Design</p>"
                ),
                text_body=f"Your {existing.plan} plan is now active. {login_url}",
            )
            emailed = True
        except Exception as e:
            print(f"Activation email failed: {e}")
        return {
            "message": "Plan activated",
            "user_id": existing.id,
            "email": existing.email,
            "temp_password": None,
            "emailed": emailed,
        }

    # Prefer the password the user set at signup; only generate one for old
    # entries created before signup collected a password.
    temp_password = None
    if entry.password_hash:
        password_hash = entry.password_hash
    else:
        temp_password = _secrets.token_urlsafe(9)
        password_hash = hash_password(temp_password)

    from app.services.limits import get_plan_limit
    plan = entry.plan or "basic"
    now = datetime.utcnow()
    period = get_plan_limit(db, plan)["period_days"]
    user = User(
        name=entry.name,
        email=entry.email,
        password_hash=password_hash,
        plan=plan,
        role="member",
        is_active=True,
        plan_started_at=now,
        plan_expires_at=now + timedelta(days=period),
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


@router.post("/upload/receipt")
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Proof-of-payment upload. Accepts PDFs as well as images, since receipts
    are often exported as documents."""
    if not storage.is_configured():
        raise HTTPException(status_code=503, detail="File storage is not configured on the server")

    content = await file.read()
    try:
        url = storage.upload_image(
            content, file.content_type or "",
            prefix=f"receipts/{current_user.id}", allow_documents=True,
        )
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
