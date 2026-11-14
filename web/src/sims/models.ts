// Engineering models behind the sims. They are deliberately simple, transparent, and labelled as
// illustrative: shapes and trends follow the PSI literature, absolute numbers must be calibrated
// against the team's downloaded PSI datasets before anyone quotes them.
//
// Anchors used:
//  - µg opposed-flow flames sustained down to ~14 % O₂ (NASA TM, NTRS 20040084156)
//  - BASS-II: flames sustained below 1 cm/s flow, dim blue (NTRS 20150019858)
//  - FLEX: heptane LOI 0.15 in O₂/N₂, ≈0.17 with CO₂ diluent (doi 10.1007/s12217-014-9372-2)
//  - SAME: much smoke < 500 nm; photoelectric detector misses Teflon/Kapton smoke (NIST/NASA)
//  - LOIs (1 g, literature): nylon ≈ 24 %, Nomex ≈ 28–30 %, Kapton ≈ 37 %, PMMA ≈ 17–18 %, PTFE ≈ 95 %

export const EARTH = { o2: 0.209, psi: 14.7, g: 1, flow: 0 }
export const ATMOS = {
  earth: { label: 'ISS / Earth cabin', o2: 0.21, psi: 14.7 },
  eawg: { label: 'Exploration (EAWG)', o2: 0.34, psi: 8.2 },
  lunar: { label: 'Moon base (brief)', o2: 0.3, psi: 10.2 },
  suit: { label: 'Suit', o2: 1, psi: 4.3 },
}
export const GRAVITY = { micro: 0, moon: 0.165, mars: 0.38, earth: 1 }

/** Buoyancy adds an effective induced flow; in µg only forced flow remains. ~30 cm/s at 1 g for small flames. */
export const effectiveFlow = (flow: number, g: number) => Math.sqrt(flow * flow + (30 * Math.sqrt(g)) ** 2)

export type Material = { id: string; label: string; dLim: number; k: number; smokeD: number; note: string }

export const MATERIALS: Record<string, Material> = {
  cotton: { id: 'cotton', label: 'Cotton-fiberglass (SIBAL)', dLim: 0, k: 1, smokeD: 0.7, note: 'Saffire-I/III sample' },
  pmma: { id: 'pmma', label: 'PMMA (acrylic)', dLim: 0.03, k: 0.6, smokeD: 0.5, note: 'BASS-II slabs and rods' },
  nylon: { id: 'nylon', label: 'Nylon (netting, Velcro)', dLim: 0.1, k: 0.8, smokeD: 0.6, note: 'Apollo 1 cabin; LOI ≈ 24 %' },
  nomex: { id: 'nomex', label: 'Nomex HT90-40', dLim: 0.14, k: 0.45, smokeD: 0.45, note: 'Stowage bags, crew clothing; LOI ≈ 28–30 %' },
  kapton: { id: 'kapton', label: 'Kapton (wire insulation)', dLim: 0.23, k: 0.3, smokeD: 0.25, note: 'Electronics; SAME smoke source' },
  teflon: { id: 'teflon', label: 'Teflon / PTFE', dLim: 0.8, k: 0.1, smokeD: 0.18, note: 'Wiring; overheats rather than burns' },
  silicone: { id: 'silicone', label: 'Silicone rubber', dLim: 0.1, k: 0.4, smokeD: 0.9, note: 'Seals; large smoke particles' },
}

/** Limiting O₂ mole fraction vs effective flow: quench at low flow (O₂ transport), blow-off at high flow. */
export function limitingO2(flowCmS: number, g: number, psi: number, mat: Material) {
  const u = effectiveFlow(flowCmS, g)
  const quench = 0.1 * Math.exp(-u / 1.2)
  const blowoff = 0.03 * (u / 100) ** 2
  const pressure = Math.pow(14.7 / Math.max(1, psi), 0.08)
  return (0.14 + quench + blowoff) * pressure + mat.dLim
}

/** Spread rate (mm/s, illustrative) for a thin fuel; 0 when below the limiting O₂. */
export function spreadRate(o2: number, flowCmS: number, g: number, psi: number, mat: Material) {
  const lim = limitingO2(flowCmS, g, psi, mat)
  if (o2 <= lim) return 0
  const u = effectiveFlow(flowCmS, g)
  return 60 * mat.k * (o2 - lim) * Math.sqrt(Math.min(u, 60) / 20) * Math.pow(psi / 14.7, 0.25)
}

/** Spread relative to the same material in an Earth cabin at the same forced flow and gravity. */
export function spreadVsEarth(o2: number, flow: number, g: number, psi: number, mat: Material) {
  const base = spreadRate(EARTH.o2, flow, g, EARTH.psi, mat)
  const v = spreadRate(o2, flow, g, psi, mat)
  if (base === 0) return v > 0 ? Infinity : 0
  return v / base
}

/** Flame shape vs gravity: sphere in µg → elongated flickering teardrop at 1 g. */
export function flameShape(g: number, o2: number, flow: number) {
  const buoy = Math.sqrt(Math.max(0, g))
  const stretch = 1 + 2.1 * buoy + Math.min(1.2, flow / 25)
  const size = Math.pow(o2 / 0.21, 0.55)
  const flickerHz = 11 * buoy
  const soot = Math.min(1, 0.08 + 0.75 * buoy * Math.pow(o2 / 0.21, 0.6))
  const tempK = Math.min(3000, 300 + 1650 * Math.pow(o2 / 0.21, 0.42))
  return { stretch, size, flickerHz, soot, tempK, lean: Math.min(0.6, flow / 40) }
}

/** Fraction of a particle's light-scattering detectability for photoelectric (≥ ~0.3 µm) vs ionization (small). */
export function detectorEfficiency(kind: 'photoelectric' | 'ionization', dMicron: number) {
  const s = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)))
  return kind === 'photoelectric' ? 0.05 + 0.95 * s(dMicron, 0.22, 0.75) : 0.35 + 0.6 * (1 - s(dMicron, 0.15, 0.9))
}

/** Droplet burning: d² law with O₂ and diluent effects, LOI from FLEX. */
export function droplet(o2: number, co2: number, d0mm: number) {
  const xo2 = o2 * (1 - co2)
  const loi = 0.15 + 0.02 * Math.min(1, co2 / 0.1)
  const burns = xo2 > loi
  const K = burns ? 0.8 * Math.pow(xo2 / 0.21, 0.7) * (1 - 0.6 * co2) : 0 // mm²/s
  const life = burns ? (d0mm * d0mm) / K : 0
  // Large heptane droplets: the hot flame radiatively extinguishes early and a cool flame carries on (FLEX).
  const coolFlame = burns && d0mm >= 2.5 && xo2 < 0.3
  const hotExtD = coolFlame ? d0mm * 0.55 : 0
  return { xo2, loi, burns, K, life, coolFlame, hotExtD, standoff: 7 + 3 * (1 - Math.min(1, xo2 / 0.4)) }
}

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`
