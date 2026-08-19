import { api } from '@/lib/axios'
import type { PaginatedResponse, User } from '@/types'

export const usersApi = {
  list: (params?: { skip?: number; limit?: number }) =>
    api.get<PaginatedResponse<User>>('/users/', { params }).then((r) => r.data),
  get: (id: number) => api.get<User>(`/users/${id}`).then((r) => r.data),
  update: (id: number, data: Partial<User>) => api.put<User>(`/users/${id}`, data).then((r) => r.data),
  changePassword: (data: { email: string; old_password: string; new_password: string }) =>
    api.post('/users/change-password', data),
  resetPassword: (email: string) => api.post(`/users/reset-password`, null, { params: { email } }),
}
