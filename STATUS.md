# Archon — Status Report

> این فایل خلاصه‌ی وضعیت پروژه‌ست. هر وقت گفتید «استاتوس رو ثبت کن»، این فایل رو با آخرین وضعیت آپدیت می‌کنم.
> طراحی شده که قابل کپی/انتقال به یک AI دیگه باشه برای مشاوره — همه چیز خودایستا و بدون نیاز به context قبلی نوشته می‌شه.

**آخرین آپدیت:** 2026-07-18 — Cloud Deploy انجام شد (Railway + Vercel)، production زنده و در دسترسه

---

## ۱. معرفی پروژه (خلاصه‌ی خودایستا)

Archon یک CRM/Business Development OS برای استودیوهای معماری و visualization است، ساخته‌شده توسط Milad Rostami (صاحب استودیوی Armila Design، مادرید، اسپانیا). امروز یک ابزار داخلی outreach است؛ چشم‌انداز بلندمدت تبدیل آن به یک اکوسیستم/marketplace کامل صنعت arch-viz (شبیه ترکیبی از LinkedIn + Upwork + Behance برای این نیچ) است.

**Stack:**
- Backend: FastAPI + SQLAlchemy، SQLite (local) / PostgreSQL (production، از طریق `DATABASE_URL`)
- Frontend: Next.js 14 App Router + TypeScript، inline styles
- AI: Claude API (`claude-sonnet-4-6`) برای تولید ایمیل، خلاصه شرکت، گزارش هفتگی، و Research واقعی با web_search
- مسیر پروژه: `C:\Users\Milad Rostami\archon`
- ریپو: `github.com/MiladRostami9999-source/archon`

---

## ۲. فاز فعلی: Phase 4 — Production Ready (~85-90%)

### تمام‌شده (بدون نیاز به Deploy)
- Landing Page (دوزبانه EN/FA با RTL، تم دارک/لایت، workflow navigation)
- PostgreSQL dual-mode + `migrate_to_postgres.py` آماده اجرا
- Public Profile System (`/u/username`)
- Onboarding Tour (spotlight واقعی، دوزبانه)
- Direct Email Sending (SMTP Gmail، پیوست، reply tracking)
- امنیت: JWT از `.env`، CORS محدود، توکن ۶۰ روزه
- Weekly Report Lock سمت سرور (جدول `weekly_reports`)
- Forgot/Reset Password با ایمیل
- Manual Backup واقعی (JSON در `backend/backups/`)
- AI Company Research واقعی (web_search grounded، نه حدسی)
- **[جدید]** تفکیک `companies.py` (۹۷۱ خط) به پکیج ماژولار `routers/companies/` (۱۳ فایل تخصصی) — بدون تغییر در API، تست‌شده با ۳۵ endpoint

### تمام‌شده — Cloud Deploy (2026-07-18)
- [x] Backend روی Railway، زنده روی `https://archon-production-b8a6.up.railway.app`
- [x] Postgres روی Railway، در همون پروژه‌ی backend
- [x] Frontend روی Vercel، زنده روی `https://archon-hazel.vercel.app`
- [x] `migrate_to_postgres.py` اجرا شد — ۷۲ ردیف منتقل شد، داده‌ی واقعی روی production تأیید شد
- [x] لاگین واقعی از production تست و تأیید شد
- [x] Add Company، Generate Email (AI)، Send Email (Resend) — همه تست و تأیید شدن
- [x] ایمیل از SMTP خام به Resend (HTTPS API) مهاجرت کرد — چون Railway پورت‌های SMTP رو مسدود می‌کنه

### تمام‌شده — R2 + Landing + Signup (2026-07-18/19)
- [x] **File Storage روی Cloudflare R2** — سرویس آپلود (boto3) + endpoint `POST /auth/upload` + سه هندلر فرانت (آواتار، پورتفولیو). عکس‌ها به‌جای base64 روی R2 می‌رن. **کد آماده، نیاز به ست‌کردن ۵ env var روی Railway** (R2_ACCOUNT_ID و...). تا اون موقع fallback به base64 کار می‌کنه.
- [x] **Landing Page عمومی** روی `/` (فایل static در `public/landing.html`، دوزبانه EN/FA). داشبورد رفت به `/dashboard`. کاربر لاگین‌شده خودکار به داشبورد هدایت می‌شه.
- [x] **Signup (Waitlist)** — چون دیتا تا Phase 5 مشترکه، signup عمومی یه waitlist امنه: `POST /auth/signup` (عمومی) + صفحه‌ی `/signup` + `GET /auth/waitlist` (فقط ادمین). CTAهای لندینگ به `/signup?plan=X` وصلن.

### باقی‌مانده Phase 4
- [ ] ست‌کردن ۵ env var مربوط به R2 روی Railway (تا آپلود واقعاً روی R2 بره، نه fallback)
- [ ] **تأیید Railway Volume + `BACKUP_DIR`** — وضعیتش نامشخصه، باید چک بشه (جزئیات در DEPLOY_CHECKLIST.md بخش ۶)
- [ ] ست‌کردن `FRONTEND_URL=https://archon-hazel.vercel.app` روی Railway (لینک فورگت‌پسورد خراب بود)
- [ ] تست attachment واقعی در ارسال ایمیل، Weekly Report، Daily Tasks
- [ ] اتصال دامنه armiladesign.com به پلتفرم (پیشنهاد: زیردامنه‌ی جدا مثل `app.armiladesign.com`) — **فردا** انجام می‌شه. نکته: armiladesign.com الان برای Resend وصله، تداخلی نداره
- [ ] یک بک‌آپ رسمی تازه از production گرفته بشه (بعد از تأیید Volume)

### Phase 5 (بعدی، پیش‌نیاز باز شدن signup واقعی)
- Multi-tenant واقعی (فیلد owner/user_id روی `companies` — الان مشترکه) — پیش‌نیاز اینه که waitlist به signup واقعی تبدیل بشه

---

## ۳. فازهای پیش رو

**Phase 5 — SaaS Launch:** Stripe Billing، Multi-tenant واقعی، Gmail OAuth per-user، Data Collection Campaign (هدف ۳۰۰۰ شرکت verified)، Admin Export to Excel، Broadcast/Notification system.

**Phase 6 — Project Marketplace:** Freelancer/Client project board، Escrow + Milestone payment، Digital contracts، Job listings، Rating system، Community feed.

**Phase 7 — Ecosystem & Scale:** AI project matching، Market Intelligence Reports، Mobile App، Data API ($299/mo)، Verified Badge Program، Enterprise plans.

*(جزئیات کامل هر فاز در `Vision and Roadmap V04.html`)*

---

## ۴. ابزارها و زیرساخت جانبی
- **GitHub:** متصل، push/pull از طریق git کار می‌کند (بدون `gh` CLI)
- **VS Code:** دسترسی computer-use در سطح "click" (بدون تایپ) — برای دیدن/کلیک UI
- **GitHub Desktop:** دسترسی کامل computer-use
- **Graphify:** knowledge graph کدبیس نصب و ساخته شده (`archon/graphify-out/`) — استفاده‌ی موردی برای سوالات ساختاری/چندفایلی، نه هر درخواست (برای صرفه‌جویی توکن)

---

## ۵. باگ‌های اخیر رفع‌شده

**در طول Deploy واقعی پیدا و رفع شد (2026-07-18):**
- `crawl4ai==0.2.77` تو `requirements.txt` دیگه روی PyPI موجود نبود و build Railway رو fail می‌کرد — حذف شد (هیچ‌جای کد استفاده نمی‌شد)
- `python-multipart` (لازم برای آپلود CSV) در `requirements.txt` نبود — اضافه شد
- `.python-version` اضافه شد تا Railway نسخه‌ی سازگار با `psycopg2-binary` انتخاب کنه
- Vercel build fail می‌شد: تضاد peer-dependency بین `react-simple-maps` و React 19 — با `.npmrc` (`legacy-peer-deps=true`) حل شد
- Vercel build fail می‌شد: خطای TypeScript (`JSX.Element` namespace در Sidebar، typeهای گم‌شده در map/page.tsx، `useSearchParams` بدون Suspense در reset-password) — هر سه رفع و با `npm run build` لوکال تأیید شد
- **[بحرانی]** آدرس بک‌اند (`http://localhost:8000`) در ۱۷ فایل فرانت‌اند هاردکد بود — بدون این fix، دیپلوی روی Vercel کاملاً از کار می‌افتاد. الان همه از `NEXT_PUBLIC_API_URL` می‌خونن.
- **[بحرانی]** بعد از migration، sequence شماره‌گذاری خودکار Postgres برای هر ۸ جدول درست نشده بود (یه خط SQL خام بدون `text()` در SQLAlchemy 2.x silent-fail می‌کرد) — هر INSERT جدید (Add Company، Generate Email، Tasks، Weekly Report) با خطای duplicate-key crash می‌کرد و به‌اشتباه به شکل خطای CORS در مرورگر دیده می‌شد. رفع شد + sequenceهای production دستی ریست شدن.
- **[بحرانی]** ارسال ایمیل با SMTP خام کار نمی‌کرد — اول `Network is unreachable` (نبود مسیر IPv6 روی Railway)، بعد از فیکس IPv4 هم `Connection timed out` (Railway پورت‌های SMTP رو مسدود می‌کنه). رفع نهایی: مهاجرت کامل به **Resend** (HTTPS API) برای send-email و forgot-password — نیاز به `RESEND_API_KEY` و `RESEND_FROM_EMAIL` روی دامنه‌ی verified.
- `migrate_to_postgres.py` جدول `weekly_reports` رو migrate نمی‌کرد (قفل ۷روزه‌ی گزارش هفتگی گم می‌شد بعد از مهاجرت) — رفع شد.
- `DEPLOY_CHECKLIST.md` ساخته شد — چک‌لیست کامل قبل از Deploy (env vars، migration، DNS، smoke tests، rollback) و کاملاً بازبینی/تست شد
- Backup path هاردکد بود و روی Railway (filesystem ephemeral) با هر redeploy پاک می‌شد — الان از `BACKUP_DIR` env var پشتیبانی می‌کنه؛ نیاز به ساخت Railway Volume + تنظیم env var قبل از Deploy واقعی (جزئیات در DEPLOY_CHECKLIST.md بخش ۶)
- Sidebar جابجایی هنگام اسکرول (minHeight→height + overflow:hidden)
- Score circle strokeDasharray بدون ضریب مقیاس
- حذف Note امکان‌پذیر نبود (DELETE endpoint اضافه شد)
- `class_mapper` import اشتباه در تفکیک companies.py (از `sqlalchemy.orm` نه `sqlalchemy`)

---

## ۶. تصمیمات و محدودیت‌های شناخته‌شده
- Plan Limits (محدودیت تعداد شرکت بر پلن) عمداً به Phase 5 موکول شد — چون `companies` table هنوز مشترک بین کاربراست، نه per-user
- `backend/app/crawler/` در dependencies هست (`crawl4ai`) ولی خالیه — زیرساخت جمع‌آوری داده هنوز ساخته نشده
- نصب `graphifyy` (دو-Y) به‌جای `graphify` — این عمداً درسته طبق README رسمی پروژه (typosquat هشدار دقیقاً برعکس بود)

---

## ۷. قدم بعدی پیشنهادی
_(این بخش رو با هر آپدیت تغییر بده)_

Cloud Deploy: Railway (Postgres + backend) → اجرای migration → Vercel (frontend) → DNS → R2 → signup endpoint واقعی.
