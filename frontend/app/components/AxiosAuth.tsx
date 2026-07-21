'use client'
import { useEffect } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Attaches the auth token to every request to our own API.
 *
 * Every /companies endpoint requires authentication now that data is
 * per-user, and the token was previously passed by hand at each call site —
 * dozens of them, with several missed. Doing it in one interceptor means new
 * calls are covered automatically. Requests to other hosts (e.g. the map's
 * geography file on a CDN) are left untouched.
 */
export default function AxiosAuth() {
  useEffect(() => {
    const id = axios.interceptors.request.use(config => {
      const url = config.url || ''
      const isOwnApi = url.startsWith(API) || url.startsWith('/')
      if (isOwnApi && !config.headers?.Authorization) {
        const token = localStorage.getItem('archon-token')
        if (token) config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })
    return () => { axios.interceptors.request.eject(id) }
  }, [])

  return null
}
