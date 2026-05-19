'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Flame, Target, TrendingUp, Calendar, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/lib/store'
import { AccountType } from '@/lib/types'
import { useAccountValues } from '@/lib/account-value'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.BANK]: 'Bankszámla',
  [AccountType.CASH]: 'Készpénz',
  [AccountType.TBSZ]: 'TBSZ',
  [AccountType.ALLAMPAPIR]: 'Állampapír',
  [AccountType.BROKER]: 'Bróker',
}

function computeFireProjection(
  currentSavings: number,
  monthlyContribution: number,
  annualReturn: number,
  targetAmount: number,
  savingsGrowthRate: number = 0
) {
  const monthlyRate = annualReturn / 100 / 12
  const chartData: { year: number; value: number }[] = []
  let value = currentSavings
  let months = 0
  const maxMonths = 600 // 50 years cap

  while (value < targetAmount && months < maxMonths) {
    // Monthly contribution grows annually
    const yearIdx = Math.floor(months / 12)
    const contrib = savingsGrowthRate > 0
      ? monthlyContribution * Math.pow(1 + savingsGrowthRate / 100, yearIdx)
      : monthlyContribution
    value = value * (1 + monthlyRate) + contrib
    months++
    if (months % 12 === 0) {
      chartData.push({ year: months / 12, value: Math.round(value) })
    }
  }

  const yearsToFire = months / 12
  const fireDate = new Date()
  fireDate.setMonth(fireDate.getMonth() + months)

  return { yearsToFire, fireDate, chartData, monthsToFire: months }
}

const SWR_SCENARIOS = [
  {
    label: 'Konzervatív',
    rate: 0.03,
    description: '3% SWR',
    color: 'text-primary',
    bgColor: 'bg-muted border-border',
  },
  {
    label: 'Mérsékelt',
    rate: 0.035,
    description: '3.5% SWR',
    color: 'text-primary',
    bgColor: 'bg-muted border-border',
  },
  {
    label: 'Agresszív',
    rate: 0.04,
    description: '4% SWR',
    color: 'text-primary',
    bgColor: 'bg-muted border-border',
  },
]

export default function FirePage() {
  const {
    accounts, fireGoalAmount, fireTargetAge, monthlyExpenses,
    investmentPositions, fireAccountIds, setFireAccountIds,
  } = useAppStore()

  // Account values — TBSZ/BROKER valued live from positions
  const { values: accountValues } = useAccountValues(accounts, investmentPositions)

  // Which accounts count toward FIRE (null = all)
  const includedIds = fireAccountIds ?? accounts.map((a) => a.id)
  const totalNetWorth = accounts
    .filter((a) => includedIds.includes(a.id))
    .reduce((s, a) => s + (accountValues[a.id] ?? a.balance), 0)

  const fireGoal = fireGoalAmount
  const fireProgress = Math.min((totalNetWorth / fireGoal) * 100, 100)

  const toggleAccount = (id: string) => {
    const current = fireAccountIds ?? accounts.map((a) => a.id)
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id]
    setFireAccountIds(next)
  }

  // Calculator state
  const [currentSavings, setCurrentSavings] = useState(String(Math.round(totalNetWorth)))
  const [savingsTouched, setSavingsTouched] = useState(false)

  // Keep "current savings" synced with the live FIRE net worth until edited
  useEffect(() => {
    if (!savingsTouched) setCurrentSavings(String(Math.round(totalNetWorth)))
  }, [totalNetWorth, savingsTouched])
  const [monthlyContribution, setMonthlyContribution] = useState('200000')
  const [annualReturn, setAnnualReturn] = useState('7')
  const [savingsGrowthRate, setSavingsGrowthRate] = useState('3')
  const [targetAmount, setTargetAmount] = useState(String(fireGoal))

  // Setup form (if no goal set)
  const [setupGoal, setSetupGoal] = useState(String(fireGoal))
  const [setupAge, setSetupAge] = useState(String(fireTargetAge ?? 45))
  const [setupMonthlyExpenses, setSetupMonthlyExpenses] = useState(
    String(monthlyExpenses ?? 280000)
  )

  const projection = useMemo(() => {
    const cs = parseFloat(currentSavings) || 0
    const mc = parseFloat(monthlyContribution) || 0
    const ar = parseFloat(annualReturn) || 0
    const ta = parseFloat(targetAmount) || 50_000_000
    const sgr = parseFloat(savingsGrowthRate) || 0
    return computeFireProjection(cs, mc, ar, ta, sgr)
  }, [currentSavings, monthlyContribution, annualReturn, targetAmount, savingsGrowthRate])

  const suggested25x = parseFloat(setupMonthlyExpenses) * 12 * 25

  const handleSaveSetup = () => {
    setTargetAmount(setupGoal)
    toast.success('FIRE cél beállítva!')
  }

  const fireYear = new Date().getFullYear() + Math.ceil(projection.yearsToFire)

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: string | number
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-muted border border-border rounded-lg p-3 shadow-xl">
          <p className="text-muted-foreground text-xs mb-1">{label}. év</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
              {p.name}: {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">FIRE Tervező</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Financial Independence, Retire Early</p>
      </div>

      {/* Hero progress */}
      <Card className="bg-gradient-to-br from-slate-400/10 to-slate-400/5 border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Flame className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                Te {fireProgress.toFixed(1)}%-nál jársz a FIRE célodhoz!
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(totalNetWorth)} / {formatCurrency(fireGoal)}
              </p>
            </div>
          </div>
          <Progress
            value={fireProgress}
            className="h-3 bg-muted"
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0</span>
            <span className="font-medium text-primary">
              Jelenlegi: {formatCurrency(totalNetWorth)}
            </span>
            <span>{formatCurrency(fireGoal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* FIRE account selection */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">FIRE-be beleszámító számlák</CardTitle>
          <p className="text-xs text-muted-foreground">
            Válaszd ki, mely számlák értékét vegyük figyelembe a FIRE számításnál
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nincs számla</p>
          ) : (
            accounts.map((acc) => {
              const included = includedIds.includes(acc.id)
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => toggleAccount(acc.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                    included
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-muted hover:bg-muted/70'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    included ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {included && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{acc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${
                    included ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {formatCurrency(accountValues[acc.id] ?? acc.balance)}
                  </span>
                </button>
              )
            })
          )}
          <div className="flex justify-between pt-2.5 mt-1 border-t border-border">
            <span className="text-sm text-muted-foreground font-medium">FIRE-be számított vagyon</span>
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(totalNetWorth)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* SWR scenarios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SWR_SCENARIOS.map((scenario) => {
          const annual = totalNetWorth * scenario.rate
          const monthly = annual / 12
          return (
            <Card key={scenario.rate} className={`border ${scenario.bgColor} bg-card`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-bold ${scenario.color}`}>{scenario.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {scenario.description}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-0.5">Éves kivehető összeg</p>
                <p className={`text-xl font-bold ${scenario.color} mb-3`}>
                  {formatCurrency(annual)}
                </p>
                <p className="text-xs text-muted-foreground mb-0.5">Havi passzív jövedelem</p>
                <p className={`text-lg font-semibold ${scenario.color}`}>
                  {formatCurrency(monthly)}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Calculator + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Calculator inputs */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              FIRE Kalkulátor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Jelenlegi megtakarítás (Ft)</Label>
              <Input
                type="number"
                value={currentSavings}
                onChange={(e) => { setCurrentSavings(e.target.value); setSavingsTouched(true) }}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Havi megtakarítás (Ft)</Label>
              <Input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Várható éves hozam (%)</Label>
              <Input
                type="number"
                value={annualReturn}
                onChange={(e) => setAnnualReturn(e.target.value)}
                className="bg-muted border-border text-foreground"
                step="0.1"
                min="0"
                max="30"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">
                Éves megtakarítás növekedés (%)
                <span className="ml-1.5 text-[10px] text-primary font-normal">pl. fizetésemelés</span>
              </Label>
              <Input
                type="number"
                value={savingsGrowthRate}
                onChange={(e) => setSavingsGrowthRate(e.target.value)}
                className="bg-muted border-border text-foreground"
                step="0.5"
                min="0"
                max="20"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Célösszeg (Ft)</Label>
              <Input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* Result */}
            <div className="bg-muted border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Várható FIRE dátum</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{fireYear}</p>
              <p className="text-sm text-muted-foreground">
                {projection.yearsToFire < 50
                  ? `${projection.yearsToFire.toFixed(1)} év múlva éred el a célodat`
                  : 'A jelenlegi beállításokkal 50 éven belül nem érhető el a cél'}
              </p>
              {projection.yearsToFire < 50 && (
                <p className="text-xs text-muted-foreground">
                  {projection.fireDate.toLocaleDateString('hu-HU', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Projection chart */}
        <Card className="xl:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Portfólió növekedés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={projection.chartData}>
                <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Évek', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={parseFloat(targetAmount) || fireGoal}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  label={{
                    value: 'FIRE cél',
                    position: 'right',
                    fill: '#22c55e',
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Portfólió"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#94a3b8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Setup card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">FIRE Cél beállítása</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Havi kiadásaid (Ft)</Label>
              <Input
                type="number"
                value={setupMonthlyExpenses}
                onChange={(e) => setSetupMonthlyExpenses(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                25× éves kiadás (ajánlott cél):
                <span className="text-primary font-semibold ml-1">
                  {formatCurrency(suggested25x)}
                </span>
              </div>
              <Input
                type="number"
                value={setupGoal}
                onChange={(e) => setSetupGoal(e.target.value)}
                className="bg-muted border-border text-foreground"
                placeholder="Célösszeg (Ft)"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Célkorod (év)</Label>
              <Input
                type="number"
                value={setupAge}
                onChange={(e) => setSetupAge(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <Button
              onClick={handleSaveSetup}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Beállítás mentése
            </Button>
          </div>
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <span className="text-amber-400 font-medium">Tipp:</span> Az általánosan elfogadott 4%-os SWR (Safe Withdrawal Rate) szerint a FIRE célösszeg az éves kiadásaid 25-szöröse. Ha havonta{' '}
              <span className="text-foreground font-medium">{formatCurrency(parseFloat(setupMonthlyExpenses) || 280000)}</span> a kiadásod, akkor a javasolt FIRE célod:{' '}
              <span className="text-green-400 font-medium">{formatCurrency(suggested25x)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
