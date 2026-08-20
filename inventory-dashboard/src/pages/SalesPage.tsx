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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { salesApi } from '@/api/sales'
import { paymentsApi } from '@/api/payments'
import { partiesApi } from '@/api/parties'
import { productVariantsApi } from '@/api/productVariants'
import { batchesApi } from '@/api/batches'
import { getApiErrorMessage } from '@/lib/axios'
import type { Sale, SaleStatus, Party, ProductVariant, ProductBatch } from '@/types'
import {
  Plus,
  Pencil,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Banknote,
} from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const STATUS_COLORS: Record<SaleStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

interface LineForm {
  variant_id: string
  batch_id: string
  qty: string
  unit_price: string
}

const emptyLine: LineForm = { variant_id: '', batch_id: '', qty: '', unit_price: '' }

const emptyForm = {
  party_id: '',
  sale_date: '',
}

export default function SalesPage() {
  const [items, setItems] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [customerFilter, setCustomerFilter] = useState<string>('ALL')

  const [customers, setCustomers] = useState<Party[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [batchesByVariant, setBatchesByVariant] = useState<Record<string, ProductBatch[]>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }])
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState<Sale | null>(null)

  const [completing, setCompleting] = useState<Sale | null>(null)
  const [cancelling, setCancelling] = useState<Sale | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [paying, setPaying] = useState<Sale | null>(null)
  const [payMode, setPayMode] = useState<'receive' | 'refund'>('receive')
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', payment_date: '' })
  const [payLoading, setPayLoading] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (customerFilter !== 'ALL') params.party_id = Number(customerFilter)
      const res = await salesApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, statusFilter, customerFilter])

  useEffect(() => {
    load()
  }, [load])

  const loadCustomers = useCallback(async () => {
    try {
      const [customersRes, walkIns] = await Promise.all([
        partiesApi.list({ limit: 200, party_type: 'CUSTOMER', is_active: true }),
        partiesApi.list({ limit: 200, party_type: 'WALK_IN', is_active: true }),
      ])
      setCustomers([...customersRes.items, ...walkIns.items])
    } catch {
      // customer filter still works, just without names
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    try {
      const variantsRes = await productVariantsApi.list({ limit: 200, is_active: true })
      setVariants(variantsRes.items)
    } catch {
      // line editor still works, just without variant options
    }
  }, [])

  const loadBatchesForVariant = useCallback(async (variantId: string) => {
    setBatchesByVariant((prev) => {
      if (prev[variantId]) return prev
      batchesApi
        .fifo(variantId)
        .then((items) => {
          setBatchesByVariant((cur) => ({ ...cur, [variantId]: items }))
        })
        .catch(() => {
          // stock hints unavailable; line editor still works
        })
      return prev
    })
  }, [])

  useEffect(() => {
    loadCustomers()
    loadCatalog()
  }, [loadCustomers, loadCatalog])

  const customerName = (id?: number) =>
    id == null ? 'Walk-in' : customers.find((c) => c.id === id)?.name ?? `#${id}`

  const saleTotal = (s: Sale) => s.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  // Per-order accounting: outstanding = total - paid - returned.
  const saleOutstanding = (s: Sale) =>
    saleTotal(s) - Number(s.amount_paid) - Number(s.returned_amount ?? 0)

  const openCreate = () => {
    setEditing(null)
    setForm({ party_id: '', sale_date: new Date().toISOString().slice(0, 10) })
    setLines([{ ...emptyLine }])
    setDialogOpen(true)
  }

  const openEdit = (item: Sale) => {
    setEditing(item)
    setForm({
      party_id: item.party_id != null ? String(item.party_id) : '',
      sale_date: item.sale_date.slice(0, 10),
    })
    setLines(
      item.lines.map((l) => ({
        variant_id: l.variant_id,
        batch_id: l.batch_id ?? '',
        qty: String(l.qty),
        unit_price: String(l.unit_price),
      })),
    )
    setDialogOpen(true)
  }

  const openView = async (item: Sale) => {
    try {
      const fresh = await salesApi.get(item.id)
      setViewing(fresh)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const addLine = () => setLines([...lines, { ...emptyLine }])

  const removeLine = (idx: number) => {
    if (lines.length === 1) {
      toast.error('A sale needs at least one line')
      return
    }
    setLines(lines.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    if (field === 'variant_id') {
      // Changing variant invalidates the previously chosen batch/supplier.
      loadBatchesForVariant(value)
      setLines(lines.map((l, i) => (i === idx ? { ...l, variant_id: value, batch_id: '' } : l)))
      return
    }
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const lineTotal = (l: LineForm) => {
    const qty = Number(l.qty) || 0
    const price = Number(l.unit_price) || 0
    return qty * price
  }

  const formTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  const handleSave = async () => {
    if (!form.sale_date) {
      toast.error('Sale date is required')
      return
    }
    const validLines = lines.map((l) => ({
      variant_id: l.variant_id,
      batch_id: l.batch_id || undefined,
      qty: Number(l.qty),
      unit_price: Number(l.unit_price),
    }))
    if (validLines.some((l) => !l.variant_id || l.qty <= 0 || l.unit_price < 0)) {
      toast.error('Each line needs a variant, a qty > 0 and a unit price >= 0')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await salesApi.update(editing.id, {
          party_id: form.party_id ? Number(form.party_id) : undefined,
          sale_date: form.sale_date,
        })
        toast.success('Sale updated')
      } else {
        await salesApi.create({
          party_id: form.party_id ? Number(form.party_id) : undefined,
          sale_date: form.sale_date,
          lines: validLines,
        })
        toast.success('Sale created (draft)')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!completing) return
    setActionLoading(true)
    try {
      await salesApi.complete(completing.id)
      toast.success('Sale completed — stock & customer ledger updated')
      setCompleting(null)
      load()
      loadCatalog()
      setBatchesByVariant({})
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelling) return
    setActionLoading(true)
    try {
      await salesApi.cancel(cancelling.id)
      toast.success('Sale cancelled')
      setCancelling(null)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const openPayment = (item: Sale) => {
    setPayMode('receive')
    setPaying(item)
    setPayForm((f) => ({
      ...f,
      amount: String(saleOutstanding(item)),
      payment_date: new Date().toISOString().slice(0, 10),
    }))
  }

  const openRefund = (item: Sale) => {
    setPayMode('refund')
    setPaying(item)
    setPayForm((f) => ({
      ...f,
      amount: String(-saleOutstanding(item)),
      payment_date: new Date().toISOString().slice(0, 10),
    }))
  }

  const handlePay = async () => {
    if (!paying) return
    const amount = Number(payForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    if (!payForm.payment_date) {
      toast.error('Payment date is required')
      return
    }
    setPayLoading(true)
    try {
      await paymentsApi.create({
        party_id: paying.party_id,
        direction: payMode === 'refund' ? 'REFUND_TO_CUSTOMER' : 'RECEIVED_FROM_CUSTOMER',
        amount,
        method: payForm.method,
        payment_date: payForm.payment_date,
        sale_id: paying.id,
      })
      toast.success(
        `${payMode === 'refund' ? 'Refund recorded' : 'Payment recorded'} against order ${paying.id.slice(0, 8).toUpperCase()}`,
      )
      setPaying(null)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setPayLoading(false)
    }
  }

  const variantLabel = (id: string) => {
    const v = variants.find((v) => v.id === id)
    return v ? `${v.name} (${v.sku})` : id
  }

  const variantBatches = (variantId: string) => batchesByVariant[variantId] ?? []

  const variantStock = (variantId: string) =>
    variantBatches(variantId).reduce((sum, b) => sum + Number(b.qty_remaining), 0)

  const selectedBatch = (variantId: string, batchId: string) =>
    variantBatches(variantId).find((b) => b.id === batchId)

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Record sales, complete checkouts, and track customer receivables."
        actions={
          <RequirePermission permission="sales:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Sale
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={customerFilter}
          onValueChange={(v) => {
            setCustomerFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Customers</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
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
                  No sales found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => {
                const isDraft = item.status === 'DRAFT'
                const outstanding = saleOutstanding(item)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>{customerName(item.party_id)}</TableCell>
                    <TableCell>{item.sale_date}</TableCell>
                    <TableCell className="text-right">{item.lines.length}</TableCell>
                    <TableCell className="text-right">
                      {money(saleTotal(item))}
                    </TableCell>
                    <TableCell className="text-right">
                      {money(Number(item.amount_paid))}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        outstanding < 0 ? 'text-green-600' : 'text-foreground'
                      }`}
                    >
                      {outstanding < 0 ? `Credit ${money(-outstanding)}` : money(outstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                        {STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openView(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <RequirePermission permission="sales:manage">
                          {isDraft && (
                            <>
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
                                onClick={() => setCompleting(item)}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCancelling(item)}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </RequirePermission>
                        <RequirePermission permission="payments:manage">
                          {item.status === 'COMPLETED' && item.party_id != null && outstanding > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPayment(item)}
                            >
                              <Banknote className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {item.status === 'COMPLETED' && item.party_id != null && outstanding < 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openRefund(item)}
                            >
                              <Banknote className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                        </RequirePermission>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? 0 : skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Sale' : 'New Sale'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={form.party_id}
                  onValueChange={(v) => setForm({ ...form, party_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Walk-in" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Walk-in</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                        {c.party_type === 'WALK_IN' ? ' (Walk-in)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-date">Sale Date</Label>
                <Input
                  id="sale-date"
                  type="date"
                  value={form.sale_date}
                  onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  disabled={!!editing}
                >
                  <Plus className="h-4 w-4" />
                  Add Line
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead className="w-56">Supplier / Batch</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Unit Price</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const batches = l.variant_id ? variantBatches(l.variant_id) : []
                      const totalStock = l.variant_id ? variantStock(l.variant_id) : null
                      const chosen = l.batch_id ? selectedBatch(l.variant_id, l.batch_id) : null
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select
                              value={l.variant_id}
                              onValueChange={(v) => updateLine(idx, 'variant_id', v)}
                              disabled={!!editing}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select variant" />
                              </SelectTrigger>
                              <SelectContent>
                                {variants.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.name} ({v.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Select
                                value={l.batch_id}
                                onValueChange={(v) => updateLine(idx, 'batch_id', v)}
                                disabled={!!editing || !l.variant_id}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Auto (FIFO)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Auto (FIFO)</SelectItem>
                                  {batches.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.supplier_name ?? `Supplier #${b.supplier_id}`} ·{' '}
                                      {money(Number(b.cost_price))} · {b.qty_remaining} left
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {totalStock != null && (
                                <p
                                  className={
                                    totalStock <= 0
                                      ? 'text-xs font-medium text-destructive'
                                      : 'text-xs text-muted-foreground'
                                  }
                                >
                                  {chosen
                                    ? `${chosen.qty_remaining} of ${totalStock} in stock (${chosen.supplier_name ?? `Supplier #${chosen.supplier_id}`})`
                                    : `${totalStock} in stock`}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              value={l.qty}
                              onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                              disabled={!!editing}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.unit_price}
                              onChange={(e) => updateLine(idx, 'unit_price', e.target.value)}
                              disabled={!!editing}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {money(lineTotal(l))}
                          </TableCell>
                          <TableCell>
                            {!editing && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLine(idx)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end text-sm">
                <span className="font-medium">Total: {money(formTotal)}</span>
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
              {editing ? 'Save Changes' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice {viewing?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{customerName(viewing.party_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{viewing.sale_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[viewing.status]}>
                    {STATUS_LABELS[viewing.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{money(saleTotal(viewing))}</p>
                </div>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{variantLabel(l.variant_id)}</TableCell>
                        <TableCell className="text-right">{l.qty}</TableCell>
                        <TableCell className="text-right">{money(Number(l.unit_price))}</TableCell>
                        <TableCell className="text-right">
                          {l.unit_cost_snapshot != null
                            ? money(Number(l.unit_cost_snapshot))
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">{money(Number(l.line_total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete confirm */}
      <AlertDialog open={!!completing} onOpenChange={(open) => !open && setCompleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              This FIFO-allocates stock batches, records stock-out movements, and
              adds the total to the customer&apos;s balance. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Complete Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              The sale will be marked as cancelled and cannot be completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receive payment dialog */}
      <Dialog open={!!paying} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {payMode === 'refund' ? 'Refund Order Credit —' : 'Receive Payment —'}{' '}
              {paying?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {paying && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{money(saleTotal(paying))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paid</p>
                  <p className="font-medium">{money(Number(paying.amount_paid))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {payMode === 'refund' ? 'Credit' : 'Due'}
                  </p>
                  <p className="font-semibold">
                    {money(Math.abs(saleOutstanding(paying)))}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {payMode === 'refund'
                  ? 'Issuing a refund reduces this order’s credit — the order’s outstanding returns to the true figure.'
                  : 'The payment is tracked against this order, reducing its outstanding — not just the overall balance.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Amount</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select
                    value={payForm.method}
                    onValueChange={(v) => setPayForm({ ...payForm, method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['cash', 'bkash', 'bank_transfer', 'card', 'check'].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay-date">Payment Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={payForm.payment_date}
                    onChange={(e) =>
                      setPayForm({ ...payForm, payment_date: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={payLoading}>
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={payLoading}>
              {payLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {payMode === 'refund' ? 'Issue Refund' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}