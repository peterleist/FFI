'use client'

import { useState, useMemo } from 'react'
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { Plus, ArrowUpRight, Pencil, Trash2, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/lib/store'
import { CategoryType, TransactionStatus, type RecurringItem } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { FREQUENCY_LABELS, monthlyAmount, isActiveInMonth } from '@/lib/recurring'
import { RecurringDialog } from '@/components/recurring/recurring-dialog'
import { toast } from 'sonner'

export function IncomePanel({ year, month }: { year: number; month: number }) {
  const { recurringItems, transactions, categories, deleteRecurringItem } = useAppStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringItem | null>(null)

  // Recurring income sources active in the selected month
  const incomeItems = useMemo(
    () =>
      recurringItems
        .filter((r) => r.type === CategoryType.INCOME && isActiveInMonth(r, year, month))
        .sort((a, b) => monthlyAmount(b) - monthlyAmount(a)),
    [recurringItems, year, month]
  )

  const expected = incomeItems.reduce((s, r) => s + monthlyAmount(r), 0)

  // Actual income received in the selected month
  const actual = useMemo(() => {
    const start = startOfMonth(new Date(year, month))
    const end = endOfMonth(new Date(year, month))
    return transactions
      .filter(
        (t) =>
          t.amount > 0 &&
          t.status === TransactionStatus.CONFIRMED &&
          isWithinInterval(new Date(t.date), { start, end })
      )
      .reduce((s, t) => s + t.amount, 0)
  }, [transactions, year, month])

  const diff = actual - expected
  const pct = expected > 0 ? (actual / expected) * 100 : 0

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'
  const catIcon = (id: string | null) => categories.find((c) => c.id === id)?.icon ?? ''

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (i: RecurringItem) => { setEditing(i); setDialogOpen(true) }
  const handleDelete = (id: string) => {
    deleteRecurringItem(id)
    toast.success('Bevételi tétel törölve')
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Várható bevétel</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(expected)}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Tényleges bevétel</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(actual)}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Eltérés</p>
          <p className={`text-xl font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
          </p>
        </CardContent></Card>
      </div>

      {/* Progress: received vs expected */}
      {expected > 0 && (
        <Card className="bg-card border-border"><CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Beérkezett a várható bevételből</span>
            <span className="text-foreground font-medium">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(pct, 100)} className="h-2 bg-muted" />
        </CardContent></Card>
      )}

      {/* Recurring income list */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base text-foreground">Rendszeres bevételi források</CardTitle>
          <Button onClick={openNew} size="sm" className="bg-primary hover:bg-primary/90 text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Új bevételi tétel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {incomeItems.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nincs rögzített rendszeres bevétel erre a hónapra
              </p>
              <Button onClick={openNew} size="sm" className="bg-primary hover:bg-primary/90 text-white gap-1.5 mt-1">
                <Plus className="w-3.5 h-3.5" /> Bevételi tétel hozzáadása
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {incomeItems.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
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
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">~{formatCurrency(monthlyAmount(r))}</p>
                    <p className="text-[10px] text-muted-foreground">/ hó</p>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecurringDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        defaultType={CategoryType.INCOME}
      />
    </div>
  )
}
