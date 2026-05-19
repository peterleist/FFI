'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { CategoryType, Frequency, type RecurringItem } from '@/lib/types'
import { FREQUENCY_LABELS } from '@/lib/recurring'
import { toast } from 'sonner'

const toISO = (d: Date) => d.toISOString().slice(0, 10)
const dateClass =
  'h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground [color-scheme:dark]'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  item: RecurringItem | null
  defaultType?: CategoryType
}

export function RecurringDialog({ open, onOpenChange, item, defaultType }: Props) {
  const { categories, addRecurringItem, updateRecurringItem } = useAppStore()

  const [type, setType] = useState<CategoryType>(defaultType ?? CategoryType.EXPENSE)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY)
  const [startDate, setStartDate] = useState(toISO(new Date()))
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (!open) return
    if (item) {
      setType(item.type)
      setName(item.name)
      setAmount(String(item.amount))
      setCategoryId(item.categoryId ?? '')
      setFrequency(item.frequency)
      setStartDate(toISO(new Date(item.startDate)))
      setEndDate(item.endDate ? toISO(new Date(item.endDate)) : '')
    } else {
      setType(defaultType ?? CategoryType.EXPENSE)
      setName('')
      setAmount('')
      setCategoryId('')
      setFrequency(Frequency.MONTHLY)
      setStartDate(toISO(new Date()))
      setEndDate('')
    }
  }, [open, item, defaultType])

  const typeCategories = categories.filter((c) => c.type === type)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!name.trim() || !amt || amt <= 0) {
      toast.error('Adj meg nevet és pozitív összeget')
      return
    }
    const now = new Date()
    if (item) {
      updateRecurringItem(item.id, {
        name: name.trim(), amount: amt, type, categoryId: categoryId || null,
        frequency, startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null, updatedAt: now,
      })
      toast.success('Ismétlődő tétel frissítve')
    } else {
      addRecurringItem({
        id: `rec-${Date.now()}`,
        userId: 'local-user',
        categoryId: categoryId || null,
        name: name.trim(), amount: amt, type, frequency,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        createdAt: now, updatedAt: now,
      })
      toast.success('Ismétlődő tétel hozzáadva')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-foreground">
            {item ? 'Ismétlődő tétel szerkesztése' : 'Új ismétlődő tétel'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="space-y-4 px-6 pt-1 pb-3 overflow-y-auto flex-1">
            {/* Type */}
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Típus</Label>
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                {([
                  [CategoryType.INCOME, 'Bevétel', 'bg-emerald-500'],
                  [CategoryType.EXPENSE, 'Kiadás', 'bg-red-500'],
                ] as const).map(([val, label, active]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setType(val); setCategoryId('') }}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all',
                      type === val ? `${active} text-white` : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Name */}
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Megnevezés *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Fizetés, Lakbér, Netflix"
                className="bg-muted border-border text-foreground"
              />
            </div>
            {/* Amount */}
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Összeg (Ft) *</Label>
              <Input
                type="number" value={amount} min="0" step="1000"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="bg-muted border-border text-foreground"
              />
            </div>
            {/* Category */}
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Kategória</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Válassz kategóriát" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {typeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-foreground">
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Frequency */}
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Gyakoriság *</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.values(Frequency).map((f) => (
                    <SelectItem key={f} value={f} className="text-foreground">
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">Kezdő dátum *</Label>
                <input
                  type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={dateClass}
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">Vég dátum</Label>
                <input
                  type="date" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={dateClass}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
            <Button
              type="button" variant="outline" onClick={() => onOpenChange(false)}
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Mégse
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white">
              {item ? 'Mentés' : 'Hozzáadás'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
