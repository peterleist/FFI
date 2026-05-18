'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { toYahooSymbol, getAssetMeta } from '@/lib/market-data'
import type { HistoryPoint } from '@/app/api/market-data/history/route'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetHistory {
  ticker: string
  name: string
  points: HistoryPoint[]
  currency: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#6366F1', // indigo
  '#EC4899', // pink
  '#EF4444', // red
  '#8B5CF6', // violet
  '#14B8A6', // teal
]

const RANGES = ['1M', '3M', '6M', '1Y', '3Y', 'MAX'] as const
type Range = typeof RANGES[number]

const RANGE_LABELS: Record<Range, string> = {
  '1M': '1 hónap', '3M': '3 hónap', '6M': '6 hónap',
  '1Y': '1 év', '3Y': '3 év', 'MAX': 'Összes',
}

const YAHOO_RANGE: Record<Range, string> = {
  '1M': '1mo', '3M': '3mo', '6M': '6mo',
  '1Y': '1y', '3Y': '3y', 'MAX': 'max',
}

const YAHOO_INTERVAL: Record<Range, string> = {
  '1M': '1d', '3M': '1d', '6M': '1d',
  '1Y': '1d', '3Y': '1wk', 'MAX': '1wk',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, range: Range): string {
  const d = new Date(dateStr)
  if (range === '1M' || range === '3M') {
    return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  }
  if (range === '6M' || range === '1Y') {
    return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
  }
  return d.getFullYear().toString()
}

function toReturnPct(points: HistoryPoint[]): Record<string, number> {
  if (!points.length) return {}
  const base = points[0].close
  const map: Record<string, number> = {}
  for (const p of points) {
    map[p.date] = base > 0 ? parseFloat(((p.close / base - 1) * 100).toFixed(2)) : 0
  }
  return map
}

// ── Date tooltip ──────────────────────────────────────────────────────────────

function DateTooltip({ active, label }: { active?: boolean; label?: string }) {
  if (!active || !label) return null
  return (
    <div className="bg-foreground text-card text-xs px-2.5 py-1.5 rounded-lg shadow-xl">
      {label}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function MarketWidget() {
  const investmentPositions = useAppStore(s => s.investmentPositions)

  const [range, setRange] = useState<Range>('1Y')
  const [histories, setHistories] = useState<Record<string, AssetHistory>>({})
  const [visible, setVisible] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unique tickers from positions
  const tickers = useMemo(
    () => [...new Set(investmentPositions.map(p => p.ticker))],
    [investmentPositions]
  )

  // Primary ticker = first one
  const primaryTicker = tickers[0] ?? null

  // Fetch history for all tickers
  const fetchAll = async (r: Range) => {
    if (!tickers.length) return
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled(
        tickers.map(async (ticker) => {
          const yahoo = toYahooSymbol(ticker)
          const res = await fetch(
            `/api/market-data/history?ticker=${encodeURIComponent(yahoo)}&range=${YAHOO_RANGE[r]}&interval=${YAHOO_INTERVAL[r]}`
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          return {
            ticker,
            name: data.shortName ?? getAssetMeta(ticker).name,
            points: (data.points ?? []) as HistoryPoint[],
            currency: data.currency ?? 'HUF',
          } as AssetHistory
        })
      )
      const next: Record<string, AssetHistory> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[tickers[i]] = r.value
      })
      setHistories(next)
      // init visible with all tickers that have data
      setVisible(prev => {
        const withData = tickers.filter(t => next[t]?.points.length)
        return prev.length ? prev.filter(t => withData.includes(t)) : withData
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll(range) }, [tickers.join(','), range])

  // Build normalised chart data (% return, all stocks rebased to 0 at period start)
  const chartData = useMemo(() => {
    const allDates = new Set<string>()
    const returnMaps: Record<string, Record<string, number>> = {}

    tickers.forEach(ticker => {
      const h = histories[ticker]
      if (!h?.points.length) return
      const ret = toReturnPct(h.points)
      returnMaps[ticker] = ret
      h.points.forEach(p => allDates.add(p.date))
    })

    const sortedDates = [...allDates].sort()
    const last: Record<string, number> = {}

    return sortedDates.map(date => {
      const row: Record<string, string | number> = { date: formatDate(date, range) }
      tickers.forEach(ticker => {
        const val = returnMaps[ticker]?.[date]
        if (val !== undefined) {
          last[ticker] = val
          row[ticker] = val
        } else if (last[ticker] !== undefined) {
          row[ticker] = last[ticker] // carry forward
        }
      })
      return row
    })
  }, [histories, tickers, range])

  // Final % change = last chart point value for each ticker
  const finalChanges = useMemo<Record<string, number>>(() => {
    const last = chartData[chartData.length - 1]
    if (!last) return {}
    return Object.fromEntries(
      tickers.map(t => [t, typeof last[t] === 'number' ? last[t] as number : 0])
    )
  }, [chartData, tickers])

  // Current prices from positions
  const currentPrices = useMemo(() => {
    return Object.fromEntries(
      investmentPositions.map(p => [p.ticker, { price: p.currentPrice, currency: p.currency }])
    )
  }, [investmentPositions])

  const toggle = (ticker: string) =>
    setVisible(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker])

  // ── No positions ─────────────────────────────────────────────────────────
  if (!tickers.length) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <BarChart2 className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Nincsenek befektetési pozíciók</p>
          <p className="text-xs text-muted-foreground/70">
            Adj hozzá részvényeket a Befektetések oldalon, hogy itt lásd az árfolyamukat
          </p>
        </CardContent>
      </Card>
    )
  }

  const primMeta = primaryTicker ? getAssetMeta(primaryTicker) : null
  const primChange = primaryTicker ? (finalChanges[primaryTicker] ?? 0) : 0
  const primPrice = primaryTicker ? currentPrices[primaryTicker] : null

  // Y domain
  const visibleVals = chartData.flatMap(d =>
    tickers.filter(t => visible.includes(t)).map(t => d[t] as number).filter(v => typeof v === 'number')
  )
  const minY = visibleVals.length ? Math.floor(Math.min(...visibleVals) - 3) : -10
  const maxY = visibleVals.length ? Math.ceil(Math.max(...visibleVals) + 3) : 10

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                style={{ backgroundColor: COLORS[0], fontSize: 9 }}
              >
                {primaryTicker?.slice(0, 3)}
              </div>
              <span className="font-semibold text-foreground text-sm truncate">
                {primMeta?.name ?? primaryTicker}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {primPrice && (
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  {primPrice.price.toLocaleString('hu-HU')} {primPrice.currency}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                primChange >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {primChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {primChange >= 0 ? '+' : ''}{primChange.toFixed(2)}%
              </span>
              <span className="text-sm text-muted-foreground">{RANGE_LABELS[range]}</span>
              {loading && (
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
              )}
            </div>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-0.5 bg-muted p-1 rounded-xl border border-border shrink-0">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  range === r
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-52">
          {loading && !chartData.length ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-sm text-destructive">
              Nem sikerült betölteni az adatokat
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFF6FF" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                  width={56}
                  domain={[minY, maxY]}
                />
                <Tooltip
                  content={<DateTooltip />}
                  cursor={{ stroke: '#94A3B8', strokeDasharray: '4 4', strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                {tickers.filter(t => visible.includes(t)).map((ticker, i) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={COLORS[tickers.indexOf(ticker) % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      stroke: '#ffffff',
                      fill: COLORS[tickers.indexOf(ticker) % COLORS.length],
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {tickers.map((ticker, i) => {
            const color = COLORS[i % COLORS.length]
            const chg = finalChanges[ticker] ?? 0
            const isPos = chg >= 0
            const isVis = visible.includes(ticker)
            const meta = getAssetMeta(ticker)
            const priceInfo = currentPrices[ticker]
            const isPrimary = ticker === primaryTicker

            return (
              <div
                key={ticker}
                className={`flex items-center gap-3 py-0.5 transition-opacity ${!isVis ? 'opacity-30' : ''}`}
              >
                <div className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-foreground flex-1 truncate min-w-0">
                  {meta.name !== ticker ? meta.name : ticker}
                </span>
                {priceInfo && (
                  <span className="text-sm text-muted-foreground tabular-nums mr-2 shrink-0">
                    {priceInfo.price.toLocaleString('hu-HU')} {priceInfo.currency}
                  </span>
                )}
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold w-[76px] justify-center shrink-0 ${
                  isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {isPos ? '↑' : '↓'} {Math.abs(chg).toFixed(2)}%
                </span>
                {isPrimary
                  ? <div className="w-5 shrink-0" />
                  : (
                    <button
                      onClick={() => toggle(ticker)}
                      className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )
                }
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <button className="flex items-center gap-2 text-sm text-primary font-medium hover:opacity-80 transition-opacity">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Plus className="w-3 h-3 text-white" />
            </div>
            Összehasonlítás hozzáadása
          </button>
          <button
            onClick={() => setVisible(primaryTicker ? [primaryTicker] : [])}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Összes eltávolítása
          </button>
        </div>

      </CardContent>
    </Card>
  )
}
