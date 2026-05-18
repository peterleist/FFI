// Enums matching Prisma schema

export enum AccountType {
  BANK = 'BANK',
  CASH = 'CASH',
  ALLAMPAPIR = 'ALLAMPAPIR',
  TBSZ = 'TBSZ',
  BROKER = 'BROKER',
}

export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
}

export enum Frequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

// Entity interfaces

export interface Account {
  id: string
  userId: string
  name: string
  type: AccountType
  tbszYear: number | null
  balance: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  userId: string
  name: string
  type: CategoryType
  icon: string | null
  color: string | null
  monthlyBudget: number | null
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  userId: string
  accountId: string
  categoryId: string | null
  amount: number
  date: Date
  description: string
  note: string | null
  isRecurring: boolean
  status: TransactionStatus
  importBatchId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface RecurringItem {
  id: string
  userId: string
  categoryId: string | null
  name: string
  amount: number
  type: CategoryType
  frequency: Frequency
  startDate: Date
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InvestmentPosition {
  id: string
  accountId: string
  ticker: string
  name: string
  quantity: number
  averageBuyPrice: number
  currentPrice: number
  currency: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface InvestmentTrade {
  id: string
  positionId: string
  type: TradeType
  quantity: number
  price: number
  fee: number
  date: Date
  note: string | null
  createdAt: Date
  updatedAt: Date
}

// Derived / summary types

export interface NetWorthSummary {
  total: number
  byType: Record<AccountType, number>
  accounts: (Account & { percentOfTotal: number })[]
}

export interface BudgetSummary {
  month: number
  year: number
  totalBudgeted: number
  totalSpent: number
  difference: number
  categories: BudgetCategoryRow[]
}

export interface BudgetCategoryRow {
  category: Category
  budgeted: number
  spent: number
  remaining: number
  percentUsed: number
}

export interface MonthlyCashflow {
  month: string
  income: number
  expense: number
  net: number
}

export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalPnl: number
  totalPnlPercent: number
  positions: (InvestmentPosition & {
    marketValue: number
    pnl: number
    pnlPercent: number
  })[]
}

export interface FireProjection {
  currentSavings: number
  monthlyContribution: number
  annualReturn: number
  targetAmount: number
  yearsToFire: number
  fireDate: Date
  monthlyPassiveIncome3pct: number
  monthlyPassiveIncome35pct: number
  monthlyPassiveIncome4pct: number
  chartData: { year: number; value: number }[]
}
