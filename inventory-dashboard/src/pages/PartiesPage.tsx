import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { partiesApi } from '@/api/parties'
import { getApiErrorMessage } from '@/lib/axios'
import type { Party, PartyType } from '@/types'
import { Plus, Pencil, ToggleLeft, ToggleRight, Search, Loader2, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const PAGE_SIZE = 10

const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  SUPPLIER: 'Supplier',
  CUSTOMER: 'Customer',
  WALK_IN: 'Walk-In',
}

const PARTY_TYPE_COLORS: Record<PartyType, string> = {
  SUPPLIER: 'bg-blue-100 text-blue-800',
  CUSTOMER: 'bg-green-100 text-green-800',
  WALK_IN: 'bg-amber-100 text-amber-800',
}

const emptyForm = {
  party_type: '' as PartyType | '',
  name: '',
  phone: '',
  email: '',
  address: '',
  credit_limit: '',
}

export default function PartiesPage() {
  const [items, setItems] = useState<Party[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Party | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [togglingId, setTogglingId] = useState<number | null>(null)

  const navigate = useNavigate()

  const openLedger = (party: Party) =>
    navigate(`/party-ledger?party_id=${party.id}&type=${party.party_type}`)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { skip, limit: PAGE_SIZE }
      if (search.trim()) params.search = search.trim()
      if (typeFilter !== 'ALL') params.party_type = typeFilter
      const res = await partiesApi.list(params)
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [skip, search, typeFilter])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: Party) => {
    setEditing(item)
    setForm({
      party_type: item.party_type,
      name: item.name,
      phone: item.phone ?? '',
      email: item.email ?? '',
      address: item.address ?? '',
      credit_limit: String(item.credit_limit),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.party_type) {
      toast.error('Party type is required')
      return
    }
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }

    const payload = {
      party_type: form.party_type as PartyType,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : 0,
    }

    setSaving(true)
    try {
      if (editing) {
        await partiesApi.update(editing.id, payload)
        toast.success('Party updated')
      } else {
        await partiesApi.create(payload)
        toast.success('Party created')
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (party: Party) => {
    setTogglingId(party.id)
    try {
      if (party.is_active) {
        await partiesApi.deactivate(party.id)
        toast.success(`${party.name} deactivated`)
      } else {
        await partiesApi.activate(party.id)
        toast.success(`${party.name} activated`)
      }
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSkip(0)
    load()
  }

  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parties"
        description="Suppliers, customers, and walk-in clients."
        actions={
          <RequirePermission permission="parties:manage">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Party
            </Button>
          </RequirePermission>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            setSkip(0)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="SUPPLIER">Supplier</SelectItem>
            <SelectItem value="CUSTOMER">Customer</SelectItem>
            <SelectItem value="WALK_IN">Walk-In</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No parties found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={PARTY_TYPE_COLORS[item.party_type]}
                    >
                      {PARTY_TYPE_LABELS[item.party_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.phone ?? '—'}</TableCell>
                  <TableCell>{item.email ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {Number(item.balance_cached).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={item.is_active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openLedger(item)}>
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <RequirePermission permission="parties:manage">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                        >
                          {item.is_active ? (
                            <ToggleRight className="h-4 w-4 text-destructive" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                      </RequirePermission>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? 0 : skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of{' '}
          {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => setSkip(skip + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Party' : 'Add Party'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Party Type</Label>
              <Select
                value={form.party_type}
                onValueChange={(v) => setForm({ ...form, party_type: v as PartyType })}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="WALK_IN">Walk-In</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-name">Name</Label>
              <Input
                id="party-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="party-phone">Phone</Label>
                <Input
                  id="party-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party-email">Email</Label>
                <Input
                  id="party-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-address">Address</Label>
              <Input
                id="party-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="party-credit">Credit Limit</Label>
              <Input
                id="party-credit"
                type="number"
                min="0"
                step="0.01"
                value={form.credit_limit}
                onChange={(e) =>
                  setForm({ ...form, credit_limit: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
