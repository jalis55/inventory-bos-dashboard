import { Loader2 } from 'lucide-react'

/**
 * In-content loader used as the Suspense fallback for lazy-loaded pages
 * inside the dashboard layout (sidebar/topbar stay visible while the
 * page chunk loads). For full-screen contexts use FullPageSpinner.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  )
}