import { createCrudApi } from './resource'
import type { Brand } from '@/types'

export const brandsApi = createCrudApi<Brand>('/brands')
