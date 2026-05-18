'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Plus, TrendingUp, TrendingDown, RefreshCw, ExternalLink, Loader2, Pencil, Trash2, BarChart2, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { AccountType, type Account } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { TradeDialog } from '@/components/investments/trade-dialog'
import { TbszDetailDialog } from '@/components/investments/tbsz-detail-dialog'
import { CustomViewDialog } from '@/components/investments/custom-view-dialog'
import { useQuotes, getAssetMeta, toYahooSymbol, type QuoteResult } from '@/lib/market-data'
import type { CustomPortfolioView } from '@/lib/store'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { toast } from 'sonner'

const COLORS = ['#94a3b8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
const CURRENT_YEAR = new Date().getFullYear()

function tbszYearsUntilFree(y: number) { return Math.max(0, y + 5 - CURRENT_YEAR) }
function tbszProgress(y: number) { return Math.min(((CURRENT_YEAR - y) / 5) * 100, 100) }

export default function InvestmentsPage() {
  const {
    accounts, investmentPositions, investmentTrades, updateAccount,
    customViews, deleteCustomView,
  } = useAppStore()

  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>()
  const [allampapirRate, setAllampapirRate] = useState('7.5')

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

  const enrichedPositions = useMemo(() => {
    return investmentPositions.map((pos) => {
      const q = quotes[pos.ticker]
      const livePrice = q?.price ?? pos.currentPrice
      const marketValue = pos.quantity * livePrice
      const cost = pos.quantity * pos.averageBuyPrice
      const pnl = marketValue - cost
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0
      const meta = getAssetMeta(pos.ticker)
      return { ...pos, livePrice, marketValue, pnl, pnlPercent, meta, q }
    })
  }, [investmentPositions, quotes])

  const totalCost = enrichedPositions.reduce((s, p) => s + p.quantity * p.averageBuyPrice, 0)
  const totalMarketValue = enrichedPositions.reduce((s, p) => s + p.marketValue, 0)
  const totalPnl = totalMarketValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const totalPortfolio = accounts
    .filter((a) => [AccountType.TBSZ, AccountType.BROKER, AccountType.ALLAMPAPIR].includes(a.type))
    .reduce((s, a) => s + a.balance, 0)

  const pieData = accounts.filter((a) => a.balance > 0).map((a) => ({ name: a.name, value: a.balance }))

  const getPositionsForAccount = (accountId: string) =>
    enrichedPositions.filter((p) => p.accountId === accountId)
  const getTradesForPosition = (positionId: string) =>
    investmentTrades.filter((t) => t.positionId === positionId)
  const getRawPositionsForAccount = (accountId: string) =>
    investmentPositions.filter((p) => p.accountId === accountId)

  const allampapirTotal = allampapirAccounts.reduce((s, a) => s + a.balance, 0)
  const annualRate = parseFloat(allampapirRate) / 100
  const annualInterest = allampapirTotal * annualRate
  const monthlyInterest = annualInterest / 12

  const openTradeDialog = (accountId?: string) => {
    setPreselectedAccountId(accountId)
    setTradeDialogOpen(true)
  }

  // Detail account info
  const detailAcc = detailAccount ? accounts.find((a) => a.id === detailAccount) ?? null : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Befektetések</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[#64748b] text-sm">Portfólió összesítő</p>
            {lastFetched && (
              <span className="text-[10px] text-[#64748b]">
                Frissítve: {format(new Date(lastFetched), 'HH:mm:ss', { locale: hu })}
              </span>
            )}
            <button
              onClick={refetch}
              disabled={quotesLoading}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300 disabled:opacity-50 transition-colors"
            >
              {quotesLoading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              {quotesLoading ? 'Betöltés…' : 'Frissítés'}
            </button>
          </div>
        </div>
        <Button
          onClick={() => openTradeDialog()}
          className="bg-slate-600 hover:bg-slate-500 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Új ügylet
        </Button>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="bg-[#1e1e2e] border border-[#2e2e3e] flex-wrap h-auto gap-1">
          {[
            ['summary', 'Összesítő'],
            ['tbsz', 'TBSZ Számlák'],
            ['allampapir', 'Állampapír'],
            ['custom', `Egyéni nézetek${customViews.length > 0 ? ` (${customViews.length})` : ''}`],
          ].map(([v, l]) => (
            <TabsTrigger
              key={v} value={v}
              className="data-[state=active]:bg-slate-600 data-[state=active]:text-white"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-[#111118] border-[#1e1e2e]">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748b]">Portfólió értéke</p>
                <p className="text-xl font-bold text-[#f1f5f9]">{formatCurrency(totalPortfolio)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e]">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748b]">Nyereség / Veszteség</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {totalPnl >= 0
                    ? <TrendingUp className="w-4 h-4 text-green-400" />
                    : <TrendingDown className="w-4 h-4 text-red-400" />}
                  <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e]">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748b]">Hozam</p>
                <p className={`text-xl font-bold mt-0.5 ${totalPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <PortfolioGrowthChart
            positions={enrichedPositions.map((p) => ({ ticker: p.ticker, quantity: p.quantity }))}
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="bg-[#111118] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-base text-[#f1f5f9]">Allokáció</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: 8, color: '#f1f5f9' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[#64748b] truncate">{d.name}</span>
                      </div>
                      <span className="text-[#f1f5f9] font-medium">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2 bg-[#111118] border-[#1e1e2e]">
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-base text-[#f1f5f9]">Összes pozíció</CardTitle>
                {quotesLoading && <Loader2 className="w-4 h-4 animate-spin text-[#64748b]" />}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                      <TableHead className="text-[#64748b] text-xs">Ticker</TableHead>
                      <TableHead className="text-[#64748b] text-xs">Szektor</TableHead>
                      <TableHead className="text-[#64748b] text-xs text-right">Db</TableHead>
                      <TableHead className="text-[#64748b] text-xs text-right">Átl. ár</TableHead>
                      <TableHead className="text-[#64748b] text-xs text-right">Aktuális</TableHead>
                      <TableHead className="text-[#64748b] text-xs text-right">Érték</TableHead>
                      <TableHead className="text-[#64748b] text-xs text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedPositions.map((pos) => (
                      <TableRow key={pos.id} className="border-[#1e1e2e] hover:bg-[#1e1e2e]/50">
                        <TableCell>
                          <p className="text-sm font-semibold text-[#f1f5f9]">{pos.ticker}</p>
                          <p className="text-xs text-[#64748b] max-w-28 truncate">{pos.meta.name}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-[#64748b]">{pos.meta.sector}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-[#f1f5f9]">{pos.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-[#64748b]">
                          {formatCurrency(pos.averageBuyPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm text-[#f1f5f9]">{formatCurrency(pos.livePrice)}</span>
                            {pos.q?.changePercent != null && (
                              <span className={`text-[10px] ${pos.q.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.q.changePercent >= 0 ? '+' : ''}{pos.q.changePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-[#f1f5f9]">
                          {formatCurrency(pos.marketValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                            <p className="text-[10px] font-normal">({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TBSZ Accounts ───────────────────────────────────────────────── */}
        <TabsContent value="tbsz" className="space-y-4 mt-4">
          {tbszAccounts.map((acc) => {
            const positions = getPositionsForAccount(acc.id)
            const yearsLeft = acc.tbszYear ? tbszYearsUntilFree(acc.tbszYear) : 0
            const progress = acc.tbszYear ? tbszProgress(acc.tbszYear) : 0
            const isFree = yearsLeft === 0

            return (
              <Card key={acc.id} className="bg-[#111118] border-[#1e1e2e]">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="text-base text-[#f1f5f9]">{acc.name}</CardTitle>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xl font-bold text-[#f1f5f9]">{formatCurrency(acc.balance)}</span>
                        {isFree ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Adómentes</Badge>
                        ) : (
                          <span className="text-sm text-[#64748b]">{yearsLeft} év múlva adómentes</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setDetailAccount(acc.id)}
                        variant="outline" size="sm"
                        className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] gap-1.5 h-8 text-xs"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        Részletes nézet
                      </Button>
                      <Button
                        onClick={() => openTradeDialog(acc.id)}
                        variant="outline" size="sm"
                        className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] gap-1.5 h-8 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Új ügylet
                      </Button>
                    </div>
                  </div>
                  {acc.tbszYear && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-[#64748b]">
                        <span>Nyitva: {acc.tbszYear}</span>
                        <span>{progress.toFixed(0)}% — {isFree ? 'Adómentességi időszak' : `${yearsLeft} év hátra`}</span>
                      </div>
                      <Progress value={progress} className="h-1.5 bg-[#1e1e2e]" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {positions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                          <TableHead className="text-[#64748b] text-xs">Ticker</TableHead>
                          <TableHead className="text-[#64748b] text-xs">Szektor</TableHead>
                          <TableHead className="text-[#64748b] text-xs text-right">Db</TableHead>
                          <TableHead className="text-[#64748b] text-xs text-right">Átl. ár</TableHead>
                          <TableHead className="text-[#64748b] text-xs text-right">Live ár</TableHead>
                          <TableHead className="text-[#64748b] text-xs text-right">P&L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((pos) => (
                          <TableRow key={pos.id} className="border-[#1e1e2e] hover:bg-[#1e1e2e]/50">
                            <TableCell>
                              <p className="text-sm font-semibold text-[#f1f5f9]">{pos.ticker}</p>
                              <p className="text-xs text-[#64748b]">{pos.meta.name}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-[#64748b]">{pos.meta.sector}</span>
                            </TableCell>
                            <TableCell className="text-right text-sm text-[#f1f5f9]">{pos.quantity}</TableCell>
                            <TableCell className="text-right text-sm text-[#64748b]">
                              {formatCurrency(pos.averageBuyPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm text-[#f1f5f9] font-medium">{formatCurrency(pos.livePrice)}</span>
                                {pos.q?.changePercent != null && (
                                  <span className={`text-[10px] ${pos.q.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {pos.q.changePercent >= 0 ? '+' : ''}{pos.q.changePercent.toFixed(2)}% ma
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                                <span className="text-[10px] font-normal ml-1">({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)</span>
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-[#64748b] text-sm text-center py-4">Nincs pozíció ezen a számlán</p>
                  )}

                  {positions.length > 0 && (
                    <div>
                      <p className="text-xs text-[#64748b] mb-2 font-medium uppercase tracking-wide">Ügylet előzmények</p>
                      <div className="space-y-1.5">
                        {positions.flatMap((pos) =>
                          getTradesForPosition(pos.id).map((trade) => (
                            <div key={trade.id} className="flex items-center justify-between text-xs bg-[#1e1e2e] rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] px-1.5 py-0 border ${
                                  trade.type === 'BUY'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}>
                                  {trade.type === 'BUY' ? 'Vétel' : 'Eladás'}
                                </Badge>
                                <span className="text-[#f1f5f9] font-medium">{pos.ticker}</span>
                                <span className="text-[#64748b]">{trade.quantity} × {formatCurrency(trade.price)}</span>
                              </div>
                              <span className="text-[#64748b]">
                                {format(new Date(trade.date), 'yyyy. MM. dd.', { locale: hu })}
                              </span>
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
        <TabsContent value="allampapir" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#111118] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-base text-[#f1f5f9]">Magyar Állampapír</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allampapirAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 bg-[#1e1e2e] rounded-lg">
                    <span className="text-sm font-medium text-[#f1f5f9]">{acc.name}</span>
                    <span className="text-sm font-bold text-amber-400">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
                <div className="border-t border-[#1e1e2e] pt-3 flex justify-between">
                  <span className="text-sm text-[#64748b]">Összesen</span>
                  <span className="text-sm font-bold text-[#f1f5f9]">{formatCurrency(allampapirTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111118] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-base text-[#f1f5f9]">Hozam kalkulátor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-[#64748b] mb-1.5">Éves kamatláb (%)</p>
                  <Input
                    type="number" value={allampapirRate}
                    onChange={(e) => setAllampapirRate(e.target.value)}
                    className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]"
                    step="0.1" min="0"
                  />
                </div>
                <div className="space-y-3">
                  {[
                    ['Éves kamatbevétel', annualInterest],
                    ['Havi kamatbevétel', monthlyInterest],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center p-3 bg-[#1e1e2e] rounded-lg">
                      <span className="text-sm text-[#64748b]">{label as string}</span>
                      <span className="text-sm font-bold text-green-400">{formatCurrency(val as number)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-slate-400/10 border border-slate-400/20 rounded-lg">
                    <span className="text-sm text-slate-400">Napi kamatbevétel</span>
                    <span className="text-sm font-bold text-slate-400">{formatCurrency(annualInterest / 365)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Custom views ─────────────────────────────────────────────────── */}
        <TabsContent value="custom" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#f1f5f9] font-medium">Egyéni portfólió nézetek</p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Kombinálj több TBSZ és befektetési számlát egy összesítő nézetbe
              </p>
            </div>
            <Button
              onClick={() => { setEditingView(null); setCustomViewDialogOpen(true) }}
              className="bg-slate-600 hover:bg-slate-500 text-white gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Új nézet
            </Button>
          </div>

          {customViews.length === 0 ? (
            <Card className="bg-[#111118] border-[#1e1e2e] border-dashed">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <Eye className="w-10 h-10 text-[#2e2e3e]" />
                <p className="text-[#64748b] text-sm">Még nincs egyéni nézeted</p>
                <p className="text-[#64748b] text-xs max-w-xs">
                  Hozz létre egy nézetet, hogy több TBSZ számlát egyszerre tekinthess át —
                  pl. kombinálj IBKR és Erste TBSZ számlákat.
                </p>
                <Button
                  onClick={() => { setEditingView(null); setCustomViewDialogOpen(true) }}
                  className="bg-slate-600 hover:bg-slate-500 text-white gap-2 mt-2"
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
  quantity: number
  averageBuyPrice: number
  livePrice: number
  marketValue: number
  pnl: number
  pnlPercent: number
  meta: ReturnType<typeof getAssetMeta>
  q: QuoteResult | undefined
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

function PortfolioGrowthChart({ positions }: { positions: { ticker: string; quantity: number }[] }) {
  const [selectedRange, setSelectedRange] = useState(GROWTH_RANGES[6])
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(false)

  const posKey = positions.map((p) => `${p.ticker}:${p.quantity}`).join(',')

  useEffect(() => {
    if (positions.length === 0) return
    setLoading(true)

    const uniqueTickers = [...new Set(positions.map((p) => p.ticker))]

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
      // Build fill-forward price maps per ticker
      const priceMaps: Record<string, Record<string, number>> = {}
      for (const { ticker, points } of results) {
        const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
        const map: Record<string, number> = {}
        let last = 0
        for (const p of sorted) {
          last = p.close
          map[p.date] = last
        }
        priceMaps[ticker] = map
      }

      // Collect all dates across all tickers
      const allDates = [...new Set(results.flatMap(({ points }) => points.map((p) => p.date)))].sort()

      // For each date compute portfolio value using fill-forward
      const lastPrice: Record<string, number> = {}
      const merged: { date: string; value: number }[] = []

      for (const date of allDates) {
        let total = 0
        let hasAny = false

        for (const { ticker } of positions) {
          const map = priceMaps[ticker] ?? {}
          if (map[date] != null) lastPrice[ticker] = map[date]
          if (lastPrice[ticker] != null) {
            total += lastPrice[ticker] * positions
              .filter((p) => p.ticker === ticker)
              .reduce((s, p) => s + p.quantity, 0)
            hasAny = true
          }
        }

        if (hasAny) merged.push({ date, value: Math.round(total) })
      }

      setChartData(merged)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRange.range, selectedRange.interval, posKey])

  const dateFormatter = (d: string) => {
    if (!d) return ''
    if (selectedRange.range === '1d') return d.slice(11, 16)
    if (['5d', '1mo', '3mo'].includes(selectedRange.range)) {
      const dt = new Date(d)
      return `${dt.getMonth() + 1}/${dt.getDate()}`
    }
    const dt = new Date(d)
    return `${dt.getFullYear().toString().slice(2)}/${String(dt.getMonth() + 1).padStart(2, '0')}`
  }

  const startValue = chartData[0]?.value ?? 0
  const endValue = chartData[chartData.length - 1]?.value ?? 0
  const gain = endValue - startValue
  const gainPct = startValue > 0 ? (gain / startValue) * 100 : 0
  const isPositive = gain >= 0

  return (
    <Card className="bg-[#111118] border-[#1e1e2e]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base text-[#f1f5f9] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
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
                <span className="text-xs text-[#64748b]">a kiválasztott időszakban</span>
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
                    ? 'bg-slate-600 text-white'
                    : 'text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[240px] flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-[#64748b]">
            Nincs adat a kiválasztott időszakra
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={dateFormatter}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                width={44}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), 'Érték']}
                labelFormatter={(l) => String(l).slice(0, 10)}
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#94a3b8"
                strokeWidth={2}
                fill="url(#portfolioGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#94a3b8' }}
              />
            </AreaChart>
          </ResponsiveContainer>
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

  const totalValue = viewPositions.reduce((s, p) => s + p.marketValue, 0)
  const totalCost  = viewPositions.reduce((s, p) => s + p.quantity * p.averageBuyPrice, 0)
  const totalPnl   = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  // Sector breakdown for this view
  const sectorMap: Record<string, number> = {}
  viewPositions.forEach((p) => {
    sectorMap[p.meta.sector] = (sectorMap[p.meta.sector] ?? 0) + p.marketValue
  })
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const COLORS = ['#94a3b8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <Card className="bg-[#111118] border-[#1e1e2e]">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base text-[#f1f5f9]">{view.name}</CardTitle>
            {view.description && (
              <p className="text-xs text-[#64748b] mt-0.5">{view.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {viewAccounts.map((a) => (
                <Badge key={a.id} className="text-[10px] bg-[#1e1e2e] text-[#64748b] border-[#2e2e3e] border">
                  {a.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onEdit}
              className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] h-7 w-7 p-0">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}
              className="border-[#2e2e3e] text-[#64748b] hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#1e1e2e] rounded-lg p-3">
            <p className="text-xs text-[#64748b]">Összértéke</p>
            <p className="text-base font-bold text-[#f1f5f9] mt-0.5">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-[#1e1e2e] rounded-lg p-3">
            <p className="text-xs text-[#64748b]">P&L</p>
            <p className={`text-base font-bold mt-0.5 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </p>
          </div>
          <div className="bg-[#1e1e2e] rounded-lg p-3">
            <p className="text-xs text-[#64748b]">Hozam</p>
            <p className={`text-base font-bold mt-0.5 ${totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Positions */}
          <div className="space-y-1.5">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide mb-2">Pozíciók</p>
            {viewPositions.length === 0 ? (
              <p className="text-xs text-[#64748b]">Nincs pozíció</p>
            ) : (
              viewPositions.map((pos) => (
                <div key={pos.accountId + pos.ticker}
                  className="flex items-center justify-between text-xs bg-[#1e1e2e] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#f1f5f9]">{pos.ticker}</span>
                    <span className="text-[#64748b]">{pos.quantity} db</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#f1f5f9]">{formatCurrency(pos.marketValue)}</span>
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
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide mb-2">Szektor bontás</p>
              {sectorData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-[#64748b] flex-1 truncate">{s.name}</span>
                  <div className="w-20">
                    <Progress value={s.pct} className="h-1 bg-[#2e2e3e]" />
                  </div>
                  <span className="text-xs text-[#f1f5f9] w-8 text-right">{s.pct.toFixed(0)}%</span>
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
                  className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] gap-1.5 h-7 text-xs"
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
