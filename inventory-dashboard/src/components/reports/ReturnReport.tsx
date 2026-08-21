import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { purchaseReturnsApi } from '@/api/purchaseReturns'
import { salesReturnsApi } from '@/api/salesReturns'
import { getApiErrorMessage } from '@/lib/axios'
import { printPurchaseReturnInvoice, printSalesReturnInvoice } from '@/utils/invoice'
import type { Party } from '@/types'
import { Eye, Loader2, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'

interface ReturnLineRow {
  id: string
  variant_name?: string
  variant_sku?: string
  qty: number
  unit_price: number
  line_total: number
  reason?: string
}

interface ReturnRow {
  id: string
  party_id?: number
  party_name: string | null
  return_date: string
  lines: ReturnLineRow[]
}

const PAGE_SIZE = 10

interface Props {
  kind: 'purchase' | 'sale'
  title: string
  description: string
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ReturnReport({ kind, title, description }: Props) {
  const [items, setItems] = useState<ReturnRow[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [term, setTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [viewing, setViewing] = useState<ReturnRow | null>(null)

  const load = useCallback(
    async (query: string, page: number) => {
      setIsLoading(true)
      try {
        const params = {
          skip: page,
          limit: PAGE_SIZE,
          ...(query.trim() ? { search: query.trim() } : {}),
        }
        const res =
          kind === 'purchase'
            ? await purchaseReturnsApi.list(params)
            : await salesReturnsApi.list(params)
        const rawItems = res.items as unknown as Array<Record<string, unknown>>
        const rows: ReturnRow[] = rawItems.map((r) => ({
          id: String(r.id),
          party_id: (r.party_id as number | undefined) ?? (r.supplier_id as number | undefined),
          party_name: (r.party_name as string | null) ?? (r.supplier_name as string | null) ?? null,
          return_date: String(r.return_date),
          lines: ((r.lines as ReturnLineRow[]) ?? []).map((l) => ({
            id: String(l.id),
            variant_name: l.variant_name,
            variant_sku: l.variant_sku,
            qty: Number(l.qty),
            unit_price: Number(
              (l as ReturnLineRow & { unit_cost?: unknown }).unit_price ??
                (l as ReturnLineRow & { unit_cost?: unknown }).unit_cost ??
                0,
            ),
            line_total: Number(l.line_total),
            reason: l.reason,
          })),
        }))
        setItems(rows)
        setTotal(Number(res.total))
      } catch (err) {
        setItems([])
        setTotal(0)
        toast.error(getApiErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    },
    [kind],
  )

  useEffect(() => {
    if (searchQuery.trim()) {
      load(searchQuery, skip)
    } else {
      // Nothing searched yet - don't pull everyone's data.
      setItems([])
      setTotal(0)
    }
  }, [load, searchQuery, skip])

  const runSearch = () => {
    setSkip(0)
    setSearchQuery(term)
  }

  const [printing, setPrinting] = useState<Set<string>>(new Set())

  const handlePrint = async (row: ReturnRow) => {
    setPrinting((s) => new Set(s).add(row.id))
    try {
      const party = { name: row.party_name ?? (row.party_id == null ? 'Walk-in' : `#${row.party_id}`) } as Party
      if (kind === 'purchase') {
        const data = await purchaseReturnsApi.get(row.id)
        printPurchaseReturnInvoice(data, { supplier: party })
      } else {
        const data = await salesReturnsApi.get(row.id)
        printSalesReturnInvoice(data, { customer: party })
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setPrinting((s) => {
        const next = new Set(s)
        next.delete(row.id)
        return next
      })
    }
  }

  const partyName = (r: ReturnRow) =>
    r.party_name ?? (r.party_id == null ? 'Walk-in' : `#${r.party_id}`)

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          className="sm:max-w-md"
          placeholder="Party id, name, email, phone or return id"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <Button onClick={runSearch} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
        {searchQuery && (
          <Button
            variant="outline"
            onClick={() => {
              setTerm('')
              setSearchQuery('')
              setSkip(0)
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>{kind === 'purchase' ? 'Supplier' : 'Customer'}</TableHead>
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
{searchQuery
                  ? 'No returns match that party or return id.'
                  : 'Enter a party id, name, email or phone, then press Search to load their returns.'}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.id.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>{partyName(item)}</TableCell>
                  <TableCell>{item.return_date}</TableCell>
                  <TableCell className="text-right">{item.lines.length}</TableCell>
                  <TableCell className="text-right">
                    {money(item.lines.reduce((s, l) => s + l.line_total, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={printing.has(item.id)}
                        onClick={() => handlePrint(item)}
                        title="Print return / credit note"
                      >
                        {printing.has(item.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setViewing(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
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

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Return {viewing?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">{kind === 'purchase' ? 'Supplier' : 'Customer'}</p>
                  <p className="font-medium">{partyName(viewing)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{viewing.return_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Items</p>
                  <p className="font-medium">{viewing.lines.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">
                    {money(viewing.lines.reduce((s, l) => s + l.line_total, 0))}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">{kind === 'purchase' ? 'Unit Cost' : 'Unit Price'}</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          {l.variant_name ?? l.id}
                          {l.variant_sku ? ` (${l.variant_sku})` : ''}
                        </TableCell>
                        <TableCell className="text-right">{money(l.qty)}</TableCell>
                        <TableCell className="text-right">{money(l.unit_price)}</TableCell>
                        <TableCell className="text-right">{money(l.line_total)}</TableCell>
                        <TableCell>{l.reason || '—'}</TableCell>
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