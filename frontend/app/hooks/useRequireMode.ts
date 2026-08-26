'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Redirects away from CRM/lead-gen pages when the account is in Client
 * mode — those tools don't apply to someone who only hires, so a client
 * account landing on `/dashboard` by URL gets sent to their own home
 * instead. Admins are exempt so their own workflows never get locked out.
 * Returns true once the check has passed and the page is safe to render;
 * false while checking or right before a redirect fires. */
export function useRequireFreelancerMode(redirectTo = '/client') {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let cancelled = false
    axios.get(`${API}/auth/me`).then(r => {
      if (cancelled) return
      const mode = r.data.account_mode === 'client' ? 'client' : 'freelancer'
      if (mode === 'client' && r.data.role !== 'admin') {
        window.location.href = redirectTo
      } else {
        setAllowed(true)
      }
    }).catch(() => { if (!cancelled) setAllowed(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return allowed
}
