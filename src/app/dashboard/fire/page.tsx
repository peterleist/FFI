'use client'

import { useState, useMemo, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { AccountType } from '@/lib/types'
import { useAccountValues } from '@/lib/account-value'
import { formatCurrency } from '@/lib/utils'
import { AreaChart } from '@/components/pefi/charts'

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} Mrd Ft`
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M Ft`
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}e Ft`
  return `${s}${Math.round(a)} Ft`
}

const ACCOUNT_LABEL: Record<AccountType, string> = {
  [AccountType.BANK]: 'Bankszámla',
  [AccountType.CASH]: 'Készpénz',
  [AccountType.TBSZ]: 'TBSZ',
  [AccountType.BROKER]: 'Bróker',
  [AccountType.ALLAMPAPIR]: 'Állampapír',
}

function computeProjection(start: number, monthly: number, annualReturn: number, target: number) {
  const mRet = Math.pow(1 + annualReturn / 100, 1 / 12) - 1
  const chart: number[] = []
  let v = start
  let months = 0
  const max = 600
  while (months < max) {
    if (months % 12 === 0) chart.push(Math.round(v))
    if (v >= target && months > 0) break
    v = v * (1 + mRet) + monthly
    months++
  }
  const fireDate = new Date()
  fireDate.setMonth(fireDate.getMonth() + months)
  return { years: months / 12, fireDate, chart }
}

export default function FirePage() {
  const {
    accounts, fireGoalAmount, investmentPositions, fireAccountIds, setFireAccountIds,
    updateProfile,
  } = useAppStore()
  const { values: accountValues } = useAccountValues(accounts, investmentPositions)

  const includedIds = fireAccountIds ?? accounts.map((a) => a.id)
  const netWorth = accounts
    .filter((a) => includedIds.includes(a.id))
    .reduce((s, a) => s + (accountValues[a.id] ?? a.balance), 0)
  const fireGoal = fireGoalAmount || 1
  const progress = Math.min((netWorth / fireGoal) * 100, 100)

  const toggleAccount = (id: string) => {
    const current = fireAccountIds ?? accounts.map((a) => a.id)
    setFireAccountIds(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  const [savings, setSavings] = useState('300000')
  const [annualReturn, setAnnualReturn] = useState('7')
  const [currentSavings, setCurrentSavings] = useState(String(Math.round(netWorth)))
  const [touched, setTouched] = useState(false)

  // Target net worth — persisted to the store so it survives reloads
  const [targetInput, setTargetInput] = useState(String(fireGoalAmount))
  const target = parseFloat(targetInput) || fireGoal
  const onTargetChange = (v: string) => {
    setTargetInput(v)
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) updateProfile({ fireGoalAmount: Math.round(n) })
  }

  useEffect(() => {
    if (!touched) setCurrentSavings(String(Math.round(netWorth)))
  }, [netWorth, touched])

  const projection = useMemo(
    () => computeProjection(
      parseFloat(currentSavings) || 0,
      parseFloat(savings) || 0,
      parseFloat(annualReturn) || 0,
      target,
    ),
    [currentSavings, savings, annualReturn, target]
  )

  const scenarios = [3.0, 3.5, 4.0].map((rate) => ({
    rate,
    annual: fireGoal * (rate / 100),
    monthly: (fireGoal * (rate / 100)) / 12,
  }))

  const reachLabel = projection.years < 50
    ? projection.fireDate.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
    : '50+ év'

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="crumb">Hosszú távú terv</div>
          <h1>FIRE Tervező</h1>
        </div>
      </div>

      {/* Hero */}
      <div className="pf-card hero-grad" style={{ padding: 26 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div>
            <div className="lbl" style={{ color: 'var(--pf-muted)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Pénzügyi függetlenség
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
              <div className="num" style={{ fontSize: 50, fontWeight: 600, letterSpacing: '-.03em' }}>
                {progress.toFixed(1)}%
              </div>
              <span className="pf-badge accent" style={{ padding: '3px 10px' }}><span className="dot" />Úton</span>
            </div>
            <div className="pf-muted" style={{ fontSize: 12, marginTop: 4 }}>
              <span className="num" style={{ color: 'var(--pf-text-2)' }}>{formatCurrency(netWorth)}</span>
              {' / '}
              <span className="num" style={{ color: 'var(--pf-text-2)' }}>{formatCurrency(fireGoal)}</span>
            </div>
          </div>
          <div style={{ flex: '0 1 420px' }}>
            <div className="pf-progress tall" style={{ height: 10 }}>
              <div className="bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="row between" style={{ marginTop: 8 }}>
              <div>
                <div className="pf-muted" style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Hátralévő</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 600 }}>{fmtCompact(Math.max(0, fireGoal - netWorth))}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="pf-muted" style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Várható FIRE dátum</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 600 }}>{reachLabel}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* SWR scenarios */}
      <div className="pf-card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="card-title">Biztonságos kivét (SWR) szcenáriók</h3>
            <div className="card-sub">Éves és havi passzív jövedelem a FIRE célnál</div>
          </div>
          <span className="pf-badge accent">Cél: {fmtCompact(fireGoal)}</span>
        </div>
        <div className="pf-grid grid-3">
          {scenarios.map((s) => (
            <div key={s.rate} className="pf-card" style={{ background: 'var(--pf-card-2)', padding: 16 }}>
              <div className="row between">
                <span className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>{s.rate.toFixed(1)}%</span>
                <span className="pf-badge" style={{ padding: '1px 6px', fontSize: 10 }}>SWR</span>
              </div>
              <hr className="pf-hr" style={{ margin: '10px 0' }} />
              <div className="row between" style={{ fontSize: 11.5 }}>
                <span className="pf-muted">Éves</span>
                <span className="num">{fmtCompact(s.annual)}</span>
              </div>
              <div className="row between" style={{ fontSize: 11.5, marginTop: 6 }}>
                <span className="pf-muted">Havi</span>
                <span className="num" style={{ color: 'var(--pf-gain)' }}>+{fmtCompact(s.monthly)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Calculator */}
      <div className="pf-card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title">FIRE kalkulátor</h3>
            <div className="card-sub">Állítsd a paramétereket a tervezett úthoz</div>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="pf-muted" style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Évek a FIRE-ig</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                {projection.years < 50 ? projection.years.toFixed(1) : '50+'}
                <span className="pf-muted" style={{ fontSize: 11, fontWeight: 400 }}> év</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pf-muted" style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Elérés</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>{reachLabel}</div>
            </div>
          </div>
        </div>

        <div className="pf-grid grid-12" style={{ gap: 18 }}>
          <div className="span-4" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Jelenlegi megtakarítás (Ft)">
              <input className="num pf-input" type="number" value={currentSavings}
                onChange={(e) => { setCurrentSavings(e.target.value); setTouched(true) }} />
            </Field>
            <Field label={`Havi megtakarítás · ${fmtCompact(parseFloat(savings) || 0)}`}>
              <input type="range" min={0} max={2000000} step={10000} value={savings}
                onChange={(e) => setSavings(e.target.value)} style={{ width: '100%' }} />
            </Field>
            <Field label={`Várható éves hozam · ${(parseFloat(annualReturn) || 0).toFixed(1)}%`}>
              <input type="range" min={0} max={14} step={0.1} value={annualReturn}
                onChange={(e) => setAnnualReturn(e.target.value)} style={{ width: '100%' }} />
            </Field>
            <Field label="Cél vagyon (Ft)">
              <input className="num pf-input" type="number" value={targetInput}
                onChange={(e) => onTargetChange(e.target.value)} />
            </Field>
          </div>
          <div className="span-8">
            <AreaChart
              series={[{ label: 'Tervezett', color: 'var(--pf-accent)', data: projection.chart }]}
              labels={projection.chart.map((_, i) => `${i}. év`)}
              height={260} padLeft={70} padBottom={26}
              yFormat={(v) => fmtCompact(v)}
            />
            <div className="row between" style={{ marginTop: 6, fontSize: 11, color: 'var(--pf-muted)' }}>
              <span>Most</span>
              <span className="num">Célvonal: {fmtCompact(target)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Account selector */}
      <div className="pf-card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="card-title">Beszámított számlák</h3>
            <div className="card-sub">Mely számlák értéke számítson a FIRE vagyonba</div>
          </div>
          <div className="num" style={{ fontWeight: 600 }}>{fmtCompact(netWorth)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.map((a) => {
            const on = includedIds.includes(a.id)
            return (
              <div key={a.id} className="row between" onClick={() => toggleAccount(a.id)}
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: on ? 'var(--pf-card-2)' : 'transparent',
                  border: `1px solid ${on ? 'var(--pf-border)' : 'transparent'}`,
                }}>
                <span className="row" style={{ gap: 10 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, display: 'grid', placeItems: 'center', color: '#fff',
                    border: `1.5px solid ${on ? 'var(--pf-accent)' : 'var(--pf-border-2)'}`,
                    background: on ? 'var(--pf-accent)' : 'transparent',
                  }}>{on && <Check size={10} strokeWidth={2.6} />}</span>
                  <span style={{ fontSize: 12.5 }}>{a.name}</span>
                  <span className="pf-muted" style={{ fontSize: 11 }}>{ACCOUNT_LABEL[a.type]}</span>
                </span>
                <span className="num" style={{ fontSize: 12, opacity: on ? 1 : 0.45 }}>
                  {fmtCompact(accountValues[a.id] ?? a.balance)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11.5, color: 'var(--pf-muted)', letterSpacing: '.04em' }}>{label}</label>
      {children}
    </div>
  )
}
