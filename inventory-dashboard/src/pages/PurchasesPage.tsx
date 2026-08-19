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
import { purchasesApi } from '@/api/purchases'
import { partiesApi } from '@/api/parties'
import { productVariantsApi } from '@/api/productVariants'
import { getApiErrorMessage } from '@/lib/axios'
import type { Purchase, PurchaseStatus, Party, ProductVariant } from '@/types'
import {
  Plus,
  Pencil,
  Eye,
  PackageCheck,
  XCircle,
  Loader2,
  Trash2,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: 'Draft',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

interface LineForm {
  variant_id: string
  qty: string
  unit_cost: string
}

const emptyLine: LineForm = { variant_id: '', qty: '', unit_cost: '' }

const emptyForm = {
  supplier_id: '',
  purchase_date: '',
  reference_no: '',
  notes: '',
}

export default function PurchasesPage() {
  const [items, setItems] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL')

  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }])
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState<Purchase | null>(null)

  const [receiving, setReceiving] = useState<Purchase | null>(null)
  const [cancelling, setCancelling] = useState<Purchase | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (supplierFilter !== 'ALL') params.supplier_id = Number(supplierFilter)
      const res = await purchasesApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, statusFilter, supplierFilter])

  useEffect(() => {
    load()
  }, [load])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await partiesApi.list({ limit: 200, party_type: 'SUPPLIER', is_active: true })
      setSuppliers(res.items)
    } catch {
      // filter/form still work, just without supplier names
    }
  }, [])

  const loadVariants = useCallback(async () => {
    try {
      const res = await productVariantsApi.list({ limit: 200, is_active: true })
      setVariants(res.items)
    } catch {
      // line editor still works, variants show by id
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
    loadVariants()
  }, [loadSuppliers, loadVariants])

  const supplierName = (id: number) =>
    suppliers.find((s) => s.id === id)?.name ?? `#${id}`

  const purchaseTotal = (p: Purchase) =>
    p.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const openCreate = () => {
    setEditing(null)
    setForm({
      supplier_id: '',
      purchase_date: new Date().toISOString().slice(0, 10),
      reference_no: '',
      notes: '',
    })
    setLines([{ ...emptyLine }])
    setDialogOpen(true)
  }

  const openEdit = (item: Purchase) => {
    setEditing(item)
    setForm({
      supplier_id: String(item.supplier_id),
      purchase_date: item.purchase_date.slice(0, 10),
      reference_no: item.reference_no ?? '',
      notes: item.notes ?? '',
    })
    setLines(
      item.lines.map((l) => ({
        variant_id: l.variant_id,
        qty: String(l.qty),
        unit_cost: String(l.unit_cost),
      })),
    )
    setDialogOpen(true)
  }

  const openView = async (item: Purchase) => {
    try {
      const fresh = await purchasesApi.get(item.id)
      setViewing(fresh)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const addLine = () => setLines([...lines, { ...emptyLine }])

  const removeLine = (idx: number) => {
    if (lines.length === 1) {
      toast.error('A purchase needs at least one line')
      return
    }
    setLines(lines.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const lineTotal = (l: LineForm) => {
    const qty = Number(l.qty) || 0
    const cost = Number(l.unit_cost) || 0
    return qty * cost
  }

  const formTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  const handleSave = async () => {
    if (!form.supplier_id) {
      toast.error('Supplier is required')
      return
    }
    if (!form.purchase_date) {
      toast.error('Purchase date is required')
      return
    }
    const validLines = lines.map((l) => ({
      variant_id: l.variant_id,
      qty: Number(l.qty),
      unit_cost: Number(l.unit_cost),
    }))
    if (validLines.some((l) => !l.variant_id || l.qty <= 0 || l.unit_cost <= 0)) {
      toast.error('Each line needs a variant, a qty > 0 and a unit cost > 0')
      return
    }

    const header = {
      supplier_id: Number(form.supplier_id),
      purchase_date: form.purchase_date,
      reference_no: form.reference_no.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }

    setSaving(true)
    try {
      if (editing) {
        await purchasesApi.update(editing.id, header)
        toast.success('Purchase updated')
      } else {
        await purchasesApi.create({ ...header, lines: validLines })
        toast.success('Purchase created')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleReceive = async () => {
    if (!receiving) return
    setActionLoading(true)
    try {
      await purchasesApi.receive(receiving.id)
      toast.success('Purchase received — stock & supplier ledger updated')
      setReceiving(null)
      load()
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
      await purchasesApi.cancel(cancelling.id)
      toast.success('Purchase cancelled')
      setCancelling(null)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const variantLabel = (id: string) => {
    const v = variants.find((v) => v.id === id)
    return v ? `${v.name} (${v.sku})` : id
  }

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Record purchase orders, receive stock, and track supplier payables."
        actions={
          <RequirePermission permission="purchases:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Purchase
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
            <SelectItem value="RECEIVED">Received</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={supplierFilter}
          onValueChange={(v) => {
            setSupplierFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No purchases found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => {
                const isDraft = item.status === 'DRAFT'
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.reference_no ?? item.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{supplierName(item.supplier_id)}</TableCell>
                    <TableCell>{item.purchase_date}</TableCell>
                    <TableCell className="text-right">{item.lines.length}</TableCell>
                    <TableCell className="text-right">
                      {money(purchaseTotal(item))}
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
                        <RequirePermission permission="purchases:manage">
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
                                onClick={() => setReceiving(item)}
                              >
                                <PackageCheck className="h-4 w-4 text-green-600" />
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
            <DialogTitle>
              {editing ? 'Edit Purchase' : 'Add Purchase'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(v) => setForm({ ...form, supplier_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Purchase Date</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  disabled={!!editing}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchase-ref">Reference No.</Label>
                <Input
                  id="purchase-ref"
                  placeholder="e.g. PO-001"
                  value={form.reference_no}
                  onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-notes">Notes</Label>
                <Input
                  id="purchase-notes"
                  placeholder="Optional"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                      <TableHead className="w-28">Qty</TableHead>
                      <TableHead className="w-32">Unit Cost</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => (
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
                            value={l.unit_cost}
                            onChange={(e) => updateLine(idx, 'unit_cost', e.target.value)}
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
                    ))}
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
              {editing ? 'Save Changes' : 'Create Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Purchase {viewing?.reference_no ?? viewing?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{supplierName(viewing.supplier_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{viewing.purchase_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[viewing.status]}>
                    {STATUS_LABELS[viewing.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{money(purchaseTotal(viewing))}</p>
                </div>
              </div>
              {viewing.notes && (
                <p className="text-sm text-muted-foreground">
                  Notes: {viewing.notes}
                </p>
              )}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{variantLabel(l.variant_id)}</TableCell>
                        <TableCell className="text-right">{l.qty}</TableCell>
                        <TableCell className="text-right">{money(Number(l.unit_cost))}</TableCell>
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

      {/* Receive confirm */}
      <AlertDialog open={!!receiving} onOpenChange={(open) => !open && setReceiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Receive this purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates stock batches, records stock-in movements, and adds the
              total to the supplier&apos;s balance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReceive} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Receive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              The purchase will be marked as cancelled and cannot be received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel Purchase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}