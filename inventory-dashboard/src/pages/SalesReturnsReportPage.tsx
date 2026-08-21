import { ReturnReport } from '@/components/reports/ReturnReport'

export default function SalesReturnsReportPage() {
  return (
    <ReturnReport
      kind="sale"
      title="Sales Returns"
      description="Look up a customer's sales returns by id, name, email or phone — every return's items, amounts and reasons."
    />
  )
}