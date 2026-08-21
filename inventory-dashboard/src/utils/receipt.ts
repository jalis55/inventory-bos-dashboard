import { printInBrowser } from './print'
import { COMPANY, money, escapeHtml } from './invoice'
import type { Party } from '@/types'

export type PartyKind = 'SUPPLIER' | 'CUSTOMER' | 'SUPPLIER_REFUND' | 'CUSTOMER_REFUND'

export interface PaymentReceiptRow {
  ref: string
  date: string
  total: number
  amountNow: number
}

/**
 * Prints the evidence document for a payment:
 * - CUSTOMER          -> MONEY RECEIPT    (money in)
 * - SUPPLIER          -> PAYMENT VOUCHER  (money out)
 * - SUPPLIER_REFUND   -> REFUND VOUCHER   (money in, from a supplier's credit)
 * - CUSTOMER_REFUND   -> REFUND VOUCHER   (money out, repaying a customer's credit)
 * Lists exactly which invoices were settled and by how much.
 */
export function printPaymentReceipt(
  kind: PartyKind,
  party: Party | undefined,
  rows: PaymentReceiptRow[],
  opts: { method: string; date: string; total: number },
): void {
  const isRefund = kind === 'SUPPLIER_REFUND' || kind === 'CUSTOMER_REFUND'
  const isSupplier = kind === 'SUPPLIER'
  const title = isRefund ? 'Refund Voucher' : isSupplier ? 'Payment Voucher' : 'Money Receipt'
  const subtitle = isRefund
    ? kind === 'SUPPLIER_REFUND' ? 'Received from Supplier' : 'Refunded to Customer'
    : isSupplier ? 'Paid to Supplier' : 'Received from Customer'
  const partyLabel = isRefund
    ? kind === 'SUPPLIER_REFUND' ? 'Received From' : 'Refunded To'
    : isSupplier ? 'Paid To' : 'Received From'
  const receiptNo = `REF-${Date.now().toString(36).toUpperCase()}`
  const accent = isSupplier || kind === 'CUSTOMER_REFUND' ? '#b45309' : '#059669'

  const bodyRows = rows
    .map(
      (row, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td>${escapeHtml(row.ref)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td class="num">${money(row.total)}</td>
          <td class="num amt">${money(row.amountNow)}</td>
        </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} ${escapeHtml(receiptNo)}</title>
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
  .topbar { height: 6px; background: linear-gradient(90deg, ${accent}, ${accent}cc); border-radius: 6px 6px 0 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 10mm 0 8mm; border-bottom: 2px solid #e5e7eb; }
  .brand h1 { font-size: 22px; letter-spacing: 0.5px; color: #111827; }
  .brand .tagline { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .brand .address { color: #9ca3af; font-size: 11px; margin-top: 4px; max-width: 60mm; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${accent}; }
  .doc-title .sub { font-size: 12px; color: #6b7280; font-weight: 600; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; padding: 8mm 0; }
  .meta h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
  .meta .value { font-weight: 600; }
  .meta .block { min-width: 0; }
  .meta .aside { text-align: right; }
  .meta .aside .item { margin-top: 6px; }
  .meta .aside .item .k { color: #6b7280; display: inline-block; width: 40mm; text-align: right; margin-right: 8px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  table.items thead th {
    background: ${accent}; color: #fff; text-align: left; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.8px; padding: 9px 10px;
  }
  table.items thead th.num, table.items tbody td.num { text-align: right; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #fafafa; }
  table.items td.amt { font-weight: 600; color: ${accent}; }
  .totals { display: flex; justify-content: flex-end; margin-top: 8mm; }
  .totals .inner { width: 64mm; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .row.total { border-top: 2px solid ${accent}; margin-top: 4px; padding-top: 10px; font-size: 15px; font-weight: 700; color: ${accent}; }
  .totals .num { font-variant-numeric: tabular-nums; }
  footer { margin-top: 14mm; border-top: 1px solid #e5e7eb; padding-top: 6mm; display: flex; justify-content: space-between; gap: 24px; color: #6b7280; font-size: 11px; }
  .toolbar { text-align: center; padding: 18px; }
  .toolbar button { font: inherit; padding: 10px 22px; border: none; border-radius: 8px; background: ${accent}; color: #fff; font-weight: 600; cursor: pointer; }
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
        <h2>${escapeHtml(title)}</h2>
        <div class="sub">${escapeHtml(subtitle)}</div>
      </div>
    </header>

    <section class="meta">
      <div class="block">
        <h4>${escapeHtml(partyLabel)}</h4>
        <div class="value">${escapeHtml(party?.name ?? (isSupplier ? 'Supplier' : 'Customer'))}</div>
        ${party?.phone ? `<div>${escapeHtml(party.phone)}</div>` : ''}
        ${party?.email ? `<div>${escapeHtml(party.email)}</div>` : ''}
        ${party?.address ? `<div>${escapeHtml(party.address)}</div>` : ''}
      </div>
      <div class="aside">
        <div class="item"><span class="k">Receipt No.</span><span class="value">${escapeHtml(receiptNo)}</span></div>
        <div class="item"><span class="k">Date</span><span class="value">${escapeHtml(opts.date)}</span></div>
        <div class="item"><span class="k">Method</span><span class="value">${escapeHtml(opts.method)}</span></div>
        <div class="item"><span class="k">Invoices</span><span class="value">${rows.length}</span></div>
      </div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th style="width:8%">#</th>
          <th>Invoice Ref</th>
          <th style="width:18%">Date</th>
          <th class="num" style="width:18%">Invoice Total</th>
          <th class="num" style="width:20%">Paid Now</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <div class="totals">
      <div class="inner">
        <div class="row total"><span>${escapeHtml(isRefund ? 'Total Refunded' : isSupplier ? 'Total Paid' : 'Total Received')}</span><span class="num">${money(opts.total)}</span></div>
      </div>
    </div>

    <footer>
      <div>
        <div><strong>${escapeHtml(title)}</strong></div>
        <div>This is a computer-generated document confirming the payment record above.</div>
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

  printInBrowser(html)
}
