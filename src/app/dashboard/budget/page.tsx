'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Pencil, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { CategoryType, TransactionStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i)
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    label: format(d, 'yyyy. MMMM', { locale: hu }),
    value: `${d.getFullYear()}-${d.getMonth()}`,
  }
})

const SHORT_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sze', 'Okt', 'Nov', 'Dec']

function getHeatColor(pct: number): string {
  if (pct === 0) return 'bg-muted text-muted-foreground'
  if (pct < 50) return 'bg-green-500/10 text-green-400'
  if (pct < 80) return 'bg-amber-500/10 text-amber-400'
  if (pct < 100) return 'bg-orange-500/10 text-orange-400'
  return 'bg-red-500/20 text-red-400'
}

export default function BudgetPage() {
  const { transactions, categories, updateCategory } = useAppStore()

  const now = new Date()
  const [selectedValue, setSelectedValue] = useState(`${now.getFullYear()}-${now.getMonth()}`)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editBudget, setEditBudget] = useState('')

  const selected = MONTH_OPTIONS.find((m) => m.value === selectedValue) ?? MONTH_OPTIONS[0]

  const expenseCategories = categories.filter(
    (c) => c.type === CategoryType.EXPENSE && c.monthlyBudget !== null
  )

  const getSpentForCategory = (categoryId: string, year: number, month: number) => {
    const start = startOfMonth(new Date(year, month))
    const end = endOfMonth(new Date(year, month))
    return Math.abs(
      transactions
        .filter(
          (t) =>
            t.categoryId === categoryId &&
            t.amount < 0 &&
            t.status === TransactionStatus.CONFIRMED &&
            isWithinInterval(new Date(t.date), { start, end })
        )
        .reduce((s, t) => s + t.amount, 0)
    )
  }

  const budgetSummary = useMemo(() => {
    const rows = expenseCategories.map((cat) => {
      const spent = getSpentForCategory(cat.id, selected.year, selected.month)
      const budget = cat.monthlyBudget ?? 0
      const remaining = budget - spent
      const pct = budget > 0 ? (spent / budget) * 100 : 0
      return { cat, spent, budget, remaining, pct }
    })
    const totalBudgeted = rows.reduce((s, r) => s + r.budget, 0)
    const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
    return { rows, totalBudgeted, totalSpent, difference: totalBudgeted - totalSpent }
  }, [expenseCategories, transactions, selected])

  const startEdit = (catId: string, currentBudget: number | null) => {
    setEditingCategoryId(catId)
    setEditBudget(String(currentBudget ?? 0))
  }

  const saveEdit = (catId: string) => {
    const val = parseInt(editBudget)
    if (isNaN(val) || val < 0) {
      toast.error('Érvénytelen összeg')
      return
    }
    updateCategory(catId, { monthlyBudget: val })
    setEditingCategoryId(null)
    toast.success('Költségvetés frissítve')
  }

  // Annual grid: last 12 months × categories
  const annualMonths = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { year: d.getFullYear(), month: d.getMonth(), label: SHORT_MONTHS[d.getMonth()] }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Költségvetés</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Havi kiadási tervek nyomon követése</p>
        </div>
        <Select value={selectedValue} onValueChange={setSelectedValue}>
          <SelectTrigger className="w-48 bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {MONTH_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-foreground">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Havi nézet
          </TabsTrigger>
          <TabsTrigger value="annual" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            Éves nézet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Tervezett kiadás</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(budgetSummary.totalBudgeted)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Tényleges kiadás</p>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(budgetSummary.totalSpent)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Különbség</p>
                <p
                  className={`text-xl font-bold ${
                    budgetSummary.difference >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {budgetSummary.difference >= 0 ? '+' : ''}
                  {formatCurrency(budgetSummary.difference)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Category rows */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Kategóriák</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {budgetSummary.rows.map(({ cat, spent, budget, remaining, pct }) => (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {cat.name}
                      </span>
                      {pct > 100 && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 border">
                          Túllépve
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {editingCategoryId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editBudget}
                            onChange={(e) => setEditBudget(e.target.value)}
                            className="w-28 h-7 bg-muted border-border text-foreground text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-400 hover:bg-green-500/10"
                            onClick={() => saveEdit(cat.id)}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-muted"
                            onClick={() => setEditingCategoryId(null)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span
                            className={`text-sm font-semibold ${
                              pct > 100
                                ? 'text-red-400'
                                : pct > 80
                                ? 'text-amber-400'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatCurrency(spent)} / {formatCurrency(budget)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => startEdit(cat.id, cat.monthlyBudget)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={Math.min(pct, 100)}
                      className="flex-1 h-2 bg-muted"
                    />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {remaining >= 0
                      ? `Maradék: ${formatCurrency(remaining)}`
                      : `Túllépés: ${formatCurrency(Math.abs(remaining))}`}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual" className="mt-4">
          <Card className="bg-card border-border overflow-x-auto">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Éves áttekintő (hőtérkép)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-muted-foreground font-medium py-2 pr-4 whitespace-nowrap">
                      Kategória
                    </th>
                    {annualMonths.map((m) => (
                      <th key={m.label} className="text-center text-muted-foreground font-medium py-2 px-1 min-w-12">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenseCategories.map((cat) => (
                    <tr key={cat.id} className="border-t border-border">
                      <td className="py-2 pr-4 text-foreground whitespace-nowrap">
                        {cat.icon} {cat.name}
                      </td>
                      {annualMonths.map((m) => {
                        const spent = getSpentForCategory(cat.id, m.year, m.month)
                        const budget = cat.monthlyBudget ?? 0
                        const pct = budget > 0 ? (spent / budget) * 100 : 0
                        return (
                          <td key={`${m.year}-${m.month}`} className="px-1 py-1.5">
                            <div
                              className={`text-center text-xs rounded px-1 py-1 ${getHeatColor(pct)}`}
                              title={`${formatCurrency(spent)} / ${formatCurrency(budget)}`}
                            >
                              {pct > 0 ? `${pct.toFixed(0)}%` : '–'}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
