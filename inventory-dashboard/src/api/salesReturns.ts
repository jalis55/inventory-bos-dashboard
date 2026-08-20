import { api } from '@/lib/axios'
import type { SalesReturn, SalesReturnOutPaginate } from '@/types'

export interface SalesReturnLineInput {
  sale_line_id: string
  qty: number
}

export interface SalesReturnInput {
  party_id?: number
  return_date: string
  reason?: string
  lines: SalesReturnLineInput[]
}

export const salesReturnsApi = {
  list: (params?: {
    skip?: number
    limit?: number
    party_id?: number
  }) => api.get<SalesReturnOutPaginate>('/sales-returns', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<SalesReturn>(`/sales-returns/${id}`).then((r) => r.data),

  create: (data: SalesReturnInput) =>
    api.post<SalesReturn>('/sales-returns', data).then((r) => r.data),
}