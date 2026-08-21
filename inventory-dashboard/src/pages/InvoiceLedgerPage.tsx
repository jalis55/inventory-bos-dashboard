import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/common/PageHeader'
import { invoiceLedgerApi } from '@/api/invoiceLedger'
import { openInvoiceLedger } from '@/utils/ledgerDocument'
import { getApiErrorMessage } from '@/lib/axios'
import type {
  InvoiceLedgerDoc,
  InvoiceLedgerPartyDoc,
  InvoiceLedgerResponse,
} from '@/types'
import { ArrowLeft, Eye, Loader2, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const clean = (value: string) => value.trim().replace(/^#+/, '').trim()

export default function InvoiceLedgerPage() {
  const [term, setTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [doc, setDoc] = useState<InvoiceLedgerDoc | null>(null)
  const [partyData, setPartyData] = useState<InvoiceLedgerPartyDoc | null>(null)
  const [opening, setOpening] = useState<Set<string>>(new Set())
  const [searchParams] = useSearchParams()

  const load = useCallback(async (raw: string) => {
    const value = clean(raw)
    if (!value) return
    setLoading(true)
    try {
      const result = await invoiceLedgerApi.get(value)
      if (result.kind === 'PARTY') {
        setPartyData(result)
        setDoc(null)
      } else {
        setDoc(result)
        setPartyData(null)
      }
    } catch (err) {
      setPartyData(null)
      setDoc(null)
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const pre = searchParams.get('invoice')
    if (pre) {
      setTerm(pre)
      load(pre)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openSingle = async (id: string) => {
    setOpening((s) => new Set(s).add(id))
    try {
      const single = await invoiceLedgerApi.getStatement(id)
      openInvoiceLedger(single)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setOpening((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const viewSingle = async (id: string) => {
    setOpening((s) => new Set(s).add(id))
    try {
      const single = await invoiceLedgerApi.getStatement(id)
      setDoc(single)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setOpening((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Ledger"
        description="Enter an invoice number (reference or id) for one invoice's ledger — or a customer/supplier id for their full invoice-wise ledger."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          className="sm:max-w-md"
          placeholder="Invoice no. or customer / supplier id"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(term)}
        />
        <Button onClick={() => load(term)} disabled={loading || !clean(term)}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Load
        </Button>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
        </p>
      )}

      {/* Party invoice-wise ledger */}
      {!loading && partyData && (
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary">
                  {partyData.party_type === 'SUPPLIER' ? 'Supplier' : 'Customer'} · ID {partyData.party_id}
                </Badge>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {partyData.invoices.length} invoice(s)
                </span>
              </div>
              <div className="text-lg font-semibold">{partyData.party_name}</div>
            </div>
          </div>

          <div className="p-4">
            {partyData.invoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No received purchases / completed sales for this party.
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Adjusted</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="w-44 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partyData.invoices.map((inv) => {
                      const busy = opening.has(inv.id)
                      const outstanding = Number(inv.outstanding)
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Badge variant={inv.invoice_kind === 'PURCHASE' ? 'secondary' : 'default'}>
                              {inv.invoice_kind === 'PURCHASE' ? 'Purchase' : 'Sale'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">#{inv.reference_no ?? inv.id.slice(0, 8)}</TableCell>
                          <TableCell>{inv.invoice_date}</TableCell>
                          <TableCell className="text-right">{money(Number(inv.total))}</TableCell>
                          <TableCell className="text-right">{money(Number(inv.amount_paid))}</TableCell>
                          <TableCell className="text-right">{money(Number(inv.returned_amount))}</TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-semibold',
                              outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-emerald-600' : '',
                            )}
                          >
                            {money(outstanding)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => viewSingle(inv.id)}
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => openSingle(inv.id)}
                              >
                                <Printer className="h-3.5 w-3.5" />
                                Print
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single invoice statement */}
      {!loading && doc && (
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b p-4">
            <div>
              {partyData && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2 -ml-2 text-muted-foreground"
                  onClick={() => {
                    setDoc(null)
                    setPartyData(partyData)
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to {partyData.party_name}'s invoices
                </Button>
              )}
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={doc.kind === 'PURCHASE' ? 'secondary' : 'default'}>
                  {doc.kind === 'PURCHASE' ? 'Purchase Invoice' : 'Sales Invoice'}
                </Badge>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {doc.status}
                </span>
              </div>
              <div className="text-lg font-semibold">#{doc.reference_no ?? doc.id}</div>
              <div className="text-sm text-muted-foreground">
                {doc.party_name ?? '—'} · {doc.invoice_date} ·{' '}
                {doc.party_type ? doc.party_type.replace(/_/g, ' ') : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => openInvoiceLedger(doc)}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              { k: 'Total Invoice', v: Number(doc.total), tone: '' },
              { k: 'Paid So Far', v: Number(doc.amount_paid), tone: '' },
              { k: 'Adjusted (Returns)', v: Number(doc.returned_amount), tone: '' },
              {
                k: doc.kind === 'PURCHASE' ? 'Outstanding (Due)' : 'Outstanding (Receivable)',
                v: Number(doc.outstanding),
                tone: doc.outstanding > 0 ? 'text-red-600' : doc.outstanding < 0 ? 'text-emerald-600' : '',
              },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.k}</div>
                <div className={cn('mt-1 text-lg font-bold', s.tone)}>{money(s.v)}</div>
              </div>
            ))}
          </div>

          <div className="space-y-6 p-4 pt-0">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                Items
              </h3>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doc.lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                          No line items.
                        </TableCell>
                      </TableRow>
                    ) : (
                      doc.lines.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{line.variant_name ?? '—'}</TableCell>
                          <TableCell>{line.variant_sku ?? '—'}</TableCell>
                          <TableCell className="text-right">{money(Number(line.qty))}</TableCell>
                          <TableCell className="text-right">{money(Number(line.rate))}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {money(Number(line.line_total))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                Ledger
              </h3>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Particulars</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doc.transactions.map((t, i) => (
                      <TableRow
                        key={i}
                        className={i === doc.transactions.length - 1 ? 'bg-primary/5' : ''}
                      >
                        <TableCell>{t.date}</TableCell>
                        <TableCell className="font-medium">{t.description}</TableCell>
                        <TableCell className="text-right">
                          {t.debit ? money(Number(t.debit)) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {t.credit ? money(Number(t.credit)) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {money(Number(t.balance))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Balance = invoice total − returns − payments. Positive means
                {doc.kind === 'PURCHASE' ? ' still due (you owe the supplier)' : ' still receivable (customer owes you)'};
                negative means a {doc.kind === 'PURCHASE' ? 'supplier credit' : 'credit owed to the customer'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}