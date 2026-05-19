'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Plus, Pencil, Trash2, Repeat, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { CategoryType, type RecurringItem } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { FREQUENCY_LABELS, monthlyAmount } from '@/lib/recurring'
import { RecurringDialog } from './recurring-dialog'
import { toast } from 'sonner'

export function RecurringPanel() {
  const { recurringItems, categories, deleteRecurringItem } = useAppStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringItem | null>(null)

  const sorted = useMemo(
    () =>
      [...recurringItems].sort((a, b) =>
        a.type === b.type
          ? b.amount - a.amount
          : a.type === CategoryType.INCOME ? -1 : 1
      ),
    [recurringItems]
  )

  const monthlyIncome = recurringItems
    .filter((r) => r.type === CategoryType.INCOME)
    .reduce((s, r) => s + monthlyAmount(r), 0)
  const monthlyExpense = recurringItems
    .filter((r) => r.type === CategoryType.EXPENSE)
    .reduce((s, r) => s + monthlyAmount(r), 0)
  const monthlyNet = monthlyIncome - monthlyExpense

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'
  const catIcon = (id: string | null) => categories.find((c) => c.id === id)?.icon ?? ''

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (item: RecurringItem) => { setEditing(item); setDialogOpen(true) }
  const handleDelete = (id: string) => {
    deleteRecurringItem(id)
    toast.success('Ismétlődő tétel törölve')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {recurringItems.length} ismétlődő tétel — fizetés, bérleti díj, előfizetések
        </p>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Plus className="w-4 h-4" /> Új ismétlődő tétel
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Havi rendszeres bevétel</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(monthlyIncome)}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Havi rendszeres kiadás</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(monthlyExpense)}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Havi egyenleg</p>
          <p className={`text-xl font-bold ${monthlyNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {monthlyNet >= 0 ? '+' : ''}{formatCurrency(monthlyNet)}
          </p>
        </CardContent></Card>
      </div>

      {/* List */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <Repeat className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Még nincs ismétlődő tétel</p>
              <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white gap-2 mt-1" size="sm">
                <Plus className="w-4 h-4" /> Első tétel hozzáadása
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sorted.map((r) => {
                const isIncome = r.type === CategoryType.INCOME
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    }`}>
                      {isIncome
                        ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-0">
                          {FREQUENCY_LABELS[r.frequency]}
                        </Badge>
                        {r.categoryId && (
                          <span className="text-[11px] text-muted-foreground">
                            {catIcon(r.categoryId)} {catName(r.categoryId)}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground/70">
                          {format(new Date(r.startDate), 'yyyy. MMM', { locale: hu })}
                          {r.endDate ? ` – ${format(new Date(r.endDate), 'yyyy. MMM', { locale: hu })}` : ' –'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isIncome ? '+' : '−'}{formatCurrency(r.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ~{formatCurrency(monthlyAmount(r))} / hó
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RecurringDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} />
    </div>
  )
}
