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
import { paymentsApi } from '@/api/payments'
import { purchasesApi } from '@/api/purchases'
import { salesApi } from '@/api/sales'
import { partiesApi } from '@/api/parties'
import { printPaymentReceipt } from '@/utils/receipt'
import { getApiErrorMessage } from '@/lib/axios'
import type { PaymentDirection, Party } from '@/types'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type PartyKind = 'SUPPLIER' | 'CUSTOMER'
type Mode = 'PAY' | 'REFUND'

interface InvoiceRow {
  id: string
  ref: string
  date: string
  total: number
  paid: number
  returned: number
  due: number // signed: negative = the supplier owes YOU a credit
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PaymentsPage() {
  const [partyType, setPartyType] = useState<PartyKind | ''>('')
  const [partyId, setPartyId] = useState('')
  const [mode, setMode] = useState<Mode>('PAY')

  const [parties, setParties] = useState<Party[]>([])
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [invLoading, setInvLoading] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmState, setConfirmState] = useState({
    method: 'cash',
    date: new Date().toISOString().slice(0, 10),
  })
  const [paying, setPaying] = useState(false)

  const selectedParty = parties.find((p) => String(p.id) === partyId)

  const loadParties = useCallback(async (type: PartyKind) => {
    try {
      const res = await partiesApi.list({
        limit: 200,
        is_active: true,
        party_type: type,
      })
      setParties(res.items)
    } catch {
      setParties([])
    }
  }, [])

  const changeType = (value: string) => {
    setPartyType(value as PartyKind)
    setPartyId('')
    setMode('PAY')
    setRows([])
    setAmounts({})
    setCheckedIds(new Set())
    if (value) loadParties(value as PartyKind)
  }

  const loadInvoices = useCallback(async (kind: PartyKind, partyIdNum: number, mode: Mode) => {
    setInvLoading(true)
    try {
      if (kind === 'SUPPLIER') {
        const res = await purchasesApi.list({
          supplier_id: partyIdNum,
          status: 'RECEIVED',
          limit: 200,
        })
        const built = res.items
          .map((p) => {
            const total = p.lines.reduce((s, l) => s + Number(l.line_total), 0)
            const paid = Number(p.amount_paid ?? 0)
            return {
              id: p.id,
              ref: p.reference_no ?? p.id.slice(0, 8),
              date: p.purchase_date,
              total,
              paid,
              returned: Number(p.returned_amount ?? 0),
              due: total - paid - Number(p.returned_amount ?? 0),
            }
          })
          // Pay mode: invoices you still owe. Refund mode: invoices whose
          // returned goods exceed what was paid - the supplier owes YOU.
          .filter((r) => (mode === 'REFUND' ? r.due < 0 : r.due > 0))
        setRows(built)
        setAmounts({})
        setCheckedIds(new Set())
      } else {
        const res = await salesApi.list({
          party_id: partyIdNum,
          status: 'COMPLETED',
          limit: 200,
        })
        const built = res.items
          .map((s) => {
            const total = s.lines.reduce((sum, l) => sum + Number(l.line_total), 0)
            const paid = Number(s.amount_paid ?? 0)
            const returned = Number(s.returned_amount ?? 0)
            return {
              id: s.id,
              ref: s.id.slice(0, 8),
              date: s.sale_date,
              total,
              paid,
              returned,
              due: total - paid - returned,
            }
          })
          // Receive mode: orders still owed to you. Refund mode: returns
          // exceeded what was paid - YOU owe the customer a credit.
          .filter((r) => (mode === 'REFUND' ? r.due < 0 : r.due > 0))
        setRows(built)
        setAmounts({})
        setCheckedIds(new Set())
      }
    } catch (err) {
      setRows([])
      toast.error(getApiErrorMessage(err))
    } finally {
      setInvLoading(false)
    }
  }, [])

  const selectParty = (value: string) => {
    setPartyId(value)
    setRows([])
    setAmounts({})
    setCheckedIds(new Set())
    if (value && partyType) loadInvoices(partyType, Number(value), mode)
  }

  const changeMode = (value: string) => {
    setMode(value as Mode)
    setRows([])
    setAmounts({})
    setCheckedIds(new Set())
    if (partyId && partyType) loadInvoices(partyType, Number(partyId), value as Mode)
  }

  const toggleRow = (id: string) => {
    if (checkedIds.has(id)) {
      setCheckedIds((cur) => {
        const next = new Set(cur)
        next.delete(id)
        return next
      })
      setAmounts((a) => {
        const next = { ...a }
        delete next[id]
        return next
      })
    } else {
      setCheckedIds((cur) => new Set(cur).add(id))
      const row = rows.find((r) => r.id === id)
      const defaultAmount = row ? (mode === 'REFUND' ? -row.due : row.due) : ''
      setAmounts((a) => ({ ...a, [id]: String(defaultAmount) }))
    }
  }

  const setRowAmount = (id: string, value: string) => {
    const row = rows.find((r) => r.id === id)
    const cap = row ? (mode === 'REFUND' ? -row.due : row.due) : 0
    const num = Number(value)
    setAmounts((cur) => ({ ...cur, [id]: value }))
    if (row && value !== '' && num > cap) {
      // Never allow more than the cap - snap it back and surface a hint.
      setAmounts((cur) => ({ ...cur, [id]: String(cap) }))
    }
  }

  const selectedAmounts = rows
      .filter((r) => checkedIds.has(r.id))
      .map((r) => ({ row: r, amount: Number(amounts[r.id]) || 0 }))
      .filter((x) => x.amount > 0)

  const totalPayable = selectedAmounts.reduce((s, x) => s + x.amount, 0)
  const hasPayable = selectedAmounts.length > 0

  const openConfirm = () => {
    setConfirmState((c) => ({ ...c, date: new Date().toISOString().slice(0, 10) }))
    setConfirmOpen(true)
  }

  const handlePay = async () => {
    if (!partyType || !partyId || selectedAmounts.length === 0) return
    const isRefund = mode === 'REFUND'
    const direction: PaymentDirection = isRefund
      ? partyType === 'SUPPLIER' ? 'REFUND_FROM_SUPPLIER' : 'REFUND_TO_CUSTOMER'
      : partyType === 'SUPPLIER'
        ? 'PAID_TO_SUPPLIER'
        : 'RECEIVED_FROM_CUSTOMER'

    setPaying(true)
    try {
      const created: unknown[] = []
      for (const { row, amount } of selectedAmounts) {
        const p = await paymentsApi.create({
          party_id: Number(partyId),
          direction,
          amount,
          method: confirmState.method,
          payment_date: confirmState.date,
          ...(partyType === 'SUPPLIER'
            ? { purchase_id: row.id }
            : { sale_id: row.id }),
        })
        created.push(p)
      }
      toast.success(
        isRefund
          ? partyType === 'SUPPLIER'
            ? `${created.length} refund(s) collected from supplier`
            : `${created.length} refund(s) paid to customer — credit cleared`
          : partyType === 'SUPPLIER'
            ? `${created.length} invoice(s) paid — supplier ledger updated`
            : `${created.length} invoice(s) settled — customer ledger updated`,
      )
      setConfirmOpen(false)
      setAmounts({})
      setCheckedIds(new Set())
      await loadInvoices(partyType, Number(partyId), mode)

      const receiptRows = selectedAmounts.map(({ row, amount }) => ({
        ref: row.ref,
        date: row.date,
        total: row.total,
        amountNow: amount,
      }))
      printPaymentReceipt(
        isRefund
          ? partyType === 'SUPPLIER' ? 'SUPPLIER_REFUND' : 'CUSTOMER_REFUND'
          : partyType,
        selectedParty,
        receiptRows,
        { method: confirmState.method, date: confirmState.date, total: totalPayable },
      )
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setPaying(false)
    }
  }

  const canConfirm = !invLoading && hasPayable

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Pay each supplier invoice or settle each customer sale, invoice by invoice — a receipt prints as your proof."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={partyType} onValueChange={changeType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Supplier or Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUPPLIER">Supplier</SelectItem>
            <SelectItem value="CUSTOMER">Customer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={partyId} onValueChange={selectParty} disabled={!partyType}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select party" />
          </SelectTrigger>
          <SelectContent>
            {parties.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No parties of this type.
              </div>
            )}
            {parties.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
                {p.party_type === 'WALK_IN' ? ' (Walk-In)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {partyType && (
          <Select value={mode} onValueChange={changeMode} disabled={!partyId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {partyType === 'SUPPLIER' ? (
                <>
                  <SelectItem value="PAY">Pay Invoices</SelectItem>
                  <SelectItem value="REFUND">Receive Refunds</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="PAY">Receive Payments</SelectItem>
                  <SelectItem value="REFUND">Refund Customers</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Invoice ID</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid Yet</TableHead>
              <TableHead className="text-right" title="Goods returned against this invoice — already adjusted from the due">
                Adjusted
              </TableHead>
              <TableHead className="text-right">{mode === 'REFUND' ? 'Credit' : 'Due'}</TableHead>
              <TableHead className="w-40 text-right">
                {mode === 'REFUND' ? 'Refund Amount' : 'Pay / Receive Now'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!partyType && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Choose a supplier to pay or a customer to receive from.
                </TableCell>
              </TableRow>
            )}
            {invLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!invLoading && partyType && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No open {mode === 'REFUND' ? 'credits' : 'invoices'} for this {partyType === 'SUPPLIER' ? 'supplier' : 'customer'}.
                </TableCell>
              </TableRow>
            )}
            {!invLoading &&
              rows.map((row) => {
                const checked = checkedIds.has(row.id)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        checked={checked}
                        onChange={() => toggleRow(row.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">#{row.ref}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="text-right">{money(row.total)}</TableCell>
                    <TableCell className="text-right">{money(row.paid)}</TableCell>
                    <TableCell className="text-right">{money(row.returned)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(mode === 'REFUND' ? -row.due : row.due)}
                    </TableCell>
                    <TableCell className="text-right">
                      {checked ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amounts[row.id] ?? String(mode === 'REFUND' ? -row.due : row.due)}
                          onChange={(e) => setRowAmount(row.id, e.target.value)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasPayable
            ? `${selectedAmounts.length} invoice(s) · total ${mode === 'REFUND' ? 'refundable' : 'payable'} ${money(totalPayable)}`
            : 'Enter amounts above to pay or receive.'}
        </p>
        <Button onClick={openConfirm} disabled={!canConfirm}>
          <CheckCircle2 className="h-4 w-4" />
          Confirm &amp; {mode === 'REFUND' ? 'Refund' : 'Pay'}
        </Button>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Confirm {mode === 'REFUND' ? 'Refund' : partyType === 'SUPPLIER' ? 'Payment' : 'Receipt'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {mode === 'REFUND'
                ? partyType === 'SUPPLIER' ? 'Collecting refund from' : 'Refunding'
                : partyType === 'SUPPLIER'
                  ? 'Paying'
                  : 'Receiving from'}{' '}
              <span className="font-medium text-foreground">
                {selectedParty?.name ?? 'party'}
              </span>
            </p>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Amount Now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedAmounts.map(({ row, amount }) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">#{row.ref}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right">{money(row.total)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={confirmState.method}
                  onValueChange={(v) => setConfirmState({ ...confirmState, method: v })}
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
                  value={confirmState.date}
                  onChange={(e) => setConfirmState({ ...confirmState, date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end text-sm">
              <span>
                Total {mode === 'REFUND'
                ? 'to Refund'
                : partyType === 'SUPPLIER'
                  ? 'to Pay'
                  : 'to Receive'}:{' '}
                <span className="text-base font-semibold">{money(totalPayable)}</span>
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={paying}>
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm & Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
