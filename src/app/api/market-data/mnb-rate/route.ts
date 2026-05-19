import { NextRequest, NextResponse } from 'next/server'

// GET /api/market-data/mnb-rate?date=YYYY-MM-DD
// Daily EUR/HUF and USD/HUF exchange rate for the requested day (or the
// nearest prior trading day). Uses the Yahoo Finance daily close — the
// market mid-rate, effectively identical to the MNB official fixing.

export interface DayRate {
  date: string | null
  EUR: number | null
  USD: number | null
}

async function rateFor(symbol: string, p1: number, p2: number): Promise<{ val: number | null; date: string | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return { val: null, date: null }
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    const ts: number[] = result?.timestamp ?? []
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
    let val: number | null = null
    let date: string | null = null
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null) {
        val = closes[i]
        date = new Date(ts[i] * 1000).toISOString().slice(0, 10)
      }
    }
    return { val, date }
  } catch {
    return { val: null, date: null }
  }
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const target = new Date(`${date}T12:00:00Z`)
  const p2 = Math.floor(target.getTime() / 1000) + 86400
  const p1 = p2 - 16 * 86400 // ~2-week window to catch weekends/holidays

  const [eur, usd] = await Promise.all([
    rateFor('EURHUF=X', p1, p2),
    rateFor('USDHUF=X', p1, p2),
  ])

  return NextResponse.json({
    date: eur.date ?? usd.date,
    EUR: eur.val,
    USD: usd.val,
  } satisfies DayRate)
}
