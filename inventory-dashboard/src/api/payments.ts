import { api } from '@/lib/axios'
import type { Payment, PaymentDirection, PaymentOutPaginate } from '@/types'

export interface PaymentInput {
  party_id?: number
  direction: PaymentDirection
  amount: number
  method: string
  payment_date: string
  reference_no?: string
  notes?: string
  sale_id?: string
  purchase_id?: string
}

export const paymentsApi = {
  list: (params?: {
    skip?: number
    limit?: number
    party_id?: number
    direction?: PaymentDirection
  }) => api.get<PaymentOutPaginate>('/payments', { params }).then((r) => r.data),

  get: (id: string) => api.get<Payment>(`/payments/${id}`).then((r) => r.data),

  create: (data: PaymentInput) =>
    api.post<Payment>('/payments', data).then((r) => r.data),
}