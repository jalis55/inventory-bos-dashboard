import { api } from '@/lib/axios'
import type { PurchaseReturn, PurchaseReturnOutPaginate } from '@/types'

export interface PurchaseReturnLineInput {
  purchase_line_id: string
  qty: number
  reason?: string
}

export interface PurchaseReturnInput {
  supplier_id: number
  return_date: string
  reason?: string
  lines: PurchaseReturnLineInput[]
}

export const purchaseReturnsApi = {
  list: (params?: {
    skip?: number
    limit?: number
    supplier_id?: number
    search?: string
  }) => api.get<PurchaseReturnOutPaginate>('/purchase-returns', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<PurchaseReturn>(`/purchase-returns/${id}`).then((r) => r.data),

  create: (data: PurchaseReturnInput) =>
    api.post<PurchaseReturn>('/purchase-returns', data).then((r) => r.data),
}