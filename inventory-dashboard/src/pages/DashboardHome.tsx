import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { useAuth } from '@/contexts/AuthContext'
import { categoriesApi } from '@/api/categories'
import { brandsApi } from '@/api/brands'
import { productsApi } from '@/api/products'
import { productVariantsApi } from '@/api/productVariants'
import { usersApi } from '@/api/users'
import { ROLE_LABELS } from '@/config/rbac'
import { Boxes, Building2, Tags, PackageSearch, Users } from 'lucide-react'

interface Stat {
  label: string
  value: number | null
  icon: typeof Boxes
}

export default function DashboardHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Products', value: null, icon: Boxes },
    { label: 'Categories', value: null, icon: Tags },
    { label: 'Brands', value: null, icon: Building2 },
    { label: 'Product Variants', value: null, icon: PackageSearch },
  ])
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const [products, categories, brands, variants] = await Promise.all([
        productsApi.list({ limit: 1 }),
        categoriesApi.list({ limit: 1 }),
        brandsApi.list({ limit: 1 }),
        productVariantsApi.list({ limit: 1 }),
      ])
      if (!mounted) return
      setStats([
        { label: 'Products', value: products.total, icon: Boxes },
        { label: 'Categories', value: categories.total, icon: Tags },
        { label: 'Brands', value: brands.total, icon: Building2 },
        { label: 'Product Variants', value: variants.total, icon: PackageSearch },
      ])
    }
    load().catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'super_admin') return
    let mounted = true
    usersApi
      .list({ limit: 1 })
      .then((res) => mounted && setUserCount(res.total))
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [user])

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ''}`}
        description={`Signed in as ${user ? ROLE_LABELS[user.role] : ''}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {s.value === null ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{s.value}</div>}
            </CardContent>
          </Card>
        ))}

        <RequirePermission permission="users:view">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {userCount === null ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{userCount}</div>}
            </CardContent>
          </Card>
        </RequirePermission>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {user?.role === 'super_admin' && 'Full access — you can manage users, roles and all inventory master data.'}
          {user?.role === 'admin' && 'You can manage store keepers, sellers and all inventory master data.'}
          {(user?.role === 'store_keeper' || user?.role === 'seller') &&
            'You can view and browse inventory data. Creating or editing master data requires an admin.'}
        </CardContent>
      </Card>
    </div>
  )
}
