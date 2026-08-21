import { api } from '@/lib/axios'
import type { InvoiceLedgerDoc, InvoiceLedgerResponse } from '@/types'

export const invoiceLedgerApi = {
  get: (invoiceNumber: string) =>
    api
      .get<InvoiceLedgerResponse>('/invoice-ledger', {
        params: { invoice_number: invoiceNumber },
      })
      .then((r) => r.data),

  /** Fetch the full single-invoice statement (used for a row's Preview/Print). */
  getStatement: (id: string) =>
    api
      .get<InvoiceLedgerDoc>('/invoice-ledger', {
        params: { invoice_number: id },
      })
      .then((r) => r.data),
}