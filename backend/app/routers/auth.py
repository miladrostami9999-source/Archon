from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from app.models.database import get_db, User

router = APIRouter(prefix="/auth", tags=["auth"])

# ─────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────
SECRET_KEY = "archon-secret-key-armila-design-2024-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days
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
