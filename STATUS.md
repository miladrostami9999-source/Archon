# Archon — Status Report

> این فایل خلاصه‌ی وضعیت پروژه‌ست. هر وقت گفتید «استاتوس رو ثبت کن»، این فایل رو با آخرین وضعیت آپدیت می‌کنم.
> طراحی شده که قابل کپی/انتقال به یک AI دیگه باشه برای مشاوره — همه چیز خودایستا و بدون نیاز به context قبلی نوشته می‌شه.

**آخرین آپدیت:** 2026-07-21 — ✅ **Phase 4 تکمیل شد.** پلتفرم زنده روی `app.armiladesign.com` — دامنه، R2، ایمیل، پروفایل عمومی و waitlist همه عملیاتی. آماده‌ی شروع Phase 5.

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

## ۲. فاز فعلی: ✅ Phase 4 تکمیل شد — آماده‌ی Phase 5

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

### تمام‌شده — دامنه، R2، و اصلاحات نهایی (2026-07-21)
- [x] ۵ env var مربوط به R2 روی Railway ست شد — آپلود واقعاً روی R2 می‌ره (تست‌شده)
- [x] `FRONTEND_URL` ست شد — لینک فورگت‌پسورد درست شد
- [x] **دامنه‌ی `app.armiladesign.com` وصل شد** (Vercel، DNS خودکار). سایت پورتفولیو روی `armiladesign.com` دست‌نخورده. `ALLOWED_ORIGINS` هم آپدیت شد.
- [x] تست‌های production: attachment، Weekly Report، Daily Tasks، پروفایل عمومی — همه تأیید شدن
- [x] دسترسی: Admin Panel/Users/Waitlist فقط ادمین؛ Admin Panel ریسپانسیو شد
- [x] پابلیک پروفایل: باگ ذخیره‌نشدن در سرور رفع شد (فقط localStorage بود)
- [x] پورتفولیو: ادیت پروژه (عنوان/توضیح/لینک) + alt text برای هر عکس
- [x] **[امنیتی]** endpointهای بک‌آپ اصلاً احراز هویت نداشتن — فقط ادمین شدن + endpoint دانلود امن اضافه شد

## ✅ Phase 4 تکمیل شد

**تنها کار عملیاتی باقی‌مانده (نه کد):** یک بک‌آپ رسمی از production بگیر و با دکمه‌ی جدید **Download** یه نسخه‌ش رو جایی بیرون از Railway نگه دار.

---

## ۳. فازهای پیش رو

### 🎯 Phase 5 — SaaS Launch (فاز بعدی، به ترتیب اجرا)

> ترتیب بر اساس **وابستگی** چیده شده — هر مرحله پیش‌نیاز مرحله‌ی بعدیه. از قدم ۱ شروع می‌کنیم.

**قدم ۱ — Multi-tenant واقعی** 🔴 *پایه‌ی همه چیز، بزرگ‌ترین کار*
- الان `companies` هیچ فیلد مالکیت نداره و status/heat/favorite/notes/campaigns/tasks/reports بین همه‌ی کاربرا مشترکه
- **مدل موردنظر:** catalog شرکت‌ها **مشترک** بمونه (هدف ۳۰۰۰ شرکت)، ولی **state هر کاربر جدا** باشه (یه جدول overlay با `user_id` برای status/favorite/heat + افزودن `user_id` به notes/campaigns/daily_tasks/weekly_reports)
- **نکته‌ی کلیدی:** ترتیب نمایش شرکت‌ها باید برای هر کاربر **متفاوت/رندوم** باشه (seed مخصوص هر اکانت) تا با ۳۰۰۰ شرکت، همه فقط سراغ ۲۰ تای اول نرن. یه گزینه‌ی sort «new» هم اضافه بشه
- ⚠️ migration یک‌طرفه روی Postgres زنده — قبلش حتماً بک‌آپ

**قدم ۲ — لیمیت‌های واقعی + نمایش اعتبار** *(وابسته به قدم ۱)*
- شمارش واقعی مصرف هر کاربر (ایمیل ارسالی، تعداد شرکت)
- نمایش باقی‌مانده تو داشبورد (مثلاً «۳۲ از ۵۰ ایمیل باقی‌مونده»)
- auto-disable بعد از ۳۰ روز یا اتمام سهمیه → نیاز به تمدید

**قدم ۳ — پلن رایگان ۷ روزه** *(وابسته به قدم ۲)*
- ۱۰ شرکت، ۱۰ ایمیل، انقضای ۷ روزه
- در آینده: فقط شرکت‌های چند کشور محدود نمایش داده بشه، بقیه قفل

**قدم ۴ — باز کردن Signup واقعی** *(وابسته به ۱–۳)*
- تبدیل waitlist فعلی به ثبت‌نام مستقیم (چون دیگه دیتا ایزوله‌ست و امنه)

**قدم ۵ — Stripe Billing** *(وابسته به ۲ و ۳)*
- پرداخت $19/$49/$99، مدیریت اشتراک، کنسل خودکار

**قدم ۶ به بعد — بدون وابستگی، هر وقت خواستیم:**
- Gmail OAuth per-user (هر کاربر با ایمیل خودش بفرسته، به‌جای Resend مشترک)
- داشبورد آنالیتیکس ایمیل هر کاربر (تعداد ارسال، reply rate شخصی)
- دسترسی ادمین به پروفایل/دیتای هر ممبر *(عمداً به اینجا موکول شد — بعد از Multi-tenant معنی «همه‌ی دیتاش» روشن می‌شه)*
- Admin Export to Excel + Broadcast/Notification system
- Data Collection Campaign (هدف ۳۰۰۰ شرکت verified)
- AI Lead Discovery

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

**Phase 4 بسته شد.** قدم بعدی: شروع **Phase 5 قدم ۱ — Multi-tenant واقعی**.

قبل از نوشتن هر کدی برای Multi-tenant:
1. یک بک‌آپ کامل از production بگیر و **دانلودش کن** (چون migration یک‌طرفه‌ست)
2. اول schema رو طراحی و تأیید کن: جدول overlay برای state هر کاربر + افزودن `user_id` به notes/campaigns/daily_tasks/weekly_reports
3. ترتیب نمایش با seed مخصوص هر کاربر + گزینه‌ی sort «new» رو از همون اول در query اصلی لحاظ کن (بعداً اضافه‌کردنش سخت‌تره)
