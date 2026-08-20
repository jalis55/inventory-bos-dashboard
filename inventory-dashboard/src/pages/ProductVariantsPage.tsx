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
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { productVariantsApi } from '@/api/productVariants'
import { productsApi } from '@/api/products'
import { getApiErrorMessage } from '@/lib/axios'
import type { ProductVariant, Product } from '@/types'
import { Plus, Pencil, ToggleLeft, ToggleRight, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const emptyForm = {
  product_id: '',
  sku: '',
  barcode: '',
  variant_name: '',
  unit_of_measure: '',
  pack_size: '',
  reorder_level: '',
}

export default function ProductVariantsPage() {
  const [items, setItems] = useState<ProductVariant[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [productFilter, setProductFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductVariant | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (productFilter !== 'ALL') params.product_id = productFilter
      if (search.trim()) params.search = search.trim()
      const res = await productVariantsApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, productFilter, search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    productsApi
      .list({ limit: 200 })
      .then((res) => setProducts(res.items))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: ProductVariant) => {
    setEditing(item)
    setForm({
      product_id: item.product_id,
      sku: item.sku,
      barcode: item.barcode ?? '',
      variant_name: item.variant_name,
      unit_of_measure: item.unit_of_measure,
      pack_size: String(item.pack_size),
      reorder_level: String(item.reorder_level),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.sku.trim() || !form.variant_name.trim() || !form.unit_of_measure.trim() || !form.pack_size) {
      toast.error('SKU, variant name, unit and pack size are required')
      return
    }

    const packSize = Number(form.pack_size)
    if (isNaN(packSize) || packSize <= 0) {
      toast.error('Pack size must be greater than 0')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await productVariantsApi.update(editing.id, {
          sku: form.sku.trim(),
          barcode: form.barcode.trim() || undefined,
          variant_name: form.variant_name.trim(),
          unit_of_measure: form.unit_of_measure.trim(),
          pack_size: packSize,
          reorder_level: form.reorder_level ? Number(form.reorder_level) : 0,
        })
        toast.success('Variant updated')
      } else {
        if (!form.product_id) {
          toast.error('Please select a product')
          setSaving(false)
          return
        }
        await productVariantsApi.create(form.product_id, {
          sku: form.sku.trim(),
          barcode: form.barcode.trim() || undefined,
          variant_name: form.variant_name.trim(),
          unit_of_measure: form.unit_of_measure.trim(),
          pack_size: packSize,
          reorder_level: form.reorder_level ? Number(form.reorder_level) : 0,
        })
        toast.success('Variant created')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (variant: ProductVariant) => {
    setTogglingId(variant.id)
    try {
      if (variant.is_active) {
        await productVariantsApi.deactivate(variant.id)
        toast.success(`${variant.name} deactivated`)
      } else {
        await productVariantsApi.activate(variant.id)
        toast.success(`${variant.name} activated`)
      }
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  const productName = (productId: string) => {
    const p = products.find((pr) => pr.id === productId)
    if (!p) return productId.slice(0, 8)
    return `${p.name} — ${p.brand?.name ?? 'No brand'}`
  }

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Variants"
        description="Manage SKUs, barcodes, pack sizes and reorder levels."
        actions={
          <RequirePermission permission="inventory:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Variant
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={productFilter}
          onValueChange={(v) => {
            setProductFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {productName(p.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Pack Size</TableHead>
              <TableHead className="text-right">Reorder</TableHead>
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
                  <TableCell colSpan={9}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No variants found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{productName(item.product_id)}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {item.sku}
                    </code>
                  </TableCell>
                  <TableCell>{item.barcode ?? '—'}</TableCell>
                  <TableCell>{item.unit_of_measure}</TableCell>
                  <TableCell className="text-right">{item.pack_size}</TableCell>
                  <TableCell className="text-right">{item.reorder_level}</TableCell>
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
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                        >
                          {item.is_active ? (
                            <ToggleRight className="h-4 w-4 text-destructive" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-green-600" />
                          )}
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
              {editing ? 'Edit Variant' : 'Add Variant'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => setForm({ ...form, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {productName(p.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="variant-sku">SKU</Label>
                <Input
                  id="variant-sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-barcode">Barcode</Label>
                <Input
                  id="variant-barcode"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant-name">Variant Name</Label>
              <Input
                id="variant-name"
                placeholder="e.g. 250ml, Large, 6-pack"
                value={form.variant_name}
                onChange={(e) =>
                  setForm({ ...form, variant_name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="variant-uom">Unit of Measure</Label>
                <Input
                  id="variant-uom"
                  placeholder="pcs, kg, box"
                  value={form.unit_of_measure}
                  onChange={(e) =>
                    setForm({ ...form, unit_of_measure: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-pack">Pack Size</Label>
                <Input
                  id="variant-pack"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.pack_size}
                  onChange={(e) =>
                    setForm({ ...form, pack_size: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-reorder">Reorder Level</Label>
                <Input
                  id="variant-reorder"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.reorder_level}
                  onChange={(e) =>
                    setForm({ ...form, reorder_level: e.target.value })
                  }
                />
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
    </div>
  )
}
