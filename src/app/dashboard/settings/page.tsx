'use client'

import { useState } from 'react'
import { format, parse, isValid } from 'date-fns'
import { hu } from 'date-fns/locale'
import {
  Settings, Calendar, Wallet, Building2, Landmark, TrendingUp,
  Check, Info, Plus, Pencil, Trash2, X, User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { AccountType } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
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
    <div className="bg-[#0e0e18] border border-[#2e2e3e] rounded-xl p-4 space-y-3">
      {/* Name + type row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-[#64748b]">Számla neve</Label>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="pl. OTP Folyószámla"
            autoFocus
            className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] placeholder:text-[#3e3e4e] h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#64748b]">Típus</Label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value as AccountType)}
            className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-[#f1f5f9] rounded-md px-3 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
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
          <Label className="text-xs text-[#64748b]">Nyitóegyenleg (Ft)</Label>
          <Input
            type="number"
            value={form.balance}
            onChange={(e) => set('balance', e.target.value)}
            placeholder="0"
            className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] placeholder:text-[#3e3e4e] h-8 text-sm"
          />
        </div>
        {form.type === AccountType.TBSZ && (
          <div className="space-y-1">
            <Label className="text-xs text-[#64748b]">TBSZ nyitás éve</Label>
            <Input
              type="number"
              value={form.tbszYear}
              onChange={(e) => set('tbszYear', e.target.value)}
              placeholder="pl. 2022"
              min={2000}
              max={new Date().getFullYear()}
              className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] placeholder:text-[#3e3e4e] h-8 text-sm"
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
          className="bg-slate-600 hover:bg-slate-500 text-white h-8"
        >
          <Check className="w-3.5 h-3.5 mr-1" /> Mentés
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] h-8"
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
    <div className="flex items-center gap-3 py-2.5 border-b border-[#1e1e2e] last:border-0 group">
      <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#f1f5f9] truncate">{account.name}</span>
          <Badge className="text-[10px] bg-[#1e1e2e] text-[#64748b] border-[#2e2e3e] border shrink-0">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </Badge>
          {account.type === AccountType.TBSZ && account.tbszYear && (
            <Badge className="text-[10px] bg-slate-400/10 text-slate-400 border-slate-400/20 border shrink-0">
              {account.tbszYear}
            </Badge>
          )}
        </div>
        <p className="text-xs text-[#3e3e4e] mt-0.5">{trackingLabel}</p>
      </div>

      <span className="text-sm font-semibold text-[#f1f5f9] shrink-0">
        {formatCurrency(account.balance)}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-[#64748b] hover:text-slate-400 hover:bg-[#1e1e2e] transition-colors"
          title="Szerkesztés"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-[#64748b] hover:text-red-400 hover:bg-[#1e1e2e] transition-colors"
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
      className="w-full bg-[#1e1e2e] border border-[#2e2e3e] text-[#f1f5f9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
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
      id: crypto.randomUUID(),
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
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-400/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f1f5f9]">Beállítások</h1>
          <p className="text-sm text-[#64748b]">Számlák, követés kezdete, nyitóegyenlegek</p>
        </div>
      </div>

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <Card className="bg-[#111118] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-base text-[#f1f5f9]">Profil</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748b]">Neved</Label>
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
                className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] placeholder:text-[#3e3e4e]"
              />
              <Button
                disabled={!nameChanged || !localName.trim()}
                onClick={() => {
                  updateProfile({ userName: localName.trim() })
                  toast.success('Név frissítve')
                }}
                className="bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40 shrink-0"
              >
                Mentés
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Accounts ─────────────────────────────────────────────────────────── */}
      <Card className="bg-[#111118] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-slate-400" />
              <CardTitle className="text-base text-[#f1f5f9]">Számlák</CardTitle>
            </div>
            {!addingNew && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAddingNew(true); setEditingId(null) }}
                className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Új számla
              </Button>
            )}
          </div>
          <CardDescription className="text-[#64748b] text-sm">
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
            <p className="text-sm text-[#64748b] italic py-2">Még nincsenek számlák.</p>
          ) : (
            <div>
              {accounts.map((account) =>
                editingId === account.id ? (
                  <div key={account.id} className="py-2 border-b border-[#1e1e2e] last:border-0">
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
      <Card className="bg-[#111118] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-base text-[#f1f5f9]">Követés kezdete</CardTitle>
          </div>
          <CardDescription className="text-[#64748b] text-sm">
            Ettől a hónaptól rögzíted a bevételeket és kiadásokat.
            Bankszámlákra és készpénzre vonatkozik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748b]">Első követett hónap</Label>
            <MonthPicker value={localMonth} onChange={setLocalMonth} />
          </div>

          <div className="flex items-start gap-2 p-3 bg-slate-400/5 border border-slate-400/10 rounded-lg">
            <Info className="w-4 h-4 text-[#64748b] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#64748b]">
              A <span className="text-slate-400">TBSZ számlák</span> automatikusan a nyitás évétől
              (megadott TBSZ év, január 1.) vannak nyomon követve — ezt külön nem kell beállítani.
            </p>
          </div>

          <Button
            onClick={handleSaveMonth}
            disabled={!monthChanged || !localMonth}
            className="bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40"
          >
            Mentés
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
