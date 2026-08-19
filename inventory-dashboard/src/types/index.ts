export type Role = 'super_admin' | 'admin' | 'store_keeper' | 'seller'

export interface User {
  id: number
  email: string
  full_name?: string
  role: Role
  is_active: boolean
  is_locked?: boolean
  created_at?: string
}

export interface PaginatedResponse<T> {
  total: number
  skip: number
  limit: number
  items: T[]
}

export interface Category {
  id: number
  name: string
  is_active: boolean
}

export interface Company {
  id: number
  name: string
  is_active: boolean
}

export interface ProductVariant {
  id: number
  name: string
  is_active: boolean
}

export interface Product {
  id: number
  name: string
  unit_of_measure: string
  company_id: number
  category_id: number
  product_variant_id: number
  company?: Company
  category?: Category
  variant?: ProductVariant
}

export interface LoginPayload {
  email: string
  password: string
}

export type PartyType = 'SUPPLIER' | 'CUSTOMER' | 'WALK_IN'

export interface Party {
  id: number
  party_type: PartyType
  name: string
  phone?: string
  email?: string
  address?: string
  credit_limit: number
  balance_cached: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PartyOutPaginate {
  total: number
  page: number
  size: number
  items: Party[]
}

export interface ApiError {
  detail: string | { msg: string }[]
}
