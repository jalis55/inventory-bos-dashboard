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
import { purchaseReturnsApi } from '@/api/purchaseReturns'
import { purchasesApi } from '@/api/purchases'
import { partiesApi } from '@/api/parties'
import { productVariantsApi } from '@/api/productVariants'
import { printPurchaseReturnInvoice } from '@/utils/invoice'
import { getApiErrorMessage } from '@/lib/axios'
import type { Party, Purchase, ProductVariant } from '@/types'
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
  purchase_line_id: string
  qty: string
  reason: string
}

interface InvoiceBlock {
  key: string
  invoice_id: string
  items: ReturnItemForm[]
}

const emptyItem: ReturnItemForm = { purchase_line_id: '', qty: '', reason: '' }

const emptyForm = {
  supplier_id: '',
  return_date: '',
}

export default function PurchaseReturnsPage() {
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])

  const [form, setForm] = useState(emptyForm)
  const [blocks, setBlocks] = useState<InvoiceBlock[]>([])
  const [saving, setSaving] = useState(false)

  // The supplier's received invoices (shared pool). Each invoice block
  // references one of these; a return can span multiple invoice blocks.
  const [invoices, setInvoices] = useState<Purchase[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [manualRef, setManualRef] = useState('')

  const keyRef = useRef(0)
  const nextKey = () => String(++keyRef.current)

  const makeBlock = (): InvoiceBlock => ({
    key: nextKey(),
    invoice_id: '',
    items: [{ ...emptyItem }],
  })

  // Lines of a block's invoice that aren't yet in the block - used to hide
  // "Add Another Item" when there's nothing left to add.
  const remainingInvoiceLines = (block: InvoiceBlock) => {
    const inv = invoiceOf(block.invoice_id)
    if (!inv) return 0
    const used = new Set(block.items.map((it) => it.purchase_line_id))
    return inv.lines.filter((l) => !used.has(l.id)).length
  }

  // Invoices already used by OTHER blocks - so an invoice can't be picked
  // twice across the return.
  const invoicesUsedElsewhere = (blockIdx: number) =>
    new Set(
      blocks.filter((_, i) => i !== blockIdx).map((b) => b.invoice_id).filter(Boolean),
    )

  // Items already picked in a block - so an item can't be picked twice
  // within one invoice block.
  const itemsUsedInBlock = (blockIdx: number, exceptItemIdx: number) =>
    new Set(
      blocks[blockIdx]?.items
        .filter((_, j) => j !== exceptItemIdx)
        .map((it) => it.purchase_line_id) ?? [],
    )

  const usedInvoiceIds = new Set(blocks.map((b) => b.invoice_id).filter(Boolean))

  const availableInvoices = invoices.filter((inv) => !usedInvoiceIds.has(inv.id))

  const loadCatalog = useCallback(async () => {
    try {
      const [sup, vars] = await Promise.all([
        partiesApi.list({ limit: 200, party_type: 'SUPPLIER', is_active: true }),
        productVariantsApi.list({ limit: 200, is_active: true }),
      ])
      setSuppliers(sup.items)
      setVariants(vars.items)
    } catch {
      // pickers still work, just without names
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const loadInvoices = useCallback(async (supplierId: string) => {
    if (!supplierId) {
      setInvoices([])
      return
    }
    setInvoicesLoading(true)
    try {
      const res = await purchasesApi.list({
        supplier_id: Number(supplierId),
        status: 'RECEIVED',
        limit: 200,
      })
      setInvoices(res.items)
    } catch (err) {
      setInvoices([])
      toast.error(getApiErrorMessage(err))
    } finally {
      setInvoicesLoading(false)
    }
  }, [])

  const resetEditor = () => {
    setForm({
      supplier_id: '',
      return_date: new Date().toISOString().slice(0, 10),
    })
    setInvoices([])
    setManualRef('')
    setBlocks([makeBlock()])
  }

  useEffect(() => {
    resetEditor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectSupplier = (value: string) => {
    setForm((f) => ({ ...f, supplier_id: value }))
    setManualRef('')
    setBlocks([makeBlock()])
    loadInvoices(value)
  }

  // Direct entry — find a received invoice by reference / id and add it to
  // the picker pool (deduped), so it becomes selectable in any invoice block.
  const lookupInvoice = async () => {
    const q = manualRef.trim()
    if (!q) {
      toast.error('Enter an invoice reference or id first')
      return
    }
    if (!form.supplier_id) {
      toast.error('Select a supplier first')
      return
    }
    try {
      const res = await purchasesApi.list({
        supplier_id: Number(form.supplier_id),
        status: 'RECEIVED',
        search: q,
        limit: 5,
      })
      if (res.items.length === 0) {
        toast.error(`No received invoice matches "${q}"`)
        return
      }
      setInvoices((cur) => {
        const ids = new Set(cur.map((i) => i.id))
        const missing = res.items.filter((i) => !ids.has(i.id))
        return missing.length ? [...cur, ...missing] : cur
      })
      toast.success(`${res.items.length} invoice(s) added to the picker`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  // ─── invoice block actions ────────────────────────────────────────────────

  const addInvoiceBlock = () => setBlocks((b) => [...b, makeBlock()])

  const removeInvoiceBlock = (idx: number) => {
    if (blocks.length === 1) {
      toast.error('At least one invoice is required')
      return
    }
    setBlocks(blocks.filter((_, i) => i !== idx))
  }

  const setBlockInvoice = (idx: number, invoiceId: string) => {
    setBlocks(
      blocks.map((b, i) =>
        i === idx ? { ...b, invoice_id: invoiceId, items: [{ ...emptyItem }] } : b,
      ),
    )
  }

  // ─── per-invoice item actions ─────────────────────────────────────────────

  const addInvoiceItem = (blockIdx: number) => {
    setBlocks(
      blocks.map((b, i) => (i === blockIdx ? { ...b, items: [...b.items, { ...emptyItem }] } : b)),
    )
  }

  const removeInvoiceItem = (blockIdx: number, itemIdx: number) => {
    setBlocks(
      blocks.map((b, i) => {
        if (i !== blockIdx) return b
        if (b.items.length === 1) {
          toast.error('An invoice needs at least one item')
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

  const invoiceOf = (id: string) => invoices.find((i) => i.id === id)

  const invoiceTotal = (p: Purchase) =>
    p.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const variantLabel = (id: string) => {
    const v = variants.find((v) => v.id === id)
    return v ? `${v.name} (${v.sku})` : id.slice(0, 8)
  }

  const itemAmount = (block: InvoiceBlock, item: ReturnItemForm) => {
    const pl = invoiceOf(block.invoice_id)?.lines.find((l) => l.id === item.purchase_line_id)
    const qty = Number(item.qty) || 0
    const cost = pl ? Number(pl.unit_cost) : 0
    return qty * cost
  }

  const formTotal = blocks.reduce(
    (sum, b) => sum + b.items.reduce((s, it) => s + itemAmount(b, it), 0),
    0,
  )

  const usedInvoices = blocks.filter((b) => b.invoice_id).map((b) => invoiceOf(b.invoice_id)!)

  const handleSave = async () => {
    if (!form.supplier_id) {
      toast.error('Supplier is required')
      return
    }
    if (!form.return_date) {
      toast.error('Return date is required')
      return
    }
    const validLines: { purchase_line_id: string; qty: number; reason?: string }[] = []
    for (const block of blocks) {
      if (!block.invoice_id) {
        toast.error('Every invoice block needs an invoice selected')
        return
      }
      for (const it of block.items) {
        if (!it.purchase_line_id || !Number(it.qty) || Number(it.qty) <= 0) {
          toast.error('Each item needs a line and a qty > 0')
          return
        }
        validLines.push({
          purchase_line_id: it.purchase_line_id,
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
      const created = await purchaseReturnsApi.create({
        supplier_id: Number(form.supplier_id),
        return_date: form.return_date,
        lines: validLines,
      })
      const supplier = suppliers.find((s) => s.id === created.supplier_id)
      toast.success(
        `Purchase return recorded across ${usedInvoices.length} invoice(s) — stock reduced & supplier ledger updated`,
      )
      resetEditor()
      printPurchaseReturnInvoice(created, { supplier })
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
        title="Purchase Returns"
        description="Return goods against one or more of a supplier's received invoices — each invoice can have many items."
      />

      {/* Create section - inline in the page body, no dialog */}
      <section className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">New Purchase Return</h2>
          <p className="text-sm text-muted-foreground">
            Pick the supplier, add invoices, and add items inside each invoice.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={form.supplier_id} onValueChange={selectSupplier}>
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
            <Label htmlFor="pr-date">Return Date</Label>
            <Input
              id="pr-date"
              type="date"
              value={form.return_date}
              onChange={(e) => setForm({ ...form, return_date: e.target.value })}
            />
          </div>
        </div>

        {form.supplier_id && (
          <>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label>Add a received invoice to the picker</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={manualRef}
                    onChange={(e) => setManualRef(e.target.value)}
                    placeholder="type invoice ref / id"
                    className="w-64"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        lookupInvoice()
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={lookupInvoice}>
                    <Search className="h-4 w-4" />
                    Find
                  </Button>
                </div>
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                {invoicesLoading
                  ? 'Loading invoices…'
                  : `${invoices.length} received invoice(s) available`}
              </p>
            </div>

            <div className="space-y-3">
              {blocks.map((block, blockIdx) => (
                <div key={block.key} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Invoice #{blockIdx + 1}
                      </span>
                      <Select
                        value={block.invoice_id}
                        onValueChange={(v) => setBlockInvoice(blockIdx, v)}
                      >
                        <SelectTrigger className="w-72">
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                        <SelectContent>
                          {invoices.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No received invoices for this supplier.
                            </div>
                          ) : invoicesUsedElsewhere(blockIdx).size >= invoices.length ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              All received invoices are already added.
                            </div>
                          ) : (
                            invoices
                              .filter((inv) => !invoicesUsedElsewhere(blockIdx).has(inv.id))
                              .map((inv) => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  #{inv.reference_no ?? inv.id.slice(0, 8)} · {inv.purchase_date} ·{' '}
                                  {money(invoiceTotal(inv))}
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
                      onClick={() => removeInvoiceBlock(blockIdx)}
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
                          const pl = invoiceOf(block.invoice_id)?.lines.find(
                            (l) => l.id === item.purchase_line_id,
                          )
                          return (
                            <TableRow key={itemIdx}>
                              <TableCell>
                                <Select
                                  value={item.purchase_line_id}
                                  onValueChange={(v) => updateItem(blockIdx, itemIdx, 'purchase_line_id', v)}
                                  disabled={!block.invoice_id}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select item" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {invoiceOf(block.invoice_id)?.lines
                                      .filter((plx) => !itemsUsedInBlock(blockIdx, itemIdx).has(plx.id))
                                      .map((plx) => (
                                        <SelectItem key={plx.id} value={plx.id}>
                                          {variantLabel(plx.variant_id)} · bought {plx.qty} @{' '}
                                          {money(Number(plx.unit_cost))}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                {pl && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Cost {money(Number(pl.unit_cost))} · invoice qty {pl.qty} ·
                                    line total {money(Number(pl.line_total))}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={item.qty}
                                  onChange={(e) => updateItem(blockIdx, itemIdx, 'qty', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.reason}
                                  placeholder="e.g. damaged, wrong size"
                                  onChange={(e) => updateItem(blockIdx, itemIdx, 'reason', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                {money(itemAmount(block, item))}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeInvoiceItem(blockIdx, itemIdx)}
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
                    {remainingInvoiceLines(block) > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addInvoiceItem(blockIdx)}
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Item
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {availableInvoices.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addInvoiceBlock}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Add Another Invoice
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