'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/lib/store'
import { AccountType, CategoryType, TransactionStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { hu } from 'date-fns/locale'
import { MarketWidget } from '@/components/market-widget'

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.BANK]: 'Bankszámla',
  [AccountType.CASH]: 'Készpénz',
  [AccountType.TBSZ]: 'TBSZ',
  [AccountType.ALLAMPAPIR]: 'Állampapír',
  [AccountType.BROKER]: 'Bróker',
}

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  [AccountType.BANK]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [AccountType.CASH]: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  [AccountType.TBSZ]: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  [AccountType.ALLAMPAPIR]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [AccountType.BROKER]: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent,
}: {
  title: string
  value: string
  icon: React.ElementType
  trend?: number
  trendLabel?: string
  accent?: 'green' | 'red' | 'blue' | 'default'
}) {
  const isPositive = trend !== undefined && trend >= 0
  const valueColors = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    default: 'text-foreground',
  }
  const iconBg = {
    green: 'bg-emerald-500/20',
    red: 'bg-red-500/20',
    blue: 'bg-blue-500/20',
    default: 'bg-secondary',
  }
  const iconColor = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    default: 'text-primary',
  }
  const a = accent ?? 'default'

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1.5 ${valueColors[a]}`}>{value}</p>
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>{trendLabel}</span>
              </div>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl ${iconBg[a]} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor[a]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
        <p className="text-muted-foreground text-xs mb-2 font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const { accounts, transactions, categories, fireGoalAmount } = useAppStore()

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)

  const totalNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0)

  const thisMonthTxs = transactions.filter(
    (t) =>
      t.status === TransactionStatus.CONFIRMED &&
      isWithinInterval(new Date(t.date), { start: thisMonthStart, end: thisMonthEnd })
  )

  const thisMonthIncome = thisMonthTxs
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const thisMonthExpense = Math.abs(
    thisMonthTxs.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
  )

  const fireGoal = fireGoalAmount
  const fireProgress = Math.min((totalNetWorth / fireGoal) * 100, 100)

  const cashflowData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i)
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const monthTxs = transactions.filter(
        (t) =>
          t.status === TransactionStatus.CONFIRMED &&
          isWithinInterval(new Date(t.date), { start, end })
      )
      const income = monthTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const expense = Math.abs(
        monthTxs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
      )
      return {
        month: format(month, 'MMM', { locale: hu }),
        Bevétel: income,
        Kiadás: expense,
      }
    })
  }, [transactions])

  const recentTxs = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const budgetItems = useMemo(() => {
    const expenseCategories = categories.filter(
      (c) => c.type === CategoryType.EXPENSE && c.monthlyBudget
    )
    return expenseCategories
      .map((cat) => {
        const spent = Math.abs(
          thisMonthTxs
            .filter((t) => t.categoryId === cat.id && t.amount < 0)
            .reduce((s, t) => s + t.amount, 0)
        )
        const budget = cat.monthlyBudget ?? 0
        const pct = budget > 0 ? (spent / budget) * 100 : 0
        return { cat, spent, budget, pct }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)
  }, [categories, thisMonthTxs])

  const getCategoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Egyéb'

  const getCategoryIcon = (id: string | null) =>
    categories.find((c) => c.id === id)?.icon ?? '💳'

  return (
    <div className="space-y-5">
      {/* Hero balance card */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 45%, #1D4ED8 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-card/5" />
        <div className="absolute -bottom-16 -right-4 w-56 h-56 rounded-full bg-card/5" />

        <div className="relative">
          <p className="text-sm text-white/70 font-medium">Teljes vagyon</p>
          <div className="flex items-end justify-between mt-1">
            <div>
              <p className="text-4xl font-bold tracking-tight">
                {formatCurrency(totalNetWorth)}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-300" />
                <span className="text-sm text-emerald-300 font-medium">+2.4%</span>
                <span className="text-sm text-white/50">előző hónaphoz képest</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50 mb-1">FIRE haladás</p>
              <p className="text-2xl font-bold text-white/90">{fireProgress.toFixed(1)}%</p>
              <div className="w-24 h-1.5 bg-card/20 rounded-full mt-1.5 ml-auto">
                <div
                  className="h-full bg-gradient-to-r from-blue-300 to-white rounded-full"
                  style={{ width: `${fireProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Mini stat row */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-card/10 rounded-xl p-3">
              <p className="text-xs text-white/60">Havi bevétel</p>
              <p className="text-base font-bold text-emerald-300 mt-0.5">
                +{formatCurrency(thisMonthIncome)}
              </p>
            </div>
            <div className="bg-card/10 rounded-xl p-3">
              <p className="text-xs text-white/60">Havi kiadás</p>
              <p className="text-base font-bold text-red-300 mt-0.5">
                -{formatCurrency(thisMonthExpense)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          title="Teljes Vagyon"
          value={formatCurrency(totalNetWorth)}
          icon={Wallet}
          trend={2.4}
          trendLabel="+2.4%"
          accent="blue"
        />
        <StatCard
          title="Havi Kiadás"
          value={formatCurrency(thisMonthExpense)}
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          title="Havi Bevétel"
          value={formatCurrency(thisMonthIncome)}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          title="FIRE Haladás"
          value={`${fireProgress.toFixed(1)}%`}
          icon={Flame}
          trend={0.1}
          trendLabel="+0.1%"
          accent="blue"
        />
      </div>

      {/* Market chart widget */}
      <MarketWidget />

      {/* Middle row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Cashflow chart */}
        <Card className="xl:col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Havi Pénzforgalom
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cashflowData} barGap={4}>
                <CartesianGrid vertical={false} stroke="#27282E" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280', paddingTop: 8 }} />
                <Bar dataKey="Bevétel" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Kiadás" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Account balances */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">Számlák</CardTitle>
            <button className="text-xs text-primary font-medium hover:text-primary/80">
              Összes
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-background transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border mt-0.5 ${ACCOUNT_TYPE_COLORS[acc.type]}`}
                  >
                    {ACCOUNT_TYPE_LABELS[acc.type]}
                  </Badge>
                </div>
                <span className="text-sm font-bold text-foreground whitespace-nowrap">
                  {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="text-sm text-muted-foreground font-medium">Összesen</span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(totalNetWorth)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">
              Legutóbbi tranzakciók
            </CardTitle>
            <button className="text-xs text-primary font-medium hover:text-primary/80 flex items-center gap-0.5">
              Összes <ChevronRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center flex-shrink-0 text-lg">
                  {getCategoryIcon(tx.categoryId)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {tx.description}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {getCategoryName(tx.categoryId)}
                    </span>
                    <span className="text-xs text-border">·</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(tx.date), 'MMM d.', { locale: hu })}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm font-bold whitespace-nowrap ${
                    tx.amount >= 0 ? 'text-emerald-400' : 'text-foreground'
                  }`}
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Budget overview */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Költségvetés — {format(now, 'MMMM', { locale: hu })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetItems.map(({ cat, spent, budget, pct }) => (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-semibold">
                    {cat.icon} {cat.name}
                  </span>
                  <span
                    className={`font-semibold text-xs ${
                      pct > 100
                        ? 'text-red-500'
                        : pct > 80
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {formatCurrency(spent)} / {formatCurrency(budget)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background:
                        pct > 100
                          ? '#EF4444'
                          : pct > 80
                          ? '#F59E0B'
                          : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
