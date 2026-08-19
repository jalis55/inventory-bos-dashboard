import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

/**
 * The backend issues httpOnly `access_token` / `refresh_token` cookies.
 * JS can never read them (by design, for XSS protection) — so this client
 * does NOT store or attach tokens manually. Instead:
 *   1. `withCredentials: true` makes the browser send/receive those cookies
 *      automatically on every request to the API origin.
 *   2. A response interceptor watches for 401s, calls POST /auth/refresh
 *      (which rotates the cookies), then transparently retries the request
 *      that failed.
 */

const baseURL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// --- refresh queueing -------------------------------------------------
// If several requests 401 at once, only fire one /auth/refresh call and
// let every other request wait on it, instead of racing N refreshes.

type QueuedRequest = {
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}

let isRefreshing = false
let refreshQueue: QueuedRequest[] = []

function processQueue(error: unknown) {
  refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()))
  refreshQueue = []
}

// Let the app react to a hard session expiry (e.g. redirect to /login)
// without this module needing to import router/context code directly.
export const AUTH_EVENTS = {
  SESSION_EXPIRED: 'auth:session-expired',
} as const

function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_EXPIRED))
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const url = originalRequest?.url ?? ''

    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')

    if (status !== 401 || !originalRequest || isAuthEndpoint) {
      return Promise.reject(error)
    }

    if (originalRequest._retry) {
      // Already retried once after a refresh and still unauthorized -> session is dead.
      emitSessionExpired()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Wait for the in-flight refresh, then retry this request.
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: () => resolve(api(originalRequest)),
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      await api.post('/auth/refresh')
      processQueue(null)
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError)
      emitSessionExpired()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
    if (error.message) return error.message
  }
  return 'Something went wrong. Please try again.'
}
