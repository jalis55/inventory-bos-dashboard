import { SimpleResourceManager } from '@/components/common/SimpleResourceManager'
import { brandsApi } from '@/api/brands'
import type { Brand } from '@/types'

export default function BrandsPage() {
  return (
    <SimpleResourceManager<Brand>
      title="Brands"
      singular="Brand"
      description="Manufacturers and suppliers linked to your products."
      api={brandsApi}
    />
  )
}
