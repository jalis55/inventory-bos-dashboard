import { api } from '@/lib/axios'
import type { StockMovement, StockMovementOutPaginate, MovementType } from '@/types'

export const stockMovementsApi = {
  list: (params?: {
    skip?: number
    limit?: number
    variant_id?: string
    batch_id?: string
    movement_type?: MovementType
    ref_type?: string
    ref_id?: string
  }) => api.get<StockMovementOutPaginate>('/stock-movements', { params }).then((r) => r.data),

  get: (id: string) => api.get<StockMovement>(`/stock-movements/${id}`).then((r) => r.data),
}