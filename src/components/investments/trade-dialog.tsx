'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
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

const COMMON_TICKERS = ['VWCE', 'CSPX', 'SPY', 'QQQ', 'IWDA', 'EIMI', 'OTP', 'MOL', 'RICHTER', 'MTELEKOM']

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
  const [ticker, setTicker] = useState('')
  const [tickerName, setTickerName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('0')
  const [date, setDate] = useState<Date>(new Date())
  const [note, setNote] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (preselectedAccountId) setAccountId(preselectedAccountId)
  }, [preselectedAccountId])

  const filteredSuggestions = COMMON_TICKERS.filter(
    (t) => t.toLowerCase().startsWith(ticker.toLowerCase()) && ticker.length > 0
  )

  const totalValue = useMemo(
    () => (parseFloat(quantity) || 0) * (parseFloat(price) || 0),
    [quantity, price]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseFloat(quantity)
    const prc = parseFloat(price)
    const feeAmt = parseFloat(fee) || 0

    if (!qty || !prc || !ticker || !accountId) {
      toast.error('Kérem töltse ki az összes kötelező mezőt!')
      return
    }

    const existingPosition = investmentPositions.find(
      (p) => p.accountId === accountId && p.ticker === ticker.toUpperCase()
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
        ticker: ticker.toUpperCase(),
        name: tickerName || ticker.toUpperCase(),
        quantity: qty,
        averageBuyPrice: prc,
        currentPrice: prc,
        currency: 'HUF',
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
      `${tradeType === TradeType.BUY ? 'Vétel' : 'Eladás'} rögzítve: ${qty} × ${ticker.toUpperCase()}`
    )
    onOpenChange(false)

    setTicker('')
    setTickerName('')
    setQuantity('')
    setPrice('')
    setFee('0')
    setNote('')
    setDate(new Date())
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
                    ? 'bg-green-500 text-white'
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

          {/* Ticker */}
          <div className="relative">
            <Label className="text-muted-foreground text-xs mb-1.5 block">Ticker *</Label>
            <Input
              placeholder="pl. VWCE"
              value={ticker}
              onChange={(e) => {
                setTicker(e.target.value.toUpperCase())
                setShowSuggestions(true)
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="bg-muted border-border text-foreground"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted"
                    onClick={() => { setTicker(s); setShowSuggestions(false) }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">Megnevezés</Label>
            <Input
              placeholder="pl. Vanguard FTSE All-World ETF"
              value={tickerName}
              onChange={(e) => setTickerName(e.target.value)}
              className="bg-muted border-border text-foreground"
            />
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
              <Label className="text-muted-foreground text-xs mb-1.5 block">Egységár (Ft) *</Label>
              <Input
                type="number"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-muted border-border text-foreground"
                min="0"
              />
            </div>
          </div>

          {/* Total preview */}
          {totalValue > 0 && (
            <div className="bg-muted rounded-lg px-3 py-2 flex justify-between">
              <span className="text-xs text-muted-foreground">Összérték</span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(totalValue)}
              </span>
            </div>
          )}

          {/* Fee */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">Jutalék (Ft)</Label>
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
                  ? 'bg-green-500 hover:bg-green-600'
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
