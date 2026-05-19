import { Frequency, CategoryType, TransactionStatus, type RecurringItem, type Transaction } from './types'

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  [Frequency.WEEKLY]: 'Heti',
  [Frequency.MONTHLY]: 'Havi',
  [Frequency.QUARTERLY]: 'Negyedéves',
  [Frequency.YEARLY]: 'Éves',
}

const MONTHLY_FACTOR: Record<Frequency, number> = {
  [Frequency.WEEKLY]: 52 / 12,
  [Frequency.MONTHLY]: 1,
  [Frequency.QUARTERLY]: 1 / 3,
  [Frequency.YEARLY]: 1 / 12,
}

/** Monthly-equivalent amount of a recurring item. */
export function monthlyAmount(item: RecurringItem): number {
  return item.amount * MONTHLY_FACTOR[item.frequency]
}

/** Whether the recurring item is active during the given year/month (0-indexed month). */
export function isActiveInMonth(item: RecurringItem, year: number, month: number): boolean {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const start = new Date(item.startDate)
  if (start > monthEnd) return false
  if (item.endDate && new Date(item.endDate) < monthStart) return false
  return true
}

function advance(d: Date, freq: Frequency): Date {
  const n = new Date(d)
  switch (freq) {
    case Frequency.WEEKLY: n.setDate(n.getDate() + 7); break
    case Frequency.MONTHLY: n.setMonth(n.getMonth() + 1); break
    case Frequency.QUARTERLY: n.setMonth(n.getMonth() + 3); break
    case Frequency.YEARLY: n.setFullYear(n.getFullYear() + 1); break
  }
  return n
}

export interface GeneratedOccurrence {
  id: string
  recurringId: string
  date: Date
  description: string
  /** Signed amount — income positive, expense negative */
  amount: number
  categoryId: string | null
  type: CategoryType
}

/**
 * Materialises recurring items into individual occurrences between `from` and `to`,
 * stepping by each item's frequency. Occurrences before the item's own start date
 * or after its end date are skipped.
 */
export function generateOccurrences(
  items: RecurringItem[],
  from: Date,
  to: Date,
): GeneratedOccurrence[] {
  const out: GeneratedOccurrence[] = []

  for (const item of items) {
    const itemStart = new Date(item.startDate)
    const itemEnd = item.endDate ? new Date(item.endDate) : to
    const limit = to < itemEnd ? to : itemEnd

    let cursor = new Date(itemStart)
    let guard = 0
    while (cursor <= limit && guard < 3000) {
      if (cursor >= from) {
        out.push({
          id: `gen-${item.id}-${cursor.toISOString().slice(0, 10)}`,
          recurringId: item.id,
          date: new Date(cursor),
          description: item.name,
          amount: item.type === CategoryType.INCOME ? item.amount : -item.amount,
          categoryId: item.categoryId,
          type: item.type,
        })
      }
      cursor = advance(cursor, item.frequency)
      guard++
    }
  }

  return out
}

export type GeneratedTransaction = Transaction & { generated: true; recurringId: string }

/** Start date for occurrence generation — the tracking-start month, or far past if unset. */
export function trackingStartDate(trackingStartMonth: string | null): Date {
  return trackingStartMonth
    ? new Date(`${trackingStartMonth}-01T00:00:00`)
    : new Date(2000, 0, 1)
}

/**
 * Materialises recurring items as Transaction-shaped rows so they can be merged
 * into the regular transaction list and into monthly aggregations.
 */
export function recurringAsTransactions(
  items: RecurringItem[],
  trackingStartMonth: string | null,
  to: Date = new Date(),
): GeneratedTransaction[] {
  return generateOccurrences(items, trackingStartDate(trackingStartMonth), to).map((o) => ({
    id: o.id,
    userId: 'local-user',
    accountId: '',
    transferAccountId: null,
    categoryId: o.categoryId,
    amount: o.amount,
    date: o.date,
    description: o.description,
    note: null,
    isRecurring: true,
    status: TransactionStatus.CONFIRMED,
    importBatchId: null,
    createdAt: o.date,
    updatedAt: o.date,
    generated: true as const,
    recurringId: o.recurringId,
  }))
}
