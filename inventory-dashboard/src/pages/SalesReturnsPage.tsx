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
import { salesReturnsApi } from '@/api/salesReturns'
import { salesApi } from '@/api/sales'
import { partiesApi } from '@/api/parties'
import { productVariantsApi } from '@/api/productVariants'
import { getApiErrorMessage } from '@/lib/axios'
import type { SalesReturn, Party, Sale, SaleLine, ProductVariant } from '@/types'
import { Plus, Eye, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

interface LineForm {
  sale_id: string
  sale_line_id: string
  qty: string
}

const emptyLine: LineForm = { sale_id: '', sale_line_id: '', qty: '' }

const emptyForm = {
  party_id: '',
  return_date: '',
}

export default function SalesReturnsPage() {
  const [items, setItems] = useState<SalesReturn[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [partyFilter, setPartyFilter] = useState<string>('ALL')

  const [customers, setCustomers] = useState<Party[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [completedSales, setCompletedSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }])
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState<SalesReturn | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (partyFilter !== 'ALL') params.party_id = Number(partyFilter)
      const res = await salesReturnsApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, partyFilter])

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
      // party picker still works, just without names
    }
  }, [])

  const loadVariants = useCallback(async () => {
    try {
      const res = await productVariantsApi.list({ limit: 200, is_active: true })
      setVariants(res.items)
    } catch {
      // line picker still works, just showing raw variant ids
    }
  }, [])

  useEffect(() => {
    loadCustomers()
    loadVariants()
  }, [loadCustomers, loadVariants])

  const loadCompletedSales = useCallback(async () => {
    setSalesLoading(true)
    try {
      const res = await salesApi.list({ status: 'COMPLETED', limit: 200 })
      setCompletedSales(res.items)
    } catch {
      // line picker still works for previously loaded sales
    } finally {
      setSalesLoading(false)
    }
  }, [])

  const openCreate = () => {
    setForm({ party_id: '', return_date: new Date().toISOString().slice(0, 10) })
    setLines([{ ...emptyLine }])
    setDialogOpen(true)
    loadCompletedSales()
  }

  const openView = async (item: SalesReturn) => {
    try {
      const fresh = await salesReturnsApi.get(item.id)
      setViewing(fresh)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const partyName = (id?: number) =>
    id == null ? 'Walk-in' : customers.find((c) => c.id === id)?.name ?? `#${id}`

  const partySales = () => {
    const pid = form.party_id ? Number(form.party_id) : null
    return completedSales.filter((s) =>
      pid == null ? s.party_id == null : s.party_id === pid,
    )
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
    if (field === 'sale_id') {
      // Changing the sale invalidates the previously chosen line.
      setLines(lines.map((l, i) => (i === idx ? { ...l, sale_id: value, sale_line_id: '' } : l)))
      return
    }
    setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const selectedSale = (idx: number) =>
    partySales().find((s) => s.id === lines[idx]?.sale_id)

  const selectedLine = (idx: number) =>
    selectedSale(idx)?.lines.find((l) => l.id === lines[idx]?.sale_line_id)

  const variantLabel = (id: string) => {
    const v = variants.find((v) => v.id === id)
    return v ? `${v.name} (${v.sku})` : id
  }

  const lineTotal = (l: LineForm) => {
    const line = partySales()
      .find((s) => s.id === l.sale_id)
      ?.lines.find((sl) => sl.id === l.sale_line_id)
    const qty = Number(l.qty) || 0
    const price = line ? Number(line.unit_price) : 0
    return qty * price
  }

  const formTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  const handleSave = async () => {
    if (!form.return_date) {
      toast.error('Return date is required')
      return
    }
    const lineMap = new Map<string, SaleLine>()
    for (const s of completedSales) for (const l of s.lines) lineMap.set(l.id, l)
    const validLines = lines.map((l) => ({ line: lineMap.get(l.sale_line_id), qty: Number(l.qty) }))
    if (validLines.some((x) => !x.line || x.qty <= 0 || x.qty > Number(x.line.qty))) {
      toast.error('Each line needs a sale line and a qty between 1 and the quantity sold')
      return
    }

    setSaving(true)
    try {
      await salesReturnsApi.create({
        party_id: form.party_id ? Number(form.party_id) : undefined,
        return_date: form.return_date,
        reason: undefined,
        lines: validLines.map((x) => ({
          sale_line_id: x.line!.id,
          qty: x.qty,
        })),
      })
      toast.success(
        form.party_id
          ? 'Sales return recorded — stock restocked & customer balance adjusted'
          : 'Sales return recorded — stock restocked & cash refund generated',
      )
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const returnTotal = (r: SalesReturn) =>
    r.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Returns"
        description="Accept returned goods — stock is restocked and the customer is credited or refunded."
        actions={
          <RequirePermission permission="sales:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Return
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={partyFilter}
          onValueChange={(v) => {
            setPartyFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Parties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Parties</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
                {c.party_type === 'WALK_IN' ? ' (Walk-in)' : ''}
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
              <TableHead>Party</TableHead>
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
                  No sales returns found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell>{partyName(item.party_id)}</TableCell>
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
            <DialogTitle>New Sales Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Party</Label>
                <Select
                  value={form.party_id}
                  onValueChange={(v) => setForm({ ...form, party_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Walk-in (cash refund)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Walk-in (cash refund)</SelectItem>
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
                      <TableHead>Original Sale</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const sale = selectedSale(idx)
                      const line = selectedLine(idx)
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select
                              value={l.sale_id}
                              onValueChange={(v) => updateLine(idx, 'sale_id', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select completed sale" />
                              </SelectTrigger>
                              <SelectContent>
                                {salesLoading ? (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    Loading…
                                  </div>
                                ) : partySales().length === 0 ? (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No completed sales for this party.
                                  </div>
                                ) : (
                                  partySales().map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      #{s.id.slice(0, 8).toUpperCase()} · {s.sale_date}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Select
                                value={l.sale_line_id}
                                onValueChange={(v) => updateLine(idx, 'sale_line_id', v)}
                                disabled={!l.sale_id}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select line" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sale?.lines.map((sl) => (
                                    <SelectItem key={sl.id} value={sl.id}>
                                      {variantLabel(sl.variant_id)} · {money(Number(sl.unit_price))} ·{' '}
                                      {sl.qty} sold
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {line && (
                                <p className="text-xs text-muted-foreground">
                                  Returnable: {line.qty} @ {money(Number(line.unit_price))} ea
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
            <DialogTitle>Sales Return {viewing?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Party</p>
                  <p className="font-medium">{partyName(viewing.party_id)}</p>
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
                      <TableHead className="text-right">Unit Price</TableHead>
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
                        <TableCell className="text-right">{money(Number(l.unit_price))}</TableCell>
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