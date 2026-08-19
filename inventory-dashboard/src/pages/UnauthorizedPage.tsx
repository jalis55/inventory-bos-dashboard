import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert className="h-10 w-10 text-destructive" />
      <div>
        <h1 className="text-xl font-semibold">You don't have access to this page</h1>
        <p className="text-sm text-muted-foreground">Your role doesn't include this permission. Contact an admin if this seems wrong.</p>
      </div>
      <Button asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  )
}
