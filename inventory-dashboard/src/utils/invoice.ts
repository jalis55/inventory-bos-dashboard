import type { Party, ProductVariant, Purchase, PurchaseReturn } from '@/types'

const COMPANY = {
  name: 'Inventor Store',
  tagline: 'Wholesale & Retail Supplies',
  address: '123 Commerce Street, Floor 3, Dhaka 1207, Bangladesh',
  phone: '+880 17XX-XXXXXX',
  email: 'accounts@inventorstore.example',
}

const STATUS_LABELS: Record<Purchase['status'], string> = {
  DRAFT: 'Draft',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

interface InvoiceOptions {
  supplier?: Party
  variants: ProductVariant[]
}

export function printPurchaseInvoice(
  purchase: Purchase,
  { supplier, variants }: InvoiceOptions,
): void {
  const variantOf = (id: string) => variants.find((v) => v.id === id)

  const ref = purchase.reference_no ?? purchase.id.slice(0, 8).toUpperCase()
  const total = purchase.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const rows = purchase.lines
    .map((line, index) => {
      const v = variantOf(line.variant_id)
      const item = v ? `${v.name} (${v.sku})` : line.variant_id.slice(0, 8)
      return `
        <tr>
          <td class="num">${index + 1}</td>
          <td>
            <div class="item-name">${escapeHtml(item)}</div>
            <div class="item-sub">SKU: ${escapeHtml(v?.sku ?? line.variant_id)}</div>
          </td>
          <td class="num">${money(Number(line.qty))}</td>
          <td class="num">${money(Number(line.unit_cost))}</td>
          <td class="num">${money(Number(line.line_total))}</td>
        </tr>`
    })
    .join('')

  // A complete, standalone document so the browser's print / "Save as PDF"
  // produces a clean A4 page with zero dependency on the dashboard's CSS.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Purchase Invoice ${escapeHtml(ref)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f3f4f6; color: #1f2937; font-size: 13px; line-height: 1.5;
  }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 14mm 16mm; }
  @media print {
    body { background: #fff; }
    .page { width: auto; min-height: auto; margin: 0; }
    .toolbar { display: none !important; }
  }
  .topbar { height: 6px; background: linear-gradient(90deg, #1d4ed8, #60a5fa); border-radius: 6px 6px 0 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 10mm 0 8mm; border-bottom: 2px solid #e5e7eb; }
  .brand h1 { font-size: 22px; letter-spacing: 0.5px; color: #1d4ed8; }
  .brand .tagline { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .brand .address { color: #9ca3af; font-size: 11px; margin-top: 4px; max-width: 60mm; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #111827; }
  .doc-title .status { display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .status.draft { background: #fef3c7; color: #92400e; }
  .status.received { background: #dcfce7; color: #166534; }
  .status.cancelled { background: #fee2e2; color: #991b1b; }
  .meta { display: flex; justify-content: space-between; gap: 24px; padding: 8mm 0; }
  .meta h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
  .meta .value { font-weight: 600; }
  .meta .block { min-width: 0; }
  .meta .aside { text-align: right; }
  .meta .aside .item { margin-top: 6px; }
  .meta .aside .item .k { color: #6b7280; display: inline-block; width: 34mm; text-align: right; margin-right: 8px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  table.items thead th {
    background: #1d4ed8; color: #fff; text-align: left; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.8px; padding: 9px 10px;
  }
  table.items thead th.num, table.items tbody td.num { text-align: right; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f9fafb; }
  .item-name { font-weight: 600; }
  .item-sub { color: #9ca3af; font-size: 11px; }
  .totals { display: flex; justify-content: flex-end; margin-top: 8mm; }
  .totals .inner { width: 64mm; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .row.total { border-top: 2px solid #111827; margin-top: 4px; padding-top: 10px; font-size: 15px; font-weight: 700; }
  .totals .num { font-variant-numeric: tabular-nums; }
  footer { margin-top: 14mm; border-top: 1px solid #e5e7eb; padding-top: 6mm; display: flex; justify-content: space-between; gap: 24px; color: #6b7280; font-size: 11px; }
  .toolbar { text-align: center; padding: 18px; }
  .toolbar button {
    font: inherit; padding: 10px 22px; border: none; border-radius: 8px;
    background: #1d4ed8; color: #fff; font-weight: 600; cursor: pointer;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>
    <header>
      <div class="brand">
        <h1>${escapeHtml(COMPANY.name)}</h1>
        <div class="tagline">${escapeHtml(COMPANY.tagline)}</div>
        <div class="address">${escapeHtml(COMPANY.address)}</div>
        <div class="address">${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</div>
      </div>
      <div class="doc-title">
        <h2>Purchase Invoice</h2>
        <div>
          <span class="status ${purchase.status.toLowerCase()}">${STATUS_LABELS[purchase.status]}</span>
        </div>
      </div>
    </header>

    <section class="meta">
      <div class="block">
        <h4>Bill From (Supplier)</h4>
        <div class="value">${escapeHtml(supplier?.name ?? `Supplier #${purchase.supplier_id}`)}</div>
        ${supplier?.phone ? `<div>${escapeHtml(supplier.phone)}</div>` : ''}
        ${supplier?.email ? `<div>${escapeHtml(supplier.email)}</div>` : ''}
        ${supplier?.address ? `<div>${escapeHtml(supplier.address)}</div>` : ''}
      </div>
      <div class="aside">
        <div class="item"><span class="k">Invoice No.</span><span class="value">${escapeHtml(ref)}</span></div>
        <div class="item"><span class="k">Date</span><span class="value">${escapeHtml(purchase.purchase_date)}</span></div>
        <div class="item"><span class="k">Total Items</span><span class="value">${purchase.lines.length}</span></div>
      </div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th style="width:8%">#</th>
          <th>Item</th>
          <th class="num" style="width:12%">Qty</th>
          <th class="num" style="width:15%">Unit Price</th>
          <th class="num" style="width:18%">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="inner">
        <div class="row"><span>Subtotal</span><span class="num">${money(total)}</span></div>
        <div class="row total"><span>Grand Total</span><span class="num">${money(total)}</span></div>
      </div>
    </div>

    <footer>
      <div>
        <div><strong>Notes</strong></div>
        <div>${escapeHtml(purchase.notes ?? 'No additional notes.')}</div>
      </div>
      <div>
        <div><strong>Thank you for your business!</strong></div>
        <div>Generated ${escapeHtml(new Date().toLocaleString())} · ${escapeHtml(COMPANY.name)}</div>
      </div>
    </footer>
  </div>

  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=720')
  if (!win) {
    window.print()
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
}

interface ReturnInvoiceOptions {
  supplier?: Party
}

/**
 * Prints a supplier credit note for a purchase return - the item rows carry
 * the per-line reason, so the reason each unit came back is recorded on the
 * document itself, not just hidden in the ledger.
 */
export function printPurchaseReturnInvoice(
  purchaseReturn: PurchaseReturn,
  { supplier }: ReturnInvoiceOptions,
): void {
  const ref = purchaseReturn.id.slice(0, 8).toUpperCase()
  const total = purchaseReturn.lines.reduce((sum, l) => sum + Number(l.line_total), 0)

  const rows = purchaseReturn.lines
    .map((line, index) => {
      const item =
        line.variant_name != null
          ? `${line.variant_name}${line.variant_sku ? ` (${line.variant_sku})` : ''}`
          : line.variant_id?.slice(0, 8) ?? 'Item'
      return `
        <tr>
          <td class="num">${index + 1}</td>
          <td>
            <div class="item-name">${escapeHtml(item)}</div>
            <div class="item-sub">Reason: ${escapeHtml(line.reason || '—')}</div>
          </td>
          <td class="num">${money(Number(line.qty))}</td>
          <td class="num">${money(Number(line.unit_cost))}</td>
          <td class="num">${money(Number(line.line_total))}</td>
        </tr>`
    })
    .join('')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Purchase Return ${escapeHtml(ref)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f3f4f6; color: #1f2937; font-size: 13px; line-height: 1.5;
  }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 14mm 16mm; }
  @media print {
    body { background: #fff; }
    .page { width: auto; min-height: auto; margin: 0; }
    .toolbar { display: none !important; }
  }
  .topbar { height: 6px; background: linear-gradient(90deg, #b45309, #f59e0b); border-radius: 6px 6px 0 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 10mm 0 8mm; border-bottom: 2px solid #e5e7eb; }
  .brand h1 { font-size: 22px; letter-spacing: 0.5px; color: #1d4ed8; }
  .brand .tagline { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .brand .address { color: #9ca3af; font-size: 11px; margin-top: 4px; max-width: 60mm; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #111827; }
  .doc-title .sub { font-size: 12px; color: #d97706; font-weight: 600; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; padding: 8mm 0; }
  .meta h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
  .meta .value { font-weight: 600; }
  .meta .block { min-width: 0; }
  .meta .aside { text-align: right; }
  .meta .aside .item { margin-top: 6px; }
  .meta .aside .item .k { color: #6b7280; display: inline-block; width: 34mm; text-align: right; margin-right: 8px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  table.items thead th {
    background: #d97706; color: #fff; text-align: left; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.8px; padding: 9px 10px;
  }
  table.items thead th.num, table.items tbody td.num { text-align: right; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f9fafb; }
  .item-name { font-weight: 600; }
  .item-sub { color: #9ca3af; font-size: 11px; }
  .totals { display: flex; justify-content: flex-end; margin-top: 8mm; }
  .totals .inner { width: 64mm; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .row.total { border-top: 2px solid #111827; margin-top: 4px; padding-top: 10px; font-size: 15px; font-weight: 700; }
  .totals .num { font-variant-numeric: tabular-nums; }
  footer { margin-top: 14mm; border-top: 1px solid #e5e7eb; padding-top: 6mm; display: flex; justify-content: space-between; gap: 24px; color: #6b7280; font-size: 11px; }
  .toolbar { text-align: center; padding: 18px; }
  .toolbar button {
    font: inherit; padding: 10px 22px; border: none; border-radius: 8px;
    background: #d97706; color: #fff; font-weight: 600; cursor: pointer;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>
    <header>
      <div class="brand">
        <h1>${escapeHtml(COMPANY.name)}</h1>
        <div class="tagline">${escapeHtml(COMPANY.tagline)}</div>
        <div class="address">${escapeHtml(COMPANY.address)}</div>
        <div class="address">${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</div>
      </div>
      <div class="doc-title">
        <h2>Purchase Return</h2>
        <div class="sub">Supplier Credit Note</div>
      </div>
    </header>

    <section class="meta">
      <div class="block">
        <h4>Returned By (Supplier)</h4>
        <div class="value">${escapeHtml(supplier?.name ?? `Supplier #${purchaseReturn.supplier_id}`)}</div>
        ${supplier?.phone ? `<div>${escapeHtml(supplier.phone)}</div>` : ''}
        ${supplier?.email ? `<div>${escapeHtml(supplier.email)}</div>` : ''}
        ${supplier?.address ? `<div>${escapeHtml(supplier.address)}</div>` : ''}
      </div>
      <div class="aside">
        <div class="item"><span class="k">Return No.</span><span class="value">${escapeHtml(ref)}</span></div>
        <div class="item"><span class="k">Date</span><span class="value">${escapeHtml(purchaseReturn.return_date)}</span></div>
        <div class="item"><span class="k">Total Items</span><span class="value">${purchaseReturn.lines.length}</span></div>
      </div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th style="width:8%">#</th>
          <th>Item</th>
          <th class="num" style="width:12%">Qty</th>
          <th class="num" style="width:15%">Unit Cost</th>
          <th class="num" style="width:18%">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="inner">
        <div class="row"><span>Subtotal</span><span class="num">${money(total)}</span></div>
        <div class="row total"><span>Credit Total</span><span class="num">${money(total)}</span></div>
      </div>
    </div>

    <footer>
      <div>
        <div><strong>Return Reason</strong></div>
        <div>Recorded per item above. This credit reduces the amount owed to the supplier.</div>
      </div>
      <div>
        <div><strong>Thank you!</strong></div>
        <div>Generated ${escapeHtml(new Date().toLocaleString())} · ${escapeHtml(COMPANY.name)}</div>
      </div>
    </footer>
  </div>

  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=720')
  if (!win) {
    window.print()
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
}