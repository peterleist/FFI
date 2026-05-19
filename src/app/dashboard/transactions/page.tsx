'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Search, Plus, Pencil, Trash2, Check, Repeat, ChevronDown, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { TransactionStatus } from '@/lib/types'
import type { Transaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { recurringAsTransactions } from '@/lib/recurring'
import { TransactionDialog } from '@/components/transactions/transaction-dialog'
import { RecurringPanel } from '@/components/recurring/recurring-panel'
import { toast } from 'sonner'

const ITEMS_PER_PAGE = 30

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} Mrd Ft`
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M Ft`
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}e Ft`
  return `${s}${Math.round(a)} Ft`
}

const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date()
  d.setMonth(d.getMonth() - i)
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: format(d, 'yyyy. LLL', { locale: hu }),
  }
})

type Row = Transaction & { generated?: boolean; recurringId?: string }

function FilterPill({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <label className="tx-pill">
      <span className="tx-pill-lbl">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown size={11} style={{ color: 'var(--pf-muted)' }} />
    </label>
  )
}

export default function TransactionsPage() {
  const {
    transactions, accounts, categories, recurringItems, trackingStartMonth,
    deleteTransaction, confirmTransaction,
  } = useAppStore()

  const [tab, setTab] = useState<'tx' | 'rec'>('tx')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [selMonth, setSelMonth] = useState('all')
  const [selAccount, setSelAccount] = useState('all')
  const [selCategory, setSelCategory] = useState('all')
  const [selStatus, setSelStatus] = useState('all')
  const [page, setPage] = useState(1)

  const allRows = useMemo<Row[]>(
    () => [...transactions, ...recurringAsTransactions(recurringItems, trackingStartMonth)],
    [transactions, recurringItems, trackingStartMonth]
  )

  const filtered = useMemo(() => {
    return allRows
      .filter((tx) => {
        if (selMonth !== 'all') {
          const [y, m] = selMonth.split('-').map(Number)
          const d = new Date(tx.date)
          if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return false
        }
        if (selAccount !== 'all' && tx.accountId !== selAccount) return false
        if (selCategory !== 'all' && tx.categoryId !== selCategory) return false
        if (selStatus !== 'all' && tx.status !== selStatus) return false
        if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allRows, selMonth, selAccount, selCategory, selStatus, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // Group the page by day
  const groups = useMemo(() => {
    const out: { date: string; items: Row[] }[] = []
    let cur: { date: string; items: Row[] } | null = null
    for (const r of paged) {
      const key = format(new Date(r.date), 'yyyy-MM-dd')
      if (!cur || cur.date !== key) { cur = { date: key, items: [] }; out.push(cur) }
      cur.items.push(r)
    }
    return out
  }, [paged])

  const income = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const expense = Math.abs(filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  const net = income - expense

  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const acctOf = (id: string) => accounts.find((a) => a.id === id)

  const openNew = () => { setEditingTx(null); setDialogOpen(true) }
  const openEdit = (tx: Row) => { setEditingTx(tx); setDialogOpen(true) }
  const handleDelete = (id: string) => { deleteTransaction(id); toast.success('Tranzakció törölve') }
  const handleConfirm = (id: string) => { confirmTransaction(id); toast.success('Tranzakció jóváhagyva') }

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="crumb">Pénzforgalom</div>
          <h1>Tranzakciók</h1>
        </div>
        <div className="pf-tabs">
          <span className={`tab ${tab === 'tx' ? 'active' : ''}`} onClick={() => setTab('tx')}>Tranzakciók</span>
          <span className={`tab ${tab === 'rec' ? 'active' : ''}`} onClick={() => setTab('rec')}>Ismétlődő tételek</span>
        </div>
      </div>

      {tab === 'tx' ? (
        <>
          {/* Stat cards */}
          <div className="pf-grid grid-3">
            <div className="pf-card stat">
              <div className="lbl">Bevétel</div>
              <div className="val num" style={{ color: 'var(--pf-gain)' }}>+{fmtCompact(income)}</div>
              <div className="sub pf-muted">{filtered.filter((t) => t.amount > 0).length} tétel</div>
            </div>
            <div className="pf-card stat">
              <div className="lbl">Kiadás</div>
              <div className="val num">−{fmtCompact(expense)}</div>
              <div className="sub pf-muted">{filtered.filter((t) => t.amount < 0).length} tétel</div>
            </div>
            <div className="pf-card stat">
              <div className="lbl">Nettó egyenleg</div>
              <div className="val num" style={{ color: net >= 0 ? 'var(--pf-gain)' : 'var(--pf-loss)' }}>
                {net >= 0 ? '+' : '−'}{fmtCompact(Math.abs(net))}
              </div>
              <div className="sub pf-muted">
                Megtakarítási ráta{' '}
                <span className="num" style={{ color: 'var(--pf-text-2)' }}>
                  {income > 0 ? Math.round((net / income) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div style={{ height: 16 }} />

          {/* Toolbar */}
          <div className="tx-toolbar">
            <div className="tx-search">
              <Search size={13} style={{ color: 'var(--pf-muted)' }} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Tranzakciók keresése…" />
            </div>
            <div className="tx-segments">
              <span className="tx-chip" data-active={selMonth === 'all'} onClick={() => { setSelMonth('all'); setPage(1) }}>
                Összes
              </span>
              {MONTH_OPTIONS.map((m) => (
                <span key={m.value} className="tx-chip" data-active={selMonth === m.value}
                  onClick={() => { setSelMonth(m.value); setPage(1) }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="tx-pills">
              <FilterPill label="Számla" value={selAccount} onChange={(v) => { setSelAccount(v); setPage(1) }}
                options={[{ v: 'all', l: 'Mind' }, ...accounts.map((a) => ({ v: a.id, l: a.name }))]} />
              <FilterPill label="Kategória" value={selCategory} onChange={(v) => { setSelCategory(v); setPage(1) }}
                options={[{ v: 'all', l: 'Mind' }, ...categories.map((c) => ({ v: c.id, l: c.name }))]} />
              <FilterPill label="Státusz" value={selStatus} onChange={(v) => { setSelStatus(v); setPage(1) }}
                options={[
                  { v: 'all', l: 'Bármely' },
                  { v: TransactionStatus.CONFIRMED, l: 'Jóváhagyott' },
                  { v: TransactionStatus.PENDING, l: 'Függőben' },
                ]} />
            </div>
            <button className="pf-btn sm primary" type="button" onClick={openNew} style={{ marginLeft: 'auto' }}>
              <Plus size={12} strokeWidth={1.9} />Új
            </button>
          </div>

          <div style={{ height: 16 }} />

          {/* Grouped list */}
          <div className="pf-card tx-list" style={{ padding: 0 }}>
            <div className="tx-cols">
              <span>Tranzakció</span>
              <span>Kategória</span>
              <span>Számla</span>
              <span className="right">Összeg</span>
            </div>

            {groups.length === 0 ? (
              <div className="pf-muted" style={{ textAlign: 'center', padding: '40px', fontSize: 13 }}>
                Nincs tranzakció a megadott szűrőkkel
              </div>
            ) : groups.map((g) => {
              const dayNet = g.items.reduce((s, t) => s + t.amount, 0)
              return (
                <div key={g.date} className="tx-group">
                  <div className="tx-group-hd">
                    <span className="tx-group-date">
                      {format(new Date(g.date), 'EEE, MMM d', { locale: hu })}
                    </span>
                    <span className="tx-group-dot" />
                    <span className="tx-group-meta">{g.items.length} tétel</span>
                    <span className="tx-group-net num">
                      {dayNet >= 0 ? '+' : '−'}{fmtCompact(Math.abs(dayNet))}
                    </span>
                  </div>
                  {g.items.map((t) => {
                    const cat = catOf(t.categoryId)
                    const acct = acctOf(t.accountId)
                    const isIn = t.amount >= 0
                    return (
                      <div key={t.id} className="tx-row">
                        <div className="tx-desc">
                          <span className="tx-arrow" data-dir={isIn ? 'in' : 'out'}>
                            {isIn ? <ArrowDownRight size={10} strokeWidth={2.2} /> : <ArrowUpRight size={10} strokeWidth={2.2} />}
                          </span>
                          <span className="tx-name">{t.description}</span>
                          {(t.generated || t.isRecurring) && (
                            <span className="tx-rec" title="Ismétlődő"><Repeat size={10} strokeWidth={2} /></span>
                          )}
                          {!t.generated && t.status === TransactionStatus.PENDING && (
                            <span className="tx-pending">Függőben</span>
                          )}
                        </div>
                        <div className="tx-cat">
                          <span className="tx-cat-dot" style={{ background: cat?.color || '#94A3B8' }} />
                          <span>{cat?.name ?? 'Egyéb'}</span>
                        </div>
                        <div className="tx-acct">{t.generated ? '—' : (acct?.name ?? '—')}</div>
                        <div className="tx-amt num" data-in={isIn ? 'true' : 'false'}>
                          {isIn ? '+' : '−'}{formatCurrency(Math.abs(t.amount))}
                        </div>
                        {!t.generated && (
                          <div className="tx-actions">
                            {t.status === TransactionStatus.PENDING && (
                              <button type="button" title="Jóváhagyás" onClick={() => handleConfirm(t.id)}>
                                <Check size={13} style={{ color: 'var(--pf-gain)' }} />
                              </button>
                            )}
                            <button type="button" title="Szerkesztés" onClick={() => openEdit(t)}>
                              <Pencil size={13} />
                            </button>
                            <button type="button" title="Törlés" onClick={() => handleDelete(t.id)}>
                              <Trash2 size={13} style={{ color: 'var(--pf-loss)' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            <div className="tx-foot">
              <span className="pf-muted" style={{ fontSize: 11.5 }}>
                {filtered.length} tételből {paged.length} megjelenítve
              </span>
              {totalPages > 1 && (
                <div className="row" style={{ gap: 6 }}>
                  <button className="pf-btn sm" type="button" disabled={safePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}>Előző</button>
                  <span className="pf-muted num" style={{ fontSize: 11.5 }}>{safePage} / {totalPages}</span>
                  <button className="pf-btn sm" type="button" disabled={safePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Következő</button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <RecurringPanel />
      )}

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} transaction={editingTx} />
    </>
  )
}
