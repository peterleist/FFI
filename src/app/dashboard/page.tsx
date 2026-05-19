'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Flame, ArrowUpRight, ArrowDownRight,
  ChevronRight, RefreshCw, Plus, Landmark, Wallet, LineChart, Shield,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { AccountType, CategoryType, TransactionStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useAccountValues } from '@/lib/account-value'
import { recurringAsTransactions } from '@/lib/recurring'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { hu } from 'date-fns/locale'
import { MarketWidget } from '@/components/market-widget'
import { AreaChart, BarChart, Sparkline } from '@/components/pefi/charts'

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} Mrd Ft`
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M Ft`
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}e Ft`
  return `${s}${Math.round(a)} Ft`
}

const ACCOUNT_ICON: Record<AccountType, typeof Wallet> = {
  [AccountType.BANK]: Landmark,
  [AccountType.CASH]: Wallet,
  [AccountType.TBSZ]: LineChart,
  [AccountType.BROKER]: LineChart,
  [AccountType.ALLAMPAPIR]: Shield,
}
const ACCOUNT_COLOR: Record<AccountType, string> = {
  [AccountType.BANK]: '#3B82F6',
  [AccountType.CASH]: '#34D399',
  [AccountType.TBSZ]: '#A78BFA',
  [AccountType.BROKER]: '#22D3EE',
  [AccountType.ALLAMPAPIR]: '#FBBF24',
}
const ACCOUNT_LABEL: Record<AccountType, string> = {
  [AccountType.BANK]: 'Bankszámla',
  [AccountType.CASH]: 'Készpénz',
  [AccountType.TBSZ]: 'TBSZ',
  [AccountType.BROKER]: 'Bróker',
  [AccountType.ALLAMPAPIR]: 'Állampapír',
}

function StatCard({
  label, value, delta, icon: Icon, spark, sparkColor,
}: {
  label: string; value: string; delta?: number
  icon: typeof TrendingUp; spark: number[]; sparkColor: string
}) {
  return (
    <div className="pf-card stat">
      <div className="lbl"><Icon size={12} strokeWidth={1.8} /> {label}</div>
      <div className="val num">{value}</div>
      <div className="sub">
        {delta != null && (
          <span className={`delta ${delta >= 0 ? 'pos' : 'neg'}`}>
            {delta >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(delta).toFixed(1)}% vs. előző hó
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Sparkline data={spark} color={sparkColor} width={70} height={26} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const {
    accounts, transactions, categories, fireGoalAmount, investmentPositions,
    fireAccountIds, recurringItems, trackingStartMonth,
  } = useAppStore()

  const now = new Date()
  const { values: accountValues, total: totalNetWorth } = useAccountValues(accounts, investmentPositions)

  const allTxs = useMemo(
    () => [...transactions, ...recurringAsTransactions(recurringItems, trackingStartMonth)],
    [transactions, recurringItems, trackingStartMonth]
  )

  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const thisMonthTxs = allTxs.filter(
    (t) => t.status === TransactionStatus.CONFIRMED &&
      isWithinInterval(new Date(t.date), { start: thisMonthStart, end: thisMonthEnd })
  )
  const monthIncome = thisMonthTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const monthExpense = Math.abs(thisMonthTxs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))

  const fireGoal = fireGoalAmount || 1
  const fireNetWorth = fireAccountIds === null
    ? totalNetWorth
    : accounts.filter((a) => fireAccountIds.includes(a.id))
        .reduce((s, a) => s + (accountValues[a.id] ?? a.balance), 0)
  const fireProgress = Math.min((fireNetWorth / fireGoal) * 100, 100)

  // 6-month cash flow
  const cashflow = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i)
      const start = startOfMonth(month), end = endOfMonth(month)
      const txs = allTxs.filter(
        (t) => t.status === TransactionStatus.CONFIRMED &&
          isWithinInterval(new Date(t.date), { start, end })
      )
      const income = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const expense = Math.abs(txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))
      return { m: format(month, 'LLL', { locale: hu }), income, expense }
    })
  }, [allTxs])

  // Net-worth trend derived from cash flow (real data, walked back from today)
  const netWorthSeries = useMemo(() => {
    const nets = cashflow.map((c) => c.income - c.expense)
    const totalNet = nets.reduce((s, n) => s + n, 0)
    let v = totalNetWorth - totalNet
    return nets.map((n) => (v += n))
  }, [cashflow, totalNetWorth])

  const monthlyChange = netWorthSeries.length > 1 && netWorthSeries[netWorthSeries.length - 2]
    ? (netWorthSeries[netWorthSeries.length - 1] / netWorthSeries[netWorthSeries.length - 2] - 1) * 100
    : 0

  const recentTxs = [...allTxs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7)

  const budgetItems = useMemo(() => {
    return categories
      .filter((c) => c.type === CategoryType.EXPENSE && c.monthlyBudget)
      .map((cat) => {
        const spent = Math.abs(
          thisMonthTxs.filter((t) => t.categoryId === cat.id && t.amount < 0).reduce((s, t) => s + t.amount, 0)
        )
        const budget = cat.monthlyBudget ?? 0
        return { cat, spent, budget, pct: budget > 0 ? spent / budget : 0 }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)
  }, [categories, thisMonthTxs])

  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const acctOf = (id: string) => accounts.find((a) => a.id === id)

  // Decorative sparklines (deterministic)
  const mkSpark = (seed: number, drift: number) => {
    let s = seed
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    let v = 100
    return Array.from({ length: 14 }, () => (v = v * (1 + drift + (r() - 0.5) * 0.06)))
  }

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="crumb">Irányítópult</div>
          <h1>Áttekintő</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pf-badge"><span className="live-dot" />Élő adatok</span>
          <button className="pf-btn sm" type="button"><RefreshCw size={12} />Frissítés</button>
        </div>
      </div>

      {/* Hero */}
      <div className="pf-card hero-grad" style={{ padding: 26, overflow: 'hidden' }}>
        <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ minWidth: 240 }}>
            <div className="lbl" style={{ color: 'var(--pf-muted)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Teljes vagyon · HUF
            </div>
            <div className="num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-.03em', marginTop: 6 }}>
              {formatCurrency(totalNetWorth)}
            </div>
            <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <span className={`pf-badge ${monthlyChange >= 0 ? 'gain' : 'loss'}`}>
                {monthlyChange >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(monthlyChange).toFixed(2)}% / hó
              </span>
              <span className="pf-muted" style={{ fontSize: 11.5 }}>
                {format(now, 'yyyy. MMM d.', { locale: hu })}
              </span>
            </div>
          </div>
          <div style={{ minWidth: 240, textAlign: 'right' }}>
            <div className="lbl" style={{ color: 'var(--pf-muted)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', justifyContent: 'flex-end' }}>
              FIRE haladás
            </div>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>
              {fireProgress.toFixed(1)}%
            </div>
            <div className="pf-progress" style={{ marginTop: 8, width: 280, marginLeft: 'auto' }}>
              <div className="bar" style={{ width: `${fireProgress}%` }} />
            </div>
            <div className="num pf-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Cél {fmtCompact(fireGoal)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, height: 180 }}>
          <AreaChart
            series={[{ label: 'Vagyon', color: 'var(--pf-accent)', data: netWorthSeries }]}
            labels={cashflow.map((c) => c.m)}
            height={180} padBottom={22} padTop={8} padLeft={70}
            yFormat={(v) => fmtCompact(v)}
          />
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Stat row */}
      <div className="pf-grid grid-4">
        <StatCard label="Teljes vagyon" value={fmtCompact(totalNetWorth)} delta={monthlyChange}
          icon={TrendingUp} spark={mkSpark(1, 0.012)} sparkColor="var(--pf-gain)" />
        <StatCard label="Havi bevétel" value={fmtCompact(monthIncome)} delta={8.1}
          icon={ArrowDownRight} spark={mkSpark(2, 0.008)} sparkColor="var(--pf-gain)" />
        <StatCard label="Havi kiadás" value={fmtCompact(monthExpense)} delta={-12.6}
          icon={ArrowUpRight} spark={mkSpark(3, -0.005)} sparkColor="var(--c8)" />
        <StatCard label="FIRE haladás" value={`${fireProgress.toFixed(1)}%`} delta={1.8}
          icon={Flame} spark={mkSpark(4, 0.018)} sparkColor="var(--pf-accent)" />
      </div>

      <div style={{ height: 16 }} />

      {/* Market + cash flow */}
      <div className="pf-grid grid-12">
        <div className="span-8"><MarketWidget /></div>
        <div className="span-4">
          <div className="pf-card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <div>
                <h3 className="card-title">Havi pénzforgalom</h3>
                <div className="card-sub">Bevétel vs. kiadás, 6 hónap</div>
              </div>
            </div>
            <div className="row" style={{ gap: 10, marginBottom: 4 }}>
              <span className="pf-badge"><span className="dot" style={{ background: 'var(--pf-gain)' }} />Bevétel</span>
              <span className="pf-badge"><span className="dot" style={{ background: 'var(--c8)' }} />Kiadás</span>
            </div>
            <div style={{ height: 200 }}>
              <BarChart
                data={cashflow}
                keys={['income', 'expense']}
                colors={['#10B981', '#94A3B8']}
                labels={cashflow.map((c) => c.m)}
                yFormat={(v) => fmtCompact(v)}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Accounts + recent + budget */}
      <div className="pf-grid grid-12">
        {/* Accounts */}
        <div className="span-5">
          <div className="pf-card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title">Számlák</h3>
                <div className="card-sub">{accounts.length} számla · {fmtCompact(totalNetWorth)}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--pf-hairline)' }}>
              {accounts.map((a) => {
                const Ico = ACCOUNT_ICON[a.type]
                const color = ACCOUNT_COLOR[a.type]
                return (
                  <div key={a.id} style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12, alignItems: 'center',
                    padding: '10px 18px', borderBottom: '1px solid var(--pf-hairline)',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
                      background: `color-mix(in oklab, ${color} 14%, var(--pf-card-2))`, color,
                      border: '1px solid var(--pf-hairline)',
                    }}>
                      <Ico size={14} strokeWidth={1.7} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</div>
                      <div className="pf-muted" style={{ fontSize: 11 }}>{ACCOUNT_LABEL[a.type]} · {a.currency}</div>
                    </div>
                    <div className="num" style={{ fontSize: 12.5, textAlign: 'right' }}>
                      {fmtCompact(accountValues[a.id] ?? a.balance)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="span-4">
          <div className="pf-card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title">Legutóbbi tranzakciók</h3>
                <div className="card-sub">Friss tételek</div>
              </div>
              <Link href="/dashboard/transactions" className="pf-btn sm ghost">
                Összes<ChevronRight size={12} />
              </Link>
            </div>
            <table className="pf-table">
              <tbody>
                {recentTxs.length === 0 ? (
                  <tr><td className="pf-muted" style={{ padding: '20px', textAlign: 'center' }}>Nincs tranzakció</td></tr>
                ) : recentTxs.map((t) => {
                  const cat = catOf(t.categoryId)
                  const acct = acctOf(t.accountId)
                  const color = cat?.color || '#94A3B8'
                  return (
                    <tr key={t.id}>
                      <td style={{ width: 40 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center',
                          background: `color-mix(in oklab, ${color} 14%, var(--pf-card-2))`, color,
                          border: '1px solid var(--pf-hairline)', fontSize: 13,
                        }}>{cat?.icon || '•'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>{t.description}</div>
                        <div className="pf-muted" style={{ fontSize: 10.5, marginTop: 1 }}>
                          {cat?.name ?? 'Egyéb'}{acct ? ` · ${acct.name}` : ''}
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontSize: 12.5, color: t.amount >= 0 ? 'var(--pf-gain)' : 'var(--pf-text)' }}>
                        {t.amount >= 0 ? '+' : '−'}{fmtCompact(Math.abs(t.amount))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Budget overview */}
        <div className="span-3">
          <div className="pf-card">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="card-title">Költségvetés</h3>
                <div className="card-sub">{format(now, 'yyyy. MMMM', { locale: hu })}</div>
              </div>
            </div>
            {budgetItems.length === 0 ? (
              <div className="pf-muted" style={{ fontSize: 12, padding: '8px 0' }}>
                Nincs beállított keret. <Link href="/dashboard/budget" style={{ color: 'var(--pf-accent-2)' }}>Tervezz egyet →</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {budgetItems.map(({ cat, spent, budget, pct }) => {
                  const over = pct > 1
                  return (
                    <div key={cat.id}>
                      <div className="row between" style={{ marginBottom: 4 }}>
                        <span className="row" style={{ gap: 8, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color || '#94A3B8' }} />
                          {cat.name}
                          {over && <span className="pf-badge loss" style={{ padding: '1px 5px', fontSize: 9.5 }}>Túllépve</span>}
                        </span>
                        <span className="num" style={{ fontSize: 11, color: over ? 'var(--pf-loss)' : 'var(--pf-text-2)' }}>
                          {fmtCompact(spent)} / {fmtCompact(budget)}
                        </span>
                      </div>
                      <div className={`pf-progress ${over ? 'over' : pct > 0.85 ? 'warn' : ''}`}>
                        <div className="bar" style={{ width: `${Math.min(100, pct * 100)}%`, background: over ? '' : (cat.color || undefined) }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
