from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

# ─────────────────────────────────────────
# DATABASE SETUP
# ─────────────────────────────────────────
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
# TABLE 1 — COMPANIES
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
# TABLE 2 — CONTACTS
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
# TABLE 3 — NOTES
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
# TABLE 4 — CAMPAIGNS
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
# TABLE 5 — HISTORY
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
# TABLE 6 — DAILY TASKS
# ─────────────────────────────────────────
class DailyTask(Base):
    __tablename__ = "daily_tasks"
    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    task_type   = Column(String)
    description = Column(Text)
    priority    = Column(Integer, default=3)
    is_done     = Column(Boolean, default=False)
    date        = Column(DateTime, default=datetime.utcnow)
    company = relationship("Company", back_populates="tasks")

# ─────────────────────────────────────────
# INIT
# ─────────────────────────────────────────
def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Archon Database initialized successfully")

if __name__ == "__main__":
    init_db()