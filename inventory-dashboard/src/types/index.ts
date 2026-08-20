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
  brand: Brand
  category: Category
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

export type LedgerRefType =
  | 'PURCHASE'
  | 'SALE'
  | 'PURCHASE_RETURN'
  | 'SALES_RETURN'
  | 'PAYMENT'
  | 'ADJUSTMENT'

/**
 * Read-only account statement row (insert-only table). Sign convention:
 * for a SUPPLIER, credit = you owe them more (purchase), debit = you owe
 * them less (payment out, purchase return). For a CUSTOMER, debit = they
 * owe you more (sale), credit = they owe you less (payment in, sales
 * return). balance_after is the party's running balance_cached right
 * after this entry.
 */
export interface PartyLedgerEntry {
  id: string
  party_id: number
  ref_type: LedgerRefType
  ref_id: string
  debit: number
  credit: number
  balance_after: number
  entry_date: string
  notes?: string
}

export interface PartyLedgerEntryOutPaginate {
  total: number
  page: number
  size: number
  items: PartyLedgerEntry[]
}

export interface PartyBalance {
  id: number
  name: string
  party_type: PartyType
  balance_cached: number
  credit_limit: number
  available_credit: number
}

export type PaymentDirection =
  | 'PAID_TO_SUPPLIER'
  | 'RECEIVED_FROM_CUSTOMER'
  | 'REFUND_FROM_SUPPLIER'
  | 'REFUND_TO_CUSTOMER'

export interface Payment {
  id: string
  party_id?: number
  direction: PaymentDirection
  amount: number
  method: string
  payment_date: string
  reference_no?: string
  notes?: string
  sale_id?: string
  sales_return_id?: string
  created_by?: number
  created_at: string
}

export interface PaymentOutPaginate {
  total: number
  page: number
  size: number
  items: Payment[]
}

export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseLine {
  id: string
  purchase_id: string
  variant_id: string
  qty: number
  unit_cost: number
  line_total: number
}

export interface Purchase {
  id: string
  supplier_id: number
  status: PurchaseStatus
  purchase_date: string
  reference_no?: string
  notes?: string
  created_by?: number
  created_at: string
  updated_at: string
  lines: PurchaseLine[]
}

export interface PurchaseOutPaginate {
  total: number
  page: number
  size: number
  items: Purchase[]
}

export type MovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'PURCHASE_RETURN_OUT'
  | 'SALES_RETURN_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'

export interface VariantBrief {
  id: string
  name: string
  sku: string
  variant_name: string
}

export interface BatchBrief {
  id: string
  qty_received: number
  qty_remaining: number
  cost_price: number
  received_date: string
  expiry_date?: string
}

export interface StockMovement {
  id: string
  variant_id: string
  batch_id: string
  movement_type: MovementType
  qty: number
  ref_type: string
  ref_id: string
  qty_remaining_after: number
  movement_date: string
  variant: VariantBrief
  batch: BatchBrief
}

export interface StockMovementOutPaginate {
  total: number
  page: number
  size: number
  items: StockMovement[]
}

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

export interface SaleLine {
  id: string
  sale_id: string
  variant_id: string
  batch_id?: string
  qty: number
  unit_price: number
  unit_cost_snapshot?: number
  line_total: number
}

export interface Sale {
  id: string
  party_id?: number
  status: SaleStatus
  sale_date: string
  created_by?: number
  created_at: string
  updated_at: string
  amount_paid: number
  returned_amount: number
  lines: SaleLine[]
}

export interface SaleOutPaginate {
  total: number
  page: number
  size: number
  items: Sale[]
}

export interface ProductBatch {
  id: string
  variant_id: string
  variant_name?: string
  variant_sku?: string
  purchase_line_id: string
  supplier_id: number
  supplier_name?: string
  cost_price: number
  qty_received: number
  qty_remaining: number
  previous_qty?: number
  received_date: string
  expiry_date?: string
  created_at: string
}

export interface ProductBatchOutPaginate {
  total: number
  page: number
  size: number
  items: ProductBatch[]
}

export interface PurchaseReturnLine {
  id: string
  purchase_return_id: string
  purchase_line_id: string
  batch_id: string
  variant_id?: string
  variant_name?: string
  variant_sku?: string
  qty: number
  unit_cost: number
  line_total: number
  reason?: string
}

export interface PurchaseReturn {
  id: string
  supplier_id: number
  supplier_name?: string
  return_date: string
  reason?: string
  created_by?: number
  created_at: string
  lines: PurchaseReturnLine[]
}

export interface PurchaseReturnOutPaginate {
  total: number
  page: number
  size: number
  items: PurchaseReturn[]
}

export interface SalesReturnLine {
  id: string
  sales_return_id: string
  sale_line_id: string
  batch_id: string
  variant_id?: string
  variant_name?: string
  variant_sku?: string
  qty: number
  unit_price: number
  line_total: number
}

export interface SalesReturn {
  id: string
  party_id?: number
  party_name?: string
  return_date: string
  reason?: string
  created_by?: number
  created_at: string
  lines: SalesReturnLine[]
}

export interface SalesReturnOutPaginate {
  total: number
  page: number
  size: number
  items: SalesReturn[]
}

export interface ApiError {
  detail: string | { msg: string }[]
}
