import { api } from '@/lib/axios'
import type { ProductVariant, PaginatedResponse } from '@/types'

export const productVariantsApi = {
  list: (params?: {
    skip?: number
    limit?: number
    product_id?: string
    is_active?: boolean
    search?: string
  }) => api.get<PaginatedResponse<ProductVariant>>('/variants', { params }).then((r) => r.data),

  listByProduct: (productId: string, params?: {
    skip?: number
    limit?: number
    is_active?: boolean
  }) => api.get<PaginatedResponse<ProductVariant>>(`/products/${productId}/variants`, { params }).then((r) => r.data),

  get: (id: string) => api.get<ProductVariant>(`/variants/${id}`).then((r) => r.data),

  create: (productId: string, data: {
    sku: string
    barcode?: string
    variant_name: string
    unit_of_measure: string
    pack_size: number
    reorder_level?: number
  }) => api.post<ProductVariant>(`/products/${productId}/variants`, data).then((r) => r.data),

  update: (id: string, data: {
    sku?: string
    barcode?: string
    variant_name?: string
    unit_of_measure?: string
    pack_size?: number
    reorder_level?: number
    is_active?: boolean
  }) => api.put<ProductVariant>(`/variants/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.patch<ProductVariant>(`/variants/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) =>
    api.patch<ProductVariant>(`/variants/${id}/activate`).then((r) => r.data),

  byBarcode: (barcode: string) =>
    api.get<ProductVariant>(`/variants/barcode/${barcode}`).then((r) => r.data),
}
