import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MANAGER_ROLES } from '@/config/rbac'

import LoginPage from '@/pages/LoginPage'
import DashboardHome from '@/pages/DashboardHome'
import ProductsPage from '@/pages/ProductsPage'
import CategoriesPage from '@/pages/CategoriesPage'
import CompaniesPage from '@/pages/CompaniesPage'
import BrandsPage from '@/pages/BrandsPage'
import ProductVariantsPage from '@/pages/ProductVariantsPage'
import PartiesPage from '@/pages/PartiesPage'
import UsersPage from '@/pages/UsersPage'
import AccountPage from '@/pages/AccountPage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Any authenticated user */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/brands" element={<BrandsPage />} />
              <Route path="/product-variants" element={<ProductVariantsPage />} />
              <Route path="/parties" element={<PartiesPage />} />
              <Route path="/account" element={<AccountPage />} />

              {/* admin / super_admin only */}
              <Route element={<ProtectedRoute allowedRoles={MANAGER_ROLES} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}
