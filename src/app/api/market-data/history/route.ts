import { NextRequest, NextResponse } from 'next/server'

// GET /api/market-data/history?ticker=VWCE.DE&range=1y&interval=1wk
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  const range = req.nextUrl.searchParams.get('range') ?? '1y'
  const interval = req.nextUrl.searchParams.get('interval') ?? '1wk'

  if (!ticker) {
    return NextResponse.json({ error: 'ticker param required' }, { status: 400 })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 3600 }, // cache 1h for historical
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Yahoo Finance fetch failed', status: res.status }, { status: 502 })
    }

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) {
      return NextResponse.json({ error: 'No data', points: [] })
    }

    const timestamps: number[] = result.timestamps ?? result.timestamp ?? []
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? []
    const meta = result.meta ?? {}

    const points: HistoryPoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i] ?? null,
      }))
      .filter((p) => p.close != null) as HistoryPoint[]

    return NextResponse.json({
      ticker,
      currency: meta.currency ?? 'USD',
      shortName: meta.shortName ?? ticker,
      points,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export interface HistoryPoint {
  date: string   // YYYY-MM-DD
  close: number
}
