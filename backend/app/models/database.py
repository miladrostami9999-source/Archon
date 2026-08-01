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

    # ── SUBSCRIPTION ──
    plan_started_at = Column(DateTime)  # when the current plan period began
    plan_expires_at = Column(DateTime)  # access is blocked past this (null = no expiry, e.g. admin)
    # "active" = plan is paid for/granted. "pending" = the account exists and can
    # explore the app, but quota features stay locked until an admin approves.
    plan_status     = Column(String, default="active")

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
    company_size      = Column(String)          # solo | small | medium | large
    # Actual headcount when we know it. The four size bands are too coarse to
    # score with — a 25-person studio and a 95-person practice are a different
    # sale — and showing the real number makes the trade-off visible on the card.
    employee_count    = Column(Integer)
    # Buying signals verified during discovery (comma-separated keys from
    # services/discovery_sources.SIGNALS). Stored because re-scoring reads only
    # the Company row: without this, Recalculate Scores silently stripped the
    # signal points off every hunted company.
    signals           = Column(Text)
    instagram         = Column(String)
    linkedin          = Column(String)
    ai_summary        = Column(Text)
    opportunity_score = Column(Float, default=0.0)
    # Per-axis explanation of opportunity_score (JSON). Kept so the number can
    # be argued with instead of trusted blindly — see services/scoring.py.
    score_breakdown   = Column(Text)
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


class PlanLimit(Base):
    """Per-plan quotas, editable by the admin at runtime (Admin Panel), so
    limits are never hardcoded — the admin can raise/lower e.g. Pro's monthly
    email cap and it takes effect immediately for everyone on that plan.
    A value of -1 means unlimited.
    """
    __tablename__ = "plan_limits"
    plan                 = Column(String, primary_key=True)  # trial | basic | pro | agency
    max_companies        = Column(Integer, default=-1)       # companies the user may add to their pipeline
    max_emails_per_month = Column(Integer, default=-1)       # sends allowed per period
    period_days          = Column(Integer, default=30)       # length of a billing/trial window
    price_usd            = Column(Float, default=0)          # 0 = free / not purchasable
    price_irr            = Column(Float, default=0)          # Toman price for Iranian users
    # Comma-separated country names this plan may browse; empty = the whole
    # catalog. Keeps the trial to a sample so it can't be used as a free
    # substitute for a paid plan.
    allowed_countries    = Column(Text, default="")
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Defaults seeded on first run — from the roadmap + landing page.
# `allowed_countries` seeds the trial to the roadmap's priority-1 markets plus
# the UK (where most of the current catalog sits, so a trial still sees
# something). The admin edits it per plan from the Admin Panel.
DEFAULT_PLAN_LIMITS = {
    "trial":  {"max_companies": 10,  "max_emails_per_month": 10,  "period_days": 7,  "price_usd": 0,  "price_irr": 0,
               "allowed_countries": "United Arab Emirates, Saudi Arabia, United Kingdom"},
    "basic":  {"max_companies": 50,  "max_emails_per_month": 30,  "period_days": 30, "price_usd": 19, "price_irr": 0,
               "allowed_countries": ""},
    "pro":    {"max_companies": 500, "max_emails_per_month": 300, "period_days": 30, "price_usd": 49, "price_irr": 0,
               "allowed_countries": ""},
    "agency": {"max_companies": -1,  "max_emails_per_month": -1,  "period_days": 30, "price_usd": 99, "price_irr": 0,
               "allowed_countries": ""},
}


class PaymentRequest(Base):
    """A user's claim that they've paid for a plan, awaiting admin confirmation.

    No automated gateway is available (Stripe and similar don't serve Iran, and
    Iranian gateways require an Iranian legal entity), so upgrades run through
    an offline payment the admin verifies and approves. This table is the audit
    trail; approving it activates the plan. When a real gateway is added later
    it becomes just another `method` and the rest of the flow is unchanged.
    """
    __tablename__ = "payment_requests"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan        = Column(String, nullable=False)     # plan being purchased
    amount      = Column(Float)                      # what the user says they paid
    currency    = Column(String, default="IRR")      # IRR (Toman) | USD
    method      = Column(String)                     # card-to-card, bank transfer, PayPal…
    reference   = Column(String)                     # tracking number / receipt id
    receipt_url = Column(String)                     # uploaded proof of payment (R2)
    note        = Column(Text)
    status      = Column(String, default="pending", index=True)  # pending | approved | rejected
    admin_note  = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)


class AppSetting(Base):
    """Small key/value store for admin-editable text, e.g. payment instructions."""
    __tablename__ = "app_settings"
    key        = Column(String, primary_key=True)
    value      = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Shown to users on the upgrade page; the admin edits these in the Admin Panel.
# Payment details live here rather than in code so they never end up in git.
DEFAULT_SETTINGS = {
    "pay_card_number": "",
    "pay_card_holder": "",
    "pay_paypal_email": "",
    "support_email": "armila.design16@gmail.com",
    "support_phone": "+989356668505",
    "payment_instructions_en": "How to upgrade:\n\n1. Pick your plan above - the amount is shown in Toman and USD.\n2. Pay using one of the methods listed (card to card inside Iran, or PayPal).\n3. Attach a screenshot or PDF of the receipt below. A tracking number is optional if you attach a receipt.\n4. Submit - we verify and activate your plan, usually within a few hours.\n\nYou'll get an email when we receive it, and another the moment your plan is active.\nNeed help? Email us, or message the number below on Telegram or WhatsApp.",
    "payment_instructions_fa": 'مراحل ارتقای پلن:\n\n۱. پلن مورد نظر را از بالا انتخاب کنید — مبلغ به تومان و دلار نمایش داده می\u200cشود.\n۲. مبلغ را با یکی از روش\u200cهای زیر پرداخت کنید (کارت به کارت داخل ایران یا پی\u200cپال).\n۳. تصویر یا فایل PDF رسید را در فرم پایین پیوست کنید. اگر رسید را پیوست کنید، وارد کردن شماره پیگیری اختیاری است.\n۴. ثبت کنید — پس از بررسی، پلن شما فعال می\u200cشود (معمولاً ظرف چند ساعت).\n\nبه محض دریافت، یک ایمیل تأیید و پس از فعال\u200cسازی پلن، ایمیل دوم برایتان ارسال می\u200cشود.\nسوالی دارید؟ با ایمیل یا از طریق تلگرام و واتساپ با شماره زیر در تماس باشید.',
}


class DiscoveryHunt(Base):
    """A saved set of lead-hunting criteria.

    Hunts are worth keeping: "small interior studios in Riyadh that are hiring a
    visualiser" is a search you want to re-run monthly, not retype. The criteria
    are stored as JSON because the shape of the form will keep growing.
    """
    __tablename__ = "discovery_hunts"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), index=True)
    name          = Column(String, nullable=False)
    criteria_json = Column(Text, nullable=False)
    last_run_at   = Column(DateTime)
    runs          = Column(Integer, default=0)
    found_total   = Column(Integer, default=0)
    added_total   = Column(Integer, default=0)
    created_at    = Column(DateTime, default=datetime.utcnow)


class DiscoveryRun(Base):
    """One execution of a hunt — what was asked, what came back, what stuck.

    Kept so the yield of each source can be compared over time; a source that
    keeps returning duplicates isn't worth searching again.
    """
    __tablename__ = "discovery_runs"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), index=True)
    hunt_id       = Column(Integer, ForeignKey("discovery_hunts.id"))
    stage         = Column(String, default="scout")  # scout | enrich
    criteria_json = Column(Text)
    found         = Column(Integer, default=0)
    fresh         = Column(Integer, default=0)   # after removing catalog duplicates
    added         = Column(Integer, default=0)   # actually saved by the admin
    # Token cost per stage, so the cheap scout pass and the expensive enrich
    # pass can be compared and the spend kept honest.
    input_tokens  = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    error         = Column(Text)
    created_at    = Column(DateTime, default=datetime.utcnow, index=True)


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


def _seed_plan_limits():
    """Insert default quotas for any plan that doesn't have a row yet. Existing
    rows are left alone so admin edits are never overwritten on restart."""
    db = SessionLocal()
    try:
        for plan, vals in DEFAULT_PLAN_LIMITS.items():
            if not db.query(PlanLimit).filter(PlanLimit.plan == plan).first():
                db.add(PlanLimit(plan=plan, **vals))
        # Rows created before prices existed came back as 0 from the ALTER
        # default; give them the standard USD price so the upgrade page has
        # something to show. Toman prices stay 0 until the admin sets them.
        for plan, vals in DEFAULT_PLAN_LIMITS.items():
            row = db.query(PlanLimit).filter(PlanLimit.plan == plan).first()
            if row and not row.price_usd and vals.get("price_usd"):
                row.price_usd = vals["price_usd"]
        for key, value in DEFAULT_SETTINGS.items():
            if not db.query(AppSetting).filter(AppSetting.key == key).first():
                db.add(AppSetting(key=key, value=value))

        # The country lock arrived after plan rows already existed, so the new
        # column came back empty (= no restriction) everywhere. Apply the
        # defaults exactly once; after that an empty value is the admin's
        # deliberate choice and must be left alone.
        if not db.query(AppSetting).filter(AppSetting.key == "country_lock_seeded").first():
            for plan, vals in DEFAULT_PLAN_LIMITS.items():
                row = db.query(PlanLimit).filter(PlanLimit.plan == plan).first()
                if row and not (row.allowed_countries or "").strip():
                    row.allowed_countries = vals.get("allowed_countries", "")
            db.add(AppSetting(key="country_lock_seeded", value="1"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️  Plan-limit seed skipped: {e}")
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
            if "score_breakdown" not in company_cols:
                conn.execute(_text("ALTER TABLE companies ADD COLUMN score_breakdown TEXT"))
                conn.commit()
            if "employee_count" not in company_cols:
                conn.execute(_text("ALTER TABLE companies ADD COLUMN employee_count INTEGER"))
                conn.commit()
            if "signals" not in company_cols:
                conn.execute(_text("ALTER TABLE companies ADD COLUMN signals TEXT"))
                conn.commit()
            for col in ("plan_started_at", "plan_expires_at"):
                if col not in user_cols:
                    conn.execute(_text(f"ALTER TABLE users ADD COLUMN {col} TIMESTAMP"))
                    conn.commit()
            if "plan_status" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN plan_status VARCHAR DEFAULT 'active'"))
                conn.execute(_text("UPDATE users SET plan_status = 'active' WHERE plan_status IS NULL"))
                conn.commit()
            if _inspector.has_table("waitlist"):
                waitlist_cols = [c["name"] for c in _inspector.get_columns("waitlist")]
                if "password_hash" not in waitlist_cols:
                    conn.execute(_text("ALTER TABLE waitlist ADD COLUMN password_hash VARCHAR"))
                    conn.commit()

            if _inspector.has_table("payment_requests"):
                pr_cols = [c["name"] for c in _inspector.get_columns("payment_requests")]
                if "receipt_url" not in pr_cols:
                    conn.execute(_text("ALTER TABLE payment_requests ADD COLUMN receipt_url VARCHAR"))
                    conn.commit()

            if _inspector.has_table("plan_limits"):
                pl_cols = [c["name"] for c in _inspector.get_columns("plan_limits")]
                for col in ("price_usd", "price_irr"):
                    if col not in pl_cols:
                        conn.execute(_text(f"ALTER TABLE plan_limits ADD COLUMN {col} FLOAT DEFAULT 0"))
                        conn.commit()
                if "allowed_countries" not in pl_cols:
                    conn.execute(_text("ALTER TABLE plan_limits ADD COLUMN allowed_countries TEXT DEFAULT ''"))
                    conn.commit()

            if _inspector.has_table("discovery_runs"):
                dr_cols = [c["name"] for c in _inspector.get_columns("discovery_runs")]
                if "stage" not in dr_cols:
                    conn.execute(_text("ALTER TABLE discovery_runs ADD COLUMN stage VARCHAR DEFAULT 'scout'"))
                    conn.commit()
                for col in ("input_tokens", "output_tokens"):
                    if col not in dr_cols:
                        conn.execute(_text(f"ALTER TABLE discovery_runs ADD COLUMN {col} INTEGER DEFAULT 0"))
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
    _seed_plan_limits()

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
