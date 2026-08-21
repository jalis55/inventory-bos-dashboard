import { printInBrowser } from './print'
import { COMPANY, money, escapeHtml } from './invoice'
import type { InvoiceLedgerDoc } from '@/types'

const ACCENT = '#4f46e5'

/**
 * Opens the print window for a single invoice's full ledger: the invoice
 * header, its line items, the running debit/credit balance of payments and
 * returns against it, and the summary totals. Always the print window.
 */
export function openInvoiceLedger(doc: InvoiceLedgerDoc): void {
  const isPurchase = doc.kind === 'PURCHASE'
  const subtitle = isPurchase ? 'Purchase Invoice' : 'Sales Invoice'
  const partyLabel = isPurchase ? 'Supplier' : 'Customer'
  const invoiceNo = doc.reference_no ?? doc.id
  const docRef = `IL-${Date.now().toString(36).toUpperCase()}`

  const itemRows = doc.lines
    .map(
      (line, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(line.variant_name ?? '—')}</td>
          <td>${escapeHtml(line.variant_sku ?? '—')}</td>
          <td class="num">${money(Number(line.qty))}</td>
          <td class="num">${money(Number(line.rate))}</td>
          <td class="num amt">${money(Number(line.line_total))}</td>
        </tr>`,
    )
    .join('')

  const txRows = doc.transactions
    .map(
      (t) => `
        <tr>
          <td>${escapeHtml(t.date)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td class="num">${t.debit ? money(Number(t.debit)) : '—'}</td>
          <td class="num">${t.credit ? money(Number(t.credit)) : '—'}</td>
          <td class="num bal">${money(Number(t.balance))}</td>
        </tr>`,
    )
    .join('')

  const outstanding = Number(doc.outstanding)

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice Ledger ${escapeHtml(invoiceNo)}</title>
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
  .topbar { height: 6px; background: linear-gradient(90deg, ${ACCENT}, ${ACCENT}cc); border-radius: 6px 6px 0 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 10mm 0 8mm; border-bottom: 2px solid #e5e7eb; }
  .brand h1 { font-size: 22px; letter-spacing: 0.5px; color: #111827; }
  .brand .tagline { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .brand .address { color: #9ca3af; font-size: 11px; margin-top: 4px; max-width: 60mm; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${ACCENT}; }
  .doc-title .sub { font-size: 12px; color: #6b7280; font-weight: 600; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; padding: 8mm 0 4mm; }
  .meta h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
  .meta .value { font-weight: 600; }
  .meta .block { min-width: 0; }
  .meta .aside { text-align: right; }
  .meta .aside .item { margin-top: 6px; }
  .meta .aside .item .k { color: #6b7280; display: inline-block; width: 44mm; text-align: right; margin-right: 8px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 6mm 0; }
  .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .stat .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; }
  .stat .v { font-size: 17px; font-weight: 700; margin-top: 4px; color: #111827; }
  .stat .v.negative { color: #dc2626; }
  .stat .v.credit { color: #059669; }
  h3.section {
    font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
    color: ${ACCENT}; margin: 8mm 0 3mm; display: flex; align-items: center; gap: 8px;
  }
  h3.section::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
  table.items, table.ledger { width: 100%; border-collapse: collapse; }
  table.ledger { margin-top: 2mm; }
  table thead th {
    background: ${ACCENT}; color: #fff; text-align: left; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 10px;
  }
  table thead th.num, table tbody td.num { text-align: right; }
  table tbody td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table tbody tr:nth-child(even) { background: #fafafa; }
  table td.amt { font-weight: 600; color: ${ACCENT}; }
  table.ledger tbody td.bal { font-weight: 600; }
  table.ledger tbody tr:last-child td { background: #eef2ff; }
  .note { margin-top: 10mm; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 5mm; }
  .toolbar { text-align: center; padding: 18px; }
  .toolbar button { font: inherit; padding: 10px 22px; border: none; border-radius: 8px; background: ${ACCENT}; color: #fff; font-weight: 600; cursor: pointer; }
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
        <h2>Invoice Ledger</h2>
        <div class="sub">${escapeHtml(subtitle)}</div>
      </div>
    </header>

    <section class="meta">
      <div class="block">
        <h4>${escapeHtml(partyLabel)}</h4>
        <div class="value">${escapeHtml(doc.party_name ?? '—')}</div>
        ${doc.party_type ? `<div>${escapeHtml(doc.party_type.replace(/_/g, ' '))}</div>` : ''}
      </div>
      <div class="aside">
        <div class="item"><span class="k">Invoice No.</span><span class="value">${escapeHtml(invoiceNo)}</span></div>
        <div class="item"><span class="k">Invoice Date</span><span class="value">${escapeHtml(doc.invoice_date)}</span></div>
        <div class="item"><span class="k">Status</span><span class="value">${escapeHtml(doc.status)}</span></div>
        <div class="item"><span class="k">Document</span><span class="value">${escapeHtml(docRef)}</span></div>
      </div>
    </section>

    <div class="stats">
      <div class="stat"><div class="k">Total Invoice</div><div class="v">${money(Number(doc.total))}</div></div>
      <div class="stat"><div class="k">Paid So Far</div><div class="v">${money(Number(doc.amount_paid))}</div></div>
      <div class="stat"><div class="k">Adjusted (Returns)</div><div class="v">${money(Number(doc.returned_amount))}</div></div>
      <div class="stat">
        <div class="k">${isPurchase ? 'Outstanding (Due)' : 'Outstanding (Receivable)'}</div>
        <div class="v ${outstanding > 0 ? 'negative' : outstanding < 0 ? 'credit' : ''}">${money(outstanding)}</div>
      </div>
    </div>

    <h3 class="section">Items</h3>
    <table class="items">
      <thead>
        <tr>
          <th style="width:6%">#</th>
          <th>Item</th>
          <th style="width:18%">SKU</th>
          <th class="num" style="width:10%">Qty</th>
          <th class="num" style="width:14%">Rate</th>
          <th class="num" style="width:16%">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <h3 class="section">Ledger</h3>
    <table class="ledger">
      <thead>
        <tr>
          <th style="width:14%">Date</th>
          <th>Particulars</th>
          <th class="num" style="width:14%">Debit</th>
          <th class="num" style="width:14%">Credit</th>
          <th class="num" style="width:16%">Balance</th>
        </tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>

    <div class="note">
      Balance runs as invoice total − returns − payments. A positive closing balance means
      ${isPurchase ? 'you still owe the supplier' : 'the customer still owes you'}; a negative one means a credit
      ${isPurchase ? 'from the supplier' : 'you owe the customer'}. Generated ${escapeHtml(new Date().toLocaleString())}
      · ${escapeHtml(COMPANY.name)}.
    </div>
  </div>

  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
  </script>
</body>
</html>`

  printInBrowser(html)
}
