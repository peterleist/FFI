'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createChart, ColorType, LineStyle, LineSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { toYahooSymbol, getAssetMeta, useQuotes, useFxRates, toHuf } from '@/lib/market-data'
import { formatCurrency } from '@/lib/utils'
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

// Chart theme constants matching globals.css dark theme
const CHART_BG    = '#18191D'
const CHART_GRID  = '#27282E'
const CHART_TEXT  = '#71717A'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toReturnPct(points: HistoryPoint[]): Record<string, number> {
  if (!points.length) return {}
  const base = points[0].close
  const map: Record<string, number> = {}
  for (const p of points) {
    map[p.date] = base > 0 ? parseFloat(((p.close / base - 1) * 100).toFixed(2)) : 0
  }
  return map
}

// ── TradingChart ──────────────────────────────────────────────────────────────

interface ChartRow {
  date: string // raw YYYY-MM-DD, used as lightweight-charts Time
  [ticker: string]: string | number
}

function TradingChart({
  data,
  tickers,
  visible,
}: {
  data: ChartRow[]
  tickers: string[]
  visible: string[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map())

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    // Clean up previous chart
    try { chartRef.current?.remove() } catch { /* ignore */ }
    chartRef.current = null
    seriesRef.current.clear()

    let chart: IChartApi
    try {
      chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: CHART_TEXT,
        fontFamily: 'inherit',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: CHART_GRID },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.05 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (t: Time) => String(t).slice(0, 7), // YYYY-MM
      },
      crosshair: {
        horzLine: { visible: false, labelVisible: false },
        vertLine: { color: '#444', style: LineStyle.Dashed, width: 1, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: 208,
    })

    chart.applyOptions({
      localization: {
        priceFormatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
      },
    })

    const visibleTickers = tickers.filter(t => visible.includes(t))

    for (const ticker of visibleTickers) {
      const color = COLORS[tickers.indexOf(ticker) % COLORS.length]
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerBorderColor: CHART_BG,
        crosshairMarkerBorderWidth: 2,
        crosshairMarkerRadius: 4,
      })

      const seriesData = data
        .filter(d => typeof d[ticker] === 'number')
        .map(d => ({ time: d.date as Time, value: d[ticker] as number }))

      series.setData(seriesData)
      seriesRef.current.set(ticker, series)
    }

    chart.timeScale().fitContent()
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      try { chart.remove() } catch { /* ignore */ }
      chartRef.current = null
      seriesRef.current.clear()
    }
    } catch (err) {
      console.error('lightweight-charts init error:', err)
    }
  }, [data, tickers, visible])

  if (!data.length) return null
  return <div ref={containerRef} className="w-full" style={{ height: 208 }} />
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function MarketWidget() {
  const investmentPositions = useAppStore(s => s.investmentPositions)

  const [range, setRange] = useState<Range>('1Y')
  const [histories, setHistories] = useState<Record<string, AssetHistory>>({})
  const [visible, setVisible] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tickers = useMemo(
    () => [...new Set(investmentPositions.map(p => p.ticker))],
    [investmentPositions]
  )

  const primaryTicker = tickers[0] ?? null

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

  // Live quotes for current price display
  const { quotes } = useQuotes(tickers)
  const { rates: fxRates } = useFxRates()

  // Build chart data — raw YYYY-MM-DD dates for lightweight-charts
  const chartData = useMemo((): ChartRow[] => {
    const allDates = new Set<string>()
    const returnMaps: Record<string, Record<string, number>> = {}

    tickers.forEach(ticker => {
      const h = histories[ticker]
      if (!h?.points.length) return
      returnMaps[ticker] = toReturnPct(h.points)
      h.points.forEach(p => allDates.add(p.date))
    })

    const sortedDates = [...allDates].sort()
    const last: Record<string, number> = {}

    return sortedDates.map(date => {
      const row: ChartRow = { date }
      tickers.forEach(ticker => {
        const val = returnMaps[ticker]?.[date]
        if (val !== undefined) {
          last[ticker] = val
          row[ticker] = val
        } else if (last[ticker] !== undefined) {
          row[ticker] = last[ticker]
        }
      })
      return row
    })
  }, [histories, tickers])

  const finalChanges = useMemo<Record<string, number>>(() => {
    const last = chartData[chartData.length - 1]
    if (!last) return {}
    return Object.fromEntries(
      tickers.map(t => [t, typeof last[t] === 'number' ? last[t] as number : 0])
    )
  }, [chartData, tickers])

  // Live prices — use quote if available, fall back to stored price
  // Currency always derived from asset meta (authoritative source)
  const currentPrices = useMemo(() => {
    return Object.fromEntries(
      investmentPositions.map(p => {
        const meta = getAssetMeta(p.ticker)
        const livePrice = quotes[p.ticker]?.price ?? p.currentPrice
        const currency = meta.currency || p.currency
        return [p.ticker, { price: livePrice, currency }]
      })
    )
  }, [investmentPositions, quotes])

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
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-foreground tabular-nums">
                    {formatCurrency(primPrice.price, primPrice.currency)}
                  </span>
                  {primPrice.currency !== 'HUF' && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatCurrency(toHuf(primPrice.price, primPrice.currency, fxRates))}
                    </span>
                  )}
                </div>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                primChange >= 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
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
        <div className="rounded-xl overflow-hidden">
          {loading && !chartData.length ? (
            <div className="h-52 flex items-center justify-center" style={{ background: CHART_BG }}>
              <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : error ? (
            <div className="h-52 flex items-center justify-center text-sm text-destructive" style={{ background: CHART_BG }}>
              Nem sikerült betölteni az adatokat
            </div>
          ) : (
            <TradingChart data={chartData} tickers={tickers} visible={visible} />
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
                  <span className="text-sm text-muted-foreground tabular-nums mr-2 shrink-0 text-right">
                    {formatCurrency(priceInfo.price, priceInfo.currency)}
                    {priceInfo.currency !== 'HUF' && (
                      <span className="block text-xs text-muted-foreground/60">
                        {formatCurrency(toHuf(priceInfo.price, priceInfo.currency, fxRates))}
                      </span>
                    )}
                  </span>
                )}
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold w-[76px] justify-center shrink-0 ${
                  isPos ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
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
