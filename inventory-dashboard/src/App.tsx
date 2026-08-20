import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FullPageSpinner } from '@/components/common/FullPageSpinner'
import { MANAGER_ROLES } from '@/config/rbac'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardHome = lazy(() => import('@/pages/DashboardHome'))
const ProductsPage = lazy(() => import('@/pages/ProductsPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const BrandsPage = lazy(() => import('@/pages/BrandsPage'))
const ProductVariantsPage = lazy(() => import('@/pages/ProductVariantsPage'))
const PartiesPage = lazy(() => import('@/pages/PartiesPage'))
const PartyLedgerPage = lazy(() => import('@/pages/PartyLedgerPage'))
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage'))
const PurchasesPage = lazy(() => import('@/pages/PurchasesPage'))
const PurchaseReturnsPage = lazy(() => import('@/pages/PurchaseReturnsPage'))
const SalesPage = lazy(() => import('@/pages/SalesPage'))
const SalesReturnsPage = lazy(() => import('@/pages/SalesReturnsPage'))
const StockMovementsPage = lazy(() => import('@/pages/StockMovementsPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const AccountPage = lazy(() => import('@/pages/AccountPage'))
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<FullPageSpinner />}>
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
                <Route path="/party-ledger" element={<PartyLedgerPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/purchase-returns" element={<PurchaseReturnsPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales-returns" element={<SalesReturnsPage />} />
                <Route path="/stock-movements" element={<StockMovementsPage />} />
                <Route path="/account" element={<AccountPage />} />

                {/* admin / super_admin only */}
                <Route element={<ProtectedRoute allowedRoles={MANAGER_ROLES} />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}
