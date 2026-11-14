// The design package: what the vehicle team hands FIREFALL before a review starts.
// In a real review this comes from the team's materials list (BOM), the cabin spec and the safety data package.
// The materials matrix is computed from it with the same engineering models the simulations use.
import type { Cite, MatrixRow } from '@/live/types'
import { MATERIALS, limitingO2 } from '@/sims/models'

export type BomItem = {
  id: string
  item: string
  material: keyof typeof MATERIALS
  location: string
  qty: string
  /** The cabin-model zone the part sits in (intake: materials.csv `zone`). */
  zone?: string
  /** Metres to the nearest listed ignition source. */
  distance?: number
  /** MAPTIS-style rating as supplied (A acceptable, B configuration-dependent, X not tested). */
  rating?: string
}

export type DesignPackage = {
  vehicle: string
  program: string
  phase: string
  atmosphere: { o2: number; psi: number; label: string }
  gravity: { g: number; label: string }
  volume: string
  ventFlow: number // cm/s
  crew: number
  bom: BomItem[]
  ignition: string[]
  existingTests: string[]
  layout: string
  /** Intake-only extras: where ignition is expected, the hatch and the hull limit. */
  ignitionZones?: string[]
  hatch?: { type: string; openTime: number }
  hull?: { burstPsia: number }
  volumeM3?: number
  /** Smoke detectors from cabin.yaml. */
  sensors?: { id: string; type: 'photoelectric' | 'ionization'; zone: string; pos: [number, number, number] }[]
}

const PR2_BOM: BomItem[] = [
  { id: 'B1', item: 'Stowage bags', material: 'nomex', location: 'Aft stowage wall', qty: '3.1 m²' },
  { id: 'B2', item: 'Crew garments', material: 'cotton', location: 'Crew lockers', qty: '4 sets' },
  { id: 'B3', item: 'Wire insulation', material: 'kapton', location: 'Aft avionics bay', qty: '120 m' },
  { id: 'B4', item: 'Wire jackets', material: 'teflon', location: 'Aft avionics bay', qty: '60 m' },
  { id: 'B5', item: 'Display covers', material: 'pmma', location: 'Forward console', qty: '0.4 m²' },
  { id: 'B6', item: 'Hatch seals', material: 'silicone', location: 'Rear hatch', qty: '2.2 m' },
  { id: 'B7', item: 'Cargo net & Velcro', material: 'nylon', location: 'Stowage + walls', qty: '1.5 m²' },
]

export const PACKAGES: Record<'habitat' | 'incident' | 'apollo1', DesignPackage> = {
  habitat: {
    vehicle: 'PR-2 pressurized lunar rover',
    program: 'Artemis surface mobility (example)',
    phase: 'Phase II safety review',
    atmosphere: { o2: 0.34, psi: 8.2, label: '34 % O₂ · 8.2 psia (exploration atmosphere)' },
    gravity: { g: 0.165, label: 'Moon · 0.165 g' },
    volume: '10 m³ free volume',
    ventFlow: 8,
    crew: 2,
    bom: PR2_BOM,
    ignition: ['Li-ion battery packs (aft bay)', 'Avionics boxes (aft bay)', 'Cabin heater', 'Galley warmer'],
    existingTests: ['Test 1 data at 21 % / 14.7 psia for all BOM items (MAPTIS)', 'No data at 34 % / 8.2 psia'],
    layout: 'Simple box model · 6.4 × 2.1 × 2.0 m',
  },
  incident: {
    vehicle: 'PR-2 pressurized lunar rover',
    program: 'Artemis surface mobility (example)',
    phase: 'Operations · day after EVA',
    atmosphere: { o2: 0.34, psi: 8.2, label: '34 % O₂ · 8.2 psia' },
    gravity: { g: 0.165, label: 'Moon · 0.165 g' },
    volume: '10 m³ free volume',
    ventFlow: 8,
    crew: 2,
    bom: PR2_BOM,
    ignition: ['Aft avionics bay (alarm source)', 'Li-ion battery packs'],
    existingTests: ['Detectors: D1 photoelectric (aft), D3 ionization (aft), D2/D4 at return vent'],
    layout: 'Simple box model · 6.4 × 2.1 × 2.0 m',
  },
  apollo1: {
    vehicle: 'Apollo Command Module CM-012',
    program: 'Apollo 1 (AS-204) · 1967',
    phase: 'Retrospective: pad test review',
    atmosphere: { o2: 1, psi: 16.7, label: '100 % O₂ · 16.7 psia (pad test)' },
    gravity: { g: 1, label: 'Earth · 1 g (launch pad)' },
    volume: '6.2 m³ habitable volume',
    ventFlow: 10,
    crew: 3,
    bom: [
      { id: 'A1', item: 'Debris nets', material: 'nylon', location: 'Cabin', qty: 'several' },
      { id: 'A2', item: 'Velcro patches', material: 'nylon', location: 'Walls', qty: '≈ 3 m²' },
      { id: 'A3', item: 'Crew garments / pads', material: 'cotton', location: 'Couches', qty: '3 sets' },
      { id: 'A4', item: 'Polyurethane foam pads', material: 'pmma', location: 'Floor', qty: 'several' },
      { id: 'A5', item: 'Wiring insulation', material: 'teflon', location: 'Lower equipment bay', qty: 'km' },
      { id: 'A6', item: 'Seals', material: 'silicone', location: 'Hatch, panels', qty: '—' },
    ],
    ignition: ['Damaged wiring near the environmental control unit (probable)'],
    existingTests: ['Materials not tested in 100 % O₂ at 16.7 psia as installed'],
    layout: 'Not modelled',
  },
}

/** Judge each BOM item: the 1 g screening result at Earth air vs the predicted limit at the target conditions. */
export function computeMatrix(pkg: DesignPackage, cites: Cite[] = [{ id: 'PSI-20' }, { id: 'PSI-25' }]): MatrixRow[] {
  return pkg.bom.map((b) => {
    const mat = MATERIALS[b.material]
    const test1Lim = limitingO2(0, 1, 14.7, mat)
    const test1 = test1Lim > 0.21 ? 'pass' : 'fail'
    const lim = limitingO2(pkg.ventFlow, pkg.gravity.g, pkg.atmosphere.psi, mat)
    const margin = lim - pkg.atmosphere.o2
    // pass: clear margin · retest: within the model's uncertainty, only a test can decide · fail: clearly burns here
    const status: MatrixRow['status'] = margin > 0.03 ? 'pass' : margin > -0.06 && test1 === 'pass' ? 'retest' : 'fail'
    const action =
      status === 'pass'
        ? b.material === 'kapton' || b.material === 'teflon'
          ? 'OK to fly · smokes when overheated: needs ionization detection'
          : 'OK to fly'
        : status === 'retest'
          ? `Requalify: Test 1 at ${Math.round(pkg.atmosphere.o2 * 100)} % / ${pkg.atmosphere.psi} psia`
          : test1 === 'pass'
            ? 'Passes on Earth, predicted to burn here: replace, or barrier + configuration analysis (JSC 29353)'
            : 'Replace with a flame-retardant alternative, or isolate behind a barrier (JSC 29353)'
    return {
      id: b.id,
      item: b.item,
      material: mat.label,
      location: b.location,
      qty: b.qty,
      zone: b.zone,
      test1,
      limitO2: lim,
      targetO2: pkg.atmosphere.o2,
      status,
      action,
      cites,
    }
  })
}
