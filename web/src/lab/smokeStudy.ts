// The detection study the Detection agent runs on the lab cluster: smoke CFD in the cabin cross-section for every
// ignition source × gravity case, then "is the designed sensor layout good, and what would be better?".
// Pure: same inputs → same numbers. Heavy (≈ 9 CFD runs), so the app runs it in a Web Worker (smoke.worker.ts).
import type { DesignPackage } from '@/demo/packages'
import type { CabinModel } from '@/intake/parse'
import { MATERIALS, detectorEfficiency } from '@/sims/models'
import { Fluid, G_CASES, cabinSection, mountable, optimizeSensors, simulate, worstFirstAlarm, type FluidConfig, type FluidRun, type SensorSpec, type Vec2 } from './fluid'

export type StudyInput = { model: CabinModel; pkg: Pick<DesignPackage, 'ventFlow' | 'ignitionZones' | 'sensors' | 'bom'>; seconds?: number }

export type SourceDef = { id: string; label: string; zone: string; at: Vec2; listed: boolean }

export type StudyCase = { source: string; g: number; gLabel: string; alarms: Record<string, number | null>; firstAlarm: number | null }

export type SmokeStudy = {
  nx: number
  ny: number
  cell: number
  w: number
  h: number
  /** 1 = cabin air, for drawing the section. */
  open: Uint8Array
  sources: SourceDef[]
  designed: SensorSpec[]
  proposed: SensorSpec[]
  cases: StudyCase[]
  proposedCases: StudyCase[]
  worstDesigned: number | null
  worstProposed: number | null
  /** Density frames for the listed ignition source, per gravity case (for the lab tiles and the stage). */
  frames: { g: number; gLabel: string; every: number; frames: Float32Array[]; alarms: Record<string, number | null> }[]
  smokeD: number
  seconds: number
  runs: number
  /** Per cell: the latest time smoke reaches it over all sources and gravity cases (Infinity = some case never). */
  worstArrival: Float32Array
  /** Per cell: the share of source × gravity cases in which smoke reaches it within the run (0..1, -1 = wall). */
  reach: Float32Array
}

const CELL = 0.06
const DT = 0.2

const centroid = (m: CabinModel, zone: string): Vec2 | undefined => {
  const ps = m.primitives.filter((p) => p.zone === zone && !p.shell)
  if (!ps.length) return undefined
  return [ps.reduce((a, p) => a + p.pos[0], 0) / ps.length, ps.reduce((a, p) => a + p.pos[1], 0) / ps.length]
}

/** Nudge a point into open air (sources sit on equipment, sensors on walls). */
function intoAir(f: Fluid, [x, y]: Vec2): Vec2 {
  const [i, j] = f.cellOf(x, y)
  if (f.open[j * f.nx + i]) return [x, y]
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        const ii = i + di
        const jj = j + dj
        if (ii >= 0 && jj >= 0 && ii < f.nx && jj < f.ny && f.open[jj * f.nx + ii]) return f.pos(ii, jj)
      }
  return [x, y]
}

/** Ignition sources: the ones listed in cabin.yaml, plus other powered equipment in the model (credible sources). */
export function sourcesFor(model: CabinModel, listed: string[]): SourceDef[] {
  const zones = [...new Set([...listed, ...['ecu', 'console'].filter((z) => model.primitives.some((p) => p.zone === z))])]
  return zones.flatMap((z) => {
    const c = centroid(model, z)
    return c ? [{ id: z, label: listed.includes(z) ? `${z} (listed)` : `${z} (powered equipment)`, zone: z, at: c, listed: listed.includes(z) }] : []
  })
}

export function smokeStudy({ model, pkg, seconds = 60 }: StudyInput, onProgress?: (done: number, total: number) => void): SmokeStudy {
  const sec = cabinSection(model)
  const probe = new Fluid({ ...sec, cell: CELL, g: 0, vent: 0, inlet: [0, 0], outlet: [0, 0], source: [0, 0], smokeD: 0.5, sensors: [] })
  const sources = sourcesFor(model, pkg.ignitionZones ?? []).map((s) => ({ ...s, at: intoAir(probe, s.at) }))
  const designed: SensorSpec[] = (pkg.sensors ?? []).map((d) => {
    const [x, y] = intoAir(probe, [d.pos[0], d.pos[1]])
    return { id: d.id, type: d.type, x, y }
  })
  // What burns at the listed source decides the smoke size the detectors see (SAME: PTFE smoke is tiny).
  const srcZone = sources.find((s) => s.listed)?.zone ?? sources[0]?.zone
  const lead = pkg.bom.find((b) => b.zone === srcZone)
  const smokeD = lead ? MATERIALS[lead.material].smokeD : 0.5
  const ecu = centroid(model, 'ecu') ?? [-1.2, 0.5]
  const vent = (pkg.ventFlow ?? 0) / 100
  const base = (g: number, at: Vec2, sensors: SensorSpec[]): FluidConfig => ({
    ...sec,
    cell: CELL,
    g,
    vent,
    inlet: intoAir(probe, [ecu[0] - 0.1, ecu[1]]),
    outlet: intoAir(probe, [-ecu[0], 1.6]),
    source: at,
    smokeD,
    sensors,
  })

  const total = sources.length * G_CASES.length
  let done = 0
  const runs: FluidRun[] = []
  const cases: StudyCase[] = []
  const frames: SmokeStudy['frames'] = []
  for (const s of sources)
    for (const gc of G_CASES) {
      const r = simulate(base(gc.g, s.at, designed), seconds, DT, 1)
      runs.push(r)
      const ts = Object.values(r.alarms).filter((t): t is number => t !== null)
      cases.push({ source: s.id, g: gc.g, gLabel: gc.label, alarms: r.alarms, firstAlarm: ts.length ? Math.min(...ts) : null })
      if (s.listed || (!sources.some((x) => x.listed) && s === sources[0])) frames.push({ g: gc.g, gLabel: gc.label, every: r.every, frames: r.frames, alarms: r.alarms })
      onProgress?.(++done, total + 1)
    }

  // Proposed layout: same number of sensors (≥ 2), placed to minimise the worst case. The detector type follows the
  // smoke the fire makes (SAME): below ~0.3 µm a photoelectric head barely sees it, so pick the type that does.
  const n = Math.max(2, designed.length)
  const type: SensorSpec['type'] = detectorEfficiency('ionization', smokeD) >= detectorEfficiency('photoelectric', smokeD) ? 'ionization' : 'photoelectric'
  const cand = mountable(probe).filter((k) => {
    const [x, y] = probe.pos(k % probe.nx, Math.floor(k / probe.nx))
    return y > 0.3 && Math.abs(x) < 1.8
  })
  const best = optimizeSensors(runs, cand.filter((_, i) => i % 2 === 0), n)
  const proposed: SensorSpec[] = best.cells.map((k, i) => {
    const [x, y] = probe.pos(k % probe.nx, Math.floor(k / probe.nx))
    return { id: `P${i + 1}`, type, x, y, proposed: true }
  })
  // Check the proposed layout with the detector physics (particle size), not just smoke arrival.
  const proposedCases: StudyCase[] = []
  for (const s of sources)
    for (const gc of G_CASES) {
      const r = simulate(base(gc.g, s.at, proposed), seconds, DT, 5)
      const ts = Object.values(r.alarms).filter((t): t is number => t !== null)
      proposedCases.push({ source: s.id, g: gc.g, gLabel: gc.label, alarms: r.alarms, firstAlarm: ts.length ? Math.min(...ts) : null })
    }
  onProgress?.(total + 1, total + 1)

  const worstArrival = new Float32Array(probe.nx * probe.ny)
  const reach = new Float32Array(probe.nx * probe.ny)
  for (let k = 0; k < worstArrival.length; k++) {
    worstArrival[k] = probe.open[k] ? Math.max(...runs.map((r) => r.arrival[k])) : -1
    reach[k] = probe.open[k] ? runs.filter((r) => Number.isFinite(r.arrival[k])).length / runs.length : -1
  }
  const worst = (cs: StudyCase[]) => (cs.some((c) => c.firstAlarm === null) ? null : Math.max(...cs.map((c) => c.firstAlarm!)))
  return {
    nx: probe.nx,
    ny: probe.ny,
    cell: CELL,
    w: sec.w,
    h: sec.h,
    open: probe.open,
    sources,
    designed,
    proposed,
    cases,
    proposedCases,
    worstDesigned: worst(cases),
    worstProposed: worst(proposedCases),
    frames,
    smokeD,
    seconds,
    runs: runs.length + proposedCases.length,
    worstArrival,
    reach,
  }
}

export { worstFirstAlarm }
