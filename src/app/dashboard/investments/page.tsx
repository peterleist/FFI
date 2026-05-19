'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import { Plus, TrendingUp, TrendingDown, RefreshCw, ExternalLink, Loader2, Pencil, Trash2, BarChart2, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/lib/store'
import { AccountType, type Account } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { TradeDialog } from '@/components/investments/trade-dialog'
import { TbszDetailDialog } from '@/components/investments/tbsz-detail-dialog'
import { CustomViewDialog } from '@/components/investments/custom-view-dialog'
import { AllampapirPanel } from '@/components/investments/allampapir-panel'
import { useQuotes, getAssetMeta, toYahooSymbol, useFxRates, toHuf, type QuoteResult } from '@/lib/market-data'
import type { CustomPortfolioView } from '@/lib/store'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { toast } from 'sonner'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#14B8A6']
const CURRENT_YEAR = new Date().getFullYear()

function tbszYearsUntilFree(y: number) { return Math.max(0, y + 5 - CURRENT_YEAR) }
function tbszProgress(y: number) { return Math.min(((CURRENT_YEAR - y) / 5) * 100, 100) }

export default function InvestmentsPage() {
  const {
    accounts, investmentPositions, investmentTrades, updateAccount,
    customViews, deleteCustomView, deleteInvestmentTrade, deleteInvestmentPosition,
  } = useAppStore()

  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>()

  // TBSZ detail dialog
  const [detailAccount, setDetailAccount] = useState<string | null>(null)

  // Custom view dialog
  const [customViewDialogOpen, setCustomViewDialogOpen] = useState(false)
  const [editingView, setEditingView] = useState<CustomPortfolioView | null>(null)

  const tbszAccounts = accounts.filter((a) => a.type === AccountType.TBSZ)
  const allampapirAccounts = accounts.filter((a) => a.type === AccountType.ALLAMPAPIR)

  // Live quotes for all investment positions
  const allTickers = [...new Set(investmentPositions.map((p) => p.ticker))]
  const { quotes, loading: quotesLoading, lastFetched, refetch } = useQuotes(allTickers)
  const { rates: fxRates } = useFxRates()

  const enrichedPositions = useMemo(() => {
    return investmentPositions.map((pos) => {
      const q = quotes[pos.ticker]
      const livePrice = q?.price ?? pos.currentPrice
      const meta = getAssetMeta(pos.ticker)
      // meta.currency is the authoritative source; fixes positions created before currency selector
      const currency = meta.currency || pos.currency
      // Native-currency figures
      const marketValue = pos.quantity * livePrice
      const cost = pos.quantity * pos.averageBuyPrice
      const pnl = marketValue - cost
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0
      // HUF-converted figures — the ONLY values safe to sum across positions
      const marketValueHuf = toHuf(marketValue, currency, fxRates)
      const costHuf = toHuf(cost, currency, fxRates)
      const pnlHuf = marketValueHuf - costHuf
      return {
        ...pos, currency, livePrice, meta, q,
        marketValue, cost, pnl, pnlPercent,
        marketValueHuf, costHuf, pnlHuf,
      }
    })
  }, [investmentPositions, quotes, fxRates])

  // Totals — always aggregate the HUF-converted values
  const totalCost = enrichedPositions.reduce((s, p) => s + p.costHuf, 0)
  const totalMarketValue = enrichedPositions.reduce((s, p) => s + p.marketValueHuf, 0)
  const totalPnl = totalMarketValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  // Allocation by ticker, using live HUF market value
  const pieData = useMemo(() => {
    const byTicker: Record<string, number> = {}
    for (const p of enrichedPositions) {
      byTicker[p.ticker] = (byTicker[p.ticker] ?? 0) + p.marketValueHuf
    }
    return Object.entries(byTicker)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [enrichedPositions])

  // Exposure breakdowns (sector / region / asset class / currency), HUF value
  const breakdowns = useMemo(() => {
    const group = (keyFn: (p: typeof enrichedPositions[number]) => string) => {
      const map: Record<string, number> = {}
      for (const p of enrichedPositions) {
        const k = keyFn(p) || 'Egyéb'
        map[k] = (map[k] ?? 0) + p.marketValueHuf
      }
      return Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
    }
    return {
      sector: group((p) => p.meta.sector),
      region: group((p) => p.meta.region),
      assetClass: group((p) => p.meta.assetClass),
      currency: group((p) => p.currency),
    }
  }, [enrichedPositions])

  const getPositionsForAccount = (accountId: string) =>
    enrichedPositions.filter((p) => p.accountId === accountId)
  const getTradesForPosition = (positionId: string) =>
    investmentTrades.filter((t) => t.positionId === positionId)
  const getRawPositionsForAccount = (accountId: string) =>
    investmentPositions.filter((p) => p.accountId === accountId)

  const openTradeDialog = (accountId?: string) => {
    setPreselectedAccountId(accountId)
    setTradeDialogOpen(true)
  }

  // Detail account info
  const detailAcc = detailAccount ? accounts.find((a) => a.id === detailAccount) ?? null : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-hd">
        <div>
          <div className="crumb">Portfólió</div>
          <h1>Befektetések</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {lastFetched && (
            <span className="pf-badge">
              <span className="live-dot" />
              {format(new Date(lastFetched), 'HH:mm', { locale: hu })}
            </span>
          )}
          <button className="pf-btn sm" type="button" onClick={refetch} disabled={quotesLoading}>
            {quotesLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Frissítés
          </button>
          <button className="pf-btn sm primary" type="button" onClick={() => openTradeDialog()}>
            <Plus className="w-3 h-3" />
            Új ügylet
          </button>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="bg-muted border border-border flex-wrap h-auto gap-1">
          {[
            ['summary', 'Összesítő'],
            ['tbsz', 'TBSZ Számlák'],
            ['allampapir', 'Állampapír'],
            ['custom', `Egyéni nézetek${customViews.length > 0 ? ` (${customViews.length})` : ''}`],
          ].map(([v, l]) => (
            <TabsTrigger
              key={v} value={v}
              className="data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          {/* Portfolio hero */}
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between flex-wrap gap-6">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Portfólió piaci értéke
                  </p>
                  <p className="text-4xl font-bold text-foreground tracking-tight mt-1.5 tabular-nums">
                    {formatCurrency(totalMarketValue)}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      totalPnl >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {totalPnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                    </span>
                    <span className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted-foreground">összesített hozam</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-muted rounded-xl px-4 py-3 min-w-[140px]">
                    <p className="text-[11px] text-muted-foreground">Bekerülési költség</p>
                    <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                      {formatCurrency(totalCost)}
                    </p>
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3 min-w-[100px]">
                    <p className="text-[11px] text-muted-foreground">Pozíciók</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {enrichedPositions.length} <span className="text-sm text-muted-foreground font-medium">db</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <PortfolioGrowthChart
            positions={enrichedPositions.map((p) => ({ ticker: p.ticker, quantity: p.quantity }))}
            fxRates={fxRates}
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">Eszközallokáció</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16">Nincs pozíció</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={75}
                          paddingAngle={3} dataKey="value" stroke="none">
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v) => formatCurrency(Number(v))}
                          contentStyle={{ backgroundColor: '#18191D', border: '1px solid #27282E', borderRadius: 8, color: '#E4E4E7' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-3">
                      {pieData.map((d, i) => {
                        const pct = totalMarketValue > 0 ? (d.value / totalMarketValue) * 100 : 0
                        return (
                          <div key={d.name} className="flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-foreground font-medium truncate">{d.name}</span>
                              <span className="text-muted-foreground shrink-0">{pct.toFixed(1)}%</span>
                            </div>
                            <span className="text-muted-foreground tabular-nums shrink-0">{formatCurrency(d.value)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2 bg-card border-border">
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-base text-foreground">Összes pozíció</CardTitle>
                {quotesLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Ticker</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Szektor</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Db</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Átl. ár</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Aktuális</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Érték</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">P&L</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedPositions.map((pos) => (
                      <TableRow key={pos.id} className="border-border hover:bg-muted/50 group">
                        <TableCell>
                          <p className="text-sm font-semibold text-foreground">{pos.ticker}</p>
                          <p className="text-xs text-muted-foreground max-w-28 truncate">{pos.meta.name}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{pos.meta.sector}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">{pos.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          <PriceCell amount={pos.averageBuyPrice} currency={pos.currency} fxRates={fxRates} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PriceCell amount={pos.livePrice} currency={pos.currency} fxRates={fxRates} className="text-sm text-foreground" />
                          {pos.q?.changePercent != null && (
                            <span className={`text-[10px] ${pos.q.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pos.q.changePercent >= 0 ? '+' : ''}{pos.q.changePercent.toFixed(2)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">
                          <PriceCell amount={pos.marketValue} currency={pos.currency} fxRates={fxRates} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl, pos.currency)}
                            {pos.currency !== 'HUF' && (
                              <span className="block text-[10px] font-normal text-muted-foreground/70">
                                {pos.pnl >= 0 ? '+' : ''}{formatCurrency(toHuf(pos.pnl, pos.currency, fxRates))}
                              </span>
                            )}
                            <p className="text-[10px] font-normal">({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => {
                              deleteInvestmentPosition(pos.id)
                              toast.success(`${pos.ticker} törölve`)
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Exposure analysis */}
          {enrichedPositions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground px-0.5">Kitettség elemzés</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <BreakdownCard title="Szektor kitettség" data={breakdowns.sector} total={totalMarketValue} />
                <BreakdownCard title="Régió szerint" data={breakdowns.region} total={totalMarketValue} />
                <BreakdownCard title="Eszköztípus" data={breakdowns.assetClass} total={totalMarketValue} />
                <BreakdownCard title="Deviza kitettség" data={breakdowns.currency} total={totalMarketValue} />
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TBSZ Accounts ───────────────────────────────────────────────── */}
        <TabsContent value="tbsz" className="space-y-4 mt-4">
          {tbszAccounts.map((acc) => {
            const positions = getPositionsForAccount(acc.id)
            const yearsLeft = acc.tbszYear ? tbszYearsUntilFree(acc.tbszYear) : 0
            const progress = acc.tbszYear ? tbszProgress(acc.tbszYear) : 0
            const isFree = yearsLeft === 0

            return (
              <Card key={acc.id} className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="text-base text-foreground">{acc.name}</CardTitle>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xl font-bold text-foreground">{formatCurrency(acc.balance)}</span>
                        {isFree ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Adómentes</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">{yearsLeft} év múlva adómentes</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setDetailAccount(acc.id)}
                        variant="outline" size="sm"
                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 h-8 text-xs"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        Részletes nézet
                      </Button>
                      <Button
                        onClick={() => openTradeDialog(acc.id)}
                        variant="outline" size="sm"
                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 h-8 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Új ügylet
                      </Button>
                    </div>
                  </div>
                  {acc.tbszYear && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Nyitva: {acc.tbszYear}</span>
                        <span>{progress.toFixed(0)}% — {isFree ? 'Adómentességi időszak' : `${yearsLeft} év hátra`}</span>
                      </div>
                      <Progress value={progress} className="h-1.5 bg-muted" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {positions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground text-xs">Ticker</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Szektor</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Db</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Átl. ár</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Live ár</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">P&L</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((pos) => (
                          <TableRow key={pos.id} className="border-border hover:bg-muted/50 group">
                            <TableCell>
                              <p className="text-sm font-semibold text-foreground">{pos.ticker}</p>
                              <p className="text-xs text-muted-foreground">{pos.meta.name}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">{pos.meta.sector}</span>
                            </TableCell>
                            <TableCell className="text-right text-sm text-foreground">{pos.quantity}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              <PriceCell amount={pos.averageBuyPrice} currency={pos.currency} fxRates={fxRates} />
                            </TableCell>
                            <TableCell className="text-right">
                              <PriceCell amount={pos.livePrice} currency={pos.currency} fxRates={fxRates} className="text-sm text-foreground font-medium" />
                              {pos.q?.changePercent != null && (
                                <span className={`text-[10px] ${pos.q.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pos.q.changePercent >= 0 ? '+' : ''}{pos.q.changePercent.toFixed(2)}% ma
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl, pos.currency)}
                                {pos.currency !== 'HUF' && (
                                  <span className="block text-[10px] font-normal text-muted-foreground/70">
                                    {pos.pnl >= 0 ? '+' : ''}{formatCurrency(toHuf(pos.pnl, pos.currency, fxRates))}
                                  </span>
                                )}
                                <span className="text-[10px] font-normal ml-1">({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)</span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => {
                                  deleteInvestmentPosition(pos.id)
                                  toast.success(`${pos.ticker} törölve`)
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">Nincs pozíció ezen a számlán</p>
                  )}

                  {positions.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Ügylet előzmények</p>
                      <div className="space-y-1.5">
                        {positions.flatMap((pos) =>
                          getTradesForPosition(pos.id).map((trade) => (
                            <div key={trade.id} className="flex items-center justify-between text-xs bg-muted rounded-lg px-3 py-2 group">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] px-1.5 py-0 border ${
                                  trade.type === 'BUY'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}>
                                  {trade.type === 'BUY' ? 'Vétel' : 'Eladás'}
                                </Badge>
                                <span className="text-foreground font-medium">{pos.ticker}</span>
                                <span className="text-muted-foreground">
                                  {trade.quantity} × {formatCurrency(trade.price, pos.currency)}
                                  {pos.currency !== 'HUF' && (
                                    <span className="ml-1 text-muted-foreground/60">
                                      ({formatCurrency(toHuf(trade.price, pos.currency, fxRates))})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">
                                  {format(new Date(trade.date), 'yyyy. MM. dd.', { locale: hu })}
                                </span>
                                <button
                                  onClick={() => {
                                    deleteInvestmentTrade(trade.id)
                                    toast.success('Ügylet törölve')
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* ── Állampapír ──────────────────────────────────────────────────── */}
        <TabsContent value="allampapir" className="mt-4">
          <AllampapirPanel accounts={allampapirAccounts} />
        </TabsContent>

        {/* ── Custom views ─────────────────────────────────────────────────── */}
        <TabsContent value="custom" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">Egyéni portfólió nézetek</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kombinálj több TBSZ és befektetési számlát egy összesítő nézetbe
              </p>
            </div>
            <Button
              onClick={() => { setEditingView(null); setCustomViewDialogOpen(true) }}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Új nézet
            </Button>
          </div>

          {customViews.length === 0 ? (
            <Card className="bg-card border-border border-dashed">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <Eye className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">Még nincs egyéni nézeted</p>
                <p className="text-muted-foreground text-xs max-w-xs">
                  Hozz létre egy nézetet, hogy több TBSZ számlát egyszerre tekinthess át —
                  pl. kombinálj IBKR és Erste TBSZ számlákat.
                </p>
                <Button
                  onClick={() => { setEditingView(null); setCustomViewDialogOpen(true) }}
                  className="bg-primary hover:bg-primary/90 text-white gap-2 mt-2"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  Első nézet létrehozása
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {customViews.map((view) => (
                <CustomViewCard
                  key={view.id}
                  view={view}
                  accounts={accounts}
                  enrichedPositions={enrichedPositions}
                  onEdit={() => { setEditingView(view); setCustomViewDialogOpen(true) }}
                  onDelete={() => {
                    deleteCustomView(view.id)
                    toast.success('Nézet törölve')
                  }}
                  onOpenDetail={(accId) => setDetailAccount(accId)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TradeDialog
        open={tradeDialogOpen}
        onOpenChange={setTradeDialogOpen}
        preselectedAccountId={preselectedAccountId}
      />

      {detailAcc && (
        <TbszDetailDialog
          account={detailAcc}
          positions={getRawPositionsForAccount(detailAcc.id)}
          trades={investmentTrades}
          open={!!detailAccount}
          onOpenChange={(v) => { if (!v) setDetailAccount(null) }}
        />
      )}

      <CustomViewDialog
        open={customViewDialogOpen}
        onOpenChange={setCustomViewDialogOpen}
        editView={editingView}
      />
    </div>
  )
}

interface EnrichedPosition {
  id: string
  accountId: string
  ticker: string
  currency: string
  quantity: number
  averageBuyPrice: number
  livePrice: number
  marketValue: number
  cost: number
  pnl: number
  pnlPercent: number
  marketValueHuf: number
  costHuf: number
  pnlHuf: number
  meta: ReturnType<typeof getAssetMeta>
  q: QuoteResult | undefined
}

// ── Price cell with optional HUF equivalent ──────────────────────────────────

function PriceCell({
  amount, currency, fxRates, className = '',
}: {
  amount: number
  currency: string
  fxRates: ReturnType<typeof useFxRates>['rates']
  className?: string
}) {
  if (currency === 'HUF') {
    return <span className={className}>{formatCurrency(amount, 'HUF')}</span>
  }
  return (
    <span className={className}>
      {formatCurrency(amount, currency)}
      <span className="block text-[10px] text-muted-foreground/70 tabular-nums">
        {formatCurrency(toHuf(amount, currency, fxRates))}
      </span>
    </span>
  )
}

// ── Exposure breakdown donut card ─────────────────────────────────────────────

function BreakdownCard({
  title, data, total,
}: {
  title: string
  data: { name: string; value: number }[]
  total: number
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">Nincs adat</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  contentStyle={{ backgroundColor: '#18191D', border: '1px solid #27282E', borderRadius: 8, color: '#E4E4E7' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {data.map((d, i) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0
                return (
                  <div key={d.name} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-foreground truncate">{d.name}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 tabular-nums">{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Portfolio Growth Chart ────────────────────────────────────────────────────
const GROWTH_RANGES = [
  { label: '1N',  range: '1d',  interval: '5m'  },
  { label: '5N',  range: '5d',  interval: '1h'  },
  { label: '1H',  range: '1mo', interval: '1d'  },
  { label: '3H',  range: '3mo', interval: '1d'  },
  { label: '6H',  range: '6mo', interval: '1wk' },
  { label: 'YTD', range: 'ytd', interval: '1wk' },
  { label: '1É',  range: '1y',  interval: '1wk' },
  { label: '2É',  range: '2y',  interval: '1mo' },
  { label: '5É',  range: '5y',  interval: '1mo' },
]

function PortfolioAreaChart({ data }: { data: { date: string; value: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    chartRef.current?.remove()
    chartRef.current = null

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#18191D' },
        textColor: '#71717A',
        fontFamily: 'inherit',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#27282E' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        horzLine: { visible: false, labelVisible: false },
        vertLine: { color: '#444', labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: 240,
    })

    chart.applyOptions({
      localization: {
        priceFormatter: (v: number) => {
          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M Ft`
          if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K Ft`
          return `${v.toFixed(0)} Ft`
        },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#3B82F6',
      topColor: 'rgba(59,130,246,0.25)',
      bottomColor: 'rgba(59,130,246,0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerBorderColor: '#18191D',
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerRadius: 4,
    })

    series.setData(data.map(d => ({ time: d.date as Time, value: d.value })))
    chart.timeScale().fitContent()
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [data])

  return <div ref={containerRef} style={{ width: '100%', height: 240 }} />
}

function PortfolioGrowthChart({
  positions, fxRates,
}: {
  positions: { ticker: string; quantity: number }[]
  fxRates: ReturnType<typeof useFxRates>['rates']
}) {
  const [selectedRange, setSelectedRange] = useState(GROWTH_RANGES[6])
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(false)

  const posKey = positions.map((p) => `${p.ticker}:${p.quantity}`).join(',')

  useEffect(() => {
    if (positions.length === 0) return
    setLoading(true)

    const uniqueTickers = [...new Set(positions.map((p) => p.ticker))]
    // Quantity and currency per ticker
    const qtyByTicker: Record<string, number> = {}
    for (const p of positions) qtyByTicker[p.ticker] = (qtyByTicker[p.ticker] ?? 0) + p.quantity

    Promise.all(
      uniqueTickers.map((ticker) =>
        fetch(
          `/api/market-data/history?ticker=${encodeURIComponent(toYahooSymbol(ticker))}&range=${selectedRange.range}&interval=${selectedRange.interval}`
        )
          .then((r) => r.json())
          .then((d) => ({ ticker, points: (d.points ?? []) as { date: string; close: number }[] }))
          .catch(() => ({ ticker, points: [] as { date: string; close: number }[] }))
      )
    ).then((results) => {
      const priceMaps: Record<string, Record<string, number>> = {}
      for (const { ticker, points } of results) {
        const map: Record<string, number> = {}
        for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) map[p.date] = p.close
        priceMaps[ticker] = map
      }

      const allDates = [...new Set(results.flatMap(({ points }) => points.map((p) => p.date)))].sort()
      const lastPrice: Record<string, number> = {}
      const merged: { date: string; value: number }[] = []

      for (const date of allDates) {
        let total = 0; let hasAny = false
        for (const ticker of uniqueTickers) {
          const map = priceMaps[ticker] ?? {}
          if (map[date] != null) lastPrice[ticker] = map[date]
          if (lastPrice[ticker] != null) {
            // Convert native price to HUF before aggregating across currencies
            const currency = getAssetMeta(ticker).currency || 'HUF'
            const priceHuf = toHuf(lastPrice[ticker], currency, fxRates)
            total += priceHuf * (qtyByTicker[ticker] ?? 0)
            hasAny = true
          }
        }
        if (hasAny) merged.push({ date, value: Math.round(total) })
      }

      setChartData(merged)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRange.range, selectedRange.interval, posKey, fxRates.EUR, fxRates.USD])

  const startValue = chartData[0]?.value ?? 0
  const endValue = chartData[chartData.length - 1]?.value ?? 0
  const gain = endValue - startValue
  const gainPct = startValue > 0 ? (gain / startValue) * 100 : 0
  const isPositive = gain >= 0

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Portfólió növekedés
            </CardTitle>
            {chartData.length > 0 && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(gain)}
                </span>
                <span className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  ({isPositive ? '+' : ''}{gainPct.toFixed(2)}%)
                </span>
                <span className="text-xs text-muted-foreground">a kiválasztott időszakban</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {GROWTH_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setSelectedRange(r)}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  selectedRange.label === r.label
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {loading ? (
          <div className="h-[240px] flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
            Nincs adat a kiválasztott időszakra
          </div>
        ) : (
          <PortfolioAreaChart data={chartData} />
        )}
      </CardContent>
    </Card>
  )
}

// ── Custom View Card ──────────────────────────────────────────────────────────
function CustomViewCard({
  view, accounts, enrichedPositions, onEdit, onDelete, onOpenDetail,
}: {
  view: CustomPortfolioView
  accounts: Account[]
  enrichedPositions: EnrichedPosition[]
  onEdit: () => void
  onDelete: () => void
  onOpenDetail: (accId: string) => void
}) {
  const viewAccounts = accounts.filter((a) => view.accountIds.includes(a.id))
  const viewPositions = enrichedPositions.filter((p) => view.accountIds.includes(p.accountId))

  const totalValue = viewPositions.reduce((s, p) => s + p.marketValueHuf, 0)
  const totalCost  = viewPositions.reduce((s, p) => s + p.costHuf, 0)
  const totalPnl   = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  // Sector breakdown for this view
  const sectorMap: Record<string, number> = {}
  viewPositions.forEach((p) => {
    sectorMap[p.meta.sector] = (sectorMap[p.meta.sector] ?? 0) + p.marketValueHuf
  })
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const COLORS = ['#94a3b8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base text-foreground">{view.name}</CardTitle>
            {view.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{view.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {viewAccounts.map((a) => (
                <Badge key={a.id} className="text-[10px] bg-muted text-muted-foreground border-border border">
                  {a.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onEdit}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted h-7 w-7 p-0">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}
              className="border-border text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Összértéke</p>
            <p className="text-base font-bold text-foreground mt-0.5">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">P&L</p>
            <p className={`text-base font-bold mt-0.5 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Hozam</p>
            <p className={`text-base font-bold mt-0.5 ${totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Positions */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Pozíciók</p>
            {viewPositions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nincs pozíció</p>
            ) : (
              viewPositions.map((pos) => (
                <div key={pos.accountId + pos.ticker}
                  className="flex items-center justify-between text-xs bg-muted rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{pos.ticker}</span>
                    <span className="text-muted-foreground">{pos.quantity} db</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{formatCurrency(pos.marketValueHuf)}</span>
                    <span className={`${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sector breakdown */}
          {sectorData.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Szektor bontás</p>
              {sectorData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-muted-foreground flex-1 truncate">{s.name}</span>
                  <div className="w-20">
                    <Progress value={s.pct} className="h-1 bg-muted/50" />
                  </div>
                  <span className="text-xs text-foreground w-8 text-right">{s.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {viewAccounts.filter((a) => a.type === AccountType.TBSZ).length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {viewAccounts
              .filter((a) => a.type === AccountType.TBSZ)
              .map((a) => (
                <Button
                  key={a.id}
                  variant="outline" size="sm"
                  onClick={() => onOpenDetail(a.id)}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 h-7 text-xs"
                >
                  <BarChart2 className="w-3 h-3" />
                  {a.name} részletei
                </Button>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
