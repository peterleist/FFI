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
      <DialogContent className="max-w-md bg-[#111118] border-[#1e1e2e] text-[#f1f5f9]">
        <DialogHeader>
          <DialogTitle className="text-[#f1f5f9]">
            {editView ? 'Nézet szerkesztése' : 'Új egyéni portfólió nézet'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748b]">Nézet neve *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='pl. "TBSZ + Állampapír összesítő"'
              className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] placeholder:text-[#64748b]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748b]">Leírás (opcionális)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rövid leírás a nézetről"
              className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] placeholder:text-[#64748b]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#64748b]">Számlák kiválasztása *</Label>
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
                        ? 'bg-slate-400/10 border-slate-400/30'
                        : 'bg-[#1e1e2e] border-[#2e2e3e] hover:border-[#3e3e4e]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        selected ? 'bg-slate-600 border-slate-400' : 'border-[#3e3e4e]'
                      }`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#f1f5f9]">{acc.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#2e2e3e] text-[#64748b] border-0">
                            {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                          </Badge>
                          {acc.tbszYear && (
                            <span className="text-[10px] text-[#64748b]">{acc.tbszYear}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${selected ? 'text-slate-400' : 'text-[#64748b]'}`}>
                      {formatCurrency(acc.balance)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-400/10 border border-slate-400/20 rounded-lg">
              <span className="text-sm text-slate-400">
                {selectedIds.length} számla kiválasztva
              </span>
              <span className="text-sm font-bold text-slate-400">
                {formatCurrency(selectedTotal)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e]"
          >
            Mégse
          </Button>
          <Button onClick={handleSave} className="bg-slate-600 hover:bg-slate-500 text-white">
            {editView ? 'Mentés' : 'Nézet létrehozása'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
