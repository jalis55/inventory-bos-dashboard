import { api } from '@/lib/axios'
import type { Product, PaginatedResponse } from '@/types'

export const productsApi = {
  list: (params?: {
    skip?: number
    limit?: number
    category_id?: number
    brand_id?: number
    is_active?: boolean
    search?: string
  }) => api.get<PaginatedResponse<Product>>('/products', { params }).then((r) => r.data),

  get: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),

  create: (data: {
    name: string
    description?: string
    brand_id: number
    category_id: number
  }) => api.post<Product>('/products', data).then((r) => r.data),

  update: (id: string, data: {
    name?: string
    description?: string
    brand_id?: number
    category_id?: number
    is_active?: boolean
  }) => api.put<Product>(`/products/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.patch<Product>(`/products/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) =>
    api.patch<Product>(`/products/${id}/activate`).then((r) => r.data),
}
