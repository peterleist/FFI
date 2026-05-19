'use client'

import { useState } from 'react'
import { format, parse, isValid } from 'date-fns'
import { hu } from 'date-fns/locale'
import {
  Calendar, Wallet, Building2, Landmark, TrendingUp,
  Check, Info, Plus, Pencil, Trash2, X, User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { AccountType } from '@/lib/types'
import { formatCurrency, uid } from '@/lib/utils'
import { toast } from 'sonner'
import type { Account } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.BANK]: 'Bankszámla',
  [AccountType.CASH]: 'Készpénz',
  [AccountType.ALLAMPAPIR]: 'Állampapír',
  [AccountType.TBSZ]: 'TBSZ',
  [AccountType.BROKER]: 'Bróker',
}

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ElementType> = {
  [AccountType.BANK]: Building2,
  [AccountType.CASH]: Wallet,
  [AccountType.ALLAMPAPIR]: Landmark,
  [AccountType.TBSZ]: Landmark,
  [AccountType.BROKER]: TrendingUp,
}

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  AccountType.BANK,
  AccountType.CASH,
  AccountType.TBSZ,
  AccountType.ALLAMPAPIR,
  AccountType.BROKER,
]

// ── Account form state ────────────────────────────────────────────────────────

interface AccountForm {
  name: string
  type: AccountType
  balance: string
  tbszYear: string
}

const emptyForm = (): AccountForm => ({
  name: '',
  type: AccountType.BANK,
  balance: '',
  tbszYear: String(new Date().getFullYear()),
})

const formFromAccount = (a: Account): AccountForm => ({
  name: a.name,
  type: a.type,
  balance: String(a.balance),
  tbszYear: String(a.tbszYear ?? new Date().getFullYear()),
})

// ── Inline account form ───────────────────────────────────────────────────────

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: AccountForm
  onSave: (form: AccountForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<AccountForm>(initial)
  const set = (k: keyof AccountForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const valid = form.name.trim().length > 0 && (form.balance === '' || !isNaN(parseFloat(form.balance)))

  return (
    <div className="bg-background border border-border rounded-xl p-4 space-y-3">
      {/* Name + type row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Számla neve</Label>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="pl. OTP Folyószámla"
            autoFocus
            className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Típus</Label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value as AccountType)}
            className="w-full bg-muted border border-border text-foreground rounded-md px-3 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ACCOUNT_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Balance + TBSZ year row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nyitóegyenleg (Ft)</Label>
          <Input
            type="number"
            value={form.balance}
            onChange={(e) => set('balance', e.target.value)}
            placeholder="0"
            className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
          />
        </div>
        {form.type === AccountType.TBSZ && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">TBSZ nyitás éve</Label>
            <Input
              type="number"
              value={form.tbszYear}
              onChange={(e) => set('tbszYear', e.target.value)}
              placeholder="pl. 2022"
              min={2000}
              max={new Date().getFullYear()}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => onSave(form)}
          className="bg-primary hover:bg-primary/90 text-white h-8"
        >
          <Check className="w-3.5 h-3.5 mr-1" /> Mentés
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted h-8"
        >
          <X className="w-3.5 h-3.5 mr-1" /> Mégse
        </Button>
      </div>
    </div>
  )
}

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({
  account,
  globalStart,
  onEdit,
  onDelete,
}: {
  account: Account
  globalStart: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = ACCOUNT_TYPE_ICONS[account.type]

  let trackingLabel = 'Követés nincs beállítva'
  if (account.type === AccountType.TBSZ && account.tbszYear) {
    trackingLabel = `${account.tbszYear}. január (nyitás éve)`
  } else if (globalStart) {
    try {
      const d = parse(globalStart + '-01', 'yyyy-MM-dd', new Date())
      if (isValid(d)) trackingLabel = `${format(d, 'yyyy. MMMM', { locale: hu })} óta`
    } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 group">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{account.name}</span>
          <Badge className="text-[10px] bg-muted text-muted-foreground border-border border shrink-0">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </Badge>
          {account.type === AccountType.TBSZ && account.tbszYear && (
            <Badge className="text-[10px] bg-muted text-primary border-border border shrink-0">
              {account.tbszYear}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{trackingLabel}</p>
      </div>

      <span className="text-sm font-semibold text-foreground shrink-0">
        {formatCurrency(account.balance)}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
          title="Szerkesztés"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
          title="Törlés"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Month picker ──────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
    const maxM = y === now.getFullYear() ? now.getMonth() + 1 : 12
    for (let m = maxM; m >= 1; m--) {
      const val = `${y}-${String(m).padStart(2, '0')}`
      const d = parse(val + '-01', 'yyyy-MM-dd', new Date())
      options.push({ value: val, label: format(d, 'yyyy. MMMM', { locale: hu }) })
    }
  }
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-muted border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="" disabled>Válassz hónapot…</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    accounts,
    userName,
    trackingStartMonth,
    setTrackingStartMonth,
    updateProfile,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useAppStore()

  const [localName, setLocalName] = useState(userName)
  const [localMonth, setLocalMonth] = useState<string | null>(trackingStartMonth)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  const handleSaveMonth = () => {
    if (!localMonth) return
    setTrackingStartMonth(localMonth)
    toast.success('Követés kezdete beállítva')
  }

  const handleAdd = (form: AccountForm) => {
    addAccount({
      id: uid(),
      userId: 'local-user',
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      currency: 'HUF',
      tbszYear: form.type === AccountType.TBSZ ? parseInt(form.tbszYear) || null : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    setAddingNew(false)
    toast.success('Számla hozzáadva')
  }

  const handleEdit = (account: Account, form: AccountForm) => {
    updateAccount(account.id, {
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      tbszYear: form.type === AccountType.TBSZ ? parseInt(form.tbszYear) || null : null,
      updatedAt: new Date(),
    })
    setEditingId(null)
    toast.success('Számla frissítve')
  }

  const handleDelete = (account: Account) => {
    deleteAccount(account.id)
    toast.success(`„${account.name}" törölve`)
  }

  const monthChanged = localMonth !== trackingStartMonth
  const nameChanged = localName.trim() !== userName

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="page-hd">
        <div>
          <div className="crumb">Konfiguráció</div>
          <h1>Beállítások</h1>
        </div>
      </div>

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <CardTitle className="text-base text-foreground">Profil</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Neved</Label>
            <div className="flex gap-2">
              <Input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameChanged && localName.trim()) {
                    updateProfile({ userName: localName.trim() })
                    toast.success('Név frissítve')
                  }
                }}
                placeholder="pl. Peterle"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60"
              />
              <Button
                disabled={!nameChanged || !localName.trim()}
                onClick={() => {
                  updateProfile({ userName: localName.trim() })
                  toast.success('Név frissítve')
                }}
                className="bg-primary hover:bg-primary/90 text-white disabled:opacity-40 shrink-0"
              >
                Mentés
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Accounts ─────────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <CardTitle className="text-base text-foreground">Számlák</CardTitle>
            </div>
            {!addingNew && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAddingNew(true); setEditingId(null) }}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Új számla
              </Button>
            )}
          </div>
          <CardDescription className="text-muted-foreground text-sm">
            Bankszámlák, készpénz, TBSZ, állampapír és bróker számlák kezelése.
            Húzd az egeret egy sorra a szerkesztési ikonokhoz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* New account form */}
          {addingNew && (
            <AccountForm
              initial={emptyForm()}
              onSave={handleAdd}
              onCancel={() => setAddingNew(false)}
            />
          )}

          {/* Account list */}
          {accounts.length === 0 && !addingNew ? (
            <p className="text-sm text-muted-foreground italic py-2">Még nincsenek számlák.</p>
          ) : (
            <div>
              {accounts.map((account) =>
                editingId === account.id ? (
                  <div key={account.id} className="py-2 border-b border-border last:border-0">
                    <AccountForm
                      initial={formFromAccount(account)}
                      onSave={(form) => handleEdit(account, form)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <AccountRow
                    key={account.id}
                    account={account}
                    globalStart={trackingStartMonth}
                    onEdit={() => { setEditingId(account.id); setAddingNew(false) }}
                    onDelete={() => handleDelete(account)}
                  />
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tracking start ────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <CardTitle className="text-base text-foreground">Követés kezdete</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-sm">
            Ettől a hónaptól rögzíted a bevételeket és kiadásokat.
            Bankszámlákra és készpénzre vonatkozik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Első követett hónap</Label>
            <MonthPicker value={localMonth} onChange={setLocalMonth} />
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted/40 border border-border rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              A <span className="text-primary">TBSZ számlák</span> automatikusan a nyitás évétől
              (megadott TBSZ év, január 1.) vannak nyomon követve — ezt külön nem kell beállítani.
            </p>
          </div>

          <Button
            onClick={handleSaveMonth}
            disabled={!monthChanged || !localMonth}
            className="bg-primary hover:bg-primary/90 text-white disabled:opacity-40"
          >
            Mentés
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
