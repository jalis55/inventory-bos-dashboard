import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ENTRIES } from '@/config/nav'
import { hasPermission } from '@/config/rbac'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Warehouse, ChevronDown, ChevronRight } from 'lucide-react'

export function Sidebar({ className }: { className?: string }) {
  const { user } = useAuth()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      NAV_ENTRIES.filter((e) => 'items' in e && e.defaultOpen).map((e) => [e.label, true]),
    ),
  )

  return (
    <aside className={cn("flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <Warehouse className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-wide">Inventory BOS</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ENTRIES.filter((entry) => hasPermission(user?.role, entry.permission)).map((entry) => {
          if ('items' in entry) {
            return (
              <div key={entry.label}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((s) => ({ ...s, [entry.label]: !s[entry.label] }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <span className="flex items-center gap-3">
                    <entry.icon className="h-4 w-4" />
                    {entry.label}
                  </span>
                  {openGroups[entry.label] ? (
                    <ChevronDown className="h-4 w-4 transition-transform" />
                  ) : (
                    <ChevronRight className="h-4 w-4 transition-transform" />
                  )}
                </button>
                {openGroups[entry.label] && (
                  <div className="mt-1 space-y-1 pl-4">
                    {entry.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
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
                  </div>
                )}
              </div>
            )
          }
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.to === '/'}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )
              }
            >
              <entry.icon className="h-4 w-4" />
              {entry.label}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/50">
        v1.0.0 · RBAC enabled
      </div>
    </aside>
  )
}