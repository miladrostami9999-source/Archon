import shutil
import os
from datetime import datetime

# مسیرها
DB_PATH = r"C:\Users\Milad Rostami\archon\database\archon.db"
BACKUP_DIR = r"C:\Users\Milad Rostami\archon\backup"

def backup():
    if not os.path.exists(DB_PATH):
        print("❌ Database not found!")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)

    # اسم فایل با تاریخ و ساعت
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    backup_file = os.path.join(BACKUP_DIR, f"archon_backup_{timestamp}.db")

    shutil.copy2(DB_PATH, backup_file)
    print(f"✅ Backup saved: archon_backup_{timestamp}.db")

    # نگه داشتن فقط ۷ backup آخر
    backups = sorted([
        f for f in os.listdir(BACKUP_DIR) if f.endswith('.db')
    ])

    if len(backups) > 7:
        for old in backups[:-7]:
            os.remove(os.path.join(BACKUP_DIR, old))
            print(f"🗑 Removed old backup: {old}")

    print(f"📁 Total backups: {min(len(backups), 7)}")

if __name__ == "__main__":
    backup()