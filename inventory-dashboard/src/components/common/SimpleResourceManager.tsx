import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/axios'
import type { PaginatedResponse } from '@/types'

interface SimpleEntity {
  id: number
  name: string
  is_active: boolean
}

interface Api<T> {
  list: (params?: { skip?: number; limit?: number }) => Promise<PaginatedResponse<T>>
  create: (data: Partial<T>) => Promise<T>
  update: (id: number, data: Partial<T>) => Promise<T>
  remove: (id: number) => Promise<void>
}

interface SimpleResourceManagerProps<T extends SimpleEntity> {
  title: string
  singular: string
  description: string
  api: Api<T>
}

const PAGE_SIZE = 10

export function SimpleResourceManager<T extends SimpleEntity>({
  title,
  singular,
  description,
  api,
}: SimpleResourceManagerProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.list({ skip, limit: PAGE_SIZE })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [api, skip])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setIsActive(true)
    setDialogOpen(true)
  }

  const openEdit = (item: T) => {
    setEditing(item)
    setName(item.name)
    setIsActive(item.is_active)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.update(editing.id, { name, is_active: isActive } as Partial<T>)
        toast.success(`${singular} updated`)
      } else {
        await api.create({ name } as Partial<T>)
        toast.success(`${singular} created`)
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.remove(deleteTarget.id)
      toast.success(`${singular} deleted`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <RequirePermission permission="inventory:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add {singular}
            </Button>
          </RequirePermission>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <RequirePermission permission="inventory:manage">
                <TableHead className="w-24 text-right">Actions</TableHead>
              </RequirePermission>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={3}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  No {title.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <StatusBadge active={item.is_active} />
                  </TableCell>
                  <RequirePermission permission="inventory:manage">
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </RequirePermission>
                </TableRow>
              ))}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${singular}` : `Add ${singular}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="resource-name">Name</Label>
              <Input id="resource-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${singular} name`} />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  id="is-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is-active" className="cursor-pointer font-normal">
                  Active
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${singular}?`}
        description={`This will permanently delete "${deleteTarget?.name}". This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </div>
  )
}
