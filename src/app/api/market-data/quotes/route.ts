import { NextRequest, NextResponse } from 'next/server'

// GET /api/market-data/quotes?tickers=VWCE.DE,OTP.BD,CSPX.L
export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get('tickers')
  if (!tickers) {
    return NextResponse.json({ error: 'tickers param required' }, { status: 400 })
  }

  const symbols = tickers.split(',').map((t) => t.trim()).filter(Boolean)
  if (symbols.length === 0) {
    return NextResponse.json({ quotes: {} })
  }

  const results: Record<string, QuoteResult> = {}

  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
          next: { revalidate: 300 }, // cache 5 min
        })
        if (!res.ok) return
        const json = await res.json()
        const meta = json?.chart?.result?.[0]?.meta
        if (!meta) return

        results[symbol] = {
          symbol,
          price: meta.regularMarketPrice ?? null,
          previousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
          currency: meta.currency ?? 'HUF',
          exchangeName: meta.exchangeName ?? '',
          shortName: meta.shortName ?? symbol,
          change: null,
          changePercent: null,
        }

        if (results[symbol].price != null && results[symbol].previousClose != null) {
          results[symbol].change = results[symbol].price! - results[symbol].previousClose!
          results[symbol].changePercent =
            ((results[symbol].price! - results[symbol].previousClose!) /
              results[symbol].previousClose!) *
            100
        }
      } catch {
        // symbol fetch failed, skip
      }
    })
  )

  return NextResponse.json({ quotes: results, fetchedAt: new Date().toISOString() })
}

export interface QuoteResult {
  symbol: string
  price: number | null
  previousClose: number | null
  currency: string
  exchangeName: string
  shortName: string
  change: number | null
  changePercent: number | null
}
