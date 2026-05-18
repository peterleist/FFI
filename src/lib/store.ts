import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  type Account,
  type Category,
  type Transaction,
  type RecurringItem,
  type InvestmentPosition,
  type InvestmentTrade,
  TransactionStatus,
  CategoryType,
} from './types'

export interface CustomPortfolioView {
  id: string
  name: string
  description?: string
  accountIds: string[]
  createdAt: string
}

export interface UserProfile {
  userName: string
  fireGoalAmount: number
  fireTargetAge: number | null
  monthlyExpenses: number | null
}

// The serialisable slice of the store (no functions)
export interface AppSnapshot {
  setupComplete: boolean
  userName: string
  fireGoalAmount: number
  fireTargetAge: number | null
  monthlyExpenses: number | null
  trackingStartMonth: string | null   // "YYYY-MM" – bank/cash accounts
  customViews: CustomPortfolioView[]
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurringItems: RecurringItem[]
  investmentPositions: InvestmentPosition[]
  investmentTrades: InvestmentTrade[]
}

export function extractSnapshot(s: AppState): AppSnapshot {
  return {
    setupComplete: s.setupComplete,
    userName: s.userName,
    fireGoalAmount: s.fireGoalAmount,
    fireTargetAge: s.fireTargetAge,
    monthlyExpenses: s.monthlyExpenses,
    trackingStartMonth: s.trackingStartMonth,
    customViews: s.customViews,
    accounts: s.accounts,
    categories: s.categories,
    transactions: s.transactions,
    recurringItems: s.recurringItems,
    investmentPositions: s.investmentPositions,
    investmentTrades: s.investmentTrades,
  }
}

interface AppState {
  // ── First-run setup ──────────────────────────────────────────────────────────
  setupComplete: boolean
  userName: string
  fireGoalAmount: number
  fireTargetAge: number | null
  monthlyExpenses: number | null
  trackingStartMonth: string | null   // "YYYY-MM"
  completeSetup: () => void
  updateProfile: (data: Partial<UserProfile>) => void
  setTrackingStartMonth: (month: string | null) => void
  setAccountOpeningBalance: (accountId: string, balance: number) => void
  loadSnapshot: (snap: AppSnapshot) => void

  // ── Custom portfolio views ───────────────────────────────────────────────────
  customViews: CustomPortfolioView[]
  addCustomView: (view: CustomPortfolioView) => void
  updateCustomView: (id: string, updates: Partial<CustomPortfolioView>) => void
  deleteCustomView: (id: string) => void

  // ── Core data ────────────────────────────────────────────────────────────────
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurringItems: RecurringItem[]
  investmentPositions: InvestmentPosition[]
  investmentTrades: InvestmentTrade[]
  pendingImportBatch: Transaction[] | null

  // ── Transaction actions ──────────────────────────────────────────────────────
  addTransaction: (tx: Transaction) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  confirmTransaction: (id: string) => void
  confirmAllPending: () => void

  // ── Account actions ──────────────────────────────────────────────────────────
  addAccount: (account: Account) => void
  updateAccount: (id: string, updates: Partial<Account>) => void
  deleteAccount: (id: string) => void

  // ── Category actions ─────────────────────────────────────────────────────────
  addCategory: (category: Category) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void

  // ── Recurring items ──────────────────────────────────────────────────────────
  addRecurringItem: (item: RecurringItem) => void
  updateRecurringItem: (id: string, updates: Partial<RecurringItem>) => void
  deleteRecurringItem: (id: string) => void

  // ── Investment actions ───────────────────────────────────────────────────────
  addInvestmentPosition: (position: InvestmentPosition) => void
  updateInvestmentPosition: (id: string, updates: Partial<InvestmentPosition>) => void
  addInvestmentTrade: (
    trade: InvestmentTrade,
    positionUpdate: { positionId: string; quantity: number; averageBuyPrice: number }
  ) => void
  deleteInvestmentTrade: (tradeId: string) => void
  deleteInvestmentPosition: (positionId: string) => void

  // ── Import batch ─────────────────────────────────────────────────────────────
  setPendingImportBatch: (transactions: Transaction[]) => void
  updatePendingImportTransaction: (id: string, updates: Partial<Transaction>) => void
  removePendingImportTransaction: (id: string) => void
  confirmImportBatch: (transactionIds: string[]) => void
  clearImportBatch: () => void
}

export const DEFAULT_CATEGORIES: Omit<Category, 'userId' | 'id'>[] = [
  // Expenses
  { name: 'Lakhatás',           type: CategoryType.EXPENSE, icon: '🏠', color: '#94a3b8', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Élelmiszer',         type: CategoryType.EXPENSE, icon: '🛒', color: '#22c55e', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Közlekedés',         type: CategoryType.EXPENSE, icon: '🚗', color: '#f59e0b', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Szórakozás',         type: CategoryType.EXPENSE, icon: '🎬', color: '#ec4899', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Egészség',           type: CategoryType.EXPENSE, icon: '🏥', color: '#ef4444', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Ruházat',            type: CategoryType.EXPENSE, icon: '👕', color: '#8b5cf6', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Rezsi',              type: CategoryType.EXPENSE, icon: '⚡', color: '#06b6d4', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Étterem',            type: CategoryType.EXPENSE, icon: '🍽️', color: '#f97316', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Oktatás',            type: CategoryType.EXPENSE, icon: '📚', color: '#14b8a6', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Egyéb kiadás',       type: CategoryType.EXPENSE, icon: '💸', color: '#64748b', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  // Income
  { name: 'Fizetés',            type: CategoryType.INCOME,  icon: '💼', color: '#22c55e', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Bónusz',             type: CategoryType.INCOME,  icon: '🎁', color: '#94a3b8', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Befektetési hozam',  type: CategoryType.INCOME,  icon: '📈', color: '#f59e0b', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  { name: 'Egyéb bevétel',      type: CategoryType.INCOME,  icon: '💰', color: '#64748b', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
  // Transfer
  { name: 'Átutalás',           type: CategoryType.TRANSFER, icon: '↔️', color: '#94a3b8', monthlyBudget: null, createdAt: new Date(), updatedAt: new Date() },
]

const userId = 'local-user'

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ── Setup ─────────────────────────────────────────────────────────────────
      setupComplete: false,
      userName: '',
      fireGoalAmount: 50_000_000,
      fireTargetAge: null,
      monthlyExpenses: null,
      trackingStartMonth: null,

      completeSetup: () => set({ setupComplete: true }),
      updateProfile: (data) => set((s) => ({ ...s, ...data })),
      setTrackingStartMonth: (month) => set({ trackingStartMonth: month }),
      setAccountOpeningBalance: (accountId, balance) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === accountId ? { ...a, balance, updatedAt: new Date() } : a
          ),
        })),
      loadSnapshot: (snap) => set(snap),

      // ── Custom views ──────────────────────────────────────────────────────────
      customViews: [],
      addCustomView: (view) =>
        set((s) => ({ customViews: [...s.customViews, view] })),
      updateCustomView: (id, updates) =>
        set((s) => ({
          customViews: s.customViews.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),
      deleteCustomView: (id) =>
        set((s) => ({ customViews: s.customViews.filter((v) => v.id !== id) })),

      // ── Core data (empty — filled by setup wizard) ────────────────────────────
      accounts: [],
      categories: DEFAULT_CATEGORIES.map((c, i) => ({
        ...c,
        id: `cat-default-${i}`,
        userId,
      })),
      transactions: [],
      recurringItems: [],
      investmentPositions: [],
      investmentTrades: [],
      pendingImportBatch: null,

      // ── Transaction actions ───────────────────────────────────────────────────
      // Helper: bump account balance by delta (used inline below)
      addTransaction: (tx) =>
        set((s) => ({
          transactions: [tx, ...s.transactions],
          // Confirmed txs immediately affect balance; pending ones don't
          accounts:
            tx.status === TransactionStatus.CONFIRMED
              ? s.accounts.map((a) =>
                  a.id === tx.accountId ? { ...a, balance: a.balance + tx.amount } : a
                )
              : s.accounts,
        })),
      updateTransaction: (id, updates) =>
        set((s) => {
          const old = s.transactions.find((t) => t.id === id)
          const updated = old ? { ...old, ...updates } : null

          // Recompute balance delta when amount or account changes on a CONFIRMED tx
          let accounts = s.accounts
          if (old && updated && old.status === TransactionStatus.CONFIRMED) {
            // Reverse the old amount on the old account
            accounts = accounts.map((a) =>
              a.id === old.accountId ? { ...a, balance: a.balance - old.amount } : a
            )
            // Apply the new amount on the new account (may be different account)
            const newAccountId = updates.accountId ?? old.accountId
            const newAmount = updates.amount ?? old.amount
            accounts = accounts.map((a) =>
              a.id === newAccountId ? { ...a, balance: a.balance + newAmount } : a
            )
          }

          return {
            transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
            accounts,
          }
        }),
      deleteTransaction: (id) =>
        set((s) => {
          const tx = s.transactions.find((t) => t.id === id)
          return {
            transactions: s.transactions.filter((t) => t.id !== id),
            // Reverse the amount if it was confirmed
            accounts:
              tx && tx.status === TransactionStatus.CONFIRMED
                ? s.accounts.map((a) =>
                    a.id === tx.accountId ? { ...a, balance: a.balance - tx.amount } : a
                  )
                : s.accounts,
          }
        }),
      confirmTransaction: (id) =>
        set((s) => {
          const tx = s.transactions.find((t) => t.id === id)
          return {
            transactions: s.transactions.map((t) =>
              t.id === id ? { ...t, status: TransactionStatus.CONFIRMED } : t
            ),
            // Now that it's confirmed, add it to account balance
            accounts: tx
              ? s.accounts.map((a) =>
                  a.id === tx.accountId ? { ...a, balance: a.balance + tx.amount } : a
                )
              : s.accounts,
          }
        }),
      confirmAllPending: () =>
        set((s) => {
          const pending = s.transactions.filter(
            (t) => t.status === TransactionStatus.PENDING
          )
          // Apply all pending amounts to their accounts
          const accounts = s.accounts.map((a) => {
            const delta = pending
              .filter((t) => t.accountId === a.id)
              .reduce((sum, t) => sum + t.amount, 0)
            return delta !== 0 ? { ...a, balance: a.balance + delta } : a
          })
          return {
            transactions: s.transactions.map((t) =>
              t.status === TransactionStatus.PENDING
                ? { ...t, status: TransactionStatus.CONFIRMED }
                : t
            ),
            accounts,
          }
        }),

      // ── Account actions ───────────────────────────────────────────────────────
      addAccount: (account) =>
        set((s) => ({ accounts: [...s.accounts, account] })),
      updateAccount: (id, updates) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      deleteAccount: (id) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),

      // ── Category actions ──────────────────────────────────────────────────────
      addCategory: (category) =>
        set((s) => ({ categories: [...s.categories, category] })),
      updateCategory: (id, updates) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      deleteCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      // ── Recurring items ───────────────────────────────────────────────────────
      addRecurringItem: (item) =>
        set((s) => ({ recurringItems: [...s.recurringItems, item] })),
      updateRecurringItem: (id, updates) =>
        set((s) => ({
          recurringItems: s.recurringItems.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteRecurringItem: (id) =>
        set((s) => ({ recurringItems: s.recurringItems.filter((r) => r.id !== id) })),

      // ── Investment actions ────────────────────────────────────────────────────
      addInvestmentPosition: (position) =>
        set((s) => ({ investmentPositions: [...s.investmentPositions, position] })),
      updateInvestmentPosition: (id, updates) =>
        set((s) => ({
          investmentPositions: s.investmentPositions.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      addInvestmentTrade: (trade, positionUpdate) =>
        set((s) => ({
          investmentTrades: [...s.investmentTrades, trade],
          investmentPositions: s.investmentPositions.map((p) =>
            p.id === positionUpdate.positionId
              ? {
                  ...p,
                  quantity: positionUpdate.quantity,
                  averageBuyPrice: positionUpdate.averageBuyPrice,
                  updatedAt: new Date(),
                }
              : p
          ),
        })),
      deleteInvestmentPosition: (positionId) =>
        set((s) => ({
          investmentPositions: s.investmentPositions.filter((p) => p.id !== positionId),
          investmentTrades: s.investmentTrades.filter((t) => t.positionId !== positionId),
        })),
      deleteInvestmentTrade: (tradeId) =>
        set((s) => {
          const trade = s.investmentTrades.find((t) => t.id === tradeId)
          if (!trade) return s

          const remaining = s.investmentTrades
            .filter((t) => t.id !== tradeId && t.positionId === trade.positionId)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

          // Replay remaining trades to recalculate quantity and average buy price
          let qty = 0
          let totalCost = 0
          for (const t of remaining) {
            if (t.type === 'BUY') {
              totalCost += t.quantity * t.price
              qty += t.quantity
            } else {
              const pct = qty > 0 ? t.quantity / qty : 0
              totalCost = Math.max(0, totalCost - totalCost * pct)
              qty = Math.max(0, qty - t.quantity)
            }
          }

          return {
            investmentTrades: s.investmentTrades.filter((t) => t.id !== tradeId),
            investmentPositions: s.investmentPositions.map((p) =>
              p.id === trade.positionId
                ? { ...p, quantity: qty, averageBuyPrice: qty > 0 ? totalCost / qty : 0, updatedAt: new Date() }
                : p
            ),
          }
        }),

      // ── Import batch ──────────────────────────────────────────────────────────
      setPendingImportBatch: (transactions) =>
        set({ pendingImportBatch: transactions }),
      updatePendingImportTransaction: (id, updates) =>
        set((s) => ({
          pendingImportBatch: s.pendingImportBatch
            ? s.pendingImportBatch.map((t) => (t.id === id ? { ...t, ...updates } : t))
            : null,
        })),
      removePendingImportTransaction: (id) =>
        set((s) => ({
          pendingImportBatch: s.pendingImportBatch
            ? s.pendingImportBatch.filter((t) => t.id !== id)
            : null,
        })),
      confirmImportBatch: (transactionIds) =>
        set((s) => {
          if (!s.pendingImportBatch) return s
          const toConfirm = s.pendingImportBatch
            .filter((t) => transactionIds.includes(t.id))
            .map((t) => ({ ...t, status: TransactionStatus.CONFIRMED }))
          // Apply confirmed import transactions to account balances
          const accounts = s.accounts.map((a) => {
            const delta = toConfirm
              .filter((t) => t.accountId === a.id)
              .reduce((sum, t) => sum + t.amount, 0)
            return delta !== 0 ? { ...a, balance: a.balance + delta } : a
          })
          return {
            transactions: [...toConfirm, ...s.transactions],
            accounts,
            pendingImportBatch: null,
          }
        }),
      clearImportBatch: () => set({ pendingImportBatch: null }),
    }),
    {
      name: 'pefi-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({} as Storage)
      ),
    }
  )
)
