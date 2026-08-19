import { api } from '@/lib/axios'
import type { Party, PartyOutPaginate, PartyType } from '@/types'

export const partiesApi = {
  list: (params?: {
    skip?: number
    limit?: number
    is_active?: boolean
    party_type?: PartyType
    search?: string
  }) => api.get<PartyOutPaginate>('/party/', { params }).then((r) => r.data),

  get: (id: number) => api.get<Party>(`/party/${id}`).then((r) => r.data),

  create: (data: {
    party_type: PartyType
    name: string
    phone?: string
    email?: string
    address?: string
    credit_limit?: number
  }) => api.post<Party>('/party', data).then((r) => r.data),

  update: (
    id: number,
    data: {
      party_type?: PartyType
      name?: string
      phone?: string
      email?: string
      address?: string
      credit_limit?: number
    },
  ) => api.put<Party>(`/party/${id}`, data).then((r) => r.data),

  deactivate: (id: number) =>
    api.patch<Party>(`/party/${id}/deactivate`).then((r) => r.data),

  activate: (id: number) =>
    api.patch<Party>(`/party/${id}/activate`).then((r) => r.data),
}
