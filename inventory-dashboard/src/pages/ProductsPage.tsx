import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { productsApi } from '@/api/products'
import { brandsApi } from '@/api/brands'
import { categoriesApi } from '@/api/categories'
import { getApiErrorMessage } from '@/lib/axios'
import type { Product, Brand, Category } from '@/types'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const emptyForm = {
  name: '',
  description: '',
  brand_id: '',
  category_id: '',
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [brands, setBrands] = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await productsApi.list({ skip, limit: PAGE_SIZE })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    Promise.all([
      brandsApi.list({ limit: 100 }),
      categoriesApi.list({ limit: 100 }),
    ])
      .then(([b, c]) => {
        setBrands(b.items)
        setCategories(c.items)
      })
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: Product) => {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description ?? '',
      brand_id: String(item.brand_id),
      category_id: String(item.category_id),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.brand_id || !form.category_id) {
      toast.error('Name, brand and category are required')
      return
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      brand_id: Number(form.brand_id),
      category_id: Number(form.category_id),
    }
    setSaving(true)
    try {
      if (editing) {
        await productsApi.update(editing.id, payload)
        toast.success('Product updated')
      } else {
        await productsApi.create(payload)
        toast.success('Product created')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productsApi.deactivate(deleteTarget.id)
      toast.success('Product deactivated')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const nameOf = (list: { id: number; name: string }[], id: number) =>
    list.find((i) => i.id === id)?.name ?? `#${id}`

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog."
        actions={
          <RequirePermission permission="inventory:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </RequirePermission>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <RequirePermission permission="inventory:manage">
                <TableHead className="w-24 text-right">Actions</TableHead>
              </RequirePermission>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No products yet.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.brand?.name ?? nameOf(brands, item.brand_id)}
                  </TableCell>
                  <TableCell>
                    {item.category?.name ?? nameOf(categories, item.category_id)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {item.description ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={item.is_active} />
                  </TableCell>
                  <RequirePermission permission="inventory:manage">
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </RequirePermission>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? 0 : skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of{' '}
          {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => setSkip(skip + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-desc">Description</Label>
              <Input
                id="product-desc"
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select
                  value={form.brand_id}
                  onValueChange={(v) => setForm({ ...form, brand_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Deactivate product?"
        description={`This will deactivate "${deleteTarget?.name}". It can be reactivated later.`}
        onConfirm={handleDeactivate}
        isLoading={deleting}
      />
    </div>
  )
}
