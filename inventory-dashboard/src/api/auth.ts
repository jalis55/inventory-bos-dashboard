import { api } from '@/lib/axios'
import type { LoginPayload, User } from '@/types'

interface RegisterResponse {
  message: string
  user: User
}

export const authApi = {
  login: (payload: LoginPayload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  refresh: () => api.post('/auth/refresh'),
  /**
   * POST /auth/register returns `{ message, user }` (not the user directly).
   * Only super_admin / admin may call it.
   */
  register: (payload: { email: string; password: string; full_name?: string; role: string }) =>
    api.post<RegisterResponse>('/auth/register', payload).then((r) => r.data),
}
