"""
═══════════════════════════════════════════════════════════════════
ARCHON — SQLite → PostgreSQL Migration Script
═══════════════════════════════════════════════════════════════════

هدف: انتقال کامل داده‌های موجود (SQLite محلی) به PostgreSQL (Railway)

نحوه استفاده:
  1. اول روی Railway یک PostgreSQL database بساز
  2. از Railway، مقدار DATABASE_URL رو کپی کن (Connect tab)
  3. این اسکریپت رو با آن URL اجرا کن:

     python migrate_to_postgres.py "postgresql://user:pass@host:port/dbname"

  4. اسکریپت همه جدول‌ها و رکوردها رو منتقل میکنه و در آخر گزارش میده

نکات مهم:
  - این اسکریپت SAFE هست — فقط از SQLite میخونه، چیزی توش تغییر نمیده
  - اگه PostgreSQL از قبل داده داشته باشه، رکوردهای تکراری skip میشن (بر اساس id)
  - قبل از اجرا حتماً از فایل archon.db یک نسخه پشتیبان بگیر (احتیاط)
═══════════════════════════════════════════════════════════════════
"""

import sys
import os
from datetime import datetime
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# ─────────────────────────────────────────
# PATHS & IMPORTS
# ─────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.models.database import (
    Base, User, Company, Contact, Note, Campaign, History, DailyTask, WeeklyReport
)

SQLITE_PATH = r"C:\Users\Milad Rostami\archon\database\archon.db"
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"

# Order matters — respect foreign key dependencies
MODELS_IN_ORDER = [
    (User, "users"),
    (Company, "companies"),
    (Contact, "contacts"),
    (Note, "notes"),
    (Campaign, "campaigns"),
    (History, "history"),
    (DailyTask, "daily_tasks"),
    (WeeklyReport, "weekly_reports"),
]


def get_postgres_url():
    if len(sys.argv) < 2:
        print("❌ Error: PostgreSQL connection URL required.\n")
        print("Usage:")
        print('  python migrate_to_postgres.py "postgresql://user:pass@host:port/dbname"\n')
        print("Get this URL from Railway → your Postgres service → Connect tab → 'Postgres Connection URL'")
        sys.exit(1)

    url = sys.argv[1]
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def model_to_dict(obj, columns):
    """Convert a SQLAlchemy model instance to a plain dict of column values."""
    return {col.name: getattr(obj, col.name) for col in columns}


def migrate():
    print("═" * 60)
    print("  ARCHON — SQLite → PostgreSQL Migration")
    print("═" * 60)

    if not os.path.exists(SQLITE_PATH):
        print(f"❌ SQLite database not found at:\n   {SQLITE_PATH}")
        sys.exit(1)

    postgres_url = get_postgres_url()

    print(f"\n📂 Source (SQLite):      {SQLITE_PATH}")
    print(f"☁️  Destination (Postgres): {postgres_url.split('@')[-1] if '@' in postgres_url else postgres_url}\n")

    confirm = input("Proceed with migration? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Migration cancelled.")
        sys.exit(0)

    # ── CONNECT TO BOTH DATABASES ──
    print("\n🔌 Connecting to databases...")
    sqlite_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
    postgres_engine = create_engine(postgres_url)

    SQLiteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)

    sqlite_db = SQLiteSession()
    postgres_db = PostgresSession()

    # ── CREATE TABLES ON POSTGRES (if not exist) ──
    print("🏗️  Ensuring tables exist on PostgreSQL...")
    Base.metadata.create_all(bind=postgres_engine)

    # ── MIGRATE EACH TABLE ──
    summary = []
    total_migrated = 0
    total_skipped = 0

    for model, table_name in MODELS_IN_ORDER:
        print(f"\n📋 Migrating table: {table_name}")
        columns = model.__table__.columns

        try:
            rows = sqlite_db.query(model).all()
        except Exception as e:
            print(f"   ⚠️  Could not read from SQLite: {e}")
            summary.append((table_name, 0, 0, "read error"))
            continue

        migrated = 0
        skipped = 0

        for row in rows:
            existing = postgres_db.query(model).filter(model.id == row.id).first()
            if existing:
                skipped += 1
                continue

            data = model_to_dict(row, columns)
            new_obj = model(**data)
            postgres_db.add(new_obj)
            migrated += 1

        try:
            postgres_db.commit()
        except Exception as e:
            postgres_db.rollback()
            print(f"   ❌ Commit failed for {table_name}: {e}")
            summary.append((table_name, migrated, skipped, "commit error"))
            continue

        # Reset PostgreSQL sequence so future inserts don't collide with migrated IDs.
        # Raw SQL must go through text() in SQLAlchemy 2.x — passing a bare string
        # raises ObjectNotExecutableError, which a bare except here used to swallow
        # silently, leaving every sequence stuck at 1 and every INSERT after
        # migration crashing with a UniqueViolation on the primary key.
        try:
            postgres_db.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table_name}), 1), true)"
            ))
            postgres_db.commit()
        except Exception as e:
            postgres_db.rollback()
            print(f"   ⚠️  Sequence reset failed for {table_name}: {e}")

        print(f"   ✅ {migrated} migrated, {skipped} already existed (skipped)")
        summary.append((table_name, migrated, skipped, "ok"))
        total_migrated += migrated
        total_skipped += skipped

    sqlite_db.close()
    postgres_db.close()

    # ── FINAL REPORT ──
    print("\n" + "═" * 60)
    print("  MIGRATION SUMMARY")
    print("═" * 60)
    print(f"{'Table':<18}{'Migrated':<12}{'Skipped':<12}{'Status'}")
    print("-" * 60)
    for table_name, migrated, skipped, status in summary:
        print(f"{table_name:<18}{migrated:<12}{skipped:<12}{status}")
    print("-" * 60)
    print(f"{'TOTAL':<18}{total_migrated:<12}{total_skipped:<12}")
    print("═" * 60)
    print(f"\n✅ Migration complete at {datetime.utcnow().isoformat()} UTC")
    print("\nNext steps:")
    print("  1. Set DATABASE_URL in your Railway backend service environment variables")
    print("  2. Redeploy the backend")
    print("  3. Verify data appears correctly in the live app")


if __name__ == "__main__":
    migrate()
