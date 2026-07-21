from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

# ─────────────────────────────────────────
# DATABASE SETUP
# Uses PostgreSQL in production (Railway sets DATABASE_URL automatically)
# Falls back to local SQLite for development on your machine
# ─────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Railway/production: PostgreSQL
    # Railway gives "postgres://" but SQLAlchemy needs "postgresql://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    # Local development: SQLite
    BASE_DIR = r"C:\Users\Milad Rostami\archon"
    DB_PATH = os.path.join(BASE_DIR, "database", "archon.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─────────────────────────────────────────
# TABLE 1 — USERS
# ─────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    email         = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role          = Column(String, default="member")   # admin | member
    plan          = Column(String, default="basic")    # basic | pro | agency
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    last_login    = Column(DateTime)

    # ── PUBLIC PROFILE FIELDS ──
    username      = Column(String, unique=True, index=True, nullable=True)  # url slug, e.g. /u/milad-rostami
    profile_json  = Column(Text, nullable=True)   # bio, location, website, skills, portfolio — stored as JSON text
    is_public     = Column(Boolean, default=False)  # must opt-in before profile is publicly visible

# ─────────────────────────────────────────
# TABLE 2 — COMPANIES
# ─────────────────────────────────────────
class Company(Base):
    __tablename__ = "companies"
    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String, nullable=False)
    domain            = Column(String, unique=True, index=True)
    website           = Column(String)
    email             = Column(String)
    phone             = Column(String)
    country           = Column(String, index=True)
    city              = Column(String)
    industry          = Column(String, index=True)
    company_size      = Column(String)
    instagram         = Column(String)
    linkedin          = Column(String)
    ai_summary        = Column(Text)
    opportunity_score = Column(Float, default=0.0)
    heat_level        = Column(String, default="cold")
    status            = Column(String, default="new", index=True)
    tags              = Column(Text)
    is_favorite       = Column(Boolean, default=False)
    discovery_source  = Column(String)
    last_checked      = Column(DateTime)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    contacts  = relationship("Contact",   back_populates="company", cascade="all, delete-orphan")
    notes     = relationship("Note",      back_populates="company", cascade="all, delete-orphan")
    campaigns = relationship("Campaign",  back_populates="company", cascade="all, delete-orphan")
    history   = relationship("History",   back_populates="company", cascade="all, delete-orphan")
    tasks     = relationship("DailyTask", back_populates="company")

# ─────────────────────────────────────────
# TABLE 3 — CONTACTS
# ─────────────────────────────────────────
class Contact(Base):
    __tablename__ = "contacts"
    id         = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    full_name  = Column(String)
    role       = Column(String)
    email      = Column(String)
    linkedin   = Column(String)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="contacts")

# ─────────────────────────────────────────
# TABLE 4 — NOTES
# ─────────────────────────────────────────
class Note(Base):
    __tablename__ = "notes"
    id         = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), index=True)  # owner — per-user note
    content    = Column(Text, nullable=False)
    language   = Column(String, default="en")
    pinned     = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="notes")

# ─────────────────────────────────────────
# TABLE 5 — CAMPAIGNS
# ─────────────────────────────────────────
class Campaign(Base):
    __tablename__ = "campaigns"
    id         = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), index=True)  # owner — per-user campaign
    subject    = Column(String)
    body       = Column(Text)
    tone       = Column(String)
    status     = Column(String, default="draft")
    sent_at    = Column(DateTime)
    replied_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="campaigns")

# ─────────────────────────────────────────
# TABLE 6 — HISTORY
# ─────────────────────────────────────────
class History(Base):
    __tablename__ = "history"
    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), index=True)  # owner — per-user activity
    event_type  = Column(String)
    description = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="history")

# ─────────────────────────────────────────
# TABLE 7 — DAILY TASKS
# ─────────────────────────────────────────
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), index=True)  # owner — per-user report
    report_json  = Column(Text, nullable=False)   # the generated report content
    lang         = Column(String, default="en")
    generated_at = Column(DateTime, default=datetime.utcnow)


class DailyTask(Base):
    __tablename__ = "daily_tasks"
    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id"), index=True)  # owner — per-user task
    task_type   = Column(String)
    title       = Column(String)
    description = Column(Text)
    priority    = Column(Integer, default=3)
    is_done     = Column(Boolean, default=False)
    date        = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="tasks")


class UserCompanyState(Base):
    """Per-user pipeline state over the SHARED company catalog.

    The `companies` table holds objective facts about a company (name, website,
    country, …) and stays shared by every account. Anything that represents one
    user's own work on that company — where it sits in their pipeline, whether
    they starred it — lives here, so one user moving a company to "sent" never
    changes what another user sees.
    """
    __tablename__ = "user_company_state"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    status      = Column(String, default="new", index=True)
    heat_level  = Column(String, default="cold")
    is_favorite = Column(Boolean, default=False)
    tags        = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_user_company"),
    )


class WaitlistEntry(Base):
    __tablename__ = "waitlist"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    email         = Column(String, index=True, nullable=False)
    password_hash = Column(String)                    # the password the user chose at signup
    plan          = Column(String, default="basic")   # plan the visitor was interested in
    company       = Column(String)                     # optional studio/company name
    note          = Column(Text)                       # optional message
    status        = Column(String, default="pending")  # pending | approved | rejected
    created_at    = Column(DateTime, default=datetime.utcnow)

# ─────────────────────────────────────────
# MULTI-TENANCY BACKFILL
# ─────────────────────────────────────────
def _backfill_multitenancy():
    """One-time data migration for the shared-catalog → per-user-state model.

    Everything created before multi-tenancy belonged to the original admin (the
    only account doing outreach), so ownerless rows are assigned to them and
    their pipeline state is lifted out of `companies` into `user_company_state`.
    Runs on every startup but is a no-op once the data is already owned.
    """
    from sqlalchemy import text as _text
    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.role == "admin").order_by(User.id).first()
        if not owner:
            return  # nothing to attribute yet

        moved = 0
        for table in ("notes", "campaigns", "history", "daily_tasks", "weekly_reports"):
            res = db.execute(_text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"), {"uid": owner.id})
            moved += res.rowcount or 0
        if moved:
            db.commit()
            print(f"✅ Multi-tenancy backfill: assigned {moved} legacy rows to {owner.email}")

        # Lift the admin's existing pipeline state out of the now-shared catalog
        already = db.query(UserCompanyState).filter(UserCompanyState.user_id == owner.id).count()
        if already == 0:
            companies = db.query(Company).all()
            for c in companies:
                db.add(UserCompanyState(
                    user_id=owner.id,
                    company_id=c.id,
                    status=c.status or "new",
                    heat_level=c.heat_level or "cold",
                    is_favorite=bool(c.is_favorite),
                    tags=c.tags,
                ))
            if companies:
                db.commit()
                print(f"✅ Multi-tenancy backfill: seeded pipeline state for {len(companies)} companies")
    except Exception as e:
        db.rollback()
        print(f"⚠️  Multi-tenancy backfill skipped: {e}")
    finally:
        db.close()


# ─────────────────────────────────────────
# INIT + SEED ADMIN
# ─────────────────────────────────────────
def init_db():
    Base.metadata.create_all(bind=engine)

    # Auto-migrate: add new columns to existing tables if they don't exist yet
    # (safe no-op on fresh databases where create_all already added them)
    try:
        from sqlalchemy import text as _text
        _inspector = __import__("sqlalchemy").inspect(engine)
        user_cols = [c["name"] for c in _inspector.get_columns("users")]
        company_cols = [c["name"] for c in _inspector.get_columns("companies")]
        with engine.connect() as conn:
            if "username" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN username VARCHAR"))
                conn.commit()
            if "profile_json" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN profile_json TEXT"))
                conn.commit()
            if "is_public" not in user_cols:
                default_val = "FALSE" if "postgresql" in str(engine.url) else "0"
                conn.execute(_text(f"ALTER TABLE users ADD COLUMN is_public BOOLEAN DEFAULT {default_val}"))
                conn.commit()
            if "phone" not in company_cols:
                conn.execute(_text("ALTER TABLE companies ADD COLUMN phone VARCHAR"))
                conn.commit()
            if _inspector.has_table("waitlist"):
                waitlist_cols = [c["name"] for c in _inspector.get_columns("waitlist")]
                if "password_hash" not in waitlist_cols:
                    conn.execute(_text("ALTER TABLE waitlist ADD COLUMN password_hash VARCHAR"))
                    conn.commit()

            # ── Multi-tenancy: per-user ownership on what used to be shared ──
            for table in ("notes", "campaigns", "history", "daily_tasks", "weekly_reports"):
                if _inspector.has_table(table):
                    cols = [c["name"] for c in _inspector.get_columns(table)]
                    if "user_id" not in cols:
                        conn.execute(_text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))
                        conn.commit()
    except Exception as e:
        print(f"⚠️  Column migration check: {e}")

    _backfill_multitenancy()

    # Create admin user if not exists
    db = SessionLocal()
    try:
        import bcrypt as _bcrypt
        existing = db.query(User).filter(User.email == "milad@armiladesign.com").first()
        if not existing:
            _hash = _bcrypt.hashpw("archon2024".encode(), _bcrypt.gensalt()).decode()
            admin = User(
                name="Milad Rostami",
                email="milad@armiladesign.com",
                password_hash=_hash,
                role="admin",
                plan="agency",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("✅ Admin user created: milad@armiladesign.com / archon2024")
        print("✅ Archon Database initialized successfully")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
