import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { stockMovementsApi } from '@/api/stockMovements'
import { productVariantsApi } from '@/api/productVariants'
import { getApiErrorMessage } from '@/lib/axios'
import type { StockMovement, MovementType, ProductVariant } from '@/types'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const MOVEMENT_LABELS: Record<MovementType, string> = {
  PURCHASE_IN: 'Purchase In',
  SALE_OUT: 'Sale Out',
  PURCHASE_RETURN_OUT: 'Purchase Return',
  SALES_RETURN_IN: 'Sales Return',
  ADJUSTMENT_IN: 'Adjustment In',
  ADJUSTMENT_OUT: 'Adjustment Out',
}

const MOVEMENT_COLORS: Record<MovementType, string> = {
  PURCHASE_IN: 'bg-green-100 text-green-800',
  SALE_OUT: 'bg-red-100 text-red-800',
  PURCHASE_RETURN_OUT: 'bg-amber-100 text-amber-800',
  SALES_RETURN_IN: 'bg-emerald-100 text-emerald-800',
  ADJUSTMENT_IN: 'bg-blue-100 text-blue-800',
  ADJUSTMENT_OUT: 'bg-orange-100 text-orange-800',
}

const IN_TYPES: MovementType[] = ['PURCHASE_IN', 'SALES_RETURN_IN', 'ADJUSTMENT_IN']

const REF_LABELS: Record<string, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  PURCHASE_RETURN: 'Purchase Return',
  SALES_RETURN: 'Sales Return',
  ADJUSTMENT: 'Adjustment',
  PAYMENT: 'Payment',
}

export default function StockMovementsPage() {
  const [items, setItems] = useState<StockMovement[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [variantFilter, setVariantFilter] = useState<string>('ALL')
  const [variants, setVariants] = useState<ProductVariant[]>([])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (typeFilter !== 'ALL') params.movement_type = typeFilter
      if (variantFilter !== 'ALL') params.variant_id = variantFilter
      const res = await stockMovementsApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, typeFilter, variantFilter])

  useEffect(() => {
    load()
  }, [load])

  const loadVariants = useCallback(async () => {
    try {
      const res = await productVariantsApi.list({ limit: 200, is_active: true })
      setVariants(res.items)
    } catch {
      // filter still works, just without variant names
    }
  }, [])

  useEffect(() => {
    loadVariants()
  }, [loadVariants])

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const qtyText = (m: StockMovement) => {
    const qty = Number(m.qty)
    const sign = IN_TYPES.includes(m.movement_type) ? '+' : '−'
    return `${sign}${qty}`
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description="Audit log of every stock in/out movement across batches."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {MOVEMENT_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={variantFilter}
          onValueChange={(v) => {
            setVariantFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Variants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Variants</SelectItem>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} ({v.sku})
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
              <TableHead>Type</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Batch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No stock movements found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(item.movement_date)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={MOVEMENT_COLORS[item.movement_type]}
                    >
                      {MOVEMENT_LABELS[item.movement_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.variant.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.variant.sku}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      IN_TYPES.includes(item.movement_type)
                        ? 'text-green-600'
                        : 'text-destructive'
                    }`}
                  >
                    {qtyText(item)}
                  </TableCell>
                  <TableCell className="text-right">
                    {money(Number(item.batch.cost_price))}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(item.qty_remaining_after)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {REF_LABELS[item.ref_type] ?? item.ref_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.ref_id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>Received {item.batch.received_date}</div>
                    <div>
                      {item.batch.qty_remaining}/
                      {item.batch.qty_received} left
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
    </div>
  )
}