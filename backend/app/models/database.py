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

    # ── MARKETPLACE (Phase 6, beta) ──
    # On for everyone by default — the marketplace is labelled Beta in the UI
    # rather than hidden, since a section nobody can see gets no testing. Kept
    # as a per-account column so an admin can still switch it off for a
    # specific account from the Users page.
    marketplace_beta_enabled = Column(Boolean, default=True)
    # Which side of the marketplace this account mainly works on. Purely a UI
    # preference — it decides which view leads (post work vs find work) and is
    # switchable at any time. It grants nothing: permissions come from being
    # the client_id/freelancer_id on a specific contract, so one account can
    # hire on one project and deliver on another without a second login.
    account_mode             = Column(String, default="freelancer")  # freelancer | client
    skills                   = Column(Text, nullable=True)   # comma-separated, freelancer profile
    hourly_rate              = Column(Float, nullable=True)

    # ── GMAIL SEND-ONLY OAUTH (Phase 5 leftover) ──
    # Lets a user send outreach from their own Gmail address instead of the
    # shared Resend sender. Scope is gmail.send only — never read/modify.
    # The refresh token is encrypted at rest (services/crypto.py) since it's
    # the first reversible secret stored in this database.
    google_refresh_token_encrypted = Column(Text, nullable=True)
    google_email                   = Column(String, nullable=True)
    google_connected_at            = Column(DateTime, nullable=True)

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


class WeeklyDigestLog(Base):
    """One row per digest actually mailed to a user, so the scheduler can tell
    whether this week's digest already went out — guards against a double
    send if the process restarts mid-week."""
    __tablename__ = "weekly_digest_log"
    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow, index=True)
    status  = Column(String, default="sent")   # sent | failed


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


class RevenueSnapshot(Base):
    """A finalized weekly/monthly revenue total, written once by the cron job
    when its period closes (see services/revenue.py + digest_scheduler.py).
    Live "so far this week/month" numbers are computed on the fly instead —
    this table only ever holds completed periods, so the trend chart has a
    stable history that doesn't shift as new payments come in.
    """
    __tablename__ = "revenue_snapshots"
    id              = Column(Integer, primary_key=True, index=True)
    period_type     = Column(String, index=True)   # "week" | "month"
    period_start    = Column(DateTime)
    period_end      = Column(DateTime)
    total_usd       = Column(Float, default=0)
    breakdown_json  = Column(Text)   # {"trial":0,"basic":..,"pro":..,"agency":..} in USD
    approved_count  = Column(Integer, default=0)
    created_at      = Column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    """Small key/value store for admin-editable text, e.g. payment instructions."""
    __tablename__ = "app_settings"
    key        = Column(String, primary_key=True)
    value      = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminActivityLog(Base):
    """Audit trail of admin-only mutations, written by services/audit.py."""
    __tablename__ = "admin_activity_log"
    id         = Column(Integer, primary_key=True, index=True)
    admin_id   = Column(Integer, ForeignKey("users.id"))
    admin_name = Column(String)   # denormalized so the log still reads if the admin account is later removed
    action     = Column(String, index=True)   # e.g. "plan_limit.update", "broadcast.send"
    target     = Column(String, default="")   # e.g. "plan:pro", "users:42 matched"
    detail     = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class CronRunLog(Base):
    """One row per background-job run, written by digest_scheduler._run()."""
    __tablename__ = "cron_run_log"
    id      = Column(Integer, primary_key=True, index=True)
    job_id  = Column(String, index=True)
    status  = Column(String)   # "success" | "failed"
    detail  = Column(Text, default="")
    ran_at  = Column(DateTime, default=datetime.utcnow, index=True)


class PlatformLog(Base):
    """General platform-wide diagnostics log — errors, warnings and notable
    system events, deliberately NOT per-user personal activity (that's what
    History/AdminActivityLog already cover). Auto-trimmed by a daily cron job
    per RETENTION_DAYS in services/platform_log.py, so this table never grows
    unbounded."""
    __tablename__ = "platform_log"
    id         = Column(Integer, primary_key=True, index=True)
    level      = Column(String, index=True)   # info | warning | error
    source     = Column(String, index=True)   # e.g. "POST /companies/bulk-delete", "cron:daily_tasks_reset"
    message    = Column(Text)
    detail     = Column(Text, default="")     # traceback / extra context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


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
# MARKETPLACE (Phase 6, beta) — client posts a project, freelancers propose,
# an accepted proposal becomes a contract with milestones. Payment reuses the
# same "manual transfer + admin approval" pattern as PaymentRequest above
# (see MilestonePayment) rather than a real held-funds escrow, because holding
# third-party funds requires money-transmitter/EMI licensing that isn't
# available yet. Any account can be both a client and a freelancer — there is
# no separate role column; a Contract's client_id/freelancer_id decide it.
# ─────────────────────────────────────────
class Project(Base):
    __tablename__ = "mp_projects"
    id          = Column(Integer, primary_key=True, index=True)
    client_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title       = Column(String, nullable=False)
    description = Column(Text)
    category    = Column(String)
    budget_min  = Column(Float)
    budget_max  = Column(Float)
    currency    = Column(String, default="USD")
    deadline    = Column(DateTime, nullable=True)
    status      = Column(String, default="open", index=True)  # open | in_progress | completed | cancelled
    skills      = Column(Text, nullable=True)  # JSON list of strings, e.g. ["3D Rendering","Vray"]
    experience_level = Column(String, nullable=True)  # entry | intermediate | expert
    created_at  = Column(DateTime, default=datetime.utcnow)


class Proposal(Base):
    __tablename__ = "mp_proposals"
    id               = Column(Integer, primary_key=True, index=True)
    project_id       = Column(Integer, ForeignKey("mp_projects.id"), nullable=False, index=True)
    freelancer_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cover_letter     = Column(Text)
    # Work samples sent with the bid — a portfolio link or an uploaded file.
    # A cover letter alone rarely wins the job in this trade.
    attachment_url   = Column(String, nullable=True)
    proposed_amount  = Column(Float)
    proposed_days    = Column(Integer)
    status           = Column(String, default="pending", index=True)  # pending | accepted | rejected | withdrawn
    created_at       = Column(DateTime, default=datetime.utcnow)


class Contract(Base):
    __tablename__ = "mp_contracts"
    id            = Column(Integer, primary_key=True, index=True)
    project_id    = Column(Integer, ForeignKey("mp_projects.id"), nullable=False, index=True)
    proposal_id   = Column(Integer, ForeignKey("mp_proposals.id"), nullable=False)
    client_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    freelancer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    total_amount  = Column(Float)
    currency      = Column(String, default="USD")
    status        = Column(String, default="active", index=True)  # active | completed | disputed | cancelled
    created_at    = Column(DateTime, default=datetime.utcnow)


class Milestone(Base):
    __tablename__ = "mp_milestones"
    id             = Column(Integer, primary_key=True, index=True)
    contract_id    = Column(Integer, ForeignKey("mp_contracts.id"), nullable=False, index=True)
    title          = Column(String, nullable=False)
    description    = Column(Text)
    amount         = Column(Float, nullable=False)
    due_date       = Column(DateTime, nullable=True)
    order_index    = Column(Integer, default=0)
    # pending (not yet funded) | funded (client paid, admin approved receipt) |
    # delivered (freelancer submitted work) | approved (client accepted) |
    # released (admin paid the freelancer out) | disputed
    status         = Column(String, default="pending", index=True)
    deliverable_url = Column(String, nullable=True)
    delivered_at   = Column(DateTime, nullable=True)
    approved_at    = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


class MilestonePayment(Base):
    """Client's claim of having paid a milestone, awaiting admin confirmation —
    the exact same shape/flow as PaymentRequest, just against a milestone
    instead of a plan."""
    __tablename__ = "mp_milestone_payments"
    id          = Column(Integer, primary_key=True, index=True)
    milestone_id = Column(Integer, ForeignKey("mp_milestones.id"), nullable=False, index=True)
    amount      = Column(Float)
    currency    = Column(String, default="USD")
    method      = Column(String)
    reference   = Column(String)
    receipt_url = Column(String)
    note        = Column(Text)
    status      = Column(String, default="pending", index=True)  # pending | approved | rejected
    admin_note  = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)


class MilestonePayout(Base):
    """Admin's record of manually paying the freelancer out for a released
    milestone — the mirror image of MilestonePayment."""
    __tablename__ = "mp_milestone_payouts"
    id           = Column(Integer, primary_key=True, index=True)
    milestone_id = Column(Integer, ForeignKey("mp_milestones.id"), nullable=False, index=True)
    amount       = Column(Float)
    method       = Column(String)
    reference    = Column(String)
    admin_note   = Column(Text)
    paid_at      = Column(DateTime, default=datetime.utcnow)


class Conversation(Base):
    """A thread between exactly two accounts.

    Chat started as contract-only, but people need to talk *before* there's a
    contract — a client asking a freelancer whether they're free at all. So a
    conversation stands on its own and merely *may* be attached to a contract.
    The pair is stored low-id-first so (a,b) and (b,a) can't both exist.
    """
    __tablename__ = "mp_conversations"
    id          = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("mp_contracts.id"), nullable=True, index=True)
    user_a_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_b_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", "contract_id", name="uq_conversation_pair"),
    )


class ContractMessage(Base):
    __tablename__ = "mp_contract_messages"
    id             = Column(Integer, primary_key=True, index=True)
    # Nullable now that a message can belong to a plain direct conversation.
    # Kept alongside conversation_id because every contract-scoped query in
    # the app already reads it.
    contract_id    = Column(Integer, ForeignKey("mp_contracts.id"), nullable=True, index=True)
    conversation_id = Column(Integer, ForeignKey("mp_conversations.id"), nullable=True, index=True)
    sender_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    body           = Column(Text)
    attachment_url = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, index=True)
    read_at        = Column(DateTime, nullable=True)


class Notification(Base):
    """In-app alerts, so nobody has to poll a page to find out something needs
    them — an admin especially, since payouts only move when they act.

    Deliberately denormalised: the title/body are rendered at creation time
    rather than reconstructed later, so an old notification keeps saying what
    it said even after the underlying row moves on.
    """
    __tablename__ = "mp_notifications"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind       = Column(String, index=True)   # see services/notifications.py
    title      = Column(String, nullable=False)
    body       = Column(Text)
    link       = Column(String)               # where clicking it should go
    read_at    = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class EmailReputationEvent(Base):
    """One row per send-health event, so a per-user reputation score can be
    derived without a bounce webhook (Resend isn't wired to one). ``sent`` and
    ``replied`` are logged automatically; ``bounced_manual`` is an admin's own
    record that a send is known to have failed, entered by hand."""
    __tablename__ = "email_reputation_events"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    event_type  = Column(String, nullable=False)   # sent | replied | bounced_manual
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)


class UserVerification(Base):
    """Identity and payout details.

    Money leaves Archon by hand, so a payout needs a real name, a real card
    and a way to reach the person if a transfer bounces. Kept in its own table
    rather than on `users` because it's the sensitive half — only the owner
    and an admin may ever read it.
    """
    __tablename__ = "mp_user_verification"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    # ── identity ──
    legal_name    = Column(String)
    national_id   = Column(String)      # کد ملی
    phone         = Column(String)
    address       = Column(Text)
    city          = Column(String)
    country       = Column(String)
    postal_code   = Column(String)
    id_document_url = Column(String)    # scan/photo of the ID

    # ── payout ──
    bank_name       = Column(String)
    account_holder  = Column(String)
    card_number     = Column(String)    # شماره کارت
    iban            = Column(String)    # شماره شبا

    # unverified | pending | verified | rejected
    status        = Column(String, default="unverified", index=True)
    admin_note    = Column(Text)
    submitted_at  = Column(DateTime)
    reviewed_at   = Column(DateTime)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Review(Base):
    __tablename__ = "mp_reviews"
    id          = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("mp_contracts.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rating      = Column(Integer, nullable=False)  # 1-5
    comment     = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)


class Post(Base):
    """A short text+image update in the marketplace's community feed."""
    __tablename__ = "mp_posts"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    text       = Column(Text, nullable=False)
    image_url  = Column(String, nullable=True)
    is_deleted = Column(Boolean, default=False, index=True)  # soft-delete keeps reports meaningful
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class PostLike(Base):
    __tablename__ = "mp_post_likes"
    id         = Column(Integer, primary_key=True, index=True)
    post_id    = Column(Integer, ForeignKey("mp_posts.id"), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_like"),)


class PostComment(Base):
    __tablename__ = "mp_post_comments"
    id         = Column(Integer, primary_key=True, index=True)
    post_id    = Column(Integer, ForeignKey("mp_posts.id"), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    text       = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class PostReport(Base):
    __tablename__ = "mp_post_reports"
    id          = Column(Integer, primary_key=True, index=True)
    post_id     = Column(Integer, ForeignKey("mp_posts.id"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reason      = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("post_id", "reporter_id", name="uq_post_report"),)


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


def _backfill_conversations():
    """Give every contract a conversation and attach its existing messages.

    Chat predates the Conversation table, so messages already sent point only
    at a contract. Runs on every startup but does nothing once each contract
    has its thread.
    """
    db = SessionLocal()
    try:
        contracts = db.query(Contract).all()
        made = 0
        for c in contracts:
            existing = db.query(Conversation).filter(Conversation.contract_id == c.id).first()
            if not existing:
                a, b = sorted((c.client_id, c.freelancer_id))
                existing = Conversation(contract_id=c.id, user_a_id=a, user_b_id=b)
                db.add(existing)
                db.flush()
                made += 1
            db.query(ContractMessage).filter(
                ContractMessage.contract_id == c.id,
                ContractMessage.conversation_id.is_(None),
            ).update({ContractMessage.conversation_id: existing.id}, synchronize_session=False)
        if made:
            print(f"✅ Marketplace: created {made} contract conversation(s)")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️  Conversation backfill skipped: {e}")
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

        # The marketplace first shipped opt-in, so accounts created before this
        # have the flag off and would never see the section. Switch them on
        # exactly once; after that an "off" value is the admin's deliberate
        # choice for that account and must be left alone.
        if not db.query(AppSetting).filter(AppSetting.key == "marketplace_opened_to_all").first():
            db.query(User).filter(
                (User.marketplace_beta_enabled.is_(False)) | (User.marketplace_beta_enabled.is_(None))
            ).update({User.marketplace_beta_enabled: True}, synchronize_session=False)
            db.add(AppSetting(key="marketplace_opened_to_all", value="1"))
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
            if _inspector.has_table("mp_projects"):
                project_cols = [c["name"] for c in _inspector.get_columns("mp_projects")]
                if "skills" not in project_cols:
                    conn.execute(_text("ALTER TABLE mp_projects ADD COLUMN skills TEXT"))
                    conn.commit()
                if "experience_level" not in project_cols:
                    conn.execute(_text("ALTER TABLE mp_projects ADD COLUMN experience_level VARCHAR"))
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

            # ── Marketplace (Phase 6, beta) — new columns on the existing users table ──
            if "marketplace_beta_enabled" not in user_cols:
                default_val = "TRUE" if "postgresql" in str(engine.url) else "1"
                conn.execute(_text(f"ALTER TABLE users ADD COLUMN marketplace_beta_enabled BOOLEAN DEFAULT {default_val}"))
                conn.commit()
            if "account_mode" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN account_mode VARCHAR DEFAULT 'freelancer'"))
                conn.execute(_text("UPDATE users SET account_mode = 'freelancer' WHERE account_mode IS NULL"))
                conn.commit()
            if _inspector.has_table("mp_proposals"):
                prop_cols = [c["name"] for c in _inspector.get_columns("mp_proposals")]
                if "attachment_url" not in prop_cols:
                    conn.execute(_text("ALTER TABLE mp_proposals ADD COLUMN attachment_url VARCHAR"))
                    conn.commit()
            if _inspector.has_table("mp_contract_messages"):
                msg_cols = [c["name"] for c in _inspector.get_columns("mp_contract_messages")]
                if "conversation_id" not in msg_cols:
                    conn.execute(_text("ALTER TABLE mp_contract_messages ADD COLUMN conversation_id INTEGER"))
                    conn.commit()
                # contract_id was NOT NULL before direct messages existed.
                nullable = next(
                    (col.get("nullable") for col in _inspector.get_columns("mp_contract_messages")
                     if col["name"] == "contract_id"),
                    True,
                )
                if not nullable:
                    if "postgresql" in str(engine.url):
                        conn.execute(_text("ALTER TABLE mp_contract_messages ALTER COLUMN contract_id DROP NOT NULL"))
                        conn.commit()
                    else:
                        # SQLite can't alter a column in place — rebuild the
                        # table and copy the rows across.
                        conn.execute(_text("""
                            CREATE TABLE mp_contract_messages_new (
                                id INTEGER NOT NULL PRIMARY KEY,
                                contract_id INTEGER,
                                conversation_id INTEGER,
                                sender_id INTEGER NOT NULL,
                                body TEXT,
                                attachment_url VARCHAR,
                                created_at DATETIME,
                                read_at DATETIME
                            )"""))
                        conn.execute(_text("""
                            INSERT INTO mp_contract_messages_new
                                (id, contract_id, conversation_id, sender_id, body, attachment_url, created_at, read_at)
                            SELECT id, contract_id, conversation_id, sender_id, body, attachment_url, created_at, read_at
                            FROM mp_contract_messages"""))
                        conn.execute(_text("DROP TABLE mp_contract_messages"))
                        conn.execute(_text("ALTER TABLE mp_contract_messages_new RENAME TO mp_contract_messages"))
                        conn.commit()
            if "skills" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN skills TEXT"))
                conn.commit()
            if "hourly_rate" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN hourly_rate FLOAT"))
                conn.commit()
            if "google_refresh_token_encrypted" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN google_refresh_token_encrypted TEXT"))
                conn.commit()
            if "google_email" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN google_email VARCHAR"))
                conn.commit()
            if "google_connected_at" not in user_cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN google_connected_at TIMESTAMP"))
                conn.commit()
    except Exception as e:
        print(f"⚠️  Column migration check: {e}")

    _backfill_multitenancy()
    _backfill_conversations()
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
