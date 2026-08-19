import { api } from '@/lib/axios'
import { createCrudApi } from './resource'
import type { Category } from '@/types'

export const categoriesApi = {
  ...createCrudApi<Category>('/category/'),
  // The backend creates categories via POST /category/create (not POST /category/).
  create: (data: Partial<Category>) => api.post<Category>('/category/create', data).then((r) => r.data),
}
