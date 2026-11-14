// What one FDS run says, in numbers the report and the agents quote. Pure over the run's CSVs.
import { firstCrossing, type FdsCsv } from './csv'

export const PA_PER_PSI = 6894.757
export const OBSCURATION_ALARM = 3.24 // %/m, UL 217 default, as in the generated &PROP

export type FdsSummary = {
  peakHrrKw: number
  peakHrrAt: number
  /** Mean HRR over the second half of the run, kW. */
  lateHrrKw: number
  burnerKw: number
  /** First time the fire is clearly bigger than the burner alone (another item burning), s. */
  spreadAt: number | null
  peakPsia: number
  peakPsiaAt: number
  startPsia: number
  /** Time the cabin passes the hull burst pressure, if it does. */
  burstAt: number | null
  alarms: Record<string, number | null>
  maxCeilingC: number
  minO2: number
  tEnd: number
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

/** First time y goes above `level` and stays there for `hold` seconds (ignores one-off puffs). */
export function sustainedAbove(t: number[], y: number[], level: number, hold: number): number | null {
  for (let i = 0; i < y.length; i++) {
    if (y[i] < level) continue
    let j = i
    while (j < y.length && y[j] >= level) j++
    if ((t[j - 1] ?? t[i]) - t[i] >= hold || j === y.length) return t[i]
    i = j
  }
  return null
}

export function summarize(hrr: FdsCsv, devc: FdsCsv, opts: { burnerKw: number; burstPsia: number; detectors: string[] }): FdsSummary {
  const th = hrr.cols.Time, q = hrr.cols.HRR
  const td = devc.cols.Time
  let pk = 0
  q.forEach((v, i) => v > q[pk] && (pk = i))
  const p = (devc.cols.P_cabin ?? []).map((v) => v / PA_PER_PSI)
  let pp = 0
  p.forEach((v, i) => v > p[pp] && (pp = i))
  const tcs = devc.names.filter((n) => n.startsWith('TC_'))
  const top = tcs.at(-1)
  return {
    peakHrrKw: q[pk],
    peakHrrAt: th[pk],
    lateHrrKw: mean(q.filter((_, i) => th[i] >= (th.at(-1) ?? 0) / 2)),
    burnerKw: opts.burnerKw,
    spreadAt: sustainedAbove(th, q, opts.burnerKw * 1.25, 2),
    peakPsia: p[pp] ?? 0,
    peakPsiaAt: td[pp] ?? 0,
    startPsia: p[0] ?? 0,
    burstAt: opts.burstPsia ? (firstCrossing(td, p, opts.burstPsia) ?? null) : null,
    alarms: Object.fromEntries(opts.detectors.map((d) => [d, devc.cols[d] ? (firstCrossing(td, devc.cols[d], OBSCURATION_ALARM) ?? null) : null])),
    maxCeilingC: top ? Math.max(...devc.cols[top]) : 0,
    minO2: Math.min(...(devc.cols.O2_cabin ?? [1])),
    tEnd: th.at(-1) ?? 0,
  }
}
