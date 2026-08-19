import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usersApi } from '@/api/users'
import { authApi } from '@/api/auth'
import { useAuth } from '@/contexts/AuthContext'
import { assignableRoles, canEditUser, ROLE_LABELS } from '@/config/rbac'
import { getApiErrorMessage } from '@/lib/axios'
import type { Role, User } from '@/types'
import { Plus, MoreHorizontal, Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [items, setItems] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', full_name: '', role: '' as Role | '' })
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<Role | ''>('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetting, setResetting] = useState(false)

  const roleOptions = assignableRoles(currentUser?.role)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await usersApi.list({ skip, limit: PAGE_SIZE })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setCreateForm({ email: '', password: '', full_name: '', role: roleOptions[0] ?? '' })
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.role) {
      toast.error('Email, password and role are required')
      return
    }
    setCreating(true)
    try {
      await authApi.register({
        email: createForm.email,
        password: createForm.password,
        full_name: createForm.full_name || undefined,
        role: createForm.role,
      })
      toast.success('User created')
      setCreateOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setEditRole(u.role)
    setEditActive(u.is_active)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await usersApi.update(editing.id, { role: editRole || editing.role, is_active: editActive })
      toast.success('User updated')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      await usersApi.resetPassword(resetTarget.email)
      toast.success(`Password reset to the default for ${resetTarget.email}`)
      setResetTarget(null)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setResetting(false)
    }
  }

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their roles."
        actions={
          roleOptions.length > 0 ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add user
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading &&
              items.map((u) => {
                const editable = currentUser ? canEditUser(currentUser, u) : false
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.full_name || u.email}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABELS[u.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge active={u.is_active} />
                        {u.is_locked && <Badge variant="destructive">Locked</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {editable && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(u)}>Edit role / status</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetTarget(u)}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              Reset password
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? 0 : skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setSkip(skip + PAGE_SIZE)}>
            Next
          </Button>
        </div>
      </div>

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">Full name</Label>
              <Input id="new-name" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password</Label>
              <Input id="new-password" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">Min 8 chars, upper, lower, number, symbol.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as Role })}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...roleOptions, editing?.role].filter((r, i, arr) => r && arr.indexOf(r) === i).map((r) => (
                    <SelectItem key={r} value={r as string}>{ROLE_LABELS[r as Role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input id="edit-active" type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
              <Label htmlFor="edit-active" className="cursor-pointer font-normal">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title="Reset password?"
        description={`This resets ${resetTarget?.email}'s password to the system default password. They should change it on next login.`}
        onConfirm={handleReset}
        isLoading={resetting}
      />
    </div>
  )
}
