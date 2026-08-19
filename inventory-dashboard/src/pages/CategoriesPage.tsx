import { SimpleResourceManager } from '@/components/common/SimpleResourceManager'
import { categoriesApi } from '@/api/categories'
import type { Category } from '@/types'

export default function CategoriesPage() {
  return (
    <SimpleResourceManager<Category>
      title="Categories"
      singular="Category"
      description="Product categories used to organize your catalog."
      api={categoriesApi}
    />
  )
}
