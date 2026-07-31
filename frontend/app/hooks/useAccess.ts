'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type LockReason = 'pending_payment' | 'expired' | 'quota_exhausted' | 'not_unlocked' | null

export interface AccessState {
  locked: boolean
  reason: LockReason
  message: string | null
  /** Countries this plan may browse; null means the whole catalog. */
  countries: string[] | null
  unlimited: boolean
}

export interface PlanLimits {
  max_companies: number
  max_emails_per_month: number
  period_days: number
  ai_search: boolean
  weekly_report: boolean
  market_map: boolean
}

export interface Me {
  id: number; name: string; email: string; role: string; plan: string
  plan_status: string; plan_expires_at: string | null
  limits: PlanLimits
  access: AccessState
}

/**
 * The server decides what this account can see; this hook just reports it.
 *
 * Never re-derive "is this locked" on the client from plan/expiry — the API
 * masks the data either way, and a second copy of the rule is a second place
 * for it to be wrong.
 */
export function useAccess() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    axios.get(`${API}/auth/me`)
      .then(r => { if (alive) setMe(r.data) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const access: AccessState = me?.access ?? {
    locked: false, reason: null, message: null, countries: null, unlimited: false,
  }

  return {
    me,
    access,
    loading,
    isAdmin: me?.role === 'admin',
    // Feature flags are advertised by /auth/me and enforced server-side; the UI
    // uses them only to avoid showing a button that would 403.
    can: (feature: keyof PlanLimits) =>
      me?.role === 'admin' || Boolean(me?.limits?.[feature]),
  }
}
