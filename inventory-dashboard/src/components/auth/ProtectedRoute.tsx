import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { Role } from '@/types'
import { FullPageSpinner } from '@/components/common/FullPageSpinner'

interface ProtectedRouteProps {
  /** If provided, only these roles may access the nested routes. */
  allowedRoles?: Role[]
}

/**
 * Guards a subtree of routes:
 *  1. Waits for the initial /auth/me check to resolve (avoids a login flash).
 *  2. Redirects to /login (preserving the intended destination) if unauthenticated.
 *  3. Redirects to /unauthorized if the user's role isn't allowed.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
