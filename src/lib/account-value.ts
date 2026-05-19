import { useMemo } from 'react'
import { AccountType, type Account, type InvestmentPosition } from './types'
import { useQuotes, useFxRates, getAssetMeta, toHuf } from './market-data'

/**
 * Returns each account's HUF value.
 * TBSZ / BROKER accounts are valued from their live investment positions
 * (falling back to the stored balance when there are no positions yet);
 * all other account types use their stored balance directly.
 */
export function useAccountValues(
  accounts: Account[],
  positions: InvestmentPosition[],
): { values: Record<string, number>; total: number; loading: boolean } {
  const tickers = useMemo(
    () => [...new Set(positions.map((p) => p.ticker))],
    [positions]
  )
  const { quotes, loading } = useQuotes(tickers)
  const { rates } = useFxRates()

  return useMemo(() => {
    const values: Record<string, number> = {}
    for (const acc of accounts) {
      if (acc.type === AccountType.TBSZ || acc.type === AccountType.BROKER) {
        const accPos = positions.filter((p) => p.accountId === acc.id)
        if (accPos.length === 0) {
          values[acc.id] = acc.balance
        } else {
          values[acc.id] = accPos.reduce((sum, p) => {
            const cur = getAssetMeta(p.ticker).currency || p.currency
            const price = quotes[p.ticker]?.price ?? p.currentPrice
            return sum + toHuf(p.quantity * price, cur, rates)
          }, 0)
        }
      } else {
        values[acc.id] = acc.balance
      }
    }
    const total = Object.values(values).reduce((s, v) => s + v, 0)
    return { values, total, loading }
  }, [accounts, positions, quotes, rates, loading])
}
