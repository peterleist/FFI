'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import { Upload, FileText, Check, Trash2, CheckCheck, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { CategoryType, TransactionStatus, type Transaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const BANK_FORMATS = [
  { value: 'otp', label: 'OTP Bank' },
  { value: 'erste', label: 'Erste Bank' },
  { value: 'kh', label: 'K&H Bank' },
  { value: 'raiffeisen', label: 'Raiffeisen Bank' },
  { value: 'generic', label: 'Általános CSV (dátum;leírás;összeg)' },
]

function parseHungarianAmount(s: string): number {
  if (!s) return 0
  // Remove spaces, replace comma with dot for decimals
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function parseHungarianDate(s: string): Date {
  if (!s) return new Date()
  // Common formats: 2024.01.15, 2024-01-15, 15/01/2024
  const parts = s.split(/[.\-\/]/)
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number)
    if (a > 1000) return new Date(a, b - 1, c) // yyyy.mm.dd
    return new Date(c, b - 1, a) // dd/mm/yyyy
  }
  return new Date(s)
}

function parseOTP(rows: string[][]): Partial<Transaction>[] {
  // OTP format: date;description;amount;balance (skip first row if header)
  const dataRows = rows.filter((r) => r.length >= 3)
  return dataRows
    .filter((r) => {
      const firstCell = r[0]?.trim()
      if (!firstCell) return false
      // Skip header rows
      if (firstCell.toLowerCase().includes('dátum') || firstCell.toLowerCase().includes('date')) return false
      return true
    })
    .map((r) => {
      const date = parseHungarianDate(r[0]?.trim() ?? '')
      const description = r[1]?.trim() ?? ''
      const amount = parseHungarianAmount(r[2]?.trim() ?? '0')
      return { date, description, amount }
    })
    .filter((r) => r.description)
}

function parseErste(rows: string[][]): Partial<Transaction>[] {
  // Erste: date;beneficiary;amount;currency
  return rows
    .filter((r) => r.length >= 3 && r[0]?.trim())
    .slice(1)
    .map((r) => ({
      date: parseHungarianDate(r[0]?.trim() ?? ''),
      description: r[1]?.trim() ?? '',
      amount: parseHungarianAmount(r[2]?.trim() ?? '0'),
    }))
    .filter((r) => r.description)
}

function parseGeneric(rows: string[][]): Partial<Transaction>[] {
  return rows
    .filter((r) => r.length >= 3 && r[0]?.trim())
    .slice(1)
    .map((r) => ({
      date: parseHungarianDate(r[0]?.trim() ?? ''),
      description: r[1]?.trim() ?? '',
      amount: parseHungarianAmount(r[2]?.trim() ?? '0'),
    }))
    .filter((r) => r.description)
}

interface ImportRow {
  id: string
  date: Date
  description: string
  amount: number
  accountId: string
  categoryId: string | null
  selected: boolean
}

export default function ImportPage() {
  const { accounts, categories, setPendingImportBatch, confirmImportBatch } = useAppStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [bankFormat, setBankFormat] = useState('otp')
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '')
  const [isDragging, setIsDragging] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const expenseCategories = categories.filter(
    (c) => c.type === CategoryType.EXPENSE || c.type === CategoryType.INCOME || c.type === CategoryType.TRANSFER
  )

  const parseFile = useCallback(
    (file: File) => {
      setFileName(file.name)
      Papa.parse<string[]>(file, {
        delimiter: ';',
        skipEmptyLines: true,
        complete: (result) => {
          let parsed: Partial<Transaction>[] = []
          if (bankFormat === 'otp') parsed = parseOTP(result.data)
          else if (bankFormat === 'erste') parsed = parseErste(result.data)
          else parsed = parseGeneric(result.data)

          const importRows: ImportRow[] = parsed.map((p, i) => ({
            id: `import-${Date.now()}-${i}`,
            date: p.date ?? new Date(),
            description: p.description ?? '',
            amount: p.amount ?? 0,
            accountId: selectedAccountId,
            categoryId: null,
            selected: true,
          }))

          setRows(importRows)
          setStep(2)
          toast.success(`${importRows.length} tranzakció betöltve`)
        },
        error: () => {
          toast.error('Hiba a fájl feldolgozása közben')
        },
      })
    },
    [bankFormat, selectedAccountId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) parseFile(file)
    },
    [parseFile]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const updateRow = (id: string, updates: Partial<ImportRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const toggleAll = (selected: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected })))
  }

  const selectedRows = rows.filter((r) => r.selected)

  const handleConfirm = () => {
    const transactions: Transaction[] = selectedRows.map((r) => ({
      id: r.id,
      userId: 'local-user',
      accountId: r.accountId,
      categoryId: r.categoryId,
      amount: r.amount,
      date: r.date,
      description: r.description,
      note: null,
      isRecurring: false,
      status: TransactionStatus.CONFIRMED,
      importBatchId: `batch-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    confirmImportBatch(transactions.map((t) => t.id))

    // Directly add confirmed transactions
    const { addTransaction } = useAppStore.getState()
    transactions.forEach((t) => addTransaction(t))

    toast.success(`${transactions.length} tranzakció importálva!`)
    setStep(1)
    setRows([])
    setFileName('')
  }

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Import</h1>
          <p className="text-[#64748b] text-sm mt-0.5">CSV fájl importálása bankból</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#111118] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-base text-[#f1f5f9]">Beállítások</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-[#64748b] mb-1.5">Bank formátum</p>
                <Select value={bankFormat} onValueChange={setBankFormat}>
                  <SelectTrigger className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                    {BANK_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-[#f1f5f9]">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-[#64748b] mb-1.5">Célszámla</p>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-[#f1f5f9]">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#111118] border-[#1e1e2e] md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-[#f1f5f9]">OTP CSV formátum</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#64748b]">
                Az OTP Bank internet bankjából exportált CSV fájl formátuma:
              </p>
              <pre className="mt-2 text-xs bg-[#1e1e2e] rounded p-3 text-[#64748b] overflow-x-auto">
                {`dátum;leírás;összeg;egyenleg
2024.05.01;Élelmiszer;-15000;1235000
2024.05.05;Fizetés;650000;1885000`}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer',
            isDragging
              ? 'border-slate-400 bg-slate-400/5'
              : 'border-[#2e2e3e] hover:border-slate-400/50 hover:bg-[#111118]'
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Upload className="w-12 h-12 text-[#64748b] mx-auto mb-4" />
          <p className="text-lg font-medium text-[#f1f5f9] mb-1">
            Húzd ide a CSV fájlt
          </p>
          <p className="text-sm text-[#64748b]">
            vagy kattints a fájl kiválasztásához (.csv, .txt)
          </p>
        </div>
      </div>
    )
  }

  // Step 2: Review
  const deletedCount = rows.length - rows.filter((r) => r.id).length
  const approvedCount = selectedRows.length
  const totalCount = rows.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Import áttekintése</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge className="bg-[#1e1e2e] text-[#64748b] border-[#2e2e3e] border">
              <FileText className="w-3 h-3 mr-1" />
              {fileName}
            </Badge>
            <span className="text-sm text-[#64748b]">
              {totalCount} tranzakció importálva
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { setStep(1); setRows([]) }}
            className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e]"
          >
            Vissza
          </Button>
          <Button
            onClick={() => toggleAll(true)}
            variant="outline"
            className="border-[#2e2e3e] text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Összes kijelölése
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedRows.length === 0}
            className="bg-slate-600 hover:bg-slate-500 text-white gap-2"
          >
            <Check className="w-4 h-4" />
            Véglegesítés ({approvedCount})
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111118] border-[#1e1e2e]">
          <CardContent className="p-4">
            <p className="text-xs text-[#64748b]">Importált</p>
            <p className="text-xl font-bold text-[#f1f5f9]">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e]">
          <CardContent className="p-4">
            <p className="text-xs text-[#64748b]">Kijelölve</p>
            <p className="text-xl font-bold text-green-400">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e]">
          <CardContent className="p-4">
            <p className="text-xs text-[#64748b]">Eltávolítva</p>
            <p className="text-xl font-bold text-red-400">{totalCount - rows.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Review table */}
      <Card className="bg-[#111118] border-[#1e1e2e]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left text-[#64748b] font-medium p-4 w-10">
                    <input
                      type="checkbox"
                      checked={rows.every((r) => r.selected)}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="accent-slate-400"
                    />
                  </th>
                  <th className="text-left text-[#64748b] font-medium p-4">Dátum</th>
                  <th className="text-left text-[#64748b] font-medium p-4">Leírás</th>
                  <th className="text-left text-[#64748b] font-medium p-4">Kategória</th>
                  <th className="text-right text-[#64748b] font-medium p-4">Összeg</th>
                  <th className="text-[#64748b] font-medium p-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-[#1e1e2e] transition-colors',
                      row.selected ? 'hover:bg-[#1e1e2e]/50' : 'opacity-50'
                    )}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
                        className="accent-slate-400"
                      />
                    </td>
                    <td className="p-4 text-[#64748b] whitespace-nowrap">
                      {format(new Date(row.date), 'yyyy. MM. dd.', { locale: hu })}
                    </td>
                    <td className="p-4">
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] h-8 text-sm min-w-48"
                      />
                    </td>
                    <td className="p-4">
                      <Select
                        value={row.categoryId ?? ''}
                        onValueChange={(v: string) => updateRow(row.id, { categoryId: v || null })}
                      >
                        <SelectTrigger className="bg-[#1e1e2e] border-[#2e2e3e] text-[#f1f5f9] h-8 text-sm w-44">
                          <SelectValue placeholder="Kategória" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                          <SelectItem value="" className="text-[#64748b]">Nincs</SelectItem>
                          {expenseCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-[#f1f5f9]">
                              {c.icon} {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td
                      className={cn(
                        'p-4 text-right font-semibold whitespace-nowrap',
                        row.amount >= 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {row.amount >= 0 ? '+' : ''}{formatCurrency(row.amount)}
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#64748b] hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
