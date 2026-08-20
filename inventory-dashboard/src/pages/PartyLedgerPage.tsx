import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { partiesApi } from '@/api/parties'
import { ledgerApi } from '@/api/ledger'
import { getApiErrorMessage } from '@/lib/axios'
import type {
  LedgerRefType,
  Party,
  PartyBalance,
  PartyLedgerEntry,
  PartyType,
} from '@/types'
import { toast } from 'sonner'

const PAGE_SIZE = 20

const TYPE_LABELS: Record<string, string> = {
  SUPPLIER: 'Supplier',
  CUSTOMER: 'Customer',
  WALK_IN: 'Walk-In',
}

const REF_LABELS: Record<LedgerRefType, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  PURCHASE_RETURN: 'Purchase Return',
  SALES_RETURN: 'Sales Return',
  PAYMENT: 'Payment',
  ADJUSTMENT: 'Adjustment',
}

const REF_COLORS: Record<LedgerRefType, string> = {
  PURCHASE: 'bg-blue-100 text-blue-800',
  SALE: 'bg-green-100 text-green-800',
  PURCHASE_RETURN: 'bg-amber-100 text-amber-800',
  SALES_RETURN: 'bg-purple-100 text-purple-800',
  PAYMENT: 'bg-slate-100 text-slate-800',
  ADJUSTMENT: 'bg-red-100 text-red-800',
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function PartyLedgerPage() {
  const [params, setParams] = useSearchParams()

  const [typeFilter, setTypeFilter] = useState<string>(
    params.get('type') || 'CUSTOMER',
  )
  const [parties, setParties] = useState<Party[]>([])
  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    params.get('party_id') || '',
  )

  const [partyInfo, setPartyInfo] = useState<PartyBalance | null>(null)

  const [items, setItems] = useState<PartyLedgerEntry[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [refFilter, setRefFilter] = useState<string>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const initDone = useRef(false)

  // Deep link from PartiesPage: /party-ledger?party_id=X&type=TYPE
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    const pid = params.get('party_id')
    const ptype = params.get('type')
    if (pid) {
      if (ptype) {
        setTypeFilter(ptype)
        setSelectedPartyId(pid)
      } else {
        partiesApi
          .get(Number(pid))
          .then((p) => {
            setTypeFilter(p.party_type)
            setSelectedPartyId(pid)
          })
          .catch(() => setSelectedPartyId(pid))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadParties = useCallback(async (type: string) => {
    try {
      if (type === 'ALL') {
        const [sup, cust, walk] = await Promise.all([
          partiesApi.list({ limit: 200, is_active: true, party_type: 'SUPPLIER' }),
          partiesApi.list({ limit: 200, is_active: true, party_type: 'CUSTOMER' }),
          partiesApi.list({ limit: 200, is_active: true, party_type: 'WALK_IN' }),
        ])
        setParties([...sup.items, ...cust.items, ...walk.items])
      } else {
        const res = await partiesApi.list({
          limit: 200,
          is_active: true,
          party_type: type as PartyType,
        })
        setParties(res.items)
      }
    } catch {
      setParties([])
    }
  }, [])

  useEffect(() => {
    loadParties(typeFilter)
  }, [typeFilter, loadParties])

  const load = useCallback(async () => {
    if (!selectedPartyId) return
    setIsLoading(true)
    try {
      const [balanceRes, ledgerRes] = await Promise.all([
        ledgerApi.balance(Number(selectedPartyId)),
        ledgerApi.list(Number(selectedPartyId), {
          skip,
          limit: PAGE_SIZE,
          ...(refFilter !== 'ALL' ? { ref_type: refFilter as LedgerRefType } : {}),
          ...(fromDate ? { from_date: fromDate } : {}),
          ...(toDate ? { to_date: toDate } : {}),
        }),
      ])
      setPartyInfo(balanceRes)
      setItems(ledgerRes.items)
      setTotal(ledgerRes.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [selectedPartyId, skip, refFilter, fromDate, toDate])

  useEffect(() => {
    load()
  }, [load])

  const selectParty = (value: string) => {
    setSelectedPartyId(value)
    setSkip(0)
    const party = parties.find((p) => String(p.id) === value)
    const next = new URLSearchParams(params)
    if (value) {
      next.set('party_id', value)
      if (party) next.set('type', party.party_type)
    } else {
      next.delete('party_id')
    }
    setParams(next, { replace: true })
  }

  const changeType = (value: string) => {
    setTypeFilter(value)
    setSkip(0)
    setSelectedPartyId('')
    setPartyInfo(null)
    setItems([])
    setTotal(0)
    const next = new URLSearchParams(params)
    next.delete('party_id')
    next.set('type', value)
    setParams(next, { replace: true })
  }

  const balanceHint =
    partyInfo?.party_type === 'SUPPLIER'
      ? 'Positive = you owe the supplier · Negative = they owe you'
      : 'Positive = they owe you · Negative = you owe them'

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Party Ledger"
        description="Account statements for suppliers and customers — every balance change, in order, with the running balance after each entry."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={typeFilter} onValueChange={changeType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Party type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUPPLIER">Supplier</SelectItem>
            <SelectItem value="CUSTOMER">Customer</SelectItem>
            <SelectItem value="WALK_IN">Walk-In</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedPartyId} onValueChange={selectParty}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a party" />
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
      </div>

      {partyInfo && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {TYPE_LABELS[partyInfo.party_type]} Balance
            </p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                Number(partyInfo.balance_cached) >= 0
                  ? 'text-foreground'
                  : 'text-destructive'
              }`}
            >
              {money(Number(partyInfo.balance_cached))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{balanceHint}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Credit Limit</p>
            <p className="mt-1 text-2xl font-semibold">
              {money(Number(partyInfo.credit_limit))}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Available Credit</p>
            <p className="mt-1 text-2xl font-semibold">
              {money(Number(partyInfo.available_credit))}
            </p>
          </div>
        </div>
      )}

      {selectedPartyId && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
          <Select
            value={refFilter}
            onValueChange={(v) => {
              setRefFilter(v)
              setSkip(0)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All reference types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All reference types</SelectItem>
              {Object.entries(REF_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setSkip(0)
              }}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setSkip(0)
              }}
              className="w-40"
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!selectedPartyId && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Select a party to view their account statement.
                </TableCell>
              </TableRow>
            )}
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && selectedPartyId && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No ledger entries for this party{refFilter !== 'ALL' ? ' matching the filter' : ''}.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(entry.entry_date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={REF_COLORS[entry.ref_type]}
                      >
                        {REF_LABELS[entry.ref_type]}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        #{(entry.ref_id || '').slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {entry.notes ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(entry.debit) > 0 ? money(Number(entry.debit)) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(entry.credit) > 0 ? money(Number(entry.credit)) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {money(Number(entry.balance_after))}
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
            disabled={!canPrev || isLoading}
            onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext || isLoading}
            onClick={() => setSkip(skip + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}