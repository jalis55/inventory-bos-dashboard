import { api } from '@/lib/axios'
import type { PaginatedResponse } from '@/types'

/**
 * Factory for the simple paginated CRUD resources that share the same shape.
 *
 * IMPORTANT: base paths must match the backend exactly, INCLUDING the
 * trailing slash. FastAPI's `redirect_slashes` answers `/products` with a
 * 307 redirect to `/products/`. The redirect's Location is an absolute URL
 * pointing at the API origin, so the browser follows it OUTSIDE the Vite dev
 * proxy, the httpOnly auth cookie (scoped to the frontend host) is not sent,
 * the retried request 401s forever and the auth interceptor fires
 * `session-expired` -> instant logout.
 */
export function createCrudApi<T>(basePath: string) {
  const base = basePath.replace(/\/+$/, '')
  return {
    list: (params?: { skip?: number; limit?: number }) =>
      api.get<PaginatedResponse<T>>(`${base}/`, { params }).then((r) => r.data),
    get: (id: number) => api.get<T>(`${base}/${id}`).then((r) => r.data),
    create: (data: Partial<T>) => api.post<T>(`${base}/`, data).then((r) => r.data),
    update: (id: number, data: Partial<T>) => api.put<T>(`${base}/${id}`, data).then((r) => r.data),
    remove: (id: number) => api.delete(`${base}/${id}`).then(() => undefined),
  }
}
