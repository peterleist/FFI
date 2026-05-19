'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Landmark, Scissors, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { HUNGARIAN_BONDS, getBond, computeRedemption } from '@/lib/hungarian-bonds'
import type { Account } from '@/lib/types'

const toISO = (d: Date) => d.toISOString().slice(0, 10)

export function AllampapirPanel({ accounts }: { accounts: Account[] }) {
  const total = accounts.reduce((s, a) => s + a.balance, 0)

  // ── Redemption calculator state ──────────────────────────────────────────
  const [code, setCode] = useState(HUNGARIAN_BONDS[0].code)
  const [amount, setAmount] = useState('1000000')
  const [purchaseDate, setPurchaseDate] = useState(
    toISO(new Date(Date.now() - 365 * 86_400_000))
  )
  const [redemptionDate, setRedemptionDate] = useState(toISO(new Date()))
  const [yieldPct, setYieldPct] = useState(String(HUNGARIAN_BONDS[0].indicativeYield))
  const [feePct, setFeePct] = useState(String(HUNGARIAN_BONDS[0].redemptionFeePct))

  const onBondChange = (c: string) => {
    setCode(c)
    const b = getBond(c)
    if (b) {
      setYieldPct(String(b.indicativeYield))
      setFeePct(String(b.redemptionFeePct))
    }
  }

  const result = useMemo(
    () => computeRedemption(
      parseFloat(amount) || 0,
      parseFloat(yieldPct) || 0,
      parseFloat(feePct) || 0,
      new Date(purchaseDate),
      new Date(redemptionDate),
    ),
    [amount, yieldPct, feePct, purchaseDate, redemptionDate]
  )

  const dateInputClass =
    'h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground [color-scheme:dark]'

  return (
    <div className="space-y-5">
      {/* ── Bond catalog ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-primary" />
            Magyar lakossági állampapírok
          </h2>
          <a
            href="https://www.allampapir.hu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            allampapir.hu <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Referencia adatok — az aktuális hozamokat és kondíciókat ellenőrizd a hivatalos oldalon.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HUNGARIAN_BONDS.map((b) => (
            <Card key={b.code} className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{b.code}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {b.tenorLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{b.name}</p>
                <div className="flex items-baseline gap-1.5 pt-0.5">
                  <span className="text-2xl font-bold text-emerald-400">{b.indicativeYield}%</span>
                  <span className="text-[10px] text-muted-foreground">indikatív éves hozam</span>
                </div>
                <div className="space-y-1 pt-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Kamatozás</span>
                    <span className="text-foreground text-right">{b.interestType}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Kamatfizetés</span>
                    <span className="text-foreground text-right">{b.interestFrequency}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Visszaváltási díj</span>
                    <span className={`font-medium ${b.redemptionFeePct > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {b.redemptionFeePct > 0 ? `${b.redemptionFeePct}%` : 'díjmentes'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/70 pt-1.5 border-t border-border">
                  {b.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Holdings ────────────────────────────────────────────────────── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Állampapír befektetéseim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nincs állampapír számla
              </p>
            ) : (
              <>
                {accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium text-foreground">{acc.name}</span>
                    <span className="text-sm font-bold text-amber-400">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-sm text-muted-foreground">Összesen</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(total)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Redemption (feltörés) calculator ────────────────────────────── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" />
              Feltörési kalkulátor
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mennyibe kerül az állampapír idő előtti visszaváltása egy adott napon?
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Állampapír típusa</Label>
              <Select value={code} onValueChange={onBondChange}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {HUNGARIAN_BONDS.map((b) => (
                    <SelectItem key={b.code} value={b.code} className="text-foreground">
                      {b.code} — {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">Névérték (Ft)</Label>
              <Input
                type="number" value={amount} min="0" step="1000"
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">Vásárlás dátuma</Label>
                <input
                  type="date" value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={dateInputClass}
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">Visszaváltás napja</Label>
                <input
                  type="date" value={redemptionDate}
                  onChange={(e) => setRedemptionDate(e.target.value)}
                  className={dateInputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">Éves hozam (%)</Label>
                <Input
                  type="number" value={yieldPct} min="0" step="0.1"
                  onChange={(e) => setYieldPct(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">Visszaváltási díj (%)</Label>
                <Input
                  type="number" value={feePct} min="0" step="0.05"
                  onChange={(e) => setFeePct(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            {/* Result */}
            <div className="bg-muted rounded-xl p-3 space-y-2 mt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tartási idő</span>
                <span className="text-foreground font-medium">{result.daysHeld} nap</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Felhalmozott kamat</span>
                <span className="text-emerald-400 font-medium">
                  +{formatCurrency(result.accruedInterest)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2">
                <span className="text-sm text-red-400 font-medium">Feltörés költsége</span>
                <span className="text-sm text-red-400 font-bold">
                  −{formatCurrency(result.redemptionFee)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">Nettó kifizetés visszaváltáskor</span>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(result.netProceeds)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Effektív éves hozam</span>
                <span className={`font-medium ${result.effectiveYieldPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.effectiveYieldPct >= 0 ? '+' : ''}{result.effectiveYieldPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
