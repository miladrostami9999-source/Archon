# Archon — Status Report

> این فایل خلاصه‌ی وضعیت پروژه‌ست. هر وقت گفتید «استاتوس رو ثبت کن»، این فایل رو با آخرین وضعیت آپدیت می‌کنم.
> طراحی شده که قابل کپی/انتقال به یک AI دیگه باشه برای مشاوره — همه چیز خودایستا و بدون نیاز به context قبلی نوشته می‌شه.

**آخرین آپدیت:** 2026-07-17

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

### باقی‌مانده Phase 4 (نیاز به Deploy)
- [ ] خرید Railway ($5/mo) + Deploy backend
- [ ] Deploy frontend روی Vercel
- [ ] اتصال دامنه armiladesign.com (خریده‌شده، DNS وصل نشده)
- [ ] File Storage روی Cloudflare R2 (الان portfolio images به‌صورت base64 در DB)
- [ ] اجرای `migrate_to_postgres.py` بعد از ساخت DB روی Railway
- [ ] Public signup endpoint واقعی (الان فقط `POST /auth/users` توسط ادمین — بدون self-serve)

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
