import { useCallback, useEffect, useRef, useState } from 'react'
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
import { PageHeader } from '@/components/common/PageHeader'
import { salesReturnsApi } from '@/api/salesReturns'
import { salesApi } from '@/api/sales'
import { partiesApi } from '@/api/parties'
import { productVariantsApi } from '@/api/productVariants'
import { printSalesReturnInvoice } from '@/utils/invoice'
import { getApiErrorMessage } from '@/lib/axios'
import type { Party, Sale, ProductVariant } from '@/types'
import {
  Plus,
  Loader2,
  Trash2,
  Search,
  FilePlus2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface ReturnItemForm {
  sale_line_id: string
  qty: string
  reason: string
}

interface SaleBlock {
  key: string
  sale_id: string
  items: ReturnItemForm[]
}

const emptyItem: ReturnItemForm = { sale_line_id: '', qty: '', reason: '' }

const emptyForm = {
  party_id: '',
  return_date: '',
}

export default function SalesReturnsPage() {
  const [customers, setCustomers] = useState<Party[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])

  const [form, setForm] = useState(emptyForm)
  const [blocks, setBlocks] = useState<SaleBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [partyChosen, setPartyChosen] = useState(false)

  const [sales, setSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [manualRef, setManualRef] = useState('')

  const keyRef = useRef(0)
  const nextKey = () => String(++keyRef.current)

  const makeBlock = (): SaleBlock => ({
    key: nextKey(),
    sale_id: '',
    items: [{ ...emptyItem }],
  })

  const remainingSaleLines = (block: SaleBlock) => {
    const sale = saleOf(block.sale_id)
    if (!sale) return 0
    const used = new Set(block.items.map((it) => it.sale_line_id))
    return sale.lines.filter((l) => !used.has(l.id)).length
  }

  const salesUsedElsewhere = (blockIdx: number) =>
    new Set(
      blocks.filter((_, i) => i !== blockIdx).map((b) => b.sale_id).filter(Boolean),
    )

  const itemsUsedInBlock = (blockIdx: number, exceptItemIdx: number) =>
    new Set(
      blocks[blockIdx]?.items
        .filter((_, j) => j !== exceptItemIdx)
        .map((it) => it.sale_line_id) ?? [],
    )

  const usedSaleIds = new Set(blocks.map((b) => b.sale_id).filter(Boolean))

  const availableSales = sales.filter((s) => !usedSaleIds.has(s.id))

  const loadCatalog = useCallback(async () => {
    try {
      const [cust, walkIns, vars] = await Promise.all([
        partiesApi.list({ limit: 200, party_type: 'CUSTOMER', is_active: true }),
        partiesApi.list({ limit: 200, party_type: 'WALK_IN', is_active: true }),
        productVariantsApi.list({ limit: 200, is_active: true }),
      ])
      setCustomers([...cust.items, ...walkIns.items])
      setVariants(vars.items)
    } catch {
      // pickers still work, just without names
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const loadSales = useCallback(async (partyId: string) => {
    if (partyId === '') {
      setSales([])
      return
    }
    setSalesLoading(true)
    try {
      const res = await salesApi.list({
        party_id: Number(partyId),
        status: 'COMPLETED',
        limit: 200,
      })
      setSales(res.items)
    } catch (err) {
      setSales([])
      toast.error(getApiErrorMessage(err))
    } finally {
      setSalesLoading(false)
    }
  }, [])

  const resetEditor = () => {
    setForm({
      party_id: '',
      return_date: new Date().toISOString().slice(0, 10),
    })
    setPartyChosen(false)
    setSales([])
    setManualRef('')
    setBlocks([makeBlock()])
  }

  useEffect(() => {
    resetEditor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectParty = (value: string) => {
    setForm((f) => ({ ...f, party_id: value }))
    setPartyChosen(true)
    setManualRef('')
    setBlocks([makeBlock()])
    if (value === '') {
      // Walk-in (cash refund): completed sales with no linked party.
      setSalesLoading(true)
      salesApi
        .list({ status: 'COMPLETED', limit: 200 })
        .then((res) => {
          setSales(res.items.filter((s) => s.party_id == null))
        })
        .catch(() => {})
        .finally(() => setSalesLoading(false))
    } else {
      loadSales(value)
    }
  }

  const lookupSale = async () => {
    const q = manualRef.trim()
    if (!q) {
      toast.error('Enter a sale id first')
      return
    }
    try {
      const res = await salesApi.list({
        party_id: form.party_id ? Number(form.party_id) : undefined,
        status: 'COMPLETED',
        limit: 5,
        search: q,
      })
      if (res.items.length === 0) {
        toast.error(`No completed sale matches "${q}"`)
        return
      }
      setSales((cur) => {
        const ids = new Set(cur.map((s) => s.id))
        const missing = res.items.filter((s) => !ids.has(s.id))
        return missing.length ? [...cur, ...missing] : cur
      })
      toast.success(`${res.items.length} sale(s) added to the picker`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  // ─── sale block actions ─────────────────────────────────────────────────────

  const addSaleBlock = () => setBlocks((b) => [...b, makeBlock()])

  const removeSaleBlock = (idx: number) => {
    if (blocks.length === 1) {
      toast.error('At least one sale is required')
      return
    }
    setBlocks(blocks.filter((_, i) => i !== idx))
  }

  const setBlockSale = (idx: number, saleId: string) => {
    setBlocks(
      blocks.map((b, i) =>
        i === idx ? { ...b, sale_id: saleId, items: [{ ...emptyItem }] } : b,
      ),
    )
  }

  // ─── per-sale item actions ──────────────────────────────────────────────────

  const addSaleItem = (blockIdx: number) => {
    setBlocks(
      blocks.map((b, i) => (i === blockIdx ? { ...b, items: [...b.items, { ...emptyItem }] } : b)),
    )
  }

  const removeSaleItem = (blockIdx: number, itemIdx: number) => {
    setBlocks(
      blocks.map((b, i) => {
        if (i !== blockIdx) return b
        if (b.items.length === 1) {
          toast.error('A sale needs at least one item')
          return b
        }
        return { ...b, items: b.items.filter((_, j) => j !== itemIdx) }
      }),
    )
  }

  const updateItem = (blockIdx: number, itemIdx: number, key: keyof ReturnItemForm, value: string) => {
    setBlocks(
      blocks.map((b, i) => {
        if (i !== blockIdx) return b
        return {
          ...b,
          items: b.items.map((it, j) => (j === itemIdx ? { ...it, [key]: value } : it)),
        }
      }),
    )
  }

  // ─── derived helpers ──────────────────────────────────────────────────────

  const saleOf = (id: string) => sales.find((s) => s.id === id)

  const saleTotal = (s: Sale) => s.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const variantLabel = (id: string) => {
    const v = variants.find((v) => v.id === id)
    return v ? `${v.name} (${v.sku})` : id.slice(0, 8)
  }

  const itemAmount = (block: SaleBlock, item: ReturnItemForm) => {
    const sl = saleOf(block.sale_id)?.lines.find((l) => l.id === item.sale_line_id)
    const qty = Number(item.qty) || 0
    const price = sl ? Number(sl.unit_price) : 0
    return qty * price
  }

  const formTotal = blocks.reduce(
    (sum, b) => sum + b.items.reduce((s, it) => s + itemAmount(b, it), 0),
    0,
  )

  const usedSales = blocks.filter((b) => b.sale_id).map((b) => saleOf(b.sale_id)!).filter(Boolean)

  const handleSave = async () => {
    if (!form.return_date) {
      toast.error('Return date is required')
      return
    }
    const validLines: { sale_line_id: string; qty: number; reason?: string }[] = []
    for (const block of blocks) {
      if (!block.sale_id) {
        toast.error('Every sale block needs a completed sale selected')
        return
      }
      for (const it of block.items) {
        if (!it.sale_line_id || !Number(it.qty) || Number(it.qty) <= 0) {
          toast.error('Each item needs a line and a qty > 0')
          return
        }
        const sl = saleOf(block.sale_id)?.lines.find((l) => l.id === it.sale_line_id)
        if (Number(it.qty) > Number(sl?.qty ?? 0)) {
          toast.error('Qty cannot exceed the quantity sold')
          return
        }
        validLines.push({
          sale_line_id: it.sale_line_id,
          qty: Number(it.qty),
          reason: it.reason.trim() || undefined,
        })
      }
    }
    if (validLines.length === 0) {
      toast.error('Add at least one item to return')
      return
    }

    setSaving(true)
    try {
      const created = await salesReturnsApi.create({
        party_id: form.party_id ? Number(form.party_id) : undefined,
        return_date: form.return_date,
        lines: validLines,
      })
      const customer = form.party_id
        ? customers.find((c) => c.id === Number(form.party_id))
        : undefined
      toast.success(
        form.party_id
          ? `Sales return recorded across ${usedSales.length} sale(s) — stock restocked & customer balance adjusted`
          : 'Sales return recorded — stock restocked & cash refund generated',
      )
      resetEditor()
      printSalesReturnInvoice(created, { customer })
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Returns"
        description="Accept returned goods against one or more of a customer's completed sales — each sale can have many items."
      />

      {/* Create section - inline in the page body, no dialog */}
      <section className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">New Sales Return</h2>
          <p className="text-sm text-muted-foreground">
            Pick the customer, add completed sales, and add items inside each sale.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={form.party_id} onValueChange={selectParty}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
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
            <Label htmlFor="sr-date">Return Date</Label>
            <Input
              id="sr-date"
              type="date"
              value={form.return_date}
              onChange={(e) => setForm({ ...form, return_date: e.target.value })}
            />
          </div>
        </div>

        {partyChosen && (
          <>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label>Add a completed sale to the picker</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={manualRef}
                    onChange={(e) => setManualRef(e.target.value)}
                    placeholder="type sale id"
                    className="w-64"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        lookupSale()
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={lookupSale}>
                    <Search className="h-4 w-4" />
                    Find
                  </Button>
                </div>
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                {salesLoading
                  ? 'Loading sales…'
                  : `${sales.length} completed sale(s) available`}
              </p>
            </div>

            <div className="space-y-3">
              {blocks.map((block, blockIdx) => (
                <div key={block.key} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Sale #{blockIdx + 1}
                      </span>
                      <Select
                        value={block.sale_id}
                        onValueChange={(v) => setBlockSale(blockIdx, v)}
                      >
                        <SelectTrigger className="w-72">
                          <SelectValue placeholder="Select completed sale" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesLoading ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Loading…
                            </div>
                          ) : sales.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No completed sales for this customer.
                            </div>
                          ) : salesUsedElsewhere(blockIdx).size >= sales.length ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              All completed sales are already added.
                            </div>
                          ) : (
                            sales
                              .filter((s) => !salesUsedElsewhere(blockIdx).has(s.id))
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  #{s.id.slice(0, 8).toUpperCase()} · {s.sale_date} ·{' '}
                                  {money(saleTotal(s))}
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSaleBlock(blockIdx)}
                      disabled={blocks.length === 1}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-64">Item</TableHead>
                          <TableHead className="w-36">Qty to Return</TableHead>
                          <TableHead className="w-44">Reason</TableHead>
                          <TableHead className="w-28 text-right">Amount</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {block.items.map((item, itemIdx) => {
                          const sl = saleOf(block.sale_id)?.lines.find(
                            (l) => l.id === item.sale_line_id,
                          )
                          return (
                            <TableRow key={itemIdx}>
                              <TableCell>
                                <Select
                                  value={item.sale_line_id}
                                  onValueChange={(v) =>
                                    updateItem(blockIdx, itemIdx, 'sale_line_id', v)
                                  }
                                  disabled={!block.sale_id}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select item" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {saleOf(block.sale_id)?.lines
                                      .filter((slx) => !itemsUsedInBlock(blockIdx, itemIdx).has(slx.id))
                                      .map((slx) => (
                                        <SelectItem key={slx.id} value={slx.id}>
                                          {variantLabel(slx.variant_id)} · sold {slx.qty} @{' '}
                                          {money(Number(slx.unit_price))}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                {sl && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Price {money(Number(sl.unit_price))} · sold qty {sl.qty} ·
                                    line total {money(Number(sl.line_total))}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateItem(blockIdx, itemIdx, 'qty', e.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.reason}
                                  placeholder="e.g. damaged, wrong size"
                                  onChange={(e) =>
                                    updateItem(blockIdx, itemIdx, 'reason', e.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                {money(itemAmount(block, item))}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeSaleItem(blockIdx, itemIdx)}
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

                  <div className="mt-2">
                    {remainingSaleLines(block) > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addSaleItem(blockIdx)}
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Item
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {availableSales.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addSaleBlock}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Add Another Sale
                </Button>
              )}

              <div className="flex justify-end text-sm">
                <span className="font-medium">Return Total: {money(formTotal)}</span>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={resetEditor} disabled={saving}>
            Clear
          </Button>
          <span className="w-2" />
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Record Return
          </Button>
        </div>
      </section>
    </div>
  )
}