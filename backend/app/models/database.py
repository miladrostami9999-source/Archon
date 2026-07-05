from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
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
    event_type  = Column(String)
    description = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="history")

# ─────────────────────────────────────────
# TABLE 7 — DAILY TASKS
# ─────────────────────────────────────────
class DailyTask(Base):
    __tablename__ = "daily_tasks"
    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    task_type   = Column(String)
    title       = Column(String)
    description = Column(Text)
    priority    = Column(Integer, default=3)
    is_done     = Column(Boolean, default=False)
    date        = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="tasks")

# ─────────────────────────────────────────
# INIT + SEED ADMIN
# ─────────────────────────────────────────
def init_db():
    Base.metadata.create_all(bind=engine)

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
