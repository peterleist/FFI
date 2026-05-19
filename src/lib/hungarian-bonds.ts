// Magyar lakossági állampapírok (retail government bonds).
// Reference data — verify current conditions at https://www.allampapir.hu
// Yields are indicative; the redemption calculator lets the user override them.

export interface HungarianBond {
  code: string
  name: string
  tenorLabel: string
  interestType: string
  interestFrequency: string
  /** Indicative annual yield, % */
  indicativeYield: number
  /** Early-redemption fee as a % of the nominal value */
  redemptionFeePct: number
  note: string
}

export const HUNGARIAN_BONDS: HungarianBond[] = [
  {
    code: 'FixMÁP',
    name: 'Fix Magyar Állampapír',
    tenorLabel: '3 év',
    interestType: 'Fix kamat',
    interestFrequency: 'Éves kamatfizetés',
    indicativeYield: 6.5,
    redemptionFeePct: 1.0,
    note: 'Előre rögzített, fix éves kamat a teljes futamidőre.',
  },
  {
    code: 'BMÁP',
    name: 'Bónusz Magyar Állampapír',
    tenorLabel: '4 év',
    interestType: 'Változó kamat + bónusz',
    interestFrequency: 'Éves kamatfizetés',
    indicativeYield: 6.0,
    redemptionFeePct: 1.0,
    note: 'A kamat a diszkont kincstárjegyek átlaghozamát követi egy bónusszal.',
  },
  {
    code: 'PMÁP',
    name: 'Prémium Magyar Állampapír',
    tenorLabel: '5 év',
    interestType: 'Inflációkövető + kamatprémium',
    interestFrequency: 'Éves kamatfizetés',
    indicativeYield: 5.0,
    redemptionFeePct: 1.0,
    note: 'A kamat az előző évi inflációhoz igazodik, plusz egy fix kamatprémium.',
  },
  {
    code: '1MÁP',
    name: 'Egyéves Magyar Állampapír',
    tenorLabel: '1 év',
    interestType: 'Fix kamat',
    interestFrequency: 'Kamatfizetés lejáratkor',
    indicativeYield: 6.0,
    redemptionFeePct: 0.25,
    note: 'Rövid, egyéves futamidő fix kamattal.',
  },
  {
    code: 'MÁP Plusz',
    name: 'Magyar Állampapír Plusz',
    tenorLabel: '5 év',
    interestType: 'Lépcsős fix kamat',
    interestFrequency: 'Éves kamatfizetés',
    indicativeYield: 4.95,
    redemptionFeePct: 0,
    note: 'Évről évre emelkedő, lépcsős kamatozás, díjmentes visszaváltással.',
  },
  {
    code: 'KTJ',
    name: 'Kincstári Takarékjegy',
    tenorLabel: '1–2 év',
    interestType: 'Lépcsős fix kamat',
    interestFrequency: 'Kamatfizetés visszaváltáskor',
    indicativeYield: 5.0,
    redemptionFeePct: 0,
    note: 'Postán is elérhető, lépcsős kamatozású takarékjegy.',
  },
  {
    code: 'DKJ',
    name: 'Diszkont Kincstárjegy',
    tenorLabel: '3 / 6 / 12 hó',
    interestType: 'Diszkont (névérték alatt vásárolható)',
    interestFrequency: 'Hozam a lejáratkor realizálódik',
    indicativeYield: 6.5,
    redemptionFeePct: 0,
    note: 'Névérték alatt vásárolható, lejáratkor a teljes névértéket fizeti.',
  },
]

export function getBond(code: string): HungarianBond | undefined {
  return HUNGARIAN_BONDS.find((b) => b.code === code)
}

export interface RedemptionResult {
  daysHeld: number
  accruedInterest: number
  redemptionFee: number
  netProceeds: number
  effectiveYieldPct: number
}

/**
 * Computes what early redemption (feltörés) would yield on a given day:
 * nominal + accrued interest − redemption fee.
 */
export function computeRedemption(
  nominal: number,
  annualYieldPct: number,
  redemptionFeePct: number,
  purchaseDate: Date,
  redemptionDate: Date,
): RedemptionResult {
  const ms = redemptionDate.getTime() - purchaseDate.getTime()
  const daysHeld = Math.max(0, Math.round(ms / 86_400_000))
  const accruedInterest = nominal * (annualYieldPct / 100) * (daysHeld / 365)
  const redemptionFee = nominal * (redemptionFeePct / 100)
  const netProceeds = nominal + accruedInterest - redemptionFee
  const effectiveYieldPct =
    daysHeld > 0 && nominal > 0
      ? ((netProceeds - nominal) / nominal) * (365 / daysHeld) * 100
      : 0
  return { daysHeld, accruedInterest, redemptionFee, netProceeds, effectiveYieldPct }
}
