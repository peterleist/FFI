'use client'

import { useState } from 'react'
import { Flame, Plus, Trash2, ChevronRight, ChevronLeft, Check, Building2, Wallet, TrendingUp, Target, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { AccountType } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountRow {
  id: string
  name: string
  balance: string
  type: AccountType
  tbszYear?: string
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i + 1 === current
              ? 'w-6 h-2 bg-card'
              : i + 1 < current
              ? 'w-2 h-2 bg-card/50'
              : 'w-2 h-2 bg-card/20'
          }`}
        />
      ))}
    </div>
  )
}

// ── Account row editor ────────────────────────────────────────────────────────

function AccountRowEditor({
  row,
  onChange,
  onRemove,
  showTbszYear = false,
}: {
  row: AccountRow
  onChange: (updated: AccountRow) => void
  onRemove: () => void
  showTbszYear?: boolean
}) {
  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={row.name}
        onChange={(e) => onChange({ ...row, name: e.target.value })}
        placeholder="Számla neve"
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 flex-1"
      />
      <Input
        type="number"
        value={row.balance}
        onChange={(e) => onChange({ ...row, balance: e.target.value })}
        placeholder="Egyenleg (Ft)"
        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 w-36"
      />
      {showTbszYear && (
        <Input
          type="number"
          value={row.tbszYear ?? ''}
          onChange={(e) => onChange({ ...row, tbszYear: e.target.value })}
          placeholder="Év (pl. 2022)"
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 w-32"
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/60 hover:text-red-400 transition-colors p-1.5 rounded opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function SetupWizard() {
  const { addAccount, updateProfile, completeSetup } = useAppStore()
  const TOTAL_STEPS = 5
  const [step, setStep] = useState(1)

  // Step 1
  const [name, setName] = useState('')

  // Step 2 – bank / cash
  const [bankRows, setBankRows] = useState<AccountRow[]>([
    { id: crypto.randomUUID(), name: '', balance: '', type: AccountType.BANK },
  ])

  // Step 3 – investments
  const [tbszRows, setTbszRows] = useState<AccountRow[]>([])
  const [allampapirRows, setAllampapirRows] = useState<AccountRow[]>([])
  const [brokerRows, setBrokerRows] = useState<AccountRow[]>([])

  // Step 4 – FIRE goal
  const [monthlyExpenses, setMonthlyExpenses] = useState('')
  const [fireGoal, setFireGoal] = useState('')
  const [targetAge, setTargetAge] = useState('')

  const addRow = (
    setter: React.Dispatch<React.SetStateAction<AccountRow[]>>,
    type: AccountType
  ) =>
    setter((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', balance: '', type },
    ])

  const updateRow = (
    setter: React.Dispatch<React.SetStateAction<AccountRow[]>>,
    id: string,
    updated: AccountRow
  ) => setter((prev) => prev.map((r) => (r.id === id ? updated : r)))

  const removeRow = (
    setter: React.Dispatch<React.SetStateAction<AccountRow[]>>,
    id: string
  ) => setter((prev) => prev.filter((r) => r.id !== id))

  // Summary calculations
  const allRows = [...bankRows, ...tbszRows, ...allampapirRows, ...brokerRows]
  const totalBalance = allRows.reduce(
    (s, r) => s + (parseFloat(r.balance) || 0),
    0
  )
  const bankTotal = bankRows.reduce(
    (s, r) => s + (parseFloat(r.balance) || 0),
    0
  )
  const investTotal = [...tbszRows, ...allampapirRows, ...brokerRows].reduce(
    (s, r) => s + (parseFloat(r.balance) || 0),
    0
  )
  const suggested25x =
    (parseFloat(monthlyExpenses) || 0) * 12 * 25
  const effectiveFireGoal =
    parseFloat(fireGoal) || suggested25x || 50_000_000
  const fireProgress = Math.min(
    (totalBalance / effectiveFireGoal) * 100,
    100
  )

  const handleFinish = () => {
    const userId = 'local-user'
    const now = new Date()

    const rowsToCreate: AccountRow[] = [
      ...bankRows,
      ...tbszRows,
      ...allampapirRows,
      ...brokerRows,
    ].filter((r) => r.name.trim())

    for (const row of rowsToCreate) {
      addAccount({
        id: crypto.randomUUID(),
        userId,
        name: row.name.trim(),
        type: row.type,
        tbszYear:
          row.type === AccountType.TBSZ && row.tbszYear
            ? parseInt(row.tbszYear)
            : null,
        balance: parseFloat(row.balance) || 0,
        currency: 'HUF',
        createdAt: now,
        updatedAt: now,
      })
    }

    updateProfile({
      userName: name.trim() || 'Felhasználó',
      fireGoalAmount: effectiveFireGoal,
      fireTargetAge: targetAge ? parseInt(targetAge) : null,
      monthlyExpenses: monthlyExpenses ? parseFloat(monthlyExpenses) : null,
    })

    completeSetup()
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-muted/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">

          {/* Header strip */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-card/20 flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">PEFI</span>
            </div>
            <StepDots current={step} total={TOTAL_STEPS} />
          </div>

          {/* Body */}
          <div className="px-6 py-6 min-h-[360px] flex flex-col">

            {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Üdvözlünk a PEFIben!</h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">
                    Néhány perc alatt beállítjuk a személyes pénzügyi irányítópultod.
                    Adjuk hozzá a meglévő számláidat és céljaidat.
                  </p>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mi a neved?</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="pl. Kovács Péter"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60 text-base"
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                      { icon: Building2, label: 'Bankszámlák', desc: 'Folyószámla, készpénz' },
                      { icon: TrendingUp, label: 'Befektetések', desc: 'TBSZ, Állampapír' },
                      { icon: Target, label: 'FIRE cél', desc: 'Pénzügyi szabadság' },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="bg-muted rounded-xl p-3 text-center">
                        <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-foreground">{label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => setStep(2)}
                    className="bg-primary hover:bg-primary/90 text-white gap-2"
                  >
                    Kezdjük el
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Bank & Cash ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Bankszámlák és készpénz</h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">
                    Add meg a folyószámláidat, megtakarítási számláidat és készpénzedet.
                    Ha nincs ilyened, hagyd ki.
                  </p>

                  <div className="space-y-2">
                    {bankRows.map((row) => (
                      <AccountRowEditor
                        key={row.id}
                        row={row}
                        onChange={(u) => updateRow(setBankRows, row.id, u)}
                        onRemove={() => removeRow(setBankRows, row.id)}
                      />
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(setBankRows, AccountType.BANK)}
                      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Bankszámla
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(setBankRows, AccountType.CASH)}
                      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 text-xs"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Készpénz
                    </Button>
                  </div>

                  {bankTotal > 0 && (
                    <div className="mt-4 flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                      <span className="text-sm text-primary">Összesen</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(bankTotal)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}
                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5">
                    <ChevronLeft className="w-4 h-4" /> Vissza
                  </Button>
                  <Button onClick={() => setStep(3)} className="bg-primary hover:bg-primary/90 text-white gap-2">
                    Következő <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Investments ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-bold text-foreground">Befektetési számlák</h2>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      Add hozzá a TBSZ számláidat, állampapírjaidat és bróker számláidat.
                      Ha nincs, hagyd ki.
                    </p>
                  </div>

                  {/* TBSZ */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TBSZ számlák</p>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => addRow(setTbszRows, AccountType.TBSZ)}
                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1 text-xs h-7">
                        <Plus className="w-3 h-3" /> TBSZ
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {tbszRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">Nincs TBSZ számla</p>
                      ) : (
                        tbszRows.map((row) => (
                          <AccountRowEditor key={row.id} row={row} showTbszYear
                            onChange={(u) => updateRow(setTbszRows, row.id, u)}
                            onRemove={() => removeRow(setTbszRows, row.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Állampapír */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Állampapír</p>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => addRow(setAllampapirRows, AccountType.ALLAMPAPIR)}
                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1 text-xs h-7">
                        <Plus className="w-3 h-3" /> Állampapír
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {allampapirRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">Nincs állampapír</p>
                      ) : (
                        allampapirRows.map((row) => (
                          <AccountRowEditor key={row.id} row={row}
                            onChange={(u) => updateRow(setAllampapirRows, row.id, u)}
                            onRemove={() => removeRow(setAllampapirRows, row.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Bróker */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bróker számla</p>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => addRow(setBrokerRows, AccountType.BROKER)}
                        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1 text-xs h-7">
                        <Plus className="w-3 h-3" /> Bróker
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {brokerRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">Nincs bróker számla</p>
                      ) : (
                        brokerRows.map((row) => (
                          <AccountRowEditor key={row.id} row={row}
                            onChange={(u) => updateRow(setBrokerRows, row.id, u)}
                            onRemove={() => removeRow(setBrokerRows, row.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {investTotal > 0 && (
                    <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                      <span className="text-sm text-primary">Befektetések összesen</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(investTotal)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}
                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5">
                    <ChevronLeft className="w-4 h-4" /> Vissza
                  </Button>
                  <Button onClick={() => setStep(4)} className="bg-primary hover:bg-primary/90 text-white gap-2">
                    Következő <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 4: FIRE goal ───────────────────────────────────────── */}
            {step === 4 && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">FIRE cél</h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-5">
                    Mikor szeretnél pénzügyileg szabaddá válni? Ezek az adatok segítik
                    a tervező kalkulátort.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Havi kiadásaid (Ft)
                        <span className="ml-1.5 text-[10px] text-muted-foreground/60">lakbér, élelmiszer, közlekedés…</span>
                      </Label>
                      <Input
                        type="number"
                        value={monthlyExpenses}
                        onChange={(e) => setMonthlyExpenses(e.target.value)}
                        placeholder="pl. 280 000"
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60"
                      />
                      {parseFloat(monthlyExpenses) > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Javasolt FIRE cél (25×):{' '}
                          <span className="text-primary font-medium">{formatCurrency(suggested25x)}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        FIRE célösszeg (Ft)
                        <span className="ml-1.5 text-[10px] text-muted-foreground/60">üresen hagyva = 25× éves kiadás</span>
                      </Label>
                      <Input
                        type="number"
                        value={fireGoal}
                        onChange={(e) => setFireGoal(e.target.value)}
                        placeholder={suggested25x > 0 ? String(Math.round(suggested25x)) : 'pl. 50 000 000'}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Célkorod (év)</Label>
                      <Input
                        type="number"
                        value={targetAge}
                        onChange={(e) => setTargetAge(e.target.value)}
                        placeholder="pl. 45"
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/60"
                        min={20}
                        max={80}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}
                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5">
                    <ChevronLeft className="w-4 h-4" /> Vissza
                  </Button>
                  <Button onClick={() => setStep(5)} className="bg-primary hover:bg-primary/90 text-white gap-2">
                    Összesítő <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 5: Summary ─────────────────────────────────────────── */}
            {step === 5 && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-5 h-5 text-green-400" />
                    <h2 className="text-lg font-bold text-foreground">
                      Minden készen áll{name ? `, ${name.split(' ')[0]}` : ''}! 🎉
                    </h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-5">
                    Íme a beállított adataid összesítője. Ezt bármikor módosíthatod a dashboardon.
                  </p>

                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Bankszámlák és készpénz</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] bg-muted/50 text-muted-foreground border-0">
                          {bankRows.filter((r) => r.name).length} db
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(bankTotal)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Befektetések</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] bg-muted/50 text-muted-foreground border-0">
                          {[...tbszRows, ...allampapirRows, ...brokerRows].filter((r) => r.name).length} db
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(investTotal)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-muted border border-border rounded-lg flex items-center justify-between">
                      <span className="text-sm text-primary font-medium">Teljes vagyon</span>
                      <span className="text-base font-bold text-primary">{formatCurrency(totalBalance)}</span>
                    </div>

                    {effectiveFireGoal > 0 && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">FIRE cél</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(effectiveFireGoal)}
                          </span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${fireProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{fireProgress.toFixed(1)}% teljesítve</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(4)}
                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5">
                    <ChevronLeft className="w-4 h-4" /> Vissza
                  </Button>
                  <Button
                    onClick={handleFinish}
                    className="bg-green-500 hover:bg-green-600 text-white gap-2"
                  >
                    Belépés a dashboardba
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/60 mt-4">
          Az adataid a saját szerveredre kerülnek — külső fél nem fér hozzájuk.
        </p>
      </div>
    </div>
  )
}
