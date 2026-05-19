'use client'

import { useMemo, useRef, useState, useLayoutEffect } from 'react'
import { ArrowUp, ArrowDown, Sparkles, Calendar } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { TransactionStatus } from '@/lib/types'
import { recurringAsTransactions } from '@/lib/recurring'
import { Donut } from '@/components/pefi/charts'

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} Mrd Ft`
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M Ft`
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}e Ft`
  return `${s}${Math.round(a)} Ft`
}
function fmtFt(v: number): string {
  return `${Math.round(v).toLocaleString('hu-HU')} Ft`
}
const DOW = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

// ── Cumulative chart ──────────────────────────────────────────────────────────
function CumulativeChart({
  cumThis, cumLast, projection, todayDay, daysInMonth,
}: {
  cumThis: (number | null)[]; cumLast: number[]; projection: number[]
  todayDay: number; daysInMonth: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => setW(Math.max(300, el.getBoundingClientRect().width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const h = 240, padTop = 12, padBottom = 26, padLeft = 64, padRight = 16
  const innerW = w - padLeft - padRight, innerH = h - padTop - padBottom
  const max = Math.max(1, cumLast[cumLast.length - 1] ?? 0, projection[projection.length - 1] ?? 0) * 1.08
  const x = (i: number) => padLeft + (i / (daysInMonth - 1)) * innerW
  const y = (v: number) => padTop + innerH - (v / max) * innerH
  const line = (arr: (number | null)[]) => {
    let d = ''
    arr.forEach((v, i) => { if (v == null) return; d += (d === '' ? 'M' : 'L') + x(i) + ',' + y(v) + ' ' })
    return d.trim()
  }
  const area = (arr: (number | null)[]) => {
    let pts = '', fx: number | null = null, lx = 0
    arr.forEach((v, i) => { if (v == null) return; if (fx == null) fx = x(i); lx = x(i); pts += (pts === '' ? 'M' : 'L') + x(i) + ',' + y(v) + ' ' })
    return pts ? pts + `L${lx},${y(0)} L${fx},${y(0)} Z` : ''
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => max * p)
  const [hi, setHi] = useState<number | null>(null)

  return (
    <div className="pf-card">
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 className="card-title">Kumulált költés</h3>
          <div className="card-sub">Folyó hónap az előzővel és a trajektóriával összevetve</div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="pf-badge"><span className="dot" style={{ background: 'var(--pf-accent)' }} />Aktuális</span>
          <span className="pf-badge"><span className="dot" style={{ background: 'var(--c8)' }} />Előző hó</span>
          <span className="pf-badge"><span className="dot" style={{ background: 'var(--pf-warn)' }} />Előrejelzés</span>
        </div>
      </div>
      <div ref={ref} style={{ width: '100%', height: h, position: 'relative' }}>
        <svg width="100%" height={h}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            let i = Math.round(((e.clientX - r.left - padLeft) / innerW) * (daysInMonth - 1))
            setHi(Math.max(0, Math.min(daysInMonth - 1, i)))
          }}
          onMouseLeave={() => setHi(null)}>
          <defs>
            <linearGradient id="sp-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--pf-accent)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--pf-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padLeft} x2={w - padRight} y1={y(t)} y2={y(t)} stroke="var(--pf-hairline)" />
              <text x={padLeft - 8} y={y(t) + 3} fontSize="10.5" textAnchor="end" fill="var(--pf-muted)" fontFamily="var(--font-mono)">
                {fmtCompact(t)}
              </text>
            </g>
          ))}
          <path d={line(cumLast)} stroke="var(--c8)" strokeWidth="1.4" fill="none" strokeDasharray="3 4" opacity=".85" />
          <path d={line(projection)} stroke="var(--pf-warn)" strokeWidth="1.2" fill="none" strokeDasharray="2 4" opacity=".7" />
          <path d={area(cumThis)} fill="url(#sp-grad)" />
          <path d={line(cumThis)} stroke="var(--pf-accent)" strokeWidth="1.8" fill="none" />
          <line x1={x(todayDay - 1)} x2={x(todayDay - 1)} y1={padTop} y2={h - padBottom}
            stroke="var(--pf-text-2)" strokeOpacity=".35" strokeWidth="1" strokeDasharray="2 3" />
          <text x={x(todayDay - 1)} y={padTop + 10} fontSize="9.5" fill="var(--pf-muted)" fontFamily="var(--font-mono)" textAnchor="middle">
            MA · {todayDay}
          </text>
          {[1, 5, 10, 15, 20, 25, daysInMonth].map((d) => (
            <text key={d} x={x(d - 1)} y={h - 8} fontSize="10.5" fill="var(--pf-muted)" textAnchor="middle" fontFamily="var(--font-mono)">{d}</text>
          ))}
          {hi != null && (
            <g>
              <line x1={x(hi)} x2={x(hi)} y1={padTop} y2={h - padBottom} stroke="var(--pf-text-2)" strokeOpacity=".25" strokeDasharray="3 3" />
              {cumThis[hi] != null && <circle cx={x(hi)} cy={y(cumThis[hi] as number)} r="3.5" fill="var(--pf-card)" stroke="var(--pf-accent)" strokeWidth="1.8" />}
              {cumLast[hi] != null && <circle cx={x(hi)} cy={y(cumLast[hi])} r="3" fill="var(--pf-card)" stroke="var(--c8)" strokeWidth="1.4" />}
            </g>
          )}
        </svg>
        {hi != null && (
          <div style={{
            position: 'absolute', left: Math.min(w - 200, Math.max(8, x(hi) - 100)), top: 4,
            background: 'var(--pf-card-2)', border: '1px solid var(--pf-border)', borderRadius: 8,
            padding: '8px 10px', fontSize: 11.5, pointerEvents: 'none', fontFamily: 'var(--font-mono)', minWidth: 170,
          }}>
            <div style={{ color: 'var(--pf-muted)', fontSize: 10.5, marginBottom: 4 }}>{hi + 1}. nap</div>
            <div className="row between" style={{ gap: 14 }}>
              <span>Aktuális</span><span>{cumThis[hi] != null ? fmtCompact(cumThis[hi] as number) : '—'}</span>
            </div>
            <div className="row between" style={{ gap: 14 }}>
              <span>Előző</span><span>{cumLast[hi] != null ? fmtCompact(cumLast[hi]) : '—'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SpendingPage() {
  const { transactions, categories, recurringItems, trackingStartMonth } = useAppStore()

  const data = useMemo(() => {
    const allTxs = [...transactions, ...recurringAsTransactions(recurringItems, trackingStartMonth)]
    const now = new Date()
    const curY = now.getFullYear(), curM = now.getMonth()
    const prev = new Date(curY, curM - 1, 1)
    const prevY = prev.getFullYear(), prevM = prev.getMonth()
    const daysInMonth = new Date(curY, curM + 1, 0).getDate()
    const daysInPrev = new Date(prevY, prevM + 1, 0).getDate()
    const todayDay = now.getDate()

    const expenses = allTxs.filter(
      (t) => t.amount < 0 && t.status === TransactionStatus.CONFIRMED
    )
    const dailyCur = new Array(daysInMonth).fill(0)
    const dailyPrev = new Array(daysInPrev).fill(0)
    const curExp: typeof expenses = []
    for (const t of expenses) {
      const d = new Date(t.date)
      if (d.getFullYear() === curY && d.getMonth() === curM) {
        dailyCur[d.getDate() - 1] += Math.abs(t.amount)
        curExp.push(t)
      } else if (d.getFullYear() === prevY && d.getMonth() === prevM) {
        dailyPrev[d.getDate() - 1] += Math.abs(t.amount)
      }
    }

    const spentToDate = dailyCur.slice(0, todayDay).reduce((s, v) => s + v, 0)
    const prevTotal = dailyPrev.reduce((s, v) => s + v, 0)
    const prevToDay = dailyPrev.slice(0, todayDay).reduce((s, v) => s + v, 0)
    const dailyAvg = todayDay > 0 ? spentToDate / todayDay : 0
    const projected = Math.round(dailyAvg * daysInMonth)
    const momDelta = prevToDay > 0 ? (spentToDate / prevToDay - 1) * 100 : 0
    const projVsLast = prevTotal > 0 ? (projected / prevTotal - 1) * 100 : 0

    // cumulative series
    const cumThis: (number | null)[] = []
    let s = 0
    for (let i = 0; i < daysInMonth; i++) {
      if (i < todayDay) { s += dailyCur[i]; cumThis.push(s) } else cumThis.push(null)
    }
    const cumLast: number[] = []
    s = 0
    for (let i = 0; i < daysInPrev; i++) { s += dailyPrev[i]; cumLast.push(s) }
    const projection = Array.from({ length: daysInMonth }, (_, i) => Math.round(dailyAvg * (i + 1)))

    // category spend
    const curByCat: Record<string, number> = {}
    const prevByCat: Record<string, number> = {}
    const txByCat: Record<string, number> = {}
    for (const t of expenses) {
      const d = new Date(t.date)
      const k = t.categoryId ?? '__none__'
      if (d.getFullYear() === curY && d.getMonth() === curM) {
        curByCat[k] = (curByCat[k] ?? 0) + Math.abs(t.amount)
        txByCat[k] = (txByCat[k] ?? 0) + 1
      } else if (d.getFullYear() === prevY && d.getMonth() === prevM) {
        prevByCat[k] = (prevByCat[k] ?? 0) + Math.abs(t.amount)
      }
    }
    const catSpend = Object.keys(curByCat)
      .map((k) => {
        const cat = categories.find((c) => c.id === k)
        return {
          id: k,
          name: cat?.name ?? 'Egyéb',
          color: cat?.color || '#94A3B8',
          spent: curByCat[k],
          prev: prevByCat[k] ?? 0,
          txs: txByCat[k] ?? 0,
          budget: cat?.monthlyBudget ?? 0,
        }
      })
      .sort((a, b) => b.spent - a.spent)
    const totalSpent = catSpend.reduce((a, c) => a + c.spent, 0)

    // merchants — grouped by description
    const merchMap: Record<string, { name: string; amount: number; txs: number; catId: string | null }> = {}
    for (const t of curExp) {
      const key = t.description.trim()
      if (!merchMap[key]) merchMap[key] = { name: key, amount: 0, txs: 0, catId: t.categoryId }
      merchMap[key].amount += Math.abs(t.amount)
      merchMap[key].txs += 1
    }
    const merchants = Object.values(merchMap).sort((a, b) => b.amount - a.amount).slice(0, 8)

    // largest
    const largest = [...curExp].sort((a, b) => a.amount - b.amount).slice(0, 6)

    // day of week (Mon-first)
    const dow = [0, 0, 0, 0, 0, 0, 0]
    for (const t of curExp) {
      const d = new Date(t.date)
      if (d.getDate() > todayDay) continue
      dow[(d.getDay() + 6) % 7] += Math.abs(t.amount)
    }

    // recurring vs discretionary
    const recurringTotal = curExp
      .filter((t) => (t as { generated?: boolean }).generated || t.isRecurring)
      .reduce((a, t) => a + Math.abs(t.amount), 0)
    const discretionary = totalSpent - recurringTotal

    // insights
    const overBudget = catSpend.filter((c) => c.budget > 0 && c.spent > c.budget)
      .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget))[0]
    const fastest = catSpend.filter((c) => c.prev > 3000)
      .map((c) => ({ ...c, growth: c.spent / c.prev - 1 }))
      .sort((a, b) => b.growth - a.growth)[0]
    const weekendShare = dow.reduce((s, v) => s + v, 0) > 0
      ? ((dow[4] + dow[5]) / dow.reduce((s, v) => s + v, 0)) * 100
      : 0

    return {
      todayDay, daysInMonth, spentToDate, prevTotal, prevToDay, dailyAvg, projected,
      momDelta, projVsLast, cumThis, cumLast, projection,
      dailyCur, catSpend, totalSpent, merchants, largest, dow,
      recurringTotal, discretionary, overBudget, fastest, weekendShare, curY, curM,
    }
  }, [transactions, categories, recurringItems, trackingStartMonth])

  const d = data
  const donutData = (() => {
    const top = d.catSpend.slice(0, 7).map((c) => ({ label: c.name, value: c.spent, color: c.color }))
    const others = d.catSpend.slice(7).reduce((s, c) => s + c.spent, 0)
    if (others > 0) top.push({ label: 'Egyéb', value: others, color: 'var(--pf-muted-2)' })
    return top
  })()

  // calendar grid
  const firstDow = (new Date(d.curY, d.curM, 1).getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let day = 1; day <= d.daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  const maxDaily = Math.max(1, ...d.dailyCur)
  const maxDow = Math.max(1, ...d.dow)
  const merchMax = Math.max(1, ...d.merchants.map((m) => m.amount))

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="crumb">Pénzforgalom · Elemzés</div>
          <h1>Kiadáselemzés</h1>
        </div>
      </div>

      {/* KPI row */}
      <div className="pf-grid grid-4">
        <div className="pf-card stat">
          <div className="lbl">Költés ebben a hónapban</div>
          <div className="val num">{fmtCompact(d.spentToDate)}</div>
          <div className="sub pf-muted">{d.todayDay} / {d.daysInMonth} nap</div>
        </div>
        <div className="pf-card stat">
          <div className="lbl">Napi átlag</div>
          <div className="val num">{fmtCompact(d.dailyAvg)}</div>
          <div className="sub pf-muted">
            előző hó: {fmtCompact(d.prevTotal / Math.max(1, d.daysInMonth))}/nap
          </div>
        </div>
        <div className="pf-card stat">
          <div className="lbl">Előző hó azonos napjához</div>
          <div className="val num" style={{ color: d.momDelta > 0 ? 'var(--pf-loss)' : 'var(--pf-gain)' }}>
            {d.momDelta > 0 ? '+' : ''}{d.momDelta.toFixed(1)}%
          </div>
          <div className="sub pf-muted">{fmtCompact(d.prevToDay)} a(z) {d.todayDay}. napig</div>
        </div>
        <div className="pf-card stat">
          <div className="lbl">Várható hó vége</div>
          <div className="val num">{fmtCompact(d.projected)}</div>
          <div className="sub">
            <span className={`delta ${d.projVsLast > 0 ? 'neg' : 'pos'}`}>
              {d.projVsLast > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
              {d.projVsLast > 0 ? '+' : ''}{d.projVsLast.toFixed(1)}% az előző hóhoz
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />
      <CumulativeChart cumThis={d.cumThis} cumLast={d.cumLast} projection={d.projection}
        todayDay={d.todayDay} daysInMonth={d.daysInMonth} />

      <div style={{ height: 16 }} />

      {/* Category split + detail */}
      <div className="pf-grid grid-12">
        <div className="span-5">
          <div className="pf-card" style={{ height: '100%' }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <h3 className="card-title">Kategória megoszlás</h3>
                <div className="card-sub">A teljes költés aránya</div>
              </div>
            </div>
            {donutData.length === 0 ? (
              <p className="pf-muted" style={{ fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Nincs kiadás ebben a hónapban</p>
            ) : (
              <div className="row" style={{ gap: 24, alignItems: 'center' }}>
                <Donut data={donutData} size={150} thickness={20}
                  centerLabel="Összesen" centerValue={fmtCompact(d.totalSpent)} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {donutData.map((x, i) => (
                    <div key={i} className="row between" style={{ fontSize: 12 }}>
                      <span className="row" style={{ gap: 8, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: x.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</span>
                      </span>
                      <span className="num pf-muted" style={{ fontSize: 11 }}>
                        {((x.value / d.totalSpent) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="span-7">
          <div className="pf-card" style={{ padding: 0, height: '100%' }}>
            <div style={{ padding: '16px 18px 8px' }}>
              <h3 className="card-title">Kategória részletek</h3>
              <div className="card-sub">Költés, változás az előző hóhoz, tranzakciók</div>
            </div>
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Kategória</th>
                  <th className="num">Költés</th>
                  <th className="num">Előzőhöz</th>
                  <th className="num">Keret</th>
                  <th className="num">Db</th>
                </tr>
              </thead>
              <tbody>
                {d.catSpend.map((c) => {
                  const delta = c.prev === 0 ? 0 : (c.spent / c.prev - 1) * 100
                  const budgetPct = c.budget > 0 ? c.spent / c.budget : 0
                  const over = budgetPct > 1
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                          <span style={{ fontSize: 12.5 }}>{c.name}</span>
                          {over && <span className="pf-badge loss" style={{ padding: '1px 5px', fontSize: 9.5 }}>Túllépve</span>}
                        </span>
                      </td>
                      <td className="num">{fmtCompact(c.spent)}</td>
                      <td className="num">
                        <span className={`delta ${delta >= 0 ? 'neg' : 'pos'}`} style={{ justifyContent: 'flex-end', display: 'inline-flex' }}>
                          {delta >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                          {Math.abs(delta).toFixed(0)}%
                        </span>
                      </td>
                      <td className="num" style={{ color: over ? 'var(--pf-loss)' : 'var(--pf-muted)' }}>
                        {c.budget > 0 ? `${(budgetPct * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="num pf-muted">{c.txs}</td>
                    </tr>
                  )
                })}
                {d.catSpend.length === 0 && (
                  <tr><td colSpan={5} className="pf-muted" style={{ textAlign: 'center', padding: 24 }}>Nincs adat</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Heatmap + weekday */}
      <div className="pf-grid grid-12">
        <div className="span-8">
          <div className="pf-card">
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <h3 className="card-title">Napi hőtérkép</h3>
                <div className="card-sub">Költés intenzitása naponta</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {DOW.map((l) => (
                <div key={l} style={{ textAlign: 'center', fontSize: 10, color: 'var(--pf-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
              ))}
              {cells.map((day, i) => {
                if (day == null) return <div key={i} style={{ aspectRatio: '1.3/1', borderRadius: 6 }} />
                const v = day <= d.todayDay ? d.dailyCur[day - 1] : null
                const t = v == null ? 0 : v / maxDaily
                const isToday = day === d.todayDay
                return (
                  <div key={i} title={v == null ? `${day}.` : `${day}. · ${fmtFt(v)}`}
                    style={{
                      aspectRatio: '1.3/1', borderRadius: 6, padding: '4px 6px', minHeight: 46,
                      background: v == null ? 'var(--pf-card-2)' : `color-mix(in oklab, var(--pf-accent) ${Math.round(t * 82)}%, var(--pf-card-2))`,
                      border: isToday ? '1px solid var(--pf-accent)' : '1px solid var(--pf-hairline)',
                      opacity: v == null ? 0.4 : 1,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: t > 0.5 ? 'var(--pf-text)' : 'var(--pf-text-2)' }}>{day}</div>
                    {v != null && v > 0 && (
                      <div className="num" style={{ fontSize: 9.5, color: t > 0.5 ? 'var(--pf-text)' : 'var(--pf-muted)' }}>
                        {(v / 1000).toFixed(0)}e
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="span-4">
          <div className="pf-card" style={{ height: '100%' }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <h3 className="card-title">Hét napjai szerint</h3>
                <div className="card-sub">Melyik napon költesz a legtöbbet</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, marginBottom: 8 }}>
              {d.dow.map((v, i) => {
                const t = v / maxDow
                const isMax = v === maxDow && v > 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span className="num" style={{ fontSize: 10, color: 'var(--pf-muted)' }}>{(v / 1000).toFixed(0)}e</span>
                    <div style={{
                      width: '100%', height: `${Math.max(4, t * 100)}%`, borderRadius: '4px 4px 2px 2px',
                      border: '1px solid var(--pf-hairline)',
                      background: isMax
                        ? 'linear-gradient(180deg, var(--pf-accent), color-mix(in oklab, var(--pf-accent) 40%, var(--pf-card-2)))'
                        : 'color-mix(in oklab, var(--pf-accent) 40%, var(--pf-card-2))',
                    }} />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DOW.map((l, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: 'var(--pf-muted)', fontFamily: 'var(--font-mono)' }}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Merchants + largest + recurring split */}
      <div className="pf-grid grid-12">
        <div className="span-5">
          <div className="pf-card" style={{ padding: 0, height: '100%' }}>
            <div style={{ padding: '16px 18px 8px' }}>
              <h3 className="card-title">Top kereskedők</h3>
              <div className="card-sub">Költés szerint rangsorolva</div>
            </div>
            <div style={{ borderTop: '1px solid var(--pf-hairline)' }}>
              {d.merchants.length === 0 ? (
                <div className="pf-muted" style={{ padding: 24, textAlign: 'center', fontSize: 12 }}>Nincs adat</div>
              ) : d.merchants.map((m, i) => {
                const cat = categories.find((c) => c.id === m.catId)
                const t = m.amount / merchMax
                return (
                  <div key={m.name} style={{
                    display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) 1fr auto', gap: 12,
                    alignItems: 'center', padding: '9px 18px',
                    borderBottom: i === d.merchants.length - 1 ? '0' : '1px solid var(--pf-hairline)',
                  }}>
                    <span className="num pf-muted" style={{ fontSize: 10.5 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div className="pf-muted" style={{ fontSize: 10.5 }}>{cat?.name ?? 'Egyéb'} · {m.txs} db</div>
                    </div>
                    <div className="pf-progress thin" style={{ height: 5 }}>
                      <div className="bar" style={{ width: `${t * 100}%`, background: cat?.color || 'var(--pf-accent)' }} />
                    </div>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 500 }}>{fmtCompact(m.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="span-4">
          <div className="pf-card" style={{ padding: 0, height: '100%' }}>
            <div style={{ padding: '16px 18px 8px' }}>
              <h3 className="card-title">Legnagyobb tételek</h3>
              <div className="card-sub">A hónap legnagyobb egyedi kiadásai</div>
            </div>
            <table className="pf-table">
              <tbody>
                {d.largest.length === 0 ? (
                  <tr><td className="pf-muted" style={{ textAlign: 'center', padding: 24 }}>Nincs adat</td></tr>
                ) : d.largest.map((t) => {
                  const cat = categories.find((c) => c.id === t.categoryId)
                  return (
                    <tr key={t.id}>
                      <td style={{ width: 64 }}>
                        <span className="num pf-muted" style={{ fontSize: 11 }}>
                          {new Date(t.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                        <div className="row" style={{ gap: 6, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 2, background: cat?.color || '#94A3B8' }} />
                          <span className="pf-muted" style={{ fontSize: 10.5 }}>{cat?.name ?? 'Egyéb'}</span>
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontSize: 12.5 }}>−{fmtCompact(Math.abs(t.amount))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="span-3">
          <div className="pf-card" style={{ height: '100%' }}>
            <h3 className="card-title">Rendszeres vs. szabad</h3>
            <div className="card-sub" style={{ marginBottom: 14 }}>Mennyit tudsz ténylegesen befolyásolni</div>
            {d.totalSpent > 0 && (
              <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--pf-hairline)', marginBottom: 14 }}>
                <div style={{
                  width: `${(d.recurringTotal / d.totalSpent) * 100}%`,
                  background: 'linear-gradient(90deg, var(--c8), color-mix(in oklab, var(--c8) 40%, var(--pf-card-2)))',
                  display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--pf-text)',
                }}>{Math.round((d.recurringTotal / d.totalSpent) * 100)}%</div>
                <div style={{
                  width: `${(d.discretionary / d.totalSpent) * 100}%`,
                  background: 'linear-gradient(90deg, var(--pf-accent), color-mix(in oklab, var(--pf-accent) 60%, var(--pf-card-2)))',
                  display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#fff',
                }}>{Math.round((d.discretionary / d.totalSpent) * 100)}%</div>
              </div>
            )}
            <div className="row between" style={{ marginBottom: 10 }}>
              <div>
                <div className="row" style={{ gap: 8, fontSize: 11.5, color: 'var(--pf-text-2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--c8)' }} />Rendszeres
                </div>
                <div className="num" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{fmtCompact(d.recurringTotal)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="row" style={{ gap: 8, fontSize: 11.5, color: 'var(--pf-text-2)', justifyContent: 'flex-end' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--pf-accent)' }} />Szabad
                </div>
                <div className="num" style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: 'var(--pf-accent-2)' }}>{fmtCompact(d.discretionary)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Insights */}
      <div className="pf-grid grid-3">
        <InsightCard tone="loss" icon={<ArrowUp size={13} />} label="Túllépve"
          title={d.overBudget ? `${d.overBudget.name} +${fmtCompact(d.overBudget.spent - d.overBudget.budget)}` : 'Nincs túllépés'}
          sub={d.overBudget
            ? `${(d.overBudget.spent / d.overBudget.budget * 100).toFixed(0)}% a havi keretből — nézd át a tételeket.`
            : 'Minden kategória a keretén belül van.'} />
        <InsightCard tone="warn" icon={<Sparkles size={13} />} label="Leggyorsabban nő"
          title={d.fastest ? `${d.fastest.name} +${(d.fastest.growth * 100).toFixed(0)}%` : '—'}
          sub={d.fastest
            ? `Az előző havi ${fmtCompact(d.fastest.prev)}-ról nőtt.`
            : 'Nincs elég adat az összevetéshez.'} />
        <InsightCard tone="accent" icon={<Calendar size={13} />} label="Minta"
          title={`Hétvége: ${d.weekendShare.toFixed(0)}%`}
          sub={`A péntek és szombat adja a heti költés ${d.weekendShare.toFixed(0)}%-át.`} />
      </div>
    </>
  )
}

function InsightCard({ tone, icon, label, title, sub }: {
  tone: 'loss' | 'warn' | 'accent'; icon: React.ReactNode; label: string; title: string; sub: string
}) {
  const c = {
    loss: { bg: 'rgba(239,68,68,.08)', bd: 'rgba(239,68,68,.25)', fg: 'var(--pf-loss)' },
    warn: { bg: 'rgba(245,158,11,.08)', bd: 'rgba(245,158,11,.25)', fg: 'var(--pf-warn)' },
    accent: { bg: 'var(--pf-accent-soft)', bd: 'color-mix(in oklab, var(--pf-accent) 30%, transparent)', fg: 'var(--pf-accent-2)' },
  }[tone]
  return (
    <div className="pf-card" style={{ borderColor: c.bd, background: `linear-gradient(180deg, ${c.bg}, var(--pf-card))` }}>
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, background: c.bg, color: c.fg,
          display: 'grid', placeItems: 'center', border: `1px solid ${c.bd}`,
        }}>{icon}</span>
        <span style={{ color: c.fg, fontSize: 10.5, fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 6 }}>{title}</div>
      <div className="pf-muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}
