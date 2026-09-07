'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PartyPopper, Building2, LayoutList, CheckSquare, BarChart3, Globe, Rocket, Briefcase, Send, FileCheck2, Wallet, Inbox, MessageCircle } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// OnboardingTour — real spotlight tour
//
// Highlights actual UI elements (dimmed/blurred background,
// clear cutout around the target), navigates across pages as
// needed, and is bilingual (EN/FA toggle inside the tour card).
//
// SETUP:
//   1. Save as: frontend/app/components/OnboardingTour.tsx
//   2. Mount once in frontend/app/layout.tsx:
//        import OnboardingTour from './components/OnboardingTour'
//        ...
//        <div className="page-enter">{children}</div>
//        <OnboardingTour />
//   3. Add data-tour="..." attributes to the real target elements
//      (see instructions provided alongside this file).
//   4. Reopen anytime by dispatching:
//        window.dispatchEvent(new Event('archon:open-onboarding'))
// ═══════════════════════════════════════════════════════════════

type Step = {
  path: string | null              // route required for this step, or null = works on any page
  selector: string | null          // CSS selector to spotlight, or null = centered modal step
  Icon: any
  title: { en: string; fa: string }
  desc: { en: string; fa: string }
}

// NOTE: "/" is not a Next.js app-router route — next.config.ts rewrites it
// to a static public/landing.html, and that page's own script bounces a
// signed-in visitor straight to /dashboard client-side (a plain
// location.replace, outside React). So the app layout — and this
// component — never actually mounts while pathname is "/"; using it as a
// trigger here was silent dead code. /dashboard is the real, always-hit
// home for a freelancer/admin account; a client-mode account is bounced
// again from there to /client by useRequireFreelancerMode, so that page is
// its own real home too. Steps below target those directly.
const CRM_STEPS: Step[] = [
  {
    path: '/dashboard', selector: null, Icon: PartyPopper,
    title: { en: 'Welcome to Archon', fa: 'به آرکون خوش اومدی' },
    desc: {
      en: "This quick tour will show you exactly where things are. Let's start on your dashboard.",
      fa: 'این تور سریع دقیقاً نشونت میده هر چیزی کجاست. بریم از داشبورد شروع کنیم.',
    },
  },
  {
    path: '/dashboard', selector: '[data-tour="add-company"]', Icon: Building2,
    title: { en: 'Add your first company', fa: 'اولین شرکتت رو اضافه کن' },
    desc: {
      en: 'Click here to add a company by name or website. Archon researches it and scores the fit automatically.',
      fa: 'اینجا کلیک کن تا یک شرکت با اسم یا وبسایت اضافه کنی. آرکون خودکار تحقیق و امتیازدهی می‌کنه.',
    },
  },
  {
    path: '/dashboard', selector: '[data-tour="view-toggle"]', Icon: LayoutList,
    title: { en: 'List or Board view', fa: 'نمای لیست یا برد' },
    desc: {
      en: 'Switch to Board to drag companies through your pipeline — New, Sent, Replied, Client.',
      fa: 'به حالت Board برو تا شرکت‌ها رو در پایپلاین بکشی — New، Sent، Replied، Client.',
    },
  },
  {
    path: '/dashboard', selector: '[data-tour="nav-tasks"]', Icon: CheckSquare,
    title: { en: 'Daily AI tasks', fa: 'وظایف روزانه با AI' },
    desc: {
      en: 'Archon generates a daily task list for you — who to follow up with, what to review.',
      fa: 'آرکون هر روز یک لیست وظایف برات می‌سازه — کی رو پیگیری کنی، چی رو بررسی کنی.',
    },
  },
  {
    path: '/dashboard', selector: '[data-tour="nav-analytics"]', Icon: BarChart3,
    title: { en: 'Track performance', fa: 'پیگیری عملکرد' },
    desc: {
      en: 'See your pipeline health, reply rates, and top industries — all in one view.',
      fa: 'سلامت پایپلاین، نرخ پاسخ، و صنایع برتر رو در یک نگاه ببین.',
    },
  },
  {
    path: '/dashboard', selector: '[data-tour="profile-link"]', Icon: Globe,
    title: { en: 'Your profile', fa: 'پروفایل شخصی‌ات' },
    desc: {
      en: 'Add your skills and portfolio here, then publish a public link — no login required for visitors.',
      fa: 'اینجا مهارت و پورتفولیوتو اضافه کن، بعد یک لینک عمومی منتشر کن — بدون نیاز به لاگین برای بازدیدکننده.',
    },
  },
  {
    path: null, selector: null, Icon: Rocket,
    title: { en: "You're all set", fa: 'همه چی آماده‌ست' },
    desc: {
      en: 'Reopen this tour anytime from the Help button in the sidebar. Now go find your first client.',
      fa: 'هر وقت خواستی از دکمه Help توی سایدبار این تور رو دوباره باز کن. حالا برو اولین کلاینتت رو پیدا کن.',
    },
  },
]

// Marketplace-side tour — separate from the CRM one above, and branched by
// account_mode since a client and a freelancer land on different pages and
// care about a different flow (post-work vs. find-work). Triggered the
// first time either home page is actually visited, not bundled into the
// CRM tour, so someone who only ever uses the Marketplace side still gets
// a real walkthrough instead of silence.
const MARKETPLACE_STEPS_CLIENT: Step[] = [
  {
    path: '/client', selector: null, Icon: Briefcase,
    title: { en: 'Welcome to the Marketplace', fa: 'به مارکت‌پلیس خوش اومدی' },
    desc: {
      en: "Here's how hiring a freelancer through Archon works, start to finish.",
      fa: 'اینجا نشونت می‌دیم استخدام یک فریلنسر توی آرکون از اول تا آخر چطوریه.',
    },
  },
  {
    path: '/client', selector: '[data-tour="client-post-project"]', Icon: Send,
    title: { en: 'Post a project', fa: 'یک پروژه پست کن' },
    desc: {
      en: 'Describe what you need done, set a budget, and freelancers can start sending proposals.',
      fa: 'کاری که لازم داری رو توضیح بده، بودجه بذار، و فریلنسرها می‌تونن پروپوزال بفرستن.',
    },
  },
  {
    path: '/projects', selector: '[data-tour="proposals-tab"]', Icon: Inbox,
    title: { en: 'Review proposals', fa: 'پروپوزال‌ها رو بررسی کن' },
    desc: {
      en: 'Every proposal on your projects lands here. Accept one to create a contract with agreed milestones.',
      fa: 'هر پروپوزالی که برای پروژه‌هات میاد اینجا جمع می‌شه. یکی رو قبول کن تا یک قرارداد با مایلستون‌های توافقی ساخته بشه.',
    },
  },
  {
    // The sidebar renders on every page (including /client and /projects),
    // so this spotlights the nav item in place — no navigation needed, and
    // importantly no route change into /dashboard, which a client-mode
    // account gets force-redirected away from the instant it renders
    // (useRequireFreelancerMode) and would silently break this step.
    path: null, selector: '[data-tour="nav-contracts"]', Icon: FileCheck2,
    title: { en: 'Contracts & milestones', fa: 'قراردادها و مایلستون‌ها' },
    desc: {
      en: 'Track active contracts here — fund a milestone once you\'re ready to pay, then approve delivered work.',
      fa: 'قراردادهای فعال رو اینجا پیگیری کن — وقتی آماده‌ی پرداخت بودی مایلستون رو فاند کن، بعد کار تحویل‌داده‌شده رو تایید کن.',
    },
  },
  {
    path: null, selector: null, Icon: Wallet,
    title: { en: 'Payments are handled manually', fa: 'پرداخت‌ها دستی انجام می‌شن' },
    desc: {
      en: "Funding a milestone pays into Archon's own account, not the freelancer's — an admin confirms it, then manually sends a separate payout to the freelancer once you approve their delivery. It's not an automated or escrow service, just a manual pass-through. Full details are in our Terms.",
      fa: 'فاندکردن یک مایلستون به حساب خودِ آرکون واریز می‌شه، نه فریلنسر — یک ادمین تاییدش می‌کنه، بعد وقتی تحویل رو تایید کردی، جدا و دستی به فریلنسر پرداخت می‌کنه. سرویس خودکار یا escrow نیست، فقط یک واسطه‌ی دستیه. جزئیات کامل توی Terms ماست.',
    },
  },
  {
    path: null, selector: null, Icon: Rocket,
    title: { en: "You're all set", fa: 'همه چی آماده‌ست' },
    desc: {
      en: 'Reopen this tour anytime from the Help button in the sidebar. Now go post your first project.',
      fa: 'هر وقت خواستی از دکمه Help توی سایدبار این تور رو دوباره باز کن. حالا برو اولین پروژه‌ت رو پست کن.',
    },
  },
]

const MARKETPLACE_STEPS_FREELANCER: Step[] = [
  {
    path: '/projects', selector: null, Icon: Briefcase,
    title: { en: 'Welcome to the Marketplace', fa: 'به مارکت‌پلیس خوش اومدی' },
    desc: {
      en: "Here's how finding and getting paid for work through Archon works, start to finish.",
      fa: 'اینجا نشونت می‌دیم پیداکردن کار و گرفتن دستمزدش توی آرکون از اول تا آخر چطوریه.',
    },
  },
  {
    path: '/projects', selector: '[data-tour="open-board-tab"]', Icon: LayoutList,
    title: { en: 'Browse the open board', fa: 'برد پروژه‌های باز رو ببین' },
    desc: {
      en: 'Every open project studios have posted shows up here. Send a proposal on the ones that fit your skills.',
      fa: 'هر پروژه‌ی بازی که استودیوها پست کردن اینجا نشون داده می‌شه. روی اونایی که با مهارتت جور در میاد پروپوزال بفرست.',
    },
  },
  {
    // No navigation needed — the sidebar (and this nav item) renders on
    // /projects too, so just spotlight it in place.
    path: null, selector: '[data-tour="nav-contracts"]', Icon: FileCheck2,
    title: { en: 'Contracts & milestones', fa: 'قراردادها و مایلستون‌ها' },
    desc: {
      en: 'Once a client accepts your proposal, the contract and its milestones show up here — deliver work against each one.',
      fa: 'وقتی کارفرما پروپوزالت رو قبول کرد، قرارداد و مایلستون‌هاش اینجا نشون داده می‌شن — کار رو در قبال هرکدوم تحویل بده.',
    },
  },
  {
    path: null, selector: '[data-tour="nav-messages"]', Icon: MessageCircle,
    title: { en: 'Messages', fa: 'پیام‌ها' },
    desc: {
      en: 'Talk with clients here — scope questions, delivery links, everything stays on the record.',
      fa: 'اینجا با کارفرماها صحبت کن — سوالات درباره‌ی scope، لینک تحویل، همه‌چیز توی سابقه می‌مونه.',
    },
  },
  {
    path: null, selector: null, Icon: Wallet,
    title: { en: 'Payments are handled manually', fa: 'پرداخت‌ها دستی انجام می‌شن' },
    desc: {
      en: "The client's payment goes into Archon's own account first — once an admin confirms it and you deliver and get approved, an admin manually sends your payout separately. It's not an automated or escrow service, just a manual pass-through, so expect a short delay. Full details are in our Terms.",
      fa: 'پرداخت کارفرما اول به حساب خودِ آرکون واریز می‌شه — وقتی ادمین تاییدش کرد و تو تحویل دادی و تایید شد، ادمین جدا و دستی پرداختت رو می‌فرسته. سرویس خودکار یا escrow نیست، فقط یک واسطه‌ی دستیه، پس یک تاخیر کوتاه طبیعیه. جزئیات کامل توی Terms ماست.',
    },
  },
  {
    path: null, selector: null, Icon: Rocket,
    title: { en: "You're all set", fa: 'همه چی آماده‌ست' },
    desc: {
      en: 'Reopen this tour anytime from the Help button in the sidebar. Now go find your first project.',
      fa: 'هر وقت خواستی از دکمه Help توی سایدبار این تور رو دوباره باز کن. حالا برو اولین پروژه‌ت رو پیدا کن.',
    },
  },
]

type TourKind = 'crm' | 'marketplace' | null

const DONE_KEY_CRM = 'archon-onboarding-done'
const DONE_KEY_MARKETPLACE = 'archon-onboarding-marketplace-done'
const LANG_KEY = 'archon-tour-lang'
const TOOLTIP_W = 320

function getAccountMode(): 'client' | 'freelancer' {
  try {
    const raw = localStorage.getItem('archon-user')
    if (raw) {
      const u = JSON.parse(raw)
      if (u.account_mode === 'client') return 'client'
    }
  } catch {}
  return 'freelancer'
}

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
  const [tourKind, setTourKind] = useState<TourKind>(null)
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [lang, setLang] = useState<'en' | 'fa'>('en')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [locating, setLocating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const STEPS: Step[] = tourKind === 'marketplace'
    ? (getAccountMode() === 'client' ? MARKETPLACE_STEPS_CLIENT : MARKETPLACE_STEPS_FREELANCER)
    : CRM_STEPS
  const doneKey = tourKind === 'marketplace' ? DONE_KEY_MARKETPLACE : DONE_KEY_CRM

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'fa' || saved === 'en') setLang(saved)
  }, [])

  const setLangPersist = (l: 'en' | 'fa') => { setLang(l); localStorage.setItem(LANG_KEY, l) }

  // Auto-show once per tour, right when a signed-in visitor actually lands
  // on that tour's real home page — mandatory for a brand-new account (no
  // silent skip), independent for CRM vs. Marketplace since plenty of
  // accounts only ever touch one side.
  useEffect(() => {
    if (active) return // don't re-trigger while a tour is already running and navigating between its own steps
    const token = localStorage.getItem('archon-token')
    if (!token) return
    let kind: TourKind = null
    if (pathname === '/dashboard' && !localStorage.getItem(DONE_KEY_CRM)) kind = 'crm'
    else if ((pathname === '/client' || pathname === '/projects') && !localStorage.getItem(DONE_KEY_MARKETPLACE)) kind = 'marketplace'
    if (kind) {
      const t = setTimeout(() => { setTourKind(kind); setStepIndex(0); setActive(true) }, 600)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, active])

  // Manual re-open — Help button always reopens whichever tour matches the
  // page you're currently on.
  useEffect(() => {
    const handler = () => {
      const kind: TourKind = (pathname === '/client' || pathname === '/projects') ? 'marketplace' : 'crm'
      setTourKind(kind); setStepIndex(0); setActive(true)
    }
    window.addEventListener('archon:open-onboarding', handler)
    return () => window.removeEventListener('archon:open-onboarding', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const clearPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  // Locate the target element for the current step (navigating pages if needed)
  const locate = useCallback((step: Step) => {
    clearPoll()
    if (!step.selector) { setRect(null); setLocating(false); return }

    if (step.path && pathname !== step.path) {
      setLocating(true)
      router.push(step.path)
      return // effect below will re-run once pathname updates
    }

    setLocating(true)
    let tries = 0
    pollRef.current = setInterval(() => {
      const el = document.querySelector(step.selector!)
      tries++
      if (el) {
        setRect(el.getBoundingClientRect())
        setLocating(false)
        clearPoll()
      } else if (tries > 40) { // ~4s timeout
        setRect(null)
        setLocating(false)
        clearPoll()
      }
    }, 100)
  }, [pathname, router])

  useEffect(() => {
    if (!active) return
    locate(STEPS[stepIndex])
    return clearPoll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, pathname])

  // Keep spotlight aligned on scroll/resize
  useEffect(() => {
    if (!active || !rect) return
    const step = STEPS[stepIndex]
    if (!step.selector) return
    const update = () => {
      const el = document.querySelector(step.selector!)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [active, rect, stepIndex])

  const close = () => { setActive(false); clearPoll(); localStorage.setItem(doneKey, '1') }
  const next = () => { if (stepIndex < STEPS.length - 1) setStepIndex(i => i + 1); else close() }
  const back = () => { if (stepIndex > 0) setStepIndex(i => i - 1) }

  if (!active) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const PAD = 8

  // ── Compute donut clip-path hole around target (for blur cutout) ──
  let clipPath = 'none'
  if (rect) {
    const vw = window.innerWidth, vh = window.innerHeight
    const l = Math.max(rect.left - PAD, 0)
    const t = Math.max(rect.top - PAD, 0)
    const r = Math.min(rect.right + PAD, vw)
    const b = Math.min(rect.bottom + PAD, vh)
    clipPath = `polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 0px, ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`
  }

  // ── Tooltip position near target ──
  let tooltipStyle: React.CSSProperties = {}
  if (rect) {
    const vw = window.innerWidth, vh = window.innerHeight
    const spaceBelow = vh - rect.bottom
    const placeBelow = spaceBelow > 240 || rect.top < 240
    const top = placeBelow ? rect.bottom + PAD + 14 : undefined
    const bottom = !placeBelow ? vh - rect.top + PAD + 14 : undefined
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16))
    tooltipStyle = { position: 'fixed', top, bottom, left, width: TOOLTIP_W }
  }

  const LangToggle = () => (
    <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px', gap: '2px', flexShrink: 0 }}>
      {(['en', 'fa'] as const).map(l => (
        <button key={l} onClick={() => setLangPersist(l)}
          style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, border: 'none', cursor: 'pointer', background: lang === l ? 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' : 'transparent', color: lang === l ? 'white' : 'var(--text-dim)' }}>
          {l === 'en' ? 'EN' : 'فا'}
        </button>
      ))}
    </div>
  )

  const ProgressDots = () => (
    <div style={{ display: 'flex', gap: '5px', marginBottom: '16px' }}>
      {STEPS.map((_, i) => (
        <div key={i} style={{ height: '3px', flex: 1, borderRadius: '999px', background: i <= stepIndex ? 'linear-gradient(135deg, #3D4FE0, #2E3BB0)' : 'var(--border)', transition: 'background 0.3s' }} />
      ))}
    </div>
  )

  const Actions = () => (
    <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
      {stepIndex > 0 && (
        <button onClick={back} style={{ padding: '9px 14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer' }}>
          {lang === 'fa' ? '← قبلی' : '← Back'}
        </button>
      )}
      <button onClick={next} style={{ flex: 1, padding: '9px 14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: 'white', border: 'none', background: 'linear-gradient(135deg, #3D4FE0, #2E3BB0)', cursor: 'pointer' }}>
        {isLast ? (lang === 'fa' ? 'بزن بریم 🚀' : "Let's go 🚀") : (lang === 'fa' ? 'بعدی →' : 'Next →')}
      </button>
    </div>
  )

  const isFa = lang === 'fa'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>

      {/* DIM + BLUR OVERLAY WITH CUTOUT */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5,7,12,0.6)',
        backdropFilter: 'blur(3px)',
        clipPath, WebkitClipPath: clipPath,
        transition: 'clip-path 0.3s ease',
        pointerEvents: 'none',
      }} />

      {/* HIGHLIGHT RING */}
      {rect && (
        <div style={{
          position: 'fixed',
          top: Math.max(rect.top - PAD, 0), left: Math.max(rect.left - PAD, 0),
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 'var(--radius-lg)', border: '2px solid var(--accent)',
          boxShadow: '0 0 0 4px var(--accent-dim), 0 0 24px var(--accent-dim)',
          pointerEvents: 'none', transition: 'all 0.3s ease', zIndex: 1,
        }} />
      )}

      {/* LOCATING SPINNER (element not found yet / navigating) */}
      {locating && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2 }}>
          <div style={{ width: '26px', height: '26px', border: '2px solid var(--accent-dim)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'tourspin 0.7s linear infinite' }} />
        </div>
      )}

      {/* TOOLTIP / CARD */}
      {!locating && (
        <div style={rect ? { ...tooltipStyle, zIndex: 2 } : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(400px, calc(100vw - 40px))', zIndex: 2 }}>
          <div style={{ borderRadius: '18px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                {stepIndex + 1} / {STEPS.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LangToggle />
                <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '13px' }}>✕</button>
              </div>
            </div>

            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <step.Icon size={19} strokeWidth={1.75} color="var(--accent)" />
            </div>

            <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text)', margin: '0 0 7px', direction: isFa ? 'rtl' : 'ltr', textAlign: isFa ? 'right' : 'left' }}>{isFa ? step.title.fa : step.title.en}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: isFa ? 1.9 : 1.65, margin: 0, direction: isFa ? 'rtl' : 'ltr', textAlign: isFa ? 'right' : 'left' }}>{isFa ? step.desc.fa : step.desc.en}</p>

            <ProgressDots />
            <Actions />
          </div>
        </div>
      )}

      <style>{`@keyframes tourspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
