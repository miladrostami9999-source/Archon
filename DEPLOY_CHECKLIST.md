# Deploy Checklist: Archon — Phase 4 Cloud Deploy
**تاریخ:** _(هر بار که اجرا کردید پر کنید)_ | **مسئول:** Milad Rostami

> اولین دیپلوی واقعی پروژه (از localhost به Railway + Vercel + Postgres). چون تیم CI/CD یا monitoring متصل نداریم، این چک‌لیست دستیه — قبل از هر مرحله تیک بزنید.

---

## بخش ۱ — آماده‌سازی کد (قبل از هرگونه دیپلوی)

- [ ] آخرین تغییرات commit و push شده‌ن (`git status` تمیزه)
- [ ] بک‌اند لوکال با `uvicorn app.main:app --reload` بدون خطا بالا میاد
- [ ] فرانت لوکال با `npm run dev` بدون خطا بالا میاد و به بک‌اند لوکال وصل می‌شه
- [ ] یک بک‌آپ دستی از دیتابیس SQLite فعلی گرفته شده (`POST /companies/backup/run` یا کپی مستقیم فایل `.db`) — قبل از هر migration
- [ ] `backend/requirements.txt` به‌روزه و شامل `psycopg2-binary` هست (برای Postgres)
- [ ] فایل `.env` واقعی (secrets) **در `.gitignore`** هست و هرگز push نشده — چک کنید با `git log --all --full-history -- backend/.env`

## بخش ۲ — متغیرهای محیطی (Environment Variables)

اینا باید روی Railway (بک‌اند) و Vercel (فرانت) تنظیم بشن — نه فقط لوکال:

**Railway (Backend):**
- [ ] `DATABASE_URL` (خودکار توسط Railway وقتی Postgres addon اضافه می‌شه)
- [ ] `ANTHROPIC_API_KEY` (کلید واقعی Claude)
- [ ] `JWT_SECRET` — **یک مقدار جدید و رندوم برای production بسازید، همون مقدار لوکال رو استفاده نکنید**
- [ ] `SMTP_EMAIL`, `SMTP_APP_PASSWORD`, `SMTP_SENDER_NAME`
- [ ] `ALLOWED_ORIGINS` — باید شامل دامنه‌ی نهایی فرانت (مثلاً `https://archon.armiladesign.com`) باشه، نه فقط localhost
- [ ] `BACKUP_DIR=/data/backups` — بعد از ساخت Railway Volume (جزئیات در بخش ۶)

**Vercel (Frontend):**
- [ ] `NEXT_PUBLIC_API_URL` (یا اسم مشابه) → آدرس بک‌اند روی Railway، نه `localhost:8000`

- [ ] هیچ‌کدوم از این مقادیر داخل کد هاردکد نشدن (چک با grep برای `localhost:8000` و کلیدهای API در سورس فرانت)

## بخش ۳ — دیتابیس / Migration

- [ ] یک Postgres instance روی Railway ساخته شده
- [ ] `migrate_to_postgres.py` یک‌بار روی دیتای local SQLite اجرا و خروجیش بررسی شده (تعداد ردیف‌های هر جدول با مبدا مطابقت داره)
- [ ] بعد از migration، یک login تستی و یک GET لیست companies از production DB انجام شده تا مطمئن بشیم داده واقعاً منتقل شده
- [ ] ⚠️ **قبل از اجرای migration روی داده‌ی واقعی، حتماً بک‌آپ بخش ۱ رو دوباره چک کنید** — این عملیات یک‌طرفه‌ست

## بخش ۴ — Deploy مرحله‌ای

- [ ] Backend روی Railway deploy شده و `/health` جواب `200 {"status":"ok"}` می‌ده
- [ ] Frontend روی Vercel deploy شده و صفحه‌ی login بالا میاد
- [ ] یک لاگین واقعی از فرانت production به بک‌اند production تست شده (نه لوکال)
- [ ] CORS خطا نمی‌ده (چک کنید در Console مرورگر — علامت رایج‌ترین خطای بعد از دیپلوی)

## بخش ۵ — دامنه و DNS

- [ ] رکورد DNS دامنه `armiladesign.com` به Vercel اشاره می‌کنه (A/CNAME طبق راهنمای Vercel)
- [ ] SSL/HTTPS به‌صورت خودکار توسط Vercel صادر شده (چند دقیقه طول می‌کشه)
- [ ] بعد از انتشار DNS (ممکنه تا چند ساعت طول بکشه)، دامنه‌ی نهایی رو دوباره باز کنید و کل مسیر لاگین → dashboard رو تست کنید

## بخش ۶ — تست مسیرهای حیاتی (Smoke Test) روی Production

بعد از این‌که همه چیز بالا اومد، این مسیرها رو **دستی، با چشم خودتون** تست کنید (نه فقط با فرض این‌که کار می‌کنه):

- [ ] Login با یوزر واقعی
- [ ] مشاهده‌ی لیست شرکت‌ها و باز کردن یک شرکت
- [ ] تولید ایمیل با AI (چک کنه `ANTHROPIC_API_KEY` روی production درست کار می‌کنه)
- [ ] ارسال یک ایمیل واقعی با SMTP (چک کنه App Password درست ست شده)
- [ ] Public Profile (`/u/username`) بدون لاگین باز می‌شه
- [ ] Forgot Password → ایمیل واقعی دریافت می‌شه
- [ ] Weekly Report (اگه قفل نبود) تولید می‌شه
- [ ] Backup manual (`/backup/run`) کار می‌کنه و مسیر ذخیره‌سازی روی Railway پایدار می‌مونه — ✅ کد الان از `BACKUP_DIR` env var پشتیبانی می‌کنه؛ روی Railway باید:
  1. یک **Volume** بسازید و mount کنید (مثلاً روی `/data`)
  2. env var `BACKUP_DIR=/data/backups` رو در Railway تنظیم کنید
  3. بدون این دو قدم، بک‌آپ‌ها با هر redeploy پاک می‌شن

## بخش ۷ — نکات امنیتی نهایی

- [ ] `DEBUG`/development mode در بک‌اند خاموشه
- [ ] هیچ کلید API یا پسورد در پاسخ‌های API لو نمی‌ره (چک کنید response شرکت‌ها/یوزرها هیچ فیلد حساسی نداره)
- [ ] Rate limiting یا حداقل محدودیت پایه روی `/auth/login` هست (اگه نیست، به لیست بعد از دیپلوی اضافه کنید — بلاکر deploy نیست)

## بخش ۸ — بعد از Deploy

- [ ] `STATUS.md` آپدیت بشه: Phase 4 → کامل، تاریخ deploy ثبت بشه
- [ ] یک بک‌آپ تازه از production گرفته بشه (اولین بک‌آپ رسمی)
- [ ] پلن مانیتورینگ ساده تعریف بشه: چک روزانه‌ی دستی `/health` یا لاگ‌های Railway در هفته‌ی اول

---

## Rollback — اگه چیزی خراب شد

- **بک‌اند:** Railway نسخه‌ی قبلی رو نگه می‌داره — از داشبورد Railway می‌تونید به deploy قبلی rollback کنید
- **فرانت:** Vercel هم همینطور — از تب Deployments، نسخه‌ی قبلی رو "Promote to Production" کنید
- **دیتابیس:** اگه migration خراب بود، از بک‌آپ بخش ۱ (قبل از migration) روی SQLite لوکال ادامه بدید تا مشکل حل بشه — به production پوش نکنید تا مطمئن نشدید
