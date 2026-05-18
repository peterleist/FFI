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
import { TrendingUp, TrendingDown, Wallet, Flame, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/lib/store'
import { AccountType, CategoryType, TransactionStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { hu } from 'date-fns/locale'

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.BANK]: 'Bankszámla',
  [AccountType.CASH]: 'Készpénz',
  [AccountType.TBSZ]: 'TBSZ',
  [AccountType.ALLAMPAPIR]: 'Állampapír',
  [AccountType.BROKER]: 'Bróker',
}

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  [AccountType.BANK]: 'bg-blue-500/20 text-slate-400 border-blue-500/30',
  [AccountType.CASH]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [AccountType.TBSZ]: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  [AccountType.ALLAMPAPIR]: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  [AccountType.BROKER]: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  valueColor,
}: {
  title: string
  value: string
  icon: React.ElementType
  trend?: number
  trendLabel?: string
  valueColor?: string
}) {
  const isPositive = trend !== undefined && trend >= 0
  return (
    <Card className="bg-[#111118] border-[#1e1e2e]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[#64748b] font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${valueColor || 'text-[#f1f5f9]'}`}>
              {value}
            </p>
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 mt-1.5 text-xs ${
                  isPositive ? 'text-green-400' : 'text-red-400'
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
          <div className="w-10 h-10 rounded-lg bg-slate-400/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-slate-400" />
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
      <div className="bg-[#1e1e2e] border border-[#2e2e3e] rounded-lg p-3 shadow-xl">
        <p className="text-[#64748b] text-xs mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
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

  // Total net worth
  const totalNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0)

  // This month transactions
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

  // FIRE progress
  const fireGoal = fireGoalAmount
  const fireProgress = Math.min((totalNetWorth / fireGoal) * 100, 100)

  // Last 6 months cashflow data
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

  // Recent transactions (last 5)
  const recentTxs = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  // Budget overview (top 5 expense categories with budget)
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

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Áttekintő</h1>
        <p className="text-[#64748b] text-sm mt-0.5">
          {format(now, 'yyyy. MMMM', { locale: hu })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Teljes Vagyon"
          value={formatCurrency(totalNetWorth)}
          icon={Wallet}
          trend={2.4}
          trendLabel="előző hónaphoz képest"
        />
        <StatCard
          title="Havi Kiadás"
          value={formatCurrency(thisMonthExpense)}
          icon={TrendingDown}
          valueColor="text-red-400"
        />
        <StatCard
          title="Havi Bevétel"
          value={formatCurrency(thisMonthIncome)}
          icon={TrendingUp}
          valueColor="text-green-400"
        />
        <StatCard
          title="FIRE Haladás"
          value={`${fireProgress.toFixed(1)}%`}
          icon={Flame}
          trendLabel={`${formatCurrency(totalNetWorth)} / ${formatCurrency(fireGoal)}`}
          trend={0.1}
          valueColor="text-slate-400"
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Cashflow chart */}
        <Card className="xl:col-span-2 bg-[#111118] border-[#1e1e2e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#f1f5f9]">
              Havi Pénzforgalom
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cashflowData} barGap={4}>
                <CartesianGrid vertical={false} stroke="#1e1e2e" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 8 }}
                />
                <Bar dataKey="Bevétel" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Kiadás" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Account balances */}
        <Card className="bg-[#111118] border-[#1e1e2e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#f1f5f9]">
              Számlák
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f1f5f9] truncate">{acc.name}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border ${ACCOUNT_TYPE_COLORS[acc.type]}`}
                  >
                    {ACCOUNT_TYPE_LABELS[acc.type]}
                  </Badge>
                </div>
                <span className="text-sm font-semibold text-[#f1f5f9] whitespace-nowrap">
                  {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
            <div className="border-t border-[#1e1e2e] pt-3 flex justify-between">
              <span className="text-sm text-[#64748b]">Összesen</span>
              <span className="text-sm font-bold text-slate-400">
                {formatCurrency(totalNetWorth)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <Card className="bg-[#111118] border-[#1e1e2e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#f1f5f9]">
              Legutóbbi Tranzakciók
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-[#1e1e2e]">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f1f5f9] truncate">
                    {tx.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#64748b]">
                      {format(new Date(tx.date), 'MMM d.', { locale: hu })}
                    </span>
                    <span className="text-xs text-[#64748b]">·</span>
                    <span className="text-xs text-[#64748b] truncate">
                      {getCategoryName(tx.categoryId)}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
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
        <Card className="bg-[#111118] border-[#1e1e2e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#f1f5f9]">
              Költségvetés — {format(now, 'MMMM', { locale: hu })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetItems.map(({ cat, spent, budget, pct }) => (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#f1f5f9] font-medium">
                    {cat.icon} {cat.name}
                  </span>
                  <span
                    className={`font-semibold text-xs ${
                      pct > 100
                        ? 'text-red-400'
                        : pct > 80
                        ? 'text-amber-400'
                        : 'text-[#64748b]'
                    }`}
                  >
                    {formatCurrency(spent)} / {formatCurrency(budget)}
                  </span>
                </div>
                <Progress
                  value={Math.min(pct, 100)}
                  className="h-1.5 bg-[#1e1e2e]"
                  style={
                    {
                      '--progress-color':
                        pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e',
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
