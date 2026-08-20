import type { Permission } from '@/config/rbac'
import {
  LayoutDashboard,
  Boxes,
  Building2,
  Tags,
  PackageSearch,
  Handshake,
  BookOpen,
  Wallet,
  ShoppingCart,
  Undo2,
  Receipt,
  RotateCcw,
  History,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  permission: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard:view' },
  { label: 'Products', to: '/products', icon: Boxes, permission: 'inventory:view' },
  { label: 'Categories', to: '/categories', icon: Tags, permission: 'inventory:view' },
  { label: 'Brands', to: '/brands', icon: Building2, permission: 'inventory:view' },
  { label: 'Product Variants', to: '/product-variants', icon: PackageSearch, permission: 'inventory:view' },
  { label: 'Parties', to: '/parties', icon: Handshake, permission: 'parties:view' },
  { label: 'Party Ledger', to: '/party-ledger', icon: BookOpen, permission: 'parties:view' },
  { label: 'Payments', to: '/payments', icon: Wallet, permission: 'payments:view' },
  { label: 'Purchases', to: '/purchases', icon: ShoppingCart, permission: 'purchases:view' },
  { label: 'Purchase Returns', to: '/purchase-returns', icon: Undo2, permission: 'purchases:view' },
  { label: 'Sales', to: '/sales', icon: Receipt, permission: 'sales:view' },
  { label: 'Sales Returns', to: '/sales-returns', icon: RotateCcw, permission: 'sales:view' },
  { label: 'Stock Movements', to: '/stock-movements', icon: History, permission: 'stock:view' },
  { label: 'Users', to: '/users', icon: Users, permission: 'users:view' },
]
