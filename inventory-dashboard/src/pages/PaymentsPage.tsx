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
import { RequirePermission } from '@/components/auth/RequirePermission'
import { paymentsApi } from '@/api/payments'
import { partiesApi } from '@/api/parties'
import { salesApi } from '@/api/sales'
import { getApiErrorMessage } from '@/lib/axios'
import type { Payment, PaymentDirection, Party, Sale } from '@/types'
import { Plus, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const PAYMENT_METHODS = ['cash', 'bkash', 'bank_transfer', 'card', 'check'] as const

interface DirectionMeta {
  label: string
  short: string
  color: string
  partyKind: 'SUPPLIER' | 'CUSTOMER' | 'NONE'
  allowsWalkIn: boolean
  hint: string
}

const DIRECTION_META: Record<PaymentDirection, DirectionMeta> = {
  PAID_TO_SUPPLIER: {
    label: 'Payment to Supplier',
    short: 'To Supplier',
    color: 'bg-red-100 text-red-800',
    partyKind: 'SUPPLIER',
    allowsWalkIn: false,
    hint: 'Reduces what you owe this supplier (ledger debit).',
  },
  RECEIVED_FROM_CUSTOMER: {
    label: 'Received from Customer',
    short: 'From Customer',
    color: 'bg-green-100 text-green-800',
    partyKind: 'CUSTOMER',
    allowsWalkIn: false,
    hint: 'Reduces what this customer owes you (ledger credit).',
  },
  REFUND_FROM_SUPPLIER: {
    label: 'Refund from Supplier',
    short: 'Supplier Refund',
    color: 'bg-emerald-100 text-emerald-800',
    partyKind: 'SUPPLIER',
    allowsWalkIn: false,
    hint: 'Supplier pays off what they owed you (ledger credit).',
  },
  REFUND_TO_CUSTOMER: {
    label: 'Refund to Customer',
    short: 'Customer Refund',
    color: 'bg-amber-100 text-amber-800',
    partyKind: 'CUSTOMER',
    allowsWalkIn: true,
    hint: 'Refund issued to a customer — ledger debit, or a straight cash-out for walk-ins (no ledger entry).',
  },
}

const emptyForm = {
  direction: '' as PaymentDirection | '',
  party_id: '',
  sale_id: '',
  amount: '',
  method: '',
  payment_date: '',
  reference_no: '',
  notes: '',
}

export default function PaymentsPage() {
  const [items, setItems] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [directionFilter, setDirectionFilter] = useState<string>('ALL')
  const [partyFilter, setPartyFilter] = useState<string>('ALL')

  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [customers, setCustomers] = useState<Party[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [customerSales, setCustomerSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  const [viewing, setViewing] = useState<Payment | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (directionFilter !== 'ALL') params.direction = directionFilter
      if (partyFilter !== 'ALL') params.party_id = Number(partyFilter)
      const res = await paymentsApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, directionFilter, partyFilter])

  useEffect(() => {
    load()
  }, [load])

  const loadCatalog = useCallback(async () => {
    try {
      const [sup, cust, walk] = await Promise.all([
        partiesApi.list({ limit: 200, is_active: true, party_type: 'SUPPLIER' }),
        partiesApi.list({ limit: 200, is_active: true, party_type: 'CUSTOMER' }),
        partiesApi.list({ limit: 200, is_active: true, party_type: 'WALK_IN' }),
      ])
      setSuppliers(sup.items)
      setCustomers([...cust.items, ...walk.items])
    } catch {
      // filters still work, just without names
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const partyName = (id?: number) =>
    id == null
      ? 'Walk-in'
      : (suppliers.find((s) => s.id === id)?.name ??
        customers.find((c) => c.id === id)?.name ??
        `#${id}`)

  const saleTotal = (sale: Sale) =>
    sale.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const saleOutstanding = (sale: Sale) =>
    saleTotal(sale) - Number(sale.amount_paid) - Number(sale.returned_amount ?? 0)

  // For a customer receipt, offer that customer's completed sales that
  // still have an unpaid balance; for a customer refund, offer the ones
  // carrying a credit. Either way the payment is tied to a specific order
  // (per-order tracking, not just on-account).
  useEffect(() => {
    if (form.party_id) {
      setSalesLoading(true)
      setCustomerSales([])
      salesApi
        .list({ status: 'COMPLETED', party_id: Number(form.party_id), limit: 200 })
        .then((res) => {
          const items = res.items.filter((s) => {
            const n = saleOutstanding(s)
            return form.direction === 'REFUND_TO_CUSTOMER' ? n < 0 : n > 0
          })
          setCustomerSales(items)
        })
        .catch(() => setCustomerSales([]))
        .finally(() => setSalesLoading(false))
    } else {
      setCustomerSales([])
    }
    setForm((f) => ({ ...f, sale_id: '' }))
  }, [form.direction, form.party_id])

  const openCreate = () => {
    setForm({
      direction: '',
      party_id: '',
      sale_id: '',
      amount: '',
      method: '',
      payment_date: new Date().toISOString().slice(0, 10),
      reference_no: '',
      notes: '',
    })
    setCustomerSales([])
    setDialogOpen(true)
  }

  const openView = async (item: Payment) => {
    try {
      const fresh = await paymentsApi.get(item.id)
      setViewing(fresh)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const setDirection = (value: string) => {
    const d = value as PaymentDirection
    setForm({ ...form, direction: d, party_id: '', sale_id: '' })
    setCustomerSales([])
  }

  const selectSale = (value: string) => {
    const sale = customerSales.find((s) => s.id === value)
    if (!sale) return
    const n = saleOutstanding(sale)
    const amt = form.direction === 'REFUND_TO_CUSTOMER' ? -n : n
    setForm((f) => ({ ...f, sale_id: value, amount: amt > 0 ? String(amt) : f.amount }))
  }

  const directionParties = () => {
    const d = form.direction as PaymentDirection
    if (!d) return []
    return DIRECTION_META[d].partyKind === 'SUPPLIER' ? suppliers : customers
  }

  const directionLabel = (d: PaymentDirection) => DIRECTION_META[d].label

  const handleSave = async () => {
    const d = form.direction as PaymentDirection
    if (!d) {
      toast.error('Payment type is required')
      return
    }
    const meta = DIRECTION_META[d]
    if (meta.partyKind !== 'NONE' && !form.party_id && !meta.allowsWalkIn) {
      toast.error(`${meta.partyKind === 'SUPPLIER' ? 'A supplier' : 'A customer'} is required for this payment type`)
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    if (!form.method) {
      toast.error('Payment method is required')
      return
    }
    if (!form.payment_date) {
      toast.error('Payment date is required')
      return
    }

    setSaving(true)
    try {
      await paymentsApi.create({
        direction: d,
        party_id: form.party_id ? Number(form.party_id) : undefined,
        sale_id: form.sale_id || undefined,
        amount: Number(form.amount),
        method: form.method,
        payment_date: form.payment_date,
        reference_no: form.reference_no.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      toast.success(
        form.party_id
          ? 'Payment recorded — party ledger updated'
          : 'Walk-in refund recorded',
      )
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Pay suppliers, receive from customers, and record refunds — each payment posts to the linked party's ledger."
        actions={
          <RequirePermission permission="payments:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={directionFilter}
          onValueChange={(v) => {
            setDirectionFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {Object.entries(DIRECTION_META).map(([value, m]) => (
              <SelectItem key={value} value={value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {suppliers.map((s) => (
              <SelectItem key={`s${s.id}`} value={String(s.id)}>
                {s.name} (Supplier)
              </SelectItem>
            ))}
            {customers.map((c) => (
              <SelectItem key={`c${c.id}`} value={String(c.id)}>
                {c.name}
                {c.party_type === 'WALK_IN' ? ' (Walk-In)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Sale</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
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
                  No payments found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">{item.payment_date}</TableCell>
                  <TableCell>{partyName(item.party_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={DIRECTION_META[item.direction].color}>
                      {DIRECTION_META[item.direction].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.method}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.reference_no ?? '—'}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      item.direction === 'PAID_TO_SUPPLIER' ||
                      item.direction === 'REFUND_TO_CUSTOMER'
                        ? 'text-destructive'
                        : 'text-green-600'
                    }`}
                  >
                    {money(Number(item.amount))}
                  </TableCell>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={form.direction} onValueChange={setDirection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIRECTION_META).map(([value, m]) => (
                    <SelectItem key={value} value={value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.direction && (
                <p className="text-xs text-muted-foreground">
                  {DIRECTION_META[form.direction as PaymentDirection].hint}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Party</Label>
                <Select
                  value={form.party_id}
                  onValueChange={(v) => setForm({ ...form, party_id: v })}
                  disabled={!form.direction}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.direction && DIRECTION_META[form.direction as PaymentDirection].allowsWalkIn
                          ? 'Walk-in (no ledger entry)'
                          : 'Select party'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTION_META[form.direction as PaymentDirection]?.allowsWalkIn && (
                      <SelectItem value="">Walk-in</SelectItem>
                    )}
                    {directionParties().map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                        {p.party_type === 'WALK_IN' ? ' (Walk-In)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-date">Payment Date</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                />
              </div>
            </div>

            {form.party_id &&
              (form.direction === 'RECEIVED_FROM_CUSTOMER' ||
                form.direction === 'REFUND_TO_CUSTOMER') && (
              <div className="space-y-2">
                <Label>
                  {form.direction === 'REFUND_TO_CUSTOMER'
                    ? 'Refund this Sale Order'
                    : 'Apply to Sale Order'}
                </Label>
                <Select
                  value={form.sale_id}
                  onValueChange={selectSale}
                  disabled={salesLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.direction === 'REFUND_TO_CUSTOMER'
                          ? 'Select the credited order to refund (optional)'
                          : 'Select a sale to pay (optional)'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {salesLoading ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading…
                      </div>
                    ) : customerSales.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {form.direction === 'REFUND_TO_CUSTOMER'
                          ? 'This customer has no credited orders.'
                          : 'No outstanding completed sales for this customer.'}
                      </div>
                    ) : (
                      customerSales.map((s) => {
                        const n = saleOutstanding(s)
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            #{s.id.slice(0, 8).toUpperCase()} · {s.sale_date} ·{' '}
                            {form.direction === 'REFUND_TO_CUSTOMER'
                              ? `credit ${money(-n)}`
                              : `due ${money(n)}`}
                          </SelectItem>
                        )
                      })
                    )}
                  </SelectContent>
                </Select>
                {form.sale_id && (
                  <p className="text-xs text-muted-foreground">
                    {form.direction === 'REFUND_TO_CUSTOMER'
                      ? 'This refund is tracked against this order — it clears that order’s credit.'
                      : 'This payment is tracked against this order — it reduces that sale’s outstanding, not just the overall balance.'}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) => setForm({ ...form, method: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-ref">Reference #</Label>
              <Input
                id="payment-ref"
                value={form.reference_no}
                onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes</Label>
              <Input
                id="payment-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Payment {viewing?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Party</p>
                  <p className="font-medium">{partyName(viewing.party_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <Badge
                    variant="outline"
                    className={DIRECTION_META[viewing.direction].color}
                  >
                    {directionLabel(viewing.direction)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{viewing.payment_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">{money(Number(viewing.amount))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Method</p>
                  <p className="font-medium">{viewing.method}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reference #</p>
                  <p className="font-medium">{viewing.reference_no ?? '—'}</p>
                </div>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Notes</p>
                <p className="font-medium">{viewing.notes ?? '—'}</p>
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