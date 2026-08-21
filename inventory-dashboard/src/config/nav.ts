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
  BarChart3,
  FileText,
  Package,
  ArrowLeftRight,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavLinkItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  permission: Permission
}

export interface NavGroup {
  group: true
  label: string
  icon: ComponentType<{ className?: string }>
  permission: Permission
  /** Whether the group starts expanded (defaults to collapsed). */
  defaultOpen?: boolean
  items: NavLinkItem[]
}

export type NavEntry = NavLinkItem | NavGroup

export const NAV_ENTRIES: NavEntry[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard:view' },
  {
    group: true,
    label: 'Product Setup',
    icon: Package,
    permission: 'inventory:view',
    defaultOpen: true,
    items: [
      { label: 'Products', to: '/products', icon: Boxes, permission: 'inventory:view' },
      { label: 'Categories', to: '/categories', icon: Tags, permission: 'inventory:view' },
      { label: 'Brands', to: '/brands', icon: Building2, permission: 'inventory:view' },
      { label: 'Product Variants', to: '/product-variants', icon: PackageSearch, permission: 'inventory:view' },
    ],
  },
  { label: 'Parties', to: '/parties', icon: Handshake, permission: 'parties:view' },
  { label: 'Party Ledger', to: '/party-ledger', icon: BookOpen, permission: 'parties:view' },
  { label: 'Payments', to: '/payments', icon: Wallet, permission: 'payments:view' },
  {
    group: true,
    label: 'Trade',
    icon: ArrowLeftRight,
    permission: 'purchases:view',
    defaultOpen: true,
    items: [
      { label: 'Purchases', to: '/purchases', icon: ShoppingCart, permission: 'purchases:view' },
      { label: 'Purchase Returns', to: '/purchase-returns', icon: Undo2, permission: 'purchases:view' },
      { label: 'Sales', to: '/sales', icon: Receipt, permission: 'sales:view' },
      { label: 'Sales Returns', to: '/sales-returns', icon: RotateCcw, permission: 'sales:view' },
    ],
  },
  {
    group: true,
    label: 'Reports',
    icon: BarChart3,
    permission: 'reports:view',
    items: [
      {
        label: 'Invoice Ledger',
        to: '/reports/invoice-ledger',
        icon: FileText,
        permission: 'reports:view',
      },
      {
        label: 'Purchase Returns',
        to: '/reports/purchase-returns',
        icon: Undo2,
        permission: 'reports:view',
      },
      {
        label: 'Sales Returns',
        to: '/reports/sales-returns',
        icon: RotateCcw,
        permission: 'reports:view',
      },
    ],
  },
  { label: 'Stock Movements', to: '/stock-movements', icon: History, permission: 'stock:view' },
  { label: 'Users', to: '/users', icon: Users, permission: 'users:view' },
]