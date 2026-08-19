import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { hasPermission, type Permission } from '@/config/rbac'

/**
 * Declaratively hide/show a piece of UI (a button, a column, a section)
 * based on the current user's role. Used inline, not for whole routes
 * (use ProtectedRoute + allowedRoles for that).
 */
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  const { user } = useAuth()
  if (!hasPermission(user?.role, permission)) return <>{fallback}</>
  return <>{children}</>
}
