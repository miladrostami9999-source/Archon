'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

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
  icon: string
  title: { en: string; fa: string }
  desc: { en: string; fa: string }
}

const STEPS: Step[] = [
  {
    path: '/', selector: null, icon: '👋',
    title: { en: 'Welcome to Archon', fa: 'به آرکون خوش اومدی' },
    desc: {
      en: "This quick tour will show you exactly where things are. Let's start on your dashboard.",
      fa: 'این تور سریع دقیقاً نشونت میده هر چیزی کجاست. بریم از داشبورد شروع کنیم.',
    },
  },
  {
    path: '/', selector: '[data-tour="add-company"]', icon: '🏢',
    title: { en: 'Add your first company', fa: 'اولین شرکتت رو اضافه کن' },
    desc: {
      en: 'Click here to add a company by name or website. Archon researches it and scores the fit automatically.',
      fa: 'اینجا کلیک کن تا یک شرکت با اسم یا وبسایت اضافه کنی. آرکون خودکار تحقیق و امتیازدهی می‌کنه.',
    },
  },
  {
    path: '/', selector: '[data-tour="view-toggle"]', icon: '📋',
    title: { en: 'List or Board view', fa: 'نمای لیست یا برد' },
    desc: {
      en: 'Switch to Board to drag companies through your pipeline — New, Sent, Replied, Client.',
      fa: 'به حالت Board برو تا شرکت‌ها رو در پایپلاین بکشی — New، Sent، Replied، Client.',
    },
  },
  {
    path: '/', selector: '[data-tour="nav-tasks"]', icon: '✅',
    title: { en: 'Daily AI tasks', fa: 'وظایف روزانه با AI' },
    desc: {
      en: 'Archon generates a daily task list for you — who to follow up with, what to review.',
      fa: 'آرکون هر روز یک لیست وظایف برات می‌سازه — کی رو پیگیری کنی، چی رو بررسی کنی.',
    },
  },
  {
    path: '/', selector: '[data-tour="nav-analytics"]', icon: '📊',
    title: { en: 'Track performance', fa: 'پیگیری عملکرد' },
    desc: {
      en: 'See your pipeline health, reply rates, and top industries — all in one view.',
      fa: 'سلامت پایپلاین، نرخ پاسخ، و صنایع برتر رو در یک نگاه ببین.',
    },
  },
  {
    path: '/', selector: '[data-tour="profile-link"]', icon: '🌐',
    title: { en: 'Your profile', fa: 'پروفایل شخصی‌ات' },
    desc: {
      en: 'Add your skills and portfolio here, then publish a public link — no login required for visitors.',
      fa: 'اینجا مهارت و پورتفولیوتو اضافه کن، بعد یک لینک عمومی منتشر کن — بدون نیاز به لاگین برای بازدیدکننده.',
    },
  },
  {
    path: null, selector: null, icon: '🚀',
    title: { en: "You're all set", fa: 'همه چی آماده‌ست' },
    desc: {
      en: 'Reopen this tour anytime from the Help button in the sidebar. Now go find your first client.',
      fa: 'هر وقت خواستی از دکمه Help توی سایدبار این تور رو دوباره باز کن. حالا برو اولین کلاینتت رو پیدا کن.',
    },
  },
]

const DONE_KEY = 'archon-onboarding-done'
const LANG_KEY = 'archon-tour-lang'
const TOOLTIP_W = 320

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [lang, setLang] = useState<'en' | 'fa'>('en')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [locating, setLocating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'fa' || saved === 'en') setLang(saved)
  }, [])

  const setLangPersist = (l: 'en' | 'fa') => { setLang(l); localStorage.setItem(LANG_KEY, l) }

  // Auto-show once on first login, only from Home
  useEffect(() => {
    if (pathname !== '/') return
    const token = localStorage.getItem('archon-token')
    const done = localStorage.getItem(DONE_KEY)
    if (token && !done) {
      const t = setTimeout(() => { setStepIndex(0); setActive(true) }, 600)
      return () => clearTimeout(t)
    }
  }, [pathname])

  // Manual re-open
  useEffect(() => {
    const handler = () => { setStepIndex(0); setActive(true) }
    window.addEventListener('archon:open-onboarding', handler)
    return () => window.removeEventListener('archon:open-onboarding', handler)
  }, [])

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

  const close = () => { setActive(false); clearPoll(); localStorage.setItem(DONE_KEY, '1') }
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
          style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, border: 'none', cursor: 'pointer', background: lang === l ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'transparent', color: lang === l ? 'white' : 'var(--text-dim)' }}>
          {l === 'en' ? 'EN' : 'فا'}
        </button>
      ))}
    </div>
  )

  const ProgressDots = () => (
    <div style={{ display: 'flex', gap: '5px', marginBottom: '16px' }}>
      {STEPS.map((_, i) => (
        <div key={i} style={{ height: '3px', flex: 1, borderRadius: '999px', background: i <= stepIndex ? 'linear-gradient(135deg, #4F7BF7, #7C3AED)' : 'var(--border)', transition: 'background 0.3s' }} />
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
      <button onClick={next} style={{ flex: 1, padding: '9px 14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 700, color: 'white', border: 'none', background: 'linear-gradient(135deg, #4F7BF7, #7C3AED)', cursor: 'pointer' }}>
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
        pointerEvents: rect ? 'none' : 'auto',
      }} onClick={!rect ? close : undefined} />

      {/* HIGHLIGHT RING */}
      {rect && (
        <div style={{
          position: 'fixed',
          top: Math.max(rect.top - PAD, 0), left: Math.max(rect.left - PAD, 0),
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: '12px', border: '2px solid #4F7BF7',
          boxShadow: '0 0 0 4px rgba(79,123,247,0.2), 0 0 24px rgba(79,123,247,0.35)',
          pointerEvents: 'none', transition: 'all 0.3s ease', zIndex: 1,
        }} />
      )}

      {/* LOCATING SPINNER (element not found yet / navigating) */}
      {locating && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2 }}>
          <div style={{ width: '26px', height: '26px', border: '2px solid rgba(79,123,247,0.25)', borderTop: '2px solid #4F7BF7', borderRadius: '50%', animation: 'tourspin 0.7s linear infinite' }} />
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

            <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'linear-gradient(135deg, rgba(79,123,247,0.18), rgba(124,58,237,0.18))', border: '1px solid rgba(79,123,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', marginBottom: '12px' }}>
              {step.icon}
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
