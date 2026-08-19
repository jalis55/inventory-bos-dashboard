import { SimpleResourceManager } from '@/components/common/SimpleResourceManager'
import { productVariantsApi } from '@/api/productVariants'
import type { ProductVariant } from '@/types'

export default function ProductVariantsPage() {
  return (
    <SimpleResourceManager<ProductVariant>
      title="Product Variants"
      singular="Variant"
      description="Size, pack, or configuration variants for products."
      api={productVariantsApi}
    />
  )
}
