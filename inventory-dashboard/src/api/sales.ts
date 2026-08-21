import { api } from '@/lib/axios'
import type { Sale, SaleOutPaginate, SaleStatus } from '@/types'

export interface SaleLineInput {
  variant_id: string
  qty: number
  unit_price: number
  batch_id?: string
}

export interface SaleInput {
  party_id?: number
  sale_date: string
  lines: SaleLineInput[]
}

export const salesApi = {
  list: (params?: {
    skip?: number
    limit?: number
    party_id?: number
    status?: SaleStatus
    search?: string
  }) => api.get<SaleOutPaginate>('/sales', { params }).then((r) => r.data),

  get: (id: string) => api.get<Sale>(`/sales/${id}`).then((r) => r.data),

  create: (data: SaleInput) => api.post<Sale>('/sales', data).then((r) => r.data),

  update: (
    id: string,
    data: {
      party_id?: number
      sale_date?: string
    },
  ) => api.put<Sale>(`/sales/${id}`, data).then((r) => r.data),

  complete: (id: string) =>
    api.post<Sale>(`/sales/${id}/complete`, {}).then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    api.post<Sale>(`/sales/${id}/cancel`, { reason }).then((r) => r.data),
}