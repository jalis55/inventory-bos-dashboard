import type { Role } from '@/types'

/**
 * Single source of truth for role-based access control.
 * Mirrors the backend's role rules (see app/api/deps.py -> require_roles)
 * so the UI never shows actions the API would reject.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STORE_KEEPER: 'store_keeper',
  SELLER: 'seller',
} as const

export const ALL_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.STORE_KEEPER,
  ROLES.SELLER,
]

export const MANAGER_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN]

/**
 * Permission -> roles allowed to perform it.
 * Keep this aligned with the FastAPI route dependencies in the README.
 */
export const PERMISSIONS = {
  'users:view': MANAGER_ROLES,
  'users:manage': MANAGER_ROLES, // create / update / reset password
  'users:register': MANAGER_ROLES,

  'inventory:view': ALL_ROLES, // categories/companies/products/variants - read
  'inventory:manage': MANAGER_ROLES, // create/update/delete master data

  'stock:view': ALL_ROLES, // stock movements / batches - read-only audit log

  'dashboard:view': ALL_ROLES,

  'parties:view': ALL_ROLES,
  'parties:manage': MANAGER_ROLES,

  'purchases:view': ALL_ROLES,
  'purchases:manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_KEEPER], // create/receive/cancel

  'sales:view': ALL_ROLES,
  'sales:manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_KEEPER], // create/complete/cancel

  'payments:view': ALL_ROLES,
  'payments:manage': MANAGER_ROLES, // record payments / refunds (mirrors backend require_superadmin_or_admin)

  'reports:view': ALL_ROLES, // read-only reports (e.g. invoice ledger)
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as Role[]).includes(role)
}

export function hasAnyRole(role: Role | undefined, allowed: Role[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}

/** A user cannot self-edit or edit a peer/superior role — mirrors backend rule. */
export function canEditUser(actor: { id: number; role: Role }, target: { id: number; role: Role }): boolean {
  if (actor.id === target.id) return false
  if (actor.role === ROLES.ADMIN && (target.role === ROLES.ADMIN || target.role === ROLES.SUPER_ADMIN)) return false
  return hasAnyRole(actor.role, MANAGER_ROLES)
}

/** Roles an actor is allowed to assign when creating/editing a user. */
export function assignableRoles(actorRole: Role | undefined): Role[] {
  if (actorRole === ROLES.SUPER_ADMIN) return [ROLES.ADMIN, ROLES.STORE_KEEPER, ROLES.SELLER]
  if (actorRole === ROLES.ADMIN) return [ROLES.STORE_KEEPER, ROLES.SELLER]
  return []
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  store_keeper: 'Store Keeper',
  seller: 'Seller',
}
