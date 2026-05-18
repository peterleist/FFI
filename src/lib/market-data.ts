import { useState, useEffect, useCallback } from 'react'
import type { QuoteResult } from '@/app/api/market-data/quotes/route'
import type { HistoryPoint } from '@/app/api/market-data/history/route'

export type { QuoteResult, HistoryPoint }

// ── Static sector / asset-class metadata ─────────────────────────────────────

export interface AssetMeta {
  name: string
  sector: string       // e.g. "Globális részvény"
  assetClass: string   // "ETF" | "Részvény" | "Kötvény" | ...
  region: string       // "Globális" | "USA" | "Magyarország" | ...
  currency: string     // native trading currency hint
  yahooSuffix?: string // if user only stores base ticker (e.g. VWCE → VWCE.DE)
}

export const ASSET_META: Record<string, AssetMeta> = {
  // ── Global ETFs ────────────────────────────────────────────────────────────
  VWCE: {
    name: 'Vanguard FTSE All-World UCITS ETF',
    sector: 'Globális részvény',
    assetClass: 'ETF',
    region: 'Globális',
    currency: 'EUR',
    yahooSuffix: 'VWCE.DE',
  },
  'VWCE.DE': {
    name: 'Vanguard FTSE All-World UCITS ETF',
    sector: 'Globális részvény',
    assetClass: 'ETF',
    region: 'Globális',
    currency: 'EUR',
  },
  'VWCE.AS': {
    name: 'Vanguard FTSE All-World UCITS ETF',
    sector: 'Globális részvény',
    assetClass: 'ETF',
    region: 'Globális',
    currency: 'EUR',
  },
  VUSA: {
    name: 'Vanguard S&P 500 UCITS ETF',
    sector: 'USA részvény',
    assetClass: 'ETF',
    region: 'USA',
    currency: 'USD',
    yahooSuffix: 'VUSA.AS',
  },
  'VUSA.AS': {
    name: 'Vanguard S&P 500 UCITS ETF',
    sector: 'USA részvény',
    assetClass: 'ETF',
    region: 'USA',
    currency: 'USD',
  },
  VUAA: {
    name: 'Vanguard S&P 500 UCITS ETF (Acc)',
    sector: 'USA részvény',
    assetClass: 'ETF',
    region: 'USA',
    currency: 'USD',
    yahooSuffix: 'VUAA.AS',
  },
  'VUAA.AS': {
    name: 'Vanguard S&P 500 UCITS ETF (Acc)',
    sector: 'USA részvény',
    assetClass: 'ETF',
    region: 'USA',
    currency: 'USD',
  },
  CSPX: {
    name: 'iShares Core S&P 500 UCITS ETF',
    sector: 'USA részvény',
    assetClass: 'ETF',
    region: 'USA',
    currency: 'USD',
    yahooSuffix: 'CSPX.L',
  },
  'CSPX.L': {
    name: 'iShares Core S&P 500 UCITS ETF',
    sector: 'USA részvény',
    assetClass: 'ETF',
    region: 'USA',
    currency: 'USD',
  },
  IWDA: {
    name: 'iShares Core MSCI World UCITS ETF',
    sector: 'Fejlett piacok',
    assetClass: 'ETF',
    region: 'Globális',
    currency: 'USD',
    yahooSuffix: 'IWDA.AS',
  },
  'IWDA.AS': {
    name: 'iShares Core MSCI World UCITS ETF',
    sector: 'Fejlett piacok',
    assetClass: 'ETF',
    region: 'Globális',
    currency: 'USD',
  },
  EIMI: {
    name: 'iShares Core MSCI EM IMI UCITS ETF',
    sector: 'Feltörekvő piacok',
    assetClass: 'ETF',
    region: 'Feltörekvő',
    currency: 'USD',
    yahooSuffix: 'EIMI.L',
  },
  IUSQ: {
    name: 'iShares MSCI ACWI UCITS ETF',
    sector: 'Globális részvény',
    assetClass: 'ETF',
    region: 'Globális',
    currency: 'USD',
    yahooSuffix: 'IUSQ.DE',
  },
  // ── Hungarian stocks (BÉT) ─────────────────────────────────────────────────
  OTP: {
    name: 'OTP Bank Nyrt.',
    sector: 'Pénzügy',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
    yahooSuffix: 'OTP.BD',
  },
  'OTP.BD': {
    name: 'OTP Bank Nyrt.',
    sector: 'Pénzügy',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
  },
  MOL: {
    name: 'MOL Magyar Olaj- és Gázipari Nyrt.',
    sector: 'Energia',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
    yahooSuffix: 'MOL.BD',
  },
  'MOL.BD': {
    name: 'MOL Magyar Olaj- és Gázipari Nyrt.',
    sector: 'Energia',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
  },
  MTELEKOM: {
    name: 'Magyar Telekom Nyrt.',
    sector: 'Telekommunikáció',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
    yahooSuffix: 'MTELEKOM.BD',
  },
  'MTELEKOM.BD': {
    name: 'Magyar Telekom Nyrt.',
    sector: 'Telekommunikáció',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
  },
  RICHTER: {
    name: 'Richter Gedeon Nyrt.',
    sector: 'Egészségügy',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
    yahooSuffix: 'RICHTER.BD',
  },
  'RICHTER.BD': {
    name: 'Richter Gedeon Nyrt.',
    sector: 'Egészségügy',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
  },
  OPUS: {
    name: 'Opus Global Nyrt.',
    sector: 'Ipar',
    assetClass: 'Részvény',
    region: 'Magyarország',
    currency: 'HUF',
    yahooSuffix: 'OPUS.BD',
  },
  // ── US individual stocks ────────────────────────────────────────────────────
  AAPL: { name: 'Apple Inc.', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  MSFT: { name: 'Microsoft Corp.', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'Fogyasztói szabad', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  NVDA: { name: 'NVIDIA Corp.', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  META: { name: 'Meta Platforms Inc.', sector: 'Kommunikáció', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  TSLA: { name: 'Tesla Inc.', sector: 'Fogyasztói szabad', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  AMD: { name: 'Advanced Micro Devices', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  AVGO: { name: 'Broadcom Inc.', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  INTC: { name: 'Intel Corp.', sector: 'Technológia', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  NFLX: { name: 'Netflix Inc.', sector: 'Kommunikáció', assetClass: 'Részvény', region: 'USA', currency: 'USD' },
  // ── Bond ETFs ──────────────────────────────────────────────────────────────
  AGGH: { name: 'iShares Core Global Agg Bond UCITS ETF', sector: 'Kötvény', assetClass: 'ETF', region: 'Globális', currency: 'USD', yahooSuffix: 'AGGH.L' },
}

export function getAssetMeta(ticker: string): AssetMeta {
  return (
    ASSET_META[ticker.toUpperCase()] ?? {
      name: ticker,
      sector: 'Egyéb',
      assetClass: 'Részvény',
      region: 'Egyéb',
      currency: 'HUF',
    }
  )
}

/** Returns the trading currency if the ticker is in the registry, otherwise null. */
export function getKnownCurrency(ticker: string): string | null {
  return ASSET_META[ticker.toUpperCase()]?.currency ?? null
}

/**
 * Maps a Yahoo Finance symbol back to the base ticker used in the registry.
 * E.g. 'VWCE.DE' → 'VWCE' (matched via yahooSuffix). Unknown symbols pass through.
 */
export function resolveTicker(yahooSymbol: string): string {
  const upper = yahooSymbol.toUpperCase()
  if (ASSET_META[upper]) return upper
  for (const [base, meta] of Object.entries(ASSET_META)) {
    if (meta.yahooSuffix?.toUpperCase() === upper) return base
  }
  return upper
}

/** Returns the Yahoo Finance symbol to query (adds suffix if needed). */
export function toYahooSymbol(ticker: string): string {
  const meta = ASSET_META[ticker.toUpperCase()]
  return meta?.yahooSuffix ?? ticker
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export interface QuotesState {
  quotes: Record<string, QuoteResult>
  loading: boolean
  error: string | null
  lastFetched: string | null
  refetch: () => void
}

export function useQuotes(tickers: string[]): QuotesState {
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  const yahooTickers = tickers.map(toYahooSymbol)

  const fetch_ = useCallback(async () => {
    if (yahooTickers.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/market-data/quotes?tickers=${yahooTickers.join(',')}`)
      const data = await res.json()
      if (data.quotes) {
        // map back from yahoo symbol to original ticker
        const mapped: Record<string, QuoteResult> = {}
        tickers.forEach((orig, i) => {
          const ySymbol = yahooTickers[i]
          if (data.quotes[ySymbol]) {
            mapped[orig] = data.quotes[ySymbol]
          } else if (data.quotes[orig]) {
            mapped[orig] = data.quotes[orig]
          }
        })
        setQuotes(mapped)
        setLastFetched(data.fetchedAt ?? new Date().toISOString())
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yahooTickers.join(',')])

  useEffect(() => { fetch_() }, [fetch_])

  return { quotes, loading, error, lastFetched, refetch: fetch_ }
}

// ── FX rates ──────────────────────────────────────────────────────────────────

export interface FxRates {
  EUR: number
  USD: number
}

const DEFAULT_FX: FxRates = { EUR: 400, USD: 365 }

export function useFxRates(): { rates: FxRates; loading: boolean } {
  const [rates, setRates] = useState<FxRates>(DEFAULT_FX)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market-data/quotes?tickers=EURHUF%3DX,USDHUF%3DX')
      .then(r => r.json())
      .then(data => {
        const q = data.quotes ?? {}
        setRates({
          EUR: q['EURHUF=X']?.price ?? DEFAULT_FX.EUR,
          USD: q['USDHUF=X']?.price ?? DEFAULT_FX.USD,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { rates, loading }
}

export function toHuf(amount: number, currency: string, rates: FxRates): number {
  if (currency === 'HUF') return amount
  const rate = currency === 'EUR' ? rates.EUR : currency === 'USD' ? rates.USD : null
  return rate ? Math.round(amount * rate) : Math.round(amount)
}

export interface HistoryState {
  points: HistoryPoint[]
  loading: boolean
  error: string | null
  currency: string
}

export function useHistory(ticker: string, range = '1y', interval = '1wk'): HistoryState {
  const [points, setPoints] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('USD')

  const yahooTicker = toYahooSymbol(ticker)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    fetch(`/api/market-data/history?ticker=${encodeURIComponent(yahooTicker)}&range=${range}&interval=${interval}`)
      .then((r) => r.json())
      .then((d) => {
        setPoints(d.points ?? [])
        setCurrency(d.currency ?? 'USD')
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [yahooTicker, range, interval])

  return { points, loading, error, currency }
}
