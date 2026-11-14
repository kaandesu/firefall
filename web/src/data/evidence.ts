// Evidence rows: the real ACME Flame Design chamber log (143 test points) plus the 39 CFI-G test-day atmospheres
// from the PSI-159 final report tables (nominal). Ported from flame-in-freefall's evidence explorer.
import { PSI_KPA, type Target } from './library'

export type TestpointsFile = { columns: string[]; rows: (string | number)[][] }

export type EvidenceRow = {
  id: string
  src: 'Flame Design' | 'CFI-G'
  study: 'flame-design' | 'cfi-g'
  date: string
  cfg: 'normal' | 'inverse'
  fuel: string
  o2: number
  o2at: 'ambient' | 'burner'
  psia: number
  ign: 0 | 1
  ref: string
  file: string
  nominal: boolean
}

const CFIG_N: [string, number, number][] = [
  ['21088', 0.4, 13.7], ['21088', 0.21, 14.7], ['21088', 0.18, 14.7], ['21102', 0.4, 14.7], ['21102', 0.21, 14.7], ['21106', 0.4, 7.35], ['21106', 0.21, 7.35],
  ['21112', 0.4, 13.7], ['21112', 0.21, 14.7], ['21125', 0.4, 14.7], ['21125', 0.21, 14.7], ['21130', 0.21, 29.4], ['21130', 0.21, 44.1], ['21137', 0.4, 14.7],
  ['21137', 0.21, 14.7], ['21153', 0.4, 7.35], ['21153', 0.4, 29.4], ['21162', 0.4, 14.7], ['21162', 0.21, 14.7], ['21174', 0.4, 7.35], ['21174', 0.4, 29.4], ['21291', 0.4, 29.4],
]
const CFIG_I: [string, number][] = [
  ['21196', 14.7], ['21196', 7.35], ['21202', 29.4], ['21202', 14.7], ['21209', 7.35], ['21216', 44.1], ['21216', 14.7], ['21222', 44.1], ['21228', 29.4],
  ['21228', 14.7], ['21235', 14.7], ['21235', 7.35], ['21242', 7.35], ['21256', 29.4], ['21265', 44.1], ['21270', 14.7], ['21277', 7.35],
]
const OTHER_FUEL: Record<string, string> = { 21088: 'C₂H₆', 21102: 'n-C₄H₁₀', 21106: 'n-C₄H₁₀', 21112: 'C₃H₈', 21125: 'n-C₄H₁₀', 21130: 'C₃H₈', 21137: 'C₃H₈', 21153: 'C₂H₆', 21162: 'C₂H₆', 21174: 'n-C₄H₁₀', 21291: 'n-C₄H₁₀' }
const cfigFuel = (d: string) => (+d >= 21256 && +d <= 21277 ? 'n-C₄H₁₀' : +d >= 21222 && +d <= 21242 ? 'C₃H₈' : +d >= 21196 && +d <= 21216 ? 'C₂H₆' : (OTHER_FUEL[d] ?? '—'))
const doy = (d: string) => new Date(Date.UTC(2000 + +d.slice(0, 2), 0, 1) + (+d.slice(2) - 1) * 864e5).toISOString().slice(0, 10)

export function buildEvidence(tp: TestpointsFile): EvidenceRow[] {
  const fd: EvidenceRow[] = tp.rows.map((r) => {
    const inv = r[1] === 'I'
    return {
      id: String(r[0]),
      src: 'Flame Design',
      study: 'flame-design',
      date: String(r[3]).slice(0, 10),
      cfg: inv ? 'inverse' : 'normal',
      fuel: inv ? 'C₂H₄ (chamber)' : String(r[6]),
      o2: inv ? 0.85 : Number(r[7]) / 100,
      o2at: inv ? 'burner' : 'ambient',
      psia: Number(r[4]),
      ign: Number(r[2]) ? 1 : 0,
      ref: `PSI-10 · test ${r[0]}`,
      file: 'Chamber Calculator.xlsx · EventData',
      nominal: false,
    }
  })
  const days = [...CFIG_N.map(([d, o, p]) => ({ d, o, p, inv: false })), ...CFIG_I.map(([d, p]) => ({ d, o: 0.85, p, inv: true }))]
  const seen: Record<string, number> = {}
  const cf: EvidenceRow[] = days.map(({ d, o, p, inv }) => {
    const n = (seen[d] = (seen[d] ?? 0) + 1)
    return {
      id: `${d}-${String.fromCharCode(64 + n)}`,
      src: 'CFI-G',
      study: 'cfi-g',
      date: doy(d),
      cfg: inv ? 'inverse' : 'normal',
      fuel: cfigFuel(d),
      o2: o,
      o2at: inv ? 'burner' : 'ambient',
      psia: p,
      ign: 1,
      ref: `PSI-159 final report · Table ${inv ? 2 : 1}`,
      file: `PSI-159 Final Report p.${inv ? 22 : 21}`,
      nominal: true,
    }
  })
  return [...fd, ...cf]
}

/** How close a test point sits to the cabin atmosphere (0..1). Burner-side O₂ counts half. */
export function match(e: EvidenceRow, h: Target) {
  const d = Math.hypot((e.o2 - h.o2) / 0.1, Math.log((e.psia * PSI_KPA) / h.kpa) / 0.35)
  return Math.exp((-d * d) / 2) * (e.o2at === 'burner' ? 0.5 : 1)
}

export function nearest(rows: EvidenceRow[], h: Target, n = 5) {
  return rows
    .filter((e) => e.o2at === 'ambient')
    .map((e) => ({ e, m: match(e, h) }))
    .sort((a, b) => b.m - a.m)
    .slice(0, n)
}

/** Richest ambient O₂ any real test reached: the edge of the evidence. */
export const maxAmbientO2 = (rows: EvidenceRow[]) => Math.max(...rows.filter((e) => e.o2at === 'ambient' && !e.nominal).map((e) => e.o2))
