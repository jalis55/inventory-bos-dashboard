import { createCrudApi } from './resource'
import type { ProductVariant } from '@/types'

// Backend route is /variants/ (see app/api/endpoints/product_variant.py).
export const productVariantsApi = createCrudApi<ProductVariant>('/variants/')
