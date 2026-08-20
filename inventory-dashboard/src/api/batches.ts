import { api } from '@/lib/axios'
import type { ProductBatch, ProductBatchOutPaginate } from '@/types'

export const batchesApi = {
  list: (params?: {
    skip?: number
    limit?: number
    variant_id?: string
    supplier_id?: number
    has_stock?: boolean
  }) => api.get<ProductBatchOutPaginate>('/batches', { params }).then((r) => r.data),

  get: (id: string) => api.get<ProductBatch>(`/batches/${id}`).then((r) => r.data),

  fifo: (variantId: string) =>
    api.get<ProductBatch[]>(`/batches/variant/${variantId}/fifo`).then((r) => r.data),
}