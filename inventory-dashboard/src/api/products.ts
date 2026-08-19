import { createCrudApi } from './resource'
import type { Product } from '@/types'

export const productsApi = createCrudApi<Product>('/products/')
