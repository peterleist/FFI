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

// ── PEFI CSV formátum ─────────────────────────────────────────────────────────
// Egyetlen elfogadott formátum, pontosvesszővel tagolva:
//   dátum;leírás;összeg;kategória
// Példa:  2024.05.01;Élelmiszer vásárlás;-15000;Élelmiszer

const CSV_EXAMPLE = `dátum;leírás;összeg;kategória
2024.05.01;Élelmiszer vásárlás;-15000;Élelmiszer
2024.05.05;Havi fizetés;650000;Fizetés
2024.05.08;Étterem;-8900;Étterem`

function parseHungarianAmount(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function parseHungarianDate(s: string): Date {
  if (!s) return new Date()
  const parts = s.split(/[.\-/]/)
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number)
    if (a > 1000) return new Date(a, b - 1, c) // yyyy.mm.dd
    return new Date(c, b - 1, a) // dd/mm/yyyy
  }
  return new Date(s)
}

interface ParsedRow {
  date: Date
  description: string
  amount: number
  categoryId: string | null
}

/** Parses the single PEFI CSV format: dátum;leírás;összeg;kategória */
function parseCsv(rows: string[][], catByName: Map<string, string>): ParsedRow[] {
  return rows
    .filter((r) => r.length >= 3 && r[0]?.trim())
    .filter((r) => {
      const f = r[0].trim().toLowerCase()
      return !(f.includes('dátum') || f.includes('datum') || f.includes('date'))
    })
    .map((r) => {
      const catName = (r[3]?.trim() ?? '').toLowerCase()
      return {
        date: parseHungarianDate(r[0]?.trim() ?? ''),
        description: r[1]?.trim() ?? '',
        amount: parseHungarianAmount(r[2]?.trim() ?? '0'),
        categoryId: catName ? (catByName.get(catName) ?? null) : null,
      }
    })
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
          const catByName = new Map(
            categories.map((c) => [c.name.toLowerCase().trim(), c.id])
          )
          const parsed = parseCsv(result.data, catByName)

          const importRows: ImportRow[] = parsed.map((p, i) => ({
            id: `import-${Date.now()}-${i}`,
            date: p.date,
            description: p.description,
            amount: p.amount,
            accountId: selectedAccountId,
            categoryId: p.categoryId,
            selected: true,
          }))

          setRows(importRows)
          setStep(2)
          const matched = importRows.filter((r) => r.categoryId).length
          toast.success(`${importRows.length} tranzakció betöltve · ${matched} kategória felismerve`)
        },
        error: () => {
          toast.error('Hiba a fájl feldolgozása közben')
        },
      })
    },
    [selectedAccountId, categories]
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
      transferAccountId: null,
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
        <div className="page-hd">
          <div>
            <div className="crumb">Tömeges felvitel</div>
            <h1>Tranzakciók importálása</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Beállítások</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Célszámla</p>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-foreground">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Az importált tételek a kiválasztott számlára kerülnek. A CSV-ben
                megadott kategóriát automatikusan párosítjuk a meglévő kategóriákhoz.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-foreground">PEFI CSV formátum</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Pontosvesszővel tagolt fájl, négy oszloppal:{' '}
                <span className="text-foreground font-medium">dátum · leírás · összeg · kategória</span>.
                A negatív összeg kiadás, a pozitív bevétel.
              </p>
              <pre className="mt-2 text-xs bg-muted rounded p-3 text-muted-foreground overflow-x-auto">
                {CSV_EXAMPLE}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer',
            isDragging
              ? 'border-slate-400 bg-muted/40'
              : 'border-border hover:border-slate-400/50 hover:bg-card'
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
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">
            Húzd ide a CSV fájlt
          </p>
          <p className="text-sm text-muted-foreground">
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
      <div className="page-hd">
        <div>
          <div className="crumb">Tömeges felvitel</div>
          <h1>Import áttekintése</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge className="bg-muted text-muted-foreground border-border border">
              <FileText className="w-3 h-3 mr-1" />
              {fileName}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {totalCount} tranzakció importálva
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { setStep(1); setRows([]) }}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Vissza
          </Button>
          <Button
            onClick={() => toggleAll(true)}
            variant="outline"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Összes kijelölése
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedRows.length === 0}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
          >
            <Check className="w-4 h-4" />
            Véglegesítés ({approvedCount})
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Importált</p>
            <p className="text-xl font-bold text-foreground">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Kijelölve</p>
            <p className="text-xl font-bold text-green-400">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Eltávolítva</p>
            <p className="text-xl font-bold text-red-400">{totalCount - rows.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Review table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium p-4 w-10">
                    <input
                      type="checkbox"
                      checked={rows.every((r) => r.selected)}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="accent-slate-400"
                    />
                  </th>
                  <th className="text-left text-muted-foreground font-medium p-4">Dátum</th>
                  <th className="text-left text-muted-foreground font-medium p-4">Leírás</th>
                  <th className="text-left text-muted-foreground font-medium p-4">Kategória</th>
                  <th className="text-right text-muted-foreground font-medium p-4">Összeg</th>
                  <th className="text-muted-foreground font-medium p-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border transition-colors',
                      row.selected ? 'hover:bg-muted/50' : 'opacity-50'
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
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(row.date), 'yyyy. MM. dd.', { locale: hu })}
                    </td>
                    <td className="p-4">
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        className="bg-muted border-border text-foreground h-8 text-sm min-w-48"
                      />
                    </td>
                    <td className="p-4">
                      <Select
                        value={row.categoryId ?? '__none__'}
                        onValueChange={(v: string) =>
                          updateRow(row.id, { categoryId: v === '__none__' ? null : v })
                        }
                      >
                        <SelectTrigger className="bg-muted border-border text-foreground h-8 text-sm w-44">
                          {(() => {
                            const c = categories.find((x) => x.id === row.categoryId)
                            return c
                              ? <span className="truncate">{c.icon} {c.name}</span>
                              : <span className="text-muted-foreground">Kategória</span>
                          })()}
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="__none__" className="text-muted-foreground">Nincs</SelectItem>
                          {expenseCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-foreground">
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
                        className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
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
