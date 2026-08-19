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

export interface Brand {
  id: number
  name: string
  is_active: boolean
}

export interface Product {
  id: string
  name: string
  description?: string
  brand_id: number
  category_id: number
  brand?: Brand
  category?: Category
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string
  barcode?: string
  variant_name: string
  unit_of_measure: string
  pack_size: number
  reorder_level: number
  is_active: boolean
  created_at: string
  updated_at: string
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
