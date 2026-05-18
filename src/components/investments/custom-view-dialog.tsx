'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { useAppStore, type CustomPortfolioView } from '@/lib/store'
import { AccountType } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editView?: CustomPortfolioView | null
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  TBSZ: 'TBSZ',
  BROKER: 'Bróker',
  ALLAMPAPIR: 'Állampapír',
  BANK: 'Bankszámla',
  CASH: 'Készpénz',
}

export function CustomViewDialog({ open, onOpenChange, editView }: Props) {
  const { accounts, addCustomView, updateCustomView } = useAppStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const investmentAccounts = accounts.filter((a) =>
    [AccountType.TBSZ, AccountType.BROKER, AccountType.ALLAMPAPIR].includes(a.type)
  )

  useEffect(() => {
    if (editView) {
      setName(editView.name)
      setDescription(editView.description ?? '')
      setSelectedIds(editView.accountIds)
    } else {
      setName('')
      setDescription('')
      setSelectedIds([])
    }
  }, [editView, open])

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectedTotal = accounts
    .filter((a) => selectedIds.includes(a.id))
    .reduce((s, a) => s + a.balance, 0)

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Adj nevet a nézetnek!')
      return
    }
    if (selectedIds.length === 0) {
      toast.error('Válassz legalább egy számlát!')
      return
    }
    if (editView) {
      updateCustomView(editView.id, { name: name.trim(), description: description.trim(), accountIds: selectedIds })
      toast.success('Nézet frissítve')
    } else {
      addCustomView({
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim() || undefined,
        accountIds: selectedIds,
        createdAt: new Date().toISOString(),
      })
      toast.success('Egyéni nézet létrehozva')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editView ? 'Nézet szerkesztése' : 'Új egyéni portfólió nézet'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nézet neve *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='pl. "TBSZ + Állampapír összesítő"'
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Leírás (opcionális)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rövid leírás a nézetről"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Számlák kiválasztása *</Label>
            <div className="space-y-2">
              {investmentAccounts.map((acc) => {
                const selected = selectedIds.includes(acc.id)
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleAccount(acc.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                      selected
                        ? 'bg-muted border-slate-400/30'
                        : 'bg-muted border-border hover:border-[#3e3e4e]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        selected ? 'bg-primary border-slate-400' : 'border-[#3e3e4e]'
                      }`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{acc.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground border-0">
                            {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                          </Badge>
                          {acc.tbszYear && (
                            <span className="text-[10px] text-muted-foreground">{acc.tbszYear}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                      {formatCurrency(acc.balance)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
              <span className="text-sm text-primary">
                {selectedIds.length} számla kiválasztva
              </span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(selectedTotal)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Mégse
          </Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white">
            {editView ? 'Mentés' : 'Nézet létrehozása'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
