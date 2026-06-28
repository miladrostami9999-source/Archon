// frontend/app/hooks/useAuth.ts
'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

interface User {
  id: number
  name: string
  email: string
  role: string
  plan: string
  limits: {
    max_companies: number
    max_emails_per_month: number
    ai_search: boolean
    weekly_report: boolean
    market_map: boolean
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('archon-token')
    const stored = localStorage.getItem('archon-user')

    if (!token) {
      // Not logged in — redirect to login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      setLoading(false)
      return
    }

    // Use stored user immediately (fast)
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }

    // Verify token with backend
    axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUser(res.data)
      localStorage.setItem('archon-user', JSON.stringify(res.data))
    }).catch(() => {
      // Token expired or invalid
      localStorage.removeItem('archon-token')
      localStorage.removeItem('archon-user')
      window.location.href = '/login'
    }).finally(() => setLoading(false))
  }, [])

  const logout = () => {
    localStorage.removeItem('archon-token')
    localStorage.removeItem('archon-user')
    window.location.href = '/login'
  }

  const getAuthHeader = () => {
    const token = localStorage.getItem('archon-token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  return { user, loading, logout, getAuthHeader }
}
