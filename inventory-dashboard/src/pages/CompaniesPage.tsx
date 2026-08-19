import { SimpleResourceManager } from '@/components/common/SimpleResourceManager'
import { companiesApi } from '@/api/companies'
import type { Company } from '@/types'

export default function CompaniesPage() {
  return (
    <SimpleResourceManager<Company>
      title="Companies"
      singular="Company"
      description="Manufacturers and suppliers linked to your products."
      api={companiesApi}
    />
  )
}
