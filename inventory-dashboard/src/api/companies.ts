import { createCrudApi } from './resource'
import type { Company } from '@/types'

// NOTE: the current backend has no /companies resource (it exposes /brands
// instead). Keep the trailing slash so requests 404 cleanly instead of
// triggering the FastAPI 307 redirect that breaks cookie auth in dev.
export const companiesApi = createCrudApi<Company>('/companies/')
