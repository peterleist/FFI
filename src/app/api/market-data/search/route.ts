import { NextRequest, NextResponse } from 'next/server'

// GET /api/market-data/search?q=AMD
// Proxies the Yahoo Finance symbol search so the trade dialog can only
// offer tickers that actually exist and have market data.

interface YahooSearchQuote {
  symbol?: string
  shortname?: string
  longname?: string
  exchDisp?: string
  quoteType?: string
  sectorDisp?: string
}

export interface TickerSearchResult {
  symbol: string
  name: string
  exchange: string
  sector: string
  type: 'Részvény' | 'ETF'
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return NextResponse.json({ results: [] })
    }

    const json = await res.json()
    const quotes: YahooSearchQuote[] = json?.quotes ?? []

    const results: TickerSearchResult[] = quotes
      .filter((it) => it.symbol && (it.quoteType === 'EQUITY' || it.quoteType === 'ETF'))
      .map((it) => ({
        symbol: it.symbol as string,
        name: it.shortname ?? it.longname ?? (it.symbol as string),
        exchange: it.exchDisp ?? '',
        sector: it.sectorDisp ?? '',
        type: it.quoteType === 'ETF' ? 'ETF' : 'Részvény',
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
