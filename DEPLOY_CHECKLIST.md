# Deploy Checklist: Archon — Phase 4 Cloud Deploy
**تاریخ:** _(هر بار که اجرا کردید پر کنید)_ | **مسئول:** Milad Rostami

> اولین دیپلوی واقعی پروژه (از localhost به Railway + Vercel + Postgres). چون تیم CI/CD یا monitoring متصل نداریم، این چک‌لیست دستیه — قبل از هر مرحله تیک بزنید.

---

## بخش ۱ — آماده‌سازی کد (قبل از هرگونه دیپلوی)

- [ ] آخرین تغییرات commit و push شده‌ن (`git status` تمیزه)
- [ ] بک‌اند لوکال با `uvicorn app.main:app --reload` بدون خطا بالا میاد
- [ ] فرانت لوکال با `npm run dev` بدون خطا بالا میاد و به بک‌اند لوکال وصل می‌شه
- [ ] یک بک‌آپ دستی از دیتابیس SQLite فعلی گرفته شده (`POST /companies/backup/run` یا کپی مستقیم فایل `.db`) — قبل از هر migration (این یکی رو خودتون باید موقع deploy واقعی انجام بدید)
- [x] `backend/requirements.txt` شامل `psycopg2-binary==2.9.9` هست — تأیید شد
- [x] فایل `.env` هرگز در تاریخچه‌ی git نبوده — با `git log --all --full-history` تأیید شد

## بخش ۲ — متغیرهای محیطی (Environment Variables)

اینا باید روی Railway (بک‌اند) و Vercel (فرانت) تنظیم بشن — نه فقط لوکال:

**Railway (Backend):**
- [x] `DATABASE_URL` — از Postgres addon reference شده و کار می‌کنه
- [x] `CLAUDE_API_KEY` — ست شده
- [x] `JWT_SECRET_KEY` — ست شده، لاگین production تست و تأیید شد
- [x] `SMTP_EMAIL`, `SMTP_APP_PASSWORD`, `SMTP_SENDER_NAME` — ست شده (هنوز end-to-end تست ارسال نشده، بخش ۶ رو ببینید)
- [x] `ALLOWED_ORIGINS` — به `https://archon-hazel.vercel.app` ست شد، CORS کار می‌کنه
- [ ] `BACKUP_DIR=/data/backups` — **وضعیتش نامشخصه.** باید تأیید بشه (چک‌لیست تأیید در بخش ۶)

**Vercel (Frontend):**
- [x] `NEXT_PUBLIC_API_URL` در Vercel ست شد و به `https://archon-production-b8a6.up.railway.app` وصله — تأیید شد، فرانت درست به بک‌اند وصل می‌شه

## بخش ۳ — دیتابیس / Migration

- [x] Postgres instance روی Railway ساخته شده (تو همون پروژه‌ی Archon)
- [x] `weekly_reports` جدول migrate می‌شه (رفع شده بود از قبل)
- [x] `migrate_to_postgres.py` اجرا شد — ۷۲ ردیف migrate شد، ۱ یوزر duplicate skip شد (نتیجه‌ی منطقی و درست)
- [x] بعد از migration، لاگین production تست شد و companies واقعی دیده شدن — تأیید شد
- [x] بک‌آپ قبل از migration — لوکال SQLite دست‌نخورده باقی موند (migration فقط خوند، ننوشت)

## بخش ۴ — Deploy مرحله‌ای

- [x] Backend روی Railway deploy شده، `/health` جواب `200` می‌ده — تأیید شد
- [x] Frontend روی Vercel deploy شده (`archon-hazel.vercel.app`)، صفحه‌ی login بالا میاد
- [x] لاگین واقعی از فرانت production به بک‌اند production تست شد و داشبورد باز شد
- [x] CORS درست کار می‌کنه (بعد از ست‌کردن `ALLOWED_ORIGINS`)

## بخش ۵ — دامنه و DNS

> **عمداً به تعویق افتاد.** فعلاً با آدرس `archon-hazel.vercel.app` کار می‌کنیم. این بخش رو هروقت خواستیم دامنه‌ی رسمی armiladesign.com رو وصل کنیم برمی‌گردیم بهش.

- [ ] رکورد DNS دامنه `armiladesign.com` به Vercel اشاره می‌کنه (A/CNAME طبق راهنمای Vercel)
- [ ] SSL/HTTPS به‌صورت خودکار توسط Vercel صادر شده (چند دقیقه طول می‌کشه)
- [ ] بعد از انتشار DNS، دامنه‌ی نهایی رو دوباره باز کنید و کل مسیر لاگین → dashboard رو تست کنید

## بخش ۶ — تست مسیرهای حیاتی (Smoke Test) روی Production

بعد از این‌که همه چیز بالا اومد، این مسیرها رو **دستی، با چشم خودتون** تست کنید (نه فقط با فرض این‌که کار می‌کنه):

- [x] Login با یوزر واقعی — تأیید شد
- [x] مشاهده‌ی لیست شرکت‌ها — تأیید شد (بعد از فیکس CORS/env vars)
- [ ] **باز کردن یک شرکت مشخص، تست ادیت** — هنوز تست نشده
- [ ] تولید ایمیل با AI (چک کنه `CLAUDE_API_KEY` روی production درست کار می‌کنه) — **هنوز تست نشده**
- [ ] ارسال یک ایمیل واقعی با SMTP (چک کنه App Password درست ست شده) — **هنوز تست نشده**
- [ ] Public Profile (`/u/username`) بدون لاگین باز می‌شه — هنوز تست نشده
- [ ] Forgot Password → ایمیل واقعی دریافت می‌شه — هنوز تست نشده
- [ ] Weekly Report تولید می‌شه — هنوز تست نشده
- [ ] Backup manual (`/backup/run`) — **وضعیت Volume نامشخصه.** باید تأیید بشه:
  1. برو Railway → سرویس Archon → Settings → مطمئن شو یه Volume با mount path `/data` وصله
  2. برو Variables → مطمئن شو `BACKUP_DIR=/data/backups` هست
  3. بعد از تأیید هر دو، یه بار `/companies/backup/run` رو بزن و چک کن فایل ساخته میشه

## بخش ۷ — نکات امنیتی نهایی

- [x] `DEBUG`/development mode در بک‌اند وجود نداره (چک شد — هیچ flag دیباگی فعال نیست)
- [x] بررسی شد: هیچ endpoint، `password_hash` رو در پاسخ برنمی‌گردونه (همه‌ی پاسخ‌های `/auth/*` دستی و صریح فیلدهای مجاز رو می‌سازن، نه serialize خام مدل)
- [x] `JWT_SECRET_KEY` بدون مقدار پیش‌فرض ناامن — اگه در `.env` نباشه، برنامه اصلاً بالا نمیاد (fail-safe از قبل موجود بود)
- [ ] Rate limiting یا حداقل محدودیت پایه روی `/auth/login` هست — **فعلاً وجود نداره.** بلاکر deploy نیست (برای یک‌نفره فعلاً ریسک پایینه) ولی قبل از باز کردن signup عمومی در Phase 5 حتماً باید اضافه بشه

## بخش ۸ — بعد از Deploy

- [ ] `STATUS.md` آپدیت بشه: Phase 4 → کامل، تاریخ deploy ثبت بشه
- [ ] یک بک‌آپ تازه از production گرفته بشه (اولین بک‌آپ رسمی)
- [ ] پلن مانیتورینگ ساده تعریف بشه: چک روزانه‌ی دستی `/health` یا لاگ‌های Railway در هفته‌ی اول

---

## Rollback — اگه چیزی خراب شد

- **بک‌اند:** Railway نسخه‌ی قبلی رو نگه می‌داره — از داشبورد Railway می‌تونید به deploy قبلی rollback کنید
- **فرانت:** Vercel هم همینطور — از تب Deployments، نسخه‌ی قبلی رو "Promote to Production" کنید
- **دیتابیس:** اگه migration خراب بود، از بک‌آپ بخش ۱ (قبل از migration) روی SQLite لوکال ادامه بدید تا مشکل حل بشه — به production پوش نکنید تا مطمئن نشدید
