import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/config/nav'
import { hasPermission } from '@/config/rbac'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Warehouse } from 'lucide-react'

export function Sidebar({ className }: { className?: string }) {
  const { user } = useAuth()

  return (
    <aside className={cn("flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <Warehouse className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-wide">Inventory BOS</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.filter((item) => hasPermission(user?.role, item.permission)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/50">
        v1.0.0 · RBAC enabled
      </div>
    </aside>
  )
}
