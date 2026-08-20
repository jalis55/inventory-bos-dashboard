import { api } from '@/lib/axios'
import type { Purchase, PurchaseOutPaginate, PurchaseStatus } from '@/types'

export interface PurchaseLineInput {
  variant_id: string
  qty: number
  unit_cost: number
}

export interface PurchaseInput {
  supplier_id: number
  purchase_date: string
  reference_no?: string
  notes?: string
  lines: PurchaseLineInput[]
}

export const purchasesApi = {
  list: (params?: {
    skip?: number
    limit?: number
    supplier_id?: number
    status?: PurchaseStatus
  }) => api.get<PurchaseOutPaginate>('/purchases', { params }).then((r) => r.data),

  get: (id: string) => api.get<Purchase>(`/purchases/${id}`).then((r) => r.data),

  create: (data: PurchaseInput) =>
    api.post<Purchase>('/purchases', data).then((r) => r.data),

  update: (
    id: string,
    data: {
      supplier_id?: number
      purchase_date?: string
      reference_no?: string
      notes?: string
    },
  ) => api.put<Purchase>(`/purchases/${id}`, data).then((r) => r.data),

  receive: (id: string) =>
    api.post<Purchase>(`/purchases/${id}/receive`, {}).then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    api.post<Purchase>(`/purchases/${id}/cancel`, { reason }).then((r) => r.data),
}