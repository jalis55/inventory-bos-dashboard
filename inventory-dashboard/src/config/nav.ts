import type { Permission } from '@/config/rbac'
import {
  LayoutDashboard,
  Users,
  Boxes,
  Building2,
  Tags,
  PackageSearch,
  Handshake,
  ShoppingCart,
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
  { label: 'Purchases', to: '/purchases', icon: ShoppingCart, permission: 'purchases:view' },
  { label: 'Users', to: '/users', icon: Users, permission: 'users:view' },
]
