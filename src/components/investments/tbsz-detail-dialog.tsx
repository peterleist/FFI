'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { RefreshCw, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { getAssetMeta, useQuotes, useHistory } from '@/lib/market-data'
import type { Account, InvestmentPosition, InvestmentTrade } from '@/lib/types'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COLORS = ['#94a3b8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
const CURRENT_YEAR = new Date().getFullYear()

function tbszYearsUntilFree(openedYear: number) {
  return Math.max(0, openedYear + 5 - CURRENT_YEAR)
}
function tbszProgress(openedYear: number) {
  return Math.min(((CURRENT_YEAR - openedYear) / 5) * 100, 100)
}

interface Props {
  account: Account
  positions: InvestmentPosition[]
  trades: InvestmentTrade[]
  open: boolean
  onOpenChange: (v: boolean) => void
}

// ── Historical chart for a single position ──────────────────────────────────
function PositionHistoryChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState('1y')
  const { points, loading, currency } = useHistory(ticker, range)

  const chartData = points.map((p) => ({ date: p.date, ár: p.close }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Adatok betöltése…
      </div>
    )
  }
  if (chartData.length === 0) {
    return <p className="text-center text-muted-foreground text-sm py-8">Nincs historikus adat</p>
  }

  const firstClose = chartData[0]?.ár ?? 0
  const lastClose = chartData[chartData.length - 1]?.ár ?? 0
  const change = lastClose - firstClose
  const changePct = firstClose > 0 ? (change / firstClose) * 100 : 0
  const positive = change >= 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-foreground">
            {lastClose.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </span>
          <span className={`text-sm font-semibold flex items-center gap-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
            {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {positive ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-24 h-7 text-xs bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            {[['1mo','1 hó'],['3mo','3 hó'],['6mo','6 hó'],['1y','1 év'],['2y','2 év'],['5y','5 év']].map(([v, l]) => (
              <SelectItem key={v} value={v} className="text-foreground text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
            tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
            domain={['auto', 'auto']} width={50} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
            formatter={(v) => [`${Number(v).toLocaleString('hu-HU', { minimumFractionDigits: 2 })} ${currency}`, 'Ár']}
          />
          <Area type="monotone" dataKey="ár" stroke={positive ? '#22c55e' : '#ef4444'}
            fill={`url(#grad-${ticker})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main dialog ──────────────────────────────────────────────────────────────
export function TbszDetailDialog({ account, positions, trades, open, onOpenChange }: Props) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [historyRange, setHistoryRange] = useState('1y')

  const tickers = positions.map((p) => p.ticker)
  const { quotes, loading: quotesLoading, lastFetched, refetch } = useQuotes(open ? tickers : [])

  const enriched = useMemo(() => {
    return positions.map((pos) => {
      const q = quotes[pos.ticker]
      const livePrice = q?.price ?? pos.currentPrice
      const marketValue = pos.quantity * livePrice
      const cost = pos.quantity * pos.averageBuyPrice
      const pnl = marketValue - cost
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
      const meta = getAssetMeta(pos.ticker)
      return { ...pos, livePrice, marketValue, pnl, pnlPct, meta, q }
    })
  }, [positions, quotes])

  const totalValue = enriched.reduce((s, p) => s + p.marketValue, 0)
  const totalCost  = enriched.reduce((s, p) => s + p.quantity * p.averageBuyPrice, 0)
  const totalPnl   = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  // Allocation pie (by position value)
  const allocationData = enriched.map((p) => ({
    name: p.ticker,
    value: Math.round(p.marketValue),
    pct: totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0,
  }))

  // Sector breakdown
  const sectorMap: Record<string, number> = {}
  enriched.forEach((p) => {
    sectorMap[p.meta.sector] = (sectorMap[p.meta.sector] ?? 0) + p.marketValue
  })
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value: Math.round(value), pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  // Region breakdown
  const regionMap: Record<string, number> = {}
  enriched.forEach((p) => {
    regionMap[p.meta.region] = (regionMap[p.meta.region] ?? 0) + p.marketValue
  })
  const regionData = Object.entries(regionMap)
    .map(([name, value]) => ({ name, value: Math.round(value), pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  // Asset class breakdown
  const assetClassMap: Record<string, number> = {}
  enriched.forEach((p) => {
    assetClassMap[p.meta.assetClass] = (assetClassMap[p.meta.assetClass] ?? 0) + p.marketValue
  })
  const assetClassData = Object.entries(assetClassMap)
    .map(([name, value]) => ({ name, value: Math.round(value), pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))

  const yearsLeft = account.tbszYear ? tbszYearsUntilFree(account.tbszYear) : 0
  const progress  = account.tbszYear ? tbszProgress(account.tbszYear) : 0
  const isFree    = yearsLeft === 0

  const tickerForHistory = selectedTicker ?? tickers[0] ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[98vw] sm:max-w-[90vw] lg:max-w-5xl xl:max-w-6xl bg-card border-border text-foreground h-[95vh] sm:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Fixed header ── */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 border-b border-border space-y-3">
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-3 flex-wrap pr-6">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">{account.name}</DialogTitle>
                <p className="text-muted-foreground text-sm mt-0.5">Részletes TBSZ statisztika</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isFree ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Adómentes</Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border">
                    {yearsLeft} év múlva adómentes
                  </Badge>
                )}
                <Button
                  variant="outline" size="sm" onClick={refetch} disabled={quotesLoading}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted h-7 text-xs gap-1.5"
                >
                  {quotesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Frissítés
                </Button>
              </div>
            </div>
          </DialogHeader>

          {account.tbszYear && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Nyitva: {account.tbszYear}</span>
                <span>{progress.toFixed(0)}% — {isFree ? 'Adómentességi időszak lejárt' : `${yearsLeft} év hátra`}</span>
              </div>
              <Progress value={progress} className="h-1.5 bg-muted" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-muted rounded-lg p-2.5 sm:p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Portfólió értéke</p>
              <p className="text-sm sm:text-base font-bold text-foreground mt-0.5 truncate">{formatCurrency(totalValue)}</p>
              {lastFetched && <p className="text-[9px] text-muted-foreground mt-0.5 hidden sm:block">Frissítve: {format(new Date(lastFetched), 'HH:mm', { locale: hu })}</p>}
            </div>
            <div className="bg-muted rounded-lg p-2.5 sm:p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Befektetett tőke</p>
              <p className="text-sm sm:text-base font-bold text-foreground mt-0.5 truncate">{formatCurrency(totalCost)}</p>
            </div>
            <div className="bg-muted rounded-lg p-2.5 sm:p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground">P&L</p>
              <p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
              </p>
              <p className={`text-[10px] ${totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="positions" className="flex flex-col h-full">
            <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-0 border-b border-border">
              <TabsList className="bg-transparent border-0 p-0 h-auto gap-1 flex-wrap">
                {[['positions','Pozíciók'],['stats','Statisztikák'],['history','Historikus ár'],['trades','Ügyletek']].map(([v, l]) => (
                  <TabsTrigger
                    key={v} value={v}
                    className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs rounded-md px-3 py-1.5 bg-muted text-muted-foreground border-0 mb-2"
                  >
                    {l}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Positions */}
            <TabsContent value="positions" className="flex-1 m-0 px-4 sm:px-6 py-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Ticker</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Szektor</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Db</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden md:table-cell">Átl. ár</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Aktuális ár</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">Piaci érték</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden lg:table-cell">Súly</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enriched.map((pos) => (
                      <TableRow key={pos.id} className="border-border hover:bg-muted/50">
                        <TableCell>
                          <p className="text-sm font-semibold text-foreground">{pos.ticker}</p>
                          <p className="text-xs text-muted-foreground max-w-28 truncate">{pos.meta.name}</p>
                          <Badge className="mt-0.5 text-[9px] px-1 py-0 h-4 bg-muted/50 text-muted-foreground border-0 hidden sm:inline-flex">
                            {pos.meta.assetClass}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{pos.meta.sector}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">{pos.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell">
                          {formatCurrency(pos.averageBuyPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="flex flex-col items-end">
                            <span className="text-foreground font-medium">{formatCurrency(pos.livePrice)}</span>
                            {pos.q?.changePercent != null && (
                              <span className={`text-[10px] ${pos.q.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.q.changePercent >= 0 ? '+' : ''}{pos.q.changePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground hidden sm:table-cell">
                          {formatCurrency(pos.marketValue)}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-foreground">
                              {totalValue > 0 ? ((pos.marketValue / totalValue) * 100).toFixed(1) : 0}%
                            </span>
                            <Progress value={totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0} className="w-16 h-1 bg-muted/50" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                            <p className="text-[10px] font-normal">({pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%)</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Statistics */}
            <TabsContent value="stats" className="flex-1 m-0 px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatPieCard title="Eszköz allokáció" data={allocationData} />
                <StatPieCard title="Szektor bontás" data={sectorData} />
                <StatPieCard title="Regionális bontás" data={regionData} />
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">Eszköz típus bontás</p>
                <div className="space-y-2">
                  {assetClassData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{d.name}</span>
                      <div className="w-20 sm:w-32 hidden xs:block">
                        <Progress value={d.pct} className="h-1.5 bg-muted/50" />
                      </div>
                      <span className="text-sm text-foreground w-10 text-right flex-shrink-0">{d.pct.toFixed(1)}%</span>
                      <span className="text-sm text-muted-foreground w-24 sm:w-28 text-right flex-shrink-0 hidden sm:block">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Historical chart */}
            <TabsContent value="history" className="flex-1 m-0 px-4 sm:px-6 py-4 space-y-3">
              {tickers.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Ticker:</span>
                  {tickers.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTicker(t)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        (selectedTicker ?? tickers[0]) === t
                          ? 'bg-muted border-slate-400/30 text-primary'
                          : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {tickerForHistory && (
                <PositionHistoryChart key={tickerForHistory + historyRange} ticker={tickerForHistory} />
              )}
            </TabsContent>

            {/* Trade history */}
            <TabsContent value="trades" className="flex-1 m-0 px-4 sm:px-6 py-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Dátum</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Típus</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Ticker</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Mennyiség</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">Ár</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Összeg</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">Jutalék</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.flatMap((pos) =>
                      trades
                        .filter((t) => t.positionId === pos.id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((trade) => (
                          <TableRow key={trade.id} className="border-border hover:bg-muted/50">
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(trade.date), 'yyyy. MM. dd.', { locale: hu })}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] px-1.5 border ${
                                trade.type === 'BUY'
                                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}>
                                {trade.type === 'BUY' ? 'Vétel' : 'Eladás'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-foreground">{pos.ticker}</TableCell>
                            <TableCell className="text-right text-sm text-foreground">{trade.quantity}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground hidden sm:table-cell">{formatCurrency(trade.price)}</TableCell>
                            <TableCell className="text-right text-sm font-medium text-foreground">
                              {formatCurrency(trade.quantity * trade.price)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground hidden sm:table-cell">
                              {trade.fee ? formatCurrency(trade.fee) : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Reusable stat pie card ───────────────────────────────────────────────────
function StatPieCard({ title, data }: { title: string; data: { name: string; value: number; pct: number }[] }) {
  return (
    <div className="bg-muted rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
            paddingAngle={3} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#111118', border: '1px solid #2e2e3e', borderRadius: 8, color: '#f1f5f9', fontSize: 11 }}
            formatter={(v) => [formatCurrency(Number(v)), '']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{d.name}</span>
            <span className="text-xs text-foreground font-medium">{d.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
