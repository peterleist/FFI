'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Calendar } from '@/components/ui/calendar'
import { SimplePopover, SimplePopoverTrigger, SimplePopoverContent } from '@/components/ui/simple-popover'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { CategoryType, TransactionStatus, Frequency, type Transaction } from '@/lib/types'
import { toast } from 'sonner'

const TYPE_OPTIONS = [
  { label: 'Kiadás', value: 'expense' },
  { label: 'Bevétel', value: 'income' },
  { label: 'Átutalás', value: 'transfer' },
]

const FREQUENCY_LABELS: Record<Frequency, string> = {
  [Frequency.WEEKLY]: 'Heti',
  [Frequency.MONTHLY]: 'Havi',
  [Frequency.QUARTERLY]: 'Negyedéves',
  [Frequency.YEARLY]: 'Éves',
}

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionDialogProps) {
  const { accounts, categories, addTransaction, updateTransaction } = useAppStore()

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState<Date>(new Date())
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY)

  useEffect(() => {
    if (transaction) {
      setAmount(String(Math.abs(transaction.amount)))
      setDate(new Date(transaction.date))
      setDescription(transaction.description)
      setNote(transaction.note ?? '')
      setAccountId(transaction.accountId)
      setCategoryId(transaction.categoryId ?? '')
      setIsRecurring(transaction.isRecurring)
      if (transaction.amount > 0) setType('income')
      else {
        const cat = categories.find((c) => c.id === transaction.categoryId)
        setType(cat?.type === CategoryType.TRANSFER ? 'transfer' : 'expense')
      }
    } else {
      setType('expense')
      setAccountId(accounts[0]?.id ?? '')
      setCategoryId('')
      setAmount('')
      setDate(new Date())
      setDescription('')
      setNote('')
      setIsRecurring(false)
      setFrequency(Frequency.MONTHLY)
    }
  }, [transaction, open, accounts, categories])

  const filteredCategories = categories.filter((c) => {
    if (type === 'income') return c.type === CategoryType.INCOME
    if (type === 'transfer') return c.type === CategoryType.TRANSFER
    return c.type === CategoryType.EXPENSE
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (!parsedAmount || !accountId || !description) {
      toast.error('Kérem töltse ki az összes kötelező mezőt!')
      return
    }

    const finalAmount = type === 'expense' || type === 'transfer' ? -parsedAmount : parsedAmount

    if (transaction) {
      updateTransaction(transaction.id, {
        accountId,
        categoryId: categoryId || null,
        amount: finalAmount,
        date,
        description,
        note: note || null,
        isRecurring,
        updatedAt: new Date(),
      })
      toast.success('Tranzakció frissítve!')
    } else {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        userId: 'local-user',
        accountId,
        categoryId: categoryId || null,
        amount: finalAmount,
        date,
        description,
        note: note || null,
        isRecurring,
        status: TransactionStatus.CONFIRMED,
        importBatchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addTransaction(newTx)
      toast.success('Tranzakció hozzáadva!')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111118] border-[#1e1e2e] text-[#f1f5f9] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#f1f5f9]">
            {transaction ? 'Tranzakció szerkesztése' : 'Új tranzakció'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Type toggle */}
          <div>
            <Label className="text-[#64748b] text-xs mb-2 block">Típus</Label>
            <div className="flex gap-1 bg-[#1e1e2e] p-1 rounded-lg">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value as typeof type)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all',
                    type === opt.value
                      ? 'bg-slate-600 text-white'
                      : 'text-[#64748b] hover:text-[#f1f5f9]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account */}
          <div>
            <Label className="text-[#64748b] text-xs mb-1.5 block">Számla *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]">
                <SelectValue placeholder="Válassz számlát" />
              </SelectTrigger>
              <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} className="text-[#f1f5f9]">
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label className="text-[#64748b] text-xs mb-1.5 block">Kategória</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]">
                <SelectValue placeholder="Kategória kiválasztása" />
              </SelectTrigger>
              <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className="text-[#f1f5f9]">
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div>
            <Label className="text-[#64748b] text-xs mb-1.5 block">Összeg (Ft) *</Label>
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]"
              min="0"
              step="1"
            />
          </div>

          {/* Date */}
          <div>
            <Label className="text-[#64748b] text-xs mb-1.5 block">Dátum *</Label>
            <SimplePopover>
              <SimplePopoverTrigger
                className={cn(
                  'flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-[#2e2e3e] bg-[#1e1e2e] px-3 py-2 text-sm text-[#f1f5f9] hover:bg-[#2e2e3e] transition-colors'
                )}
              >
                <CalendarIcon className="h-4 w-4 text-[#64748b]" />
                {date ? format(date, 'yyyy. MM. dd.') : 'Válassz dátumot'}
              </SimplePopoverTrigger>
              <SimplePopoverContent className="rounded-lg border border-[#1e1e2e] bg-[#111118] shadow-xl">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={hu}
                />
              </SimplePopoverContent>
            </SimplePopover>
          </div>

          {/* Description */}
          <div>
            <Label className="text-[#64748b] text-xs mb-1.5 block">Leírás *</Label>
            <Input
              placeholder="pl. Aldi bevásárlás"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]"
            />
          </div>

          {/* Note */}
          <div>
            <Label className="text-[#64748b] text-xs mb-1.5 block">Megjegyzés (opcionális)</Label>
            <Input
              placeholder="Opcionális megjegyzés"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]"
            />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 accent-slate-400"
            />
            <Label htmlFor="recurring" className="text-sm text-[#f1f5f9] cursor-pointer">
              Ismétlődő tétel
            </Label>
          </div>

          {isRecurring && (
            <div>
              <Label className="text-[#64748b] text-xs mb-1.5 block">Ismétlődés</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as Frequency)}
              >
                <SelectTrigger className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  {Object.values(Frequency).map((f) => (
                    <SelectItem key={f} value={f} className="text-[#f1f5f9]">
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e]"
            >
              Mégse
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white"
            >
              {transaction ? 'Mentés' : 'Hozzáadás'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
