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
import { RequirePermission } from '@/components/auth/RequirePermission'
import { purchaseReturnsApi } from '@/api/purchaseReturns'
import { partiesApi } from '@/api/parties'
import { batchesApi } from '@/api/batches'
import { getApiErrorMessage } from '@/lib/axios'
import type { PurchaseReturn, Party, ProductBatch } from '@/types'
import { Plus, Eye, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

interface LineForm {
  batch_id: string
  qty: string
}

const emptyLine: LineForm = { batch_id: '', qty: '' }

const emptyForm = {
  supplier_id: '',
  return_date: '',
}

export default function PurchaseReturnsPage() {
  const [items, setItems] = useState<PurchaseReturn[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [supplierFilter, setSupplierFilter] = useState<string>('ALL')

  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [batchesBySupplier, setBatchesBySupplier] = useState<Record<number, ProductBatch[]>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }])
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState<PurchaseReturn | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (supplierFilter !== 'ALL') params.supplier_id = Number(supplierFilter)
      const res = await purchaseReturnsApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, supplierFilter])

  useEffect(() => {
    load()
  }, [load])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await partiesApi.list({ limit: 200, party_type: 'SUPPLIER', is_active: true })
      setSuppliers(res.items)
    } catch {
      // supplier picker still works as a typed id
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const loadBatches = useCallback(async (supplierId: number) => {
    setBatchesBySupplier((prev) => {
      if (prev[supplierId]) return prev
      batchesApi
        .list({ supplier_id: supplierId, has_stock: true, limit: 200 })
        .then((res) => {
          setBatchesBySupplier((cur) => ({ ...cur, [supplierId]: res.items }))
        })
        .catch(() => {
          // line editor still works, just without batch options
        })
      return prev
    })
  }, [])

  const openCreate = () => {
    setForm({ supplier_id: '', return_date: new Date().toISOString().slice(0, 10) })
    setLines([{ ...emptyLine }])
    setDialogOpen(true)
  }

  const openView = async (item: PurchaseReturn) => {
    try {
      const fresh = await purchaseReturnsApi.get(item.id)
      setViewing(fresh)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const setSupplier = (value: string) => {
    setForm((f) => ({ ...f, supplier_id: value }))
    if (value) loadBatches(Number(value))
  }

  const addLine = () => setLines([...lines, { ...emptyLine }])

  const removeLine = (idx: number) => {
    if (lines.length === 1) {
      toast.error('A return needs at least one line')
      return
    }
    setLines(lines.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const supplierBatches = () => {
    if (!form.supplier_id) return []
    return batchesBySupplier[Number(form.supplier_id)] ?? []
  }

  const selectedBatch = (idx: number) =>
    supplierBatches().find((b) => b.id === lines[idx]?.batch_id)

  // A batch can only be returned once per form - hide already-chosen ones.
  const availableBatches = (idx: number) => {
    const chosen = new Set(lines.map((l) => l.batch_id).filter(Boolean))
    return supplierBatches().filter((b) => b.id === lines[idx]?.batch_id || !chosen.has(b.id))
  }

  const lineTotal = (l: LineForm) => {
    const batch = supplierBatches().find((b) => b.id === l.batch_id)
    const qty = Number(l.qty) || 0
    const cost = batch ? Number(batch.cost_price) : 0
    return qty * cost
  }

  const formTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  const handleSave = async () => {
    if (!form.supplier_id) {
      toast.error('Supplier is required')
      return
    }
    if (!form.return_date) {
      toast.error('Return date is required')
      return
    }
    const batchMap = new Map(supplierBatches().map((b) => [b.id, b]))
    const validLines = lines.map((l) => {
      const batch = batchMap.get(l.batch_id)
      return { batch, qty: Number(l.qty) }
    })
    if (validLines.some((l) => !l.batch || l.qty <= 0 || l.qty > Number(l.batch.qty_remaining))) {
      toast.error('Each line needs a batch and a qty between 1 and the batch stock on hand')
      return
    }

    setSaving(true)
    try {
      await purchaseReturnsApi.create({
        supplier_id: Number(form.supplier_id),
        return_date: form.return_date,
        reason: undefined,
        lines: validLines.map((l) => ({
          purchase_line_id: l.batch!.purchase_line_id,
          qty: l.qty,
        })),
      })
      toast.success('Purchase return recorded — stock reduced & supplier ledger updated')
      setDialogOpen(false)
      setBatchesBySupplier({})
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const returnTotal = (r: PurchaseReturn) =>
    r.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Returns"
        description="Return goods to suppliers — stock goes back and the supplier balance is adjusted."
        actions={
          <RequirePermission permission="purchases:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Return
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={supplierFilter}
          onValueChange={(v) => {
            setSupplierFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-64">
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
              <TableHead>Return #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
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
                  No purchase returns found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell>{item.supplier_name ?? `Supplier #${item.supplier_id}`}</TableCell>
                  <TableCell>{item.return_date}</TableCell>
                  <TableCell className="text-right">{item.lines.length}</TableCell>
                  <TableCell className="text-right">{money(returnTotal(item))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openView(item)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Purchase Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={setSupplier}>
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
                <Label htmlFor="return-date">Return Date</Label>
                <Input
                  id="return-date"
                  type="date"
                  value={form.return_date}
                  onChange={(e) => setForm({ ...form, return_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4" />
                  Add Line
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const batch = selectedBatch(idx)
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="space-y-1">
                              <Select
                                value={l.batch_id}
                                onValueChange={(v) => updateLine(idx, 'batch_id', v)}
                                disabled={!form.supplier_id}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a batch" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableBatches(idx).map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.variant_name ?? b.variant_id} ({b.variant_sku}) ·{' '}
                                      {money(Number(b.cost_price))} · {b.qty_remaining} in stock
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {batch && (
                                <p className="text-xs text-muted-foreground">
                                  Returnable: {batch.qty_remaining} @ {money(Number(batch.cost_price))} ea
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
                            />
                          </TableCell>
                          <TableCell className="text-right">{money(lineTotal(l))}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Record Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Return {viewing?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">
                    {viewing.supplier_name ?? `Supplier #${viewing.supplier_id}`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{viewing.return_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reason</p>
                  <p className="font-medium">{viewing.reason || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{money(returnTotal(viewing))}</p>
                </div>
              </div>
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
                        <TableCell>
                          {l.variant_name ?? l.variant_id}
                          {l.variant_sku ? ` (${l.variant_sku})` : ''}
                        </TableCell>
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
    </div>
  )
}