'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Plus, Search, Pencil, Trash2, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/lib/store'
import { TransactionStatus, CategoryType } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { TransactionDialog } from '@/components/transactions/transaction-dialog'
import { toast } from 'sonner'
import type { Transaction } from '@/lib/types'

const ITEMS_PER_PAGE = 10

const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date()
  d.setMonth(d.getMonth() - i)
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: format(d, 'yyyy. MMMM', { locale: hu }),
  }
})

export default function TransactionsPage() {
  const { transactions, accounts, categories, deleteTransaction, confirmTransaction } =
    useAppStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (selectedMonth !== 'all') {
          const [y, m] = selectedMonth.split('-').map(Number)
          const txDate = new Date(tx.date)
          if (txDate.getFullYear() !== y || txDate.getMonth() + 1 !== m) return false
        }
        if (selectedAccount !== 'all' && tx.accountId !== selectedAccount) return false
        if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) return false
        if (selectedStatus !== 'all' && tx.status !== selectedStatus) return false
        if (search) {
          const s = search.toLowerCase()
          if (!tx.description.toLowerCase().includes(s)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, selectedMonth, selectedAccount, selectedCategory, selectedStatus, search])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const totalIncome = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = Math.abs(filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  const net = totalIncome - totalExpense

  const getCategoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Egyéb'

  const getCategoryIcon = (id: string | null) =>
    categories.find((c) => c.id === id)?.icon ?? ''

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id

  const handleDelete = (id: string) => {
    deleteTransaction(id)
    toast.success('Tranzakció törölve')
  }

  const handleConfirm = (id: string) => {
    confirmTransaction(id)
    toast.success('Tranzakció jóváhagyva')
  }

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setDialogOpen(true)
  }

  const openNew = () => {
    setEditingTx(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tranzakciók</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} tranzakció</p>
        </div>
        <Button
          onClick={openNew}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Új tranzakció
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Keresés..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Select value={selectedMonth} onValueChange={(v: string) => { setSelectedMonth(v); setPage(1) }}>
              <SelectTrigger className="w-44 bg-muted border-border text-foreground">
                <SelectValue placeholder="Hónap" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="text-foreground">Összes hónap</SelectItem>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-foreground">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAccount} onValueChange={(v: string) => { setSelectedAccount(v); setPage(1) }}>
              <SelectTrigger className="w-44 bg-muted border-border text-foreground">
                <SelectValue placeholder="Számla" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="text-foreground">Összes számla</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-foreground">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={(v: string) => { setSelectedCategory(v); setPage(1) }}>
              <SelectTrigger className="w-44 bg-muted border-border text-foreground">
                <SelectValue placeholder="Kategória" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="text-foreground">Összes kategória</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-foreground">
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(v: string) => { setSelectedStatus(v); setPage(1) }}>
              <SelectTrigger className="w-36 bg-muted border-border text-foreground">
                <SelectValue placeholder="Státusz" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="text-foreground">Minden</SelectItem>
                <SelectItem value={TransactionStatus.CONFIRMED} className="text-foreground">Jóváhagyott</SelectItem>
                <SelectItem value={TransactionStatus.PENDING} className="text-foreground">Függőben</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Bevétel</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Kiadás</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Egyenleg</p>
            <p className={`text-lg font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {net >= 0 ? '+' : ''}{formatCurrency(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Dátum</TableHead>
                <TableHead className="text-muted-foreground">Leírás</TableHead>
                <TableHead className="text-muted-foreground">Kategória</TableHead>
                <TableHead className="text-muted-foreground">Számla</TableHead>
                <TableHead className="text-muted-foreground text-right">Összeg</TableHead>
                <TableHead className="text-muted-foreground">Státusz</TableHead>
                <TableHead className="text-muted-foreground w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nincs tranzakció a megadott szűrőkkel
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((tx) => (
                  <TableRow key={tx.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(tx.date), 'MMM d.', { locale: hu })}
                    </TableCell>
                    <TableCell className="text-foreground text-sm font-medium max-w-48 truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getCategoryIcon(tx.categoryId)} {getCategoryName(tx.categoryId)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getAccountName(tx.accountId)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold text-sm ${
                        tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          tx.status === TransactionStatus.CONFIRMED
                            ? 'border-green-500/30 text-green-400 bg-green-500/10 text-xs'
                            : 'border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs'
                        }
                      >
                        {tx.status === TransactionStatus.CONFIRMED ? 'Jóváhagyott' : 'Függőben'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {tx.status === TransactionStatus.PENDING && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            onClick={() => handleConfirm(tx.id)}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => openEdit(tx)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDelete(tx.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} / {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Előző
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Következő
              </Button>
            </div>
          </div>
        )}
      </Card>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTx}
      />
    </div>
  )
}
