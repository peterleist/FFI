'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Pencil, Check, X, Plus, Tag } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { CategoryType, TransactionStatus } from '@/lib/types'
import { recurringAsTransactions } from '@/lib/recurring'
import { IncomePanel } from '@/components/budget/income-panel'
import { toast } from 'sonner'

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} Mrd Ft`
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M Ft`
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}e Ft`
  return `${s}${Math.round(a)} Ft`
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i)
  return {
    year: d.getFullYear(), month: d.getMonth(),
    label: format(d, 'yyyy. MMMM', { locale: hu }),
    value: `${d.getFullYear()}-${d.getMonth()}`,
  }
})
const SHORT_MONTHS = ['J', 'F', 'M', 'Á', 'M', 'J', 'J', 'A', 'Sz', 'O', 'N', 'D']

export default function BudgetPage() {
  const { transactions, categories, updateCategory, recurringItems, trackingStartMonth } = useAppStore()
  const allTxs = useMemo(
    () => [...transactions, ...recurringAsTransactions(recurringItems, trackingStartMonth)],
    [transactions, recurringItems, trackingStartMonth]
  )

  const [tab, setTab] = useState<'monthly' | 'annual' | 'income'>('monthly')
  const [selectedValue, setSelectedValue] = useState(`${new Date().getFullYear()}-${new Date().getMonth()}`)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBudget, setEditBudget] = useState('')

  const selected = MONTH_OPTIONS.find((m) => m.value === selectedValue) ?? MONTH_OPTIONS[0]
  const expenseCategories = categories.filter((c) => c.type === CategoryType.EXPENSE)

  const spentFor = (catId: string, year: number, month: number) => {
    const start = startOfMonth(new Date(year, month))
    const end = endOfMonth(new Date(year, month))
    return Math.abs(
      allTxs
        .filter((t) => t.categoryId === catId && t.amount < 0 && t.status === TransactionStatus.CONFIRMED &&
          isWithinInterval(new Date(t.date), { start, end }))
        .reduce((s, t) => s + t.amount, 0)
    )
  }

  const rows = useMemo(() => {
    return expenseCategories
      .map((cat) => {
        const hasBudget = cat.monthlyBudget !== null
        const spent = spentFor(cat.id, selected.year, selected.month)
        const budget = cat.monthlyBudget ?? 0
        return { cat, hasBudget, spent, budget, pct: budget > 0 ? spent / budget : 0 }
      })
      .sort((a, b) => Number(b.hasBudget) - Number(a.hasBudget) || b.pct - a.pct)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseCategories, allTxs, selected])

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const totalPct = totalBudget > 0 ? totalSpent / totalBudget : 0

  const startEdit = (id: string, current: number | null) => {
    setEditingId(id)
    setEditBudget(String(current ?? 0))
  }
  const saveEdit = (id: string) => {
    const v = parseInt(editBudget)
    if (isNaN(v) || v < 0) { toast.error('Érvénytelen összeg'); return }
    updateCategory(id, { monthlyBudget: v })
    setEditingId(null)
    toast.success('Költségvetés frissítve')
  }

  const annualMonths = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i)
    return { year: d.getFullYear(), month: d.getMonth(), label: SHORT_MONTHS[d.getMonth()] }
  })

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="crumb">Tervezés és követés</div>
          <h1>Költségvetés</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {tab === 'monthly' && (
            <select className="pf-btn sm" style={{ background: 'var(--pf-bg-elev)' }}
              value={selectedValue} onChange={(e) => setSelectedValue(e.target.value)}>
              {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
          <div className="pf-tabs">
            <span className={`tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>Havi</span>
            <span className={`tab ${tab === 'annual' ? 'active' : ''}`} onClick={() => setTab('annual')}>Éves</span>
            <span className={`tab ${tab === 'income' ? 'active' : ''}`} onClick={() => setTab('income')}>Várható bevétel</span>
          </div>
        </div>
      </div>

      {tab === 'monthly' && (
        <>
          {/* Hero */}
          <div className="pf-card hero-grad" style={{ padding: 22, marginBottom: 16 }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div className="lbl" style={{ color: 'var(--pf-muted)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  {selected.label} · havi keret
                </div>
                <div className="num" style={{ fontSize: 30, fontWeight: 600, marginTop: 4, letterSpacing: '-.02em' }}>
                  {fmtCompact(totalSpent)}{' '}
                  <span className="pf-muted" style={{ fontSize: 16, fontWeight: 400 }}>/ {fmtCompact(totalBudget)}</span>
                </div>
                <div className="row" style={{ gap: 10, marginTop: 8 }}>
                  <span className="pf-badge accent">{(totalPct * 100).toFixed(0)}% felhasználva</span>
                  <span className="pf-muted" style={{ fontSize: 11.5 }}>
                    {fmtCompact(Math.max(0, totalBudget - totalSpent))} maradék
                  </span>
                </div>
              </div>
              <div style={{ minWidth: 280, flex: '0 1 360px' }}>
                <div className={`pf-progress tall ${totalPct > 1 ? 'over' : totalPct > 0.85 ? 'warn' : ''}`} style={{ marginTop: 10 }}>
                  <div className="bar" style={{ width: `${Math.min(100, totalPct * 100)}%` }} />
                </div>
                <div className="row between" style={{ marginTop: 8 }}>
                  <span className="num pf-muted" style={{ fontSize: 10.5 }}>0</span>
                  <span className="num pf-muted" style={{ fontSize: 10.5 }}>{fmtCompact(totalBudget)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category cards */}
          <div className="pf-grid grid-3">
            {rows.map(({ cat, hasBudget, spent, budget, pct }) => {
              const over = pct > 1
              const editing = editingId === cat.id
              return (
                <div key={cat.id} className="pf-card" style={{ padding: 16 }}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <span className="row" style={{ gap: 10 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
                        background: `color-mix(in oklab, ${cat.color || '#94A3B8'} 14%, var(--pf-card-2))`,
                        color: cat.color || '#94A3B8', border: '1px solid var(--pf-hairline)', fontSize: 14,
                      }}>{cat.icon || <Tag size={13} />}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.name}</span>
                      {hasBudget && over && <span className="pf-badge loss" style={{ padding: '1px 6px' }}>Túllépve</span>}
                    </span>
                    {!editing && (
                      <button className="pf-btn sm ghost icon" type="button" onClick={() => startEdit(cat.id, cat.monthlyBudget)}>
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <div className="row" style={{ gap: 6 }}>
                      <input className="num" type="number" value={editBudget} autoFocus
                        onChange={(e) => setEditBudget(e.target.value)}
                        placeholder="Havi keret (Ft)"
                        style={{ flex: 1, background: 'var(--pf-bg-elev)', border: '1px solid var(--pf-border)', borderRadius: 8, padding: '6px 10px', color: 'var(--pf-text)', fontSize: 13 }} />
                      <button className="pf-btn sm icon" type="button" onClick={() => saveEdit(cat.id)} style={{ color: 'var(--pf-gain)' }}><Check size={13} /></button>
                      <button className="pf-btn sm icon ghost" type="button" onClick={() => setEditingId(null)}><X size={13} /></button>
                    </div>
                  ) : hasBudget ? (
                    <>
                      <div className="row between" style={{ marginBottom: 6, alignItems: 'baseline' }}>
                        <span className="num" style={{ fontSize: 18, fontWeight: 600, color: over ? 'var(--pf-loss)' : 'var(--pf-text)' }}>
                          {fmtCompact(spent)}
                        </span>
                        <span className="num pf-muted" style={{ fontSize: 11.5 }}>/ {fmtCompact(budget)}</span>
                      </div>
                      <div className={`pf-progress tall ${over ? 'over' : pct > 0.85 ? 'warn' : ''}`}>
                        <div className="bar" style={{ width: `${Math.min(100, pct * 100)}%`, background: over ? undefined : (cat.color || undefined) }} />
                      </div>
                      <div className="row between" style={{ marginTop: 8 }}>
                        <span className="num pf-muted" style={{ fontSize: 10.5 }}>{(pct * 100).toFixed(0)}% felhasználva</span>
                        <span className="num" style={{ fontSize: 11, color: over ? 'var(--pf-loss)' : 'var(--pf-text-2)' }}>
                          {over ? '−' : ''}{fmtCompact(Math.abs(budget - spent))} {over ? 'túllépés' : 'maradék'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <button className="pf-btn sm" type="button" onClick={() => startEdit(cat.id, null)} style={{ width: '100%', justifyContent: 'center' }}>
                      <Plus size={12} /> Keret hozzáadása
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'annual' && (
        <div className="pf-card">
          <div className="row between" style={{ marginBottom: 14 }}>
            <div>
              <h3 className="card-title">Éves kihasználtság</h3>
              <div className="card-sub">A havi keret elköltött százaléka</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 4, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }} />
                  {annualMonths.map((m, i) => (
                    <th key={i} style={{ color: 'var(--pf-muted)', fontWeight: 400, padding: '4px 6px', textAlign: 'center', fontSize: 10.5 }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ color: 'var(--pf-text-2)', padding: '0 8px 0 0', whiteSpace: 'nowrap', fontSize: 11.5, fontFamily: 'var(--font-sans)' }}>
                      {cat.icon} {cat.name}
                    </td>
                    {annualMonths.map((m, ci) => {
                      const budget = cat.monthlyBudget ?? 0
                      const spent = spentFor(cat.id, m.year, m.month)
                      const v = budget > 0 ? spent / budget : null
                      let bg = 'var(--pf-card-2)'
                      if (v != null) {
                        bg = v <= 1
                          ? `color-mix(in oklab, var(--pf-accent) ${Math.round(v * 70)}%, var(--pf-card-2))`
                          : `color-mix(in oklab, var(--pf-loss) ${Math.round(40 + Math.min(1, (v - 1) * 2) * 40)}%, var(--pf-card-2))`
                      }
                      return (
                        <td key={ci} title={`${cat.name} · ${m.label}: ${v != null ? Math.round(v * 100) : 0}%`}
                          style={{
                            width: 40, height: 24, borderRadius: 5, background: bg,
                            color: v != null ? 'rgba(255,255,255,.92)' : 'var(--pf-muted-2)',
                            textAlign: 'center', verticalAlign: 'middle', fontWeight: 500,
                            border: '1px solid var(--pf-hairline)', opacity: v == null ? 0.5 : 1,
                          }}>
                          {v != null ? Math.round(v * 100) : '–'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'income' && <IncomePanel year={selected.year} month={selected.month} />}
    </>
  )
}
