// Fits of FIREFALL's simple models to published NASA flight data (src/data/published/*.json). Plain least squares,
// residuals reported, nothing hidden. These calibrate and check the models; they do not replace them yet.
//   limiting O2 vs flow   ← BASS-II (PMMA rods, SIBAL strip, 1 g blowoff)
//   spread rate scale     ← Saffire IV-VI thin cotton samples (50 cm burned in burn_s at 20 cm/s)
//   droplet K vs O2       ← FLEX n-decane at 0.5 atm
import bass from '@/data/published/bass.json'
import flex from '@/data/published/flex.json'
import saffire from '@/data/published/saffire.json'
import { MATERIALS, effectiveFlow, limitingO2, spreadRate } from './models'

export type FitPoint = { id: string; x: string; observed: number; model: number; fit: number }
export type Fit = { name: string; what: string; params: Record<string, number>; points: FitPoint[]; rmsModel: number; rmsFit: number; source: string; caveat: string }

/** Solve the normal equations (XᵀX)β = Xᵀy by Gaussian elimination. */
export function lsq(X: number[][], y: number[]): number[] {
  const n = X[0].length
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (j < n ? X.reduce((s, r) => s + r[i] * r[j], 0) : X.reduce((s, r, k) => s + r[i] * y[k], 0))))
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < n; r++) {
      if (r === c || !A[c][c]) continue
      const f = A[r][c] / A[c][c]
      for (let j = c; j <= n; j++) A[r][j] -= f * A[c][j]
    }
  }
  return A.map((r, i) => r[n] / r[i])
}

const rms = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length))

/** Limiting O2 = a + b·exp(−u/1.2) + blowoff + material offset; fit a and b to BASS-II limits. */
function fitLimitingO2(): Fit {
  const pts = bass.rows.filter((r) => ['BASS-1', 'BASS-2', 'BASS-6'].includes(r.id))
  const rows = pts.map((r) => {
    const mat = MATERIALS[r.material]
    const flow = r.flow ?? 0
    const u = effectiveFlow(flow, r.g)
    return { r, mat, u, flow, y: r.o2!, fixed: 0.03 * (u / 100) ** 2 + mat.dLim }
  })
  const [a, b] = lsq(
    rows.map((p) => [1, Math.exp(-p.u / 1.2)]),
    rows.map((p) => p.y - p.fixed),
  )
  const points = rows.map((p) => ({ id: p.r.id, x: `${p.r.material} · ${p.flow} cm/s · ${p.r.g} g`, observed: p.y, model: limitingO2(p.flow, p.r.g, 14.7, p.mat), fit: a + b * Math.exp(-p.u / 1.2) + p.fixed }))
  return {
    name: 'limiting O₂ vs flow',
    what: 'O₂ mole fraction below which the flame cannot survive',
    params: { base: a, quench: b, modelBase: 0.14, modelQuench: 0.1 },
    points,
    rmsModel: rms(points.map((p) => p.model - p.observed)),
    rmsFit: rms(points.map((p) => p.fit - p.observed)),
    source: 'BASS-II (NTRS 20160000593, 20150008961)',
    caveat: 'Three limit points for two parameters: the fit is a calibration, not a validation. The SIBAL strip is narrow (2.2 cm) and loses heat to its holder, so its limit sits high.',
  }
}

/** Spread-rate scale: Saffire thin cotton samples, 50 cm in burn_s. Fit one multiplier on the model. */
function fitSpread(): Fit {
  const rows = saffire.rows.filter((r) => r.material === 'cotton')
  const pts = rows.map((r) => {
    const psi = r.kpa / 6.894757
    return { r, y: (500 / r.burn_s), m: spreadRate(r.o2, r.flow, 0, psi, MATERIALS.cotton) }
  })
  const k = pts.reduce((s, p) => s + p.y * p.m, 0) / pts.reduce((s, p) => s + p.m * p.m, 0)
  const points = pts.map((p) => ({ id: p.r.id, x: `${Math.round(p.r.o2 * 100)} % O₂ · ${p.r.kpa} kPa`, observed: p.y, model: p.m, fit: k * p.m }))
  return {
    name: 'spread rate (thin cotton, µg, 20 cm/s)',
    what: 'mm/s; observed = 500 mm sample ÷ burn duration (a lower bound on speed)',
    params: { scale: k },
    points,
    rmsModel: rms(points.map((p) => p.model - p.observed)),
    rmsFit: rms(points.map((p) => p.fit - p.observed)),
    source: 'Saffire IV-VI (NTRS 20240002981, Tables 1-2)',
    caveat: 'Burn duration includes ignition and burnout, so these speeds are lower bounds. Cotton jersey (V-2) is not SIBAL.',
  }
}

/** Droplet burning-rate constant K = c·(X_O2/0.21)^n, log-linear fit to FLEX n-decane. */
function fitDroplet(): Fit {
  const rows = flex.rows.filter((r) => r.fuel === 'n-decane' && r.quantity === 'K hot flame')
  const [lc, n] = lsq(
    rows.map((r) => [1, Math.log(r.o2 / 0.21)]),
    rows.map((r) => Math.log(r.value!)),
  )
  const c = Math.exp(lc)
  const points = rows.map((r) => ({ id: r.id, x: `${Math.round(r.o2 * 100)} % O₂ · ${r.atm} atm`, observed: r.value!, model: 0.8 * (r.o2 / 0.21) ** 0.7, fit: c * (r.o2 / 0.21) ** n }))
  return {
    name: 'droplet burning rate K vs O₂',
    what: 'mm²/s, n-decane hot flame, N₂ diluent, 0.5 atm',
    params: { c, n, modelC: 0.8, modelN: 0.7 },
    points,
    rmsModel: rms(points.map((p) => p.model - p.observed)),
    rmsFit: rms(points.map((p) => p.fit - p.observed)),
    source: 'FLEX (NTRS 20140006750)',
    caveat: 'Our model was written for heptane at 1 atm; decane at 0.5 atm burns slower. The exponent n is the transferable part.',
  }
}

export const FITS = { limitingO2: fitLimitingO2(), spread: fitSpread(), droplet: fitDroplet() }

/** Methanol LOI from FLEX against the model's droplet limit. */
export const FLEX_LOI = { methanol: flex.rows.find((r) => r.id === 'FLEX-10')!.value!, modelHeptane: 0.15 }
