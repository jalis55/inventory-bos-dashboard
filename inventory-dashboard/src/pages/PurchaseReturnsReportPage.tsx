import { ReturnReport } from '@/components/reports/ReturnReport'

export default function PurchaseReturnsReportPage() {
  return (
    <ReturnReport
      kind="purchase"
      title="Purchase Returns"
      description="Look up a supplier's purchase returns by id, name, email or phone — every return's items, amounts and reasons."
    />
  )
}