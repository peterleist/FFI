'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { CalendarIcon, Loader2, Search, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { SimplePopover, SimplePopoverTrigger, SimplePopoverContent } from '@/components/ui/simple-popover'
import { cn, formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { AccountType, TradeType, type InvestmentPosition, type InvestmentTrade } from '@/lib/types'
import { toast } from 'sonner'
import { resolveTicker } from '@/lib/market-data'
import type { TickerSearchResult } from '@/app/api/market-data/search/route'

// Trades are always in a foreign currency — never HUF.
const CURRENCIES = ['EUR', 'USD'] as const
type Currency = typeof CURRENCIES[number]

const CURRENCY_SYMBOLS: Record<Currency, string> = { EUR: '€', USD: '$' }

interface TradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectedAccountId?: string
}

export function TradeDialog({ open, onOpenChange, preselectedAccountId }: TradeDialogProps) {
  const { accounts, investmentPositions, addInvestmentTrade, addInvestmentPosition } = useAppStore()

  const tbszAccounts = accounts.filter((a) => a.type === AccountType.TBSZ || a.type === AccountType.BROKER)

  const [accountId, setAccountId] = useState(preselectedAccountId ?? tbszAccounts[0]?.id ?? '')
  const [tradeType, setTradeType] = useState<TradeType>(TradeType.BUY)

  // Ticker search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [validating, setValidating] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [ticker, setTicker] = useState('')          // confirmed, only set via a validated selection
  const [tickerName, setTickerName] = useState('')

  const [currency, setCurrency] = useState<Currency>('EUR')
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [priceHuf, setPriceHuf] = useState('')
  const [priceSource, setPriceSource] = useState<'native' | 'huf'>('native')
  const [fee, setFee] = useState('0')
  const [date, setDate] = useState<Date>(new Date())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (preselectedAccountId) setAccountId(preselectedAccountId)
  }, [preselectedAccountId])

  // Fresh form every time the dialog opens (account selection preserved separately)
  useEffect(() => {
    if (!open) return
    setTradeType(TradeType.BUY)
    setQuery(''); setSearchResults([]); setShowSuggestions(false)
    setTicker(''); setTickerName('')
    setCurrency('EUR')
    setQuantity(''); setPrice(''); setPriceHuf(''); setPriceSource('native'); setFee('0'); setNote('')
    setDate(new Date())
  }, [open])

  // Debounced live ticker search against Yahoo Finance
  useEffect(() => {
    const q = query.trim()
    if (q.length < 1 || ticker) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market-data/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!cancelled) setSearchResults(data.results ?? [])
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [query, ticker])

  // Picking a result: verify it actually has market data before confirming it
  const selectResult = async (r: TickerSearchResult) => {
    setShowSuggestions(false)
    setQuery(r.symbol)
    setValidating(true)
    try {
      const res = await fetch(`/api/market-data/quotes?tickers=${encodeURIComponent(r.symbol)}`)
      const data = await res.json()
      const quote = data.quotes?.[r.symbol]
      if (!quote || quote.price == null) {
        toast.error(`${r.symbol}: nincs elérhető árfolyamadat`)
        setTicker('')
        return
      }
      setTicker(resolveTicker(r.symbol))
      setTickerName(r.name)
      if (quote.currency && (CURRENCIES as readonly string[]).includes(quote.currency)) {
        setCurrency(quote.currency as Currency)
      }
    } catch {
      toast.error('Nem sikerült ellenőrizni a tickert')
      setTicker('')
    } finally {
      setValidating(false)
    }
  }

  // Auto-fetch the daily HUF exchange rate for the chosen trade date
  useEffect(() => {
    let cancelled = false
    setRateLoading(true)
    const iso = date.toISOString().slice(0, 10)
    fetch(`/api/market-data/mnb-rate?date=${iso}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setFxRate(currency === 'EUR' ? d.EUR : d.USD) })
      .catch(() => { if (!cancelled) setFxRate(null) })
      .finally(() => { if (!cancelled) setRateLoading(false) })
    return () => { cancelled = true }
  }, [date, currency])

  // When fxRate reloads (date/currency change), re-sync the non-source field
  useEffect(() => {
    if (!fxRate) return
    if (priceSource === 'native' && price) {
      const n = parseFloat(price)
      if (!isNaN(n)) setPriceHuf((n * fxRate).toFixed(0))
    } else if (priceSource === 'huf' && priceHuf) {
      const n = parseFloat(priceHuf)
      if (!isNaN(n)) setPrice((n / fxRate).toFixed(4))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxRate])

  const totalValue = useMemo(
    () => (parseFloat(quantity) || 0) * (parseFloat(price) || 0),
    [quantity, price]
  )
  const feeValue = parseFloat(fee) || 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseFloat(quantity)
    const prc = parseFloat(price)
    const feeAmt = parseFloat(fee) || 0

    if (!ticker) {
      toast.error('Válassz egy tickert a keresési találatok közül')
      return
    }
    if (!accountId || !qty || !prc) {
      toast.error('Kérem töltse ki az összes kötelező mezőt!')
      return
    }

    const existingPosition = investmentPositions.find(
      (p) => p.accountId === accountId && p.ticker === ticker
    )

    const tradeId = `trade-${Date.now()}`

    if (existingPosition) {
      let newQty: number
      let newAvgPrice: number

      if (tradeType === TradeType.BUY) {
        newQty = existingPosition.quantity + qty
        newAvgPrice =
          (existingPosition.quantity * existingPosition.averageBuyPrice + qty * prc) / newQty
      } else {
        newQty = Math.max(0, existingPosition.quantity - qty)
        newAvgPrice = existingPosition.averageBuyPrice
      }

      const trade: InvestmentTrade = {
        id: tradeId,
        positionId: existingPosition.id,
        type: tradeType,
        quantity: qty,
        price: prc,
        fee: feeAmt,
        date,
        note: note || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      addInvestmentTrade(trade, {
        positionId: existingPosition.id,
        quantity: newQty,
        averageBuyPrice: newAvgPrice,
      })
    } else {
      const positionId = `pos-${Date.now()}`
      const newPosition: InvestmentPosition = {
        id: positionId,
        accountId,
        ticker,
        name: tickerName || ticker,
        quantity: qty,
        averageBuyPrice: prc,
        currentPrice: prc,
        currency,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      addInvestmentPosition(newPosition)

      const trade: InvestmentTrade = {
        id: tradeId,
        positionId,
        type: tradeType,
        quantity: qty,
        price: prc,
        fee: feeAmt,
        date,
        note: note || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      addInvestmentTrade(trade, {
        positionId,
        quantity: qty,
        averageBuyPrice: prc,
      })
    }

    toast.success(
      `${tradeType === TradeType.BUY ? 'Vétel' : 'Eladás'} rögzítve: ${qty} × ${ticker}`
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Új ügylet</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Account */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">Számla *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Válassz számlát" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {tbszAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} className="text-foreground">
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buy/Sell toggle */}
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">Ügylet típusa</Label>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setTradeType(TradeType.BUY)}
                className={cn(
                  'flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all',
                  tradeType === TradeType.BUY
                    ? 'bg-emerald-500 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Vétel
              </button>
              <button
                type="button"
                onClick={() => setTradeType(TradeType.SELL)}
                className={cn(
                  'flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all',
                  tradeType === TradeType.SELL
                    ? 'bg-red-500 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Eladás
              </button>
            </div>
          </div>

          {/* Ticker search */}
          <div className="relative">
            <Label className="text-muted-foreground text-xs mb-1.5 block">Ticker keresés *</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Keress: AMD, Apple, VWCE…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                  if (ticker) { setTicker(''); setTickerName('') }
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="bg-muted border-border text-foreground pl-8 pr-8"
              />
              {(searching || validating) && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
              {ticker && !validating && (
                <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              )}
            </div>

            {showSuggestions && !ticker && query.trim().length >= 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {searching ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Keresés…
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                    Nincs találat erre: „{query.trim()}"
                  </div>
                ) : (
                  searchResults.map((r) => (
                    <button
                      key={r.symbol}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectResult(r)}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 border-b border-border last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{r.symbol}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.name}</p>
                      </div>
                      {r.exchange && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{r.exchange}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {ticker && (
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" />
                {ticker}{tickerName ? ` — ${tickerName}` : ''}
              </p>
            )}
          </div>

          {/* Currency */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">Deviza</Label>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all',
                    currency === c
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Darabszám *</Label>
              <Input
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-muted border-border text-foreground"
                min="0"
                step="0.0001"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">
                Egységár ({CURRENCY_SYMBOLS[currency]}) *
              </Label>
              <Input
                type="number"
                placeholder="0"
                value={price}
                onChange={(e) => {
                  const val = e.target.value
                  setPriceSource('native')
                  setPrice(val)
                  const n = parseFloat(val)
                  if (!isNaN(n) && fxRate) setPriceHuf((n * fxRate).toFixed(0))
                  else if (!val) setPriceHuf('')
                }}
                className="bg-muted border-border text-foreground"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* HUF price — back-calculate native price from HUF when fxRate available */}
          {fxRate && (
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">
                Egységár (Ft) — vagy forintból számolj vissza
              </Label>
              <Input
                type="number"
                placeholder="0"
                value={priceHuf}
                onChange={(e) => {
                  const val = e.target.value
                  setPriceSource('huf')
                  setPriceHuf(val)
                  const n = parseFloat(val)
                  if (!isNaN(n) && fxRate) setPrice((n / fxRate).toFixed(4))
                  else if (!val) setPrice('')
                }}
                className="bg-muted border-border text-foreground"
                min="0"
                step="1"
              />
            </div>
          )}

          {/* Total + daily FX summary */}
          {totalValue > 0 && (
            <div className="bg-muted rounded-lg px-3 py-2.5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Összérték ({CURRENCY_SYMBOLS[currency]})</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(totalValue, currency)}
                </span>
              </div>
              {feeValue > 0 && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Jutalék</span>
                  <span className="text-xs text-foreground">{formatCurrency(feeValue, currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Napi árfolyam · {date.toISOString().slice(0, 10)}
                </span>
                <span className="text-xs text-foreground tabular-nums">
                  {rateLoading ? '…' : fxRate ? `${fxRate.toFixed(2)} Ft/${currency}` : 'n/a'}
                </span>
              </div>
              {fxRate && (
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-xs text-muted-foreground">Összesen forintban</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency((totalValue + feeValue) * fxRate, 'HUF')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Fee */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">
              Jutalék ({CURRENCY_SYMBOLS[currency]})
            </Label>
            <Input
              type="number"
              placeholder="0"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="bg-muted border-border text-foreground"
              min="0"
            />
          </div>

          {/* Date */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">Dátum *</Label>
            <SimplePopover>
              <SimplePopoverTrigger
                className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {format(date, 'yyyy. MM. dd.')}
              </SimplePopoverTrigger>
              <SimplePopoverContent className="rounded-lg border border-border bg-card shadow-xl">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={hu}
                />
              </SimplePopoverContent>
            </SimplePopover>
          </div>

          {/* Note */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">Megjegyzés</Label>
            <Input
              placeholder="Opcionális megjegyzés"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-muted border-border text-foreground"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Mégse
            </Button>
            <Button
              type="submit"
              className={cn(
                'flex-1 text-white',
                tradeType === TradeType.BUY
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-red-500 hover:bg-red-600'
              )}
            >
              {tradeType === TradeType.BUY ? 'Vétel rögzítése' : 'Eladás rögzítése'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
