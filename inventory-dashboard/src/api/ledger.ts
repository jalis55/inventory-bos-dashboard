import { api } from '@/lib/axios'
import type {
  LedgerRefType,
  PartyBalance,
  PartyLedgerEntryOutPaginate,
} from '@/types'

export const ledgerApi = {
  list: (
    partyId: number,
    params?: {
      skip?: number
      limit?: number
      ref_type?: LedgerRefType
      from_date?: string
      to_date?: string
    },
  ) =>
    api
      .get<PartyLedgerEntryOutPaginate>(`/party-ledger/${partyId}`, { params })
      .then((r) => r.data),

  balance: (partyId: number) =>
    api.get<PartyBalance>(`/party/${partyId}/balance`).then((r) => r.data),
}