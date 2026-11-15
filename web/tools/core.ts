// The tools an agent can call, as plain functions over the app's own models and data. Nothing here is scripted:
// every answer is computed from the parameters given. tools/mcp.ts exposes them over MCP.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEvidence, maxAmbientO2, nearest, publishedEvidence, type EvidenceRow, type TestpointsFile } from '@/data/evidence'
import { ranked, targetOf } from '@/data/library'
import { searchPages, type Report } from '@/data/report'
import { parseCabin, parseMaterials, parseModel, toPackage, type CabinModel, type CabinSpec, type MaterialRow } from '@/intake/parse'
import { smokeStudy } from '@/lab/smokeStudy'
import { FITS } from '@/sims/fits'
import { MATERIALS, droplet, limitingO2, spreadRate, spreadVsEarth } from '@/sims/models'
import { simulateFire, type Variant } from '@/stage/physics'

export const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXAMPLE = join(WEB, 'public/examples/apollo-cm012')

export class ToolError extends Error {}

const r2 = (v: number, d = 2) => Number(v.toFixed(d))
const gLabel = (g: number) => (g === 0 ? 'µg' : g === 1 ? '1 g' : `${g} g`)

export type Cabin = { spec: CabinSpec; rows: MaterialRow[]; model: CabinModel }

let override: Cabin | undefined

/** The cabin under review: the files the app sent for this review (setCabin), or else the Apollo CM-012 example. */
export function loadCabin(): Cabin {
  if (override) return override
  const read = (f: string) => readFileSync(join(EXAMPLE, f), 'utf8')
  return { spec: parseCabin(read('cabin.yaml')), rows: parseMaterials(read('materials.csv')), model: parseModel(read('cabin.model.json')) }
}

/** Use these intake files for every tool from now on. Throws if they do not parse. */
export function setCabin(files: { cabin: string; materials: string; model: string }) {
  override = { spec: parseCabin(files.cabin), rows: parseMaterials(files.materials), model: parseModel(files.model) }
  return { vehicle: override.spec.vehicle, materials: override.rows.length }
}

export type CallRecord = { n: number; tool: string; args: unknown; ok: boolean; result: unknown; at: string; ms: number }
const calls: CallRecord[] = []
let callN = 0

/** Every tool call with its full result, so the app can draw what an agent just did. */
export function recordCall(c: Omit<CallRecord, 'n'>) {
  calls.push({ ...c, n: ++callN })
  if (calls.length > 400) calls.shift()
}
export const callsSince = (n: number) => calls.filter((c) => c.n > n)

function material(id: string) {
  const m = MATERIALS[id.toLowerCase()]
  if (!m) throw new ToolError(`Unknown material "${id}". Known: ${Object.keys(MATERIALS).join(', ')}.`)
  return m
}

let evidence: EvidenceRow[] | undefined
function allEvidence(): EvidenceRow[] {
  if (!evidence) {
    const tp = JSON.parse(readFileSync(join(WEB, 'public/data/acme/testpoints.json'), 'utf8')) as TestpointsFile
    evidence = [...buildEvidence(tp), ...publishedEvidence()]
  }
  return evidence
}

export function getCabin() {
  const { spec, rows } = loadCabin()
  return {
    vehicle: spec.vehicle,
    atmosphere: { o2: spec.o2, psia: spec.psi },
    gravity_g: spec.g,
    volume_m3: spec.volume,
    vent_flow_cm_s: spec.ventFlow,
    hatch_open_s: spec.hatch.openTime,
    hull_burst_psia: spec.hull.burstPsia,
    ignition: spec.ignition,
    detectors: spec.sensors.map((s) => ({ id: s.id, type: s.type, zone: s.zone })),
    materials: rows.map((r) => ({ part: r.part, material: r.key ?? r.material, zone: r.zone, rating: r.rating, quantity: r.quantity })),
    known_materials: Object.values(MATERIALS).map((m) => ({ id: m.id, label: m.label })),
  }
}

export function searchStudies(p: { o2: number; psia: number; top?: number }) {
  return {
    target: { o2: p.o2, psia: p.psia },
    studies: ranked(targetOf(p.o2, p.psia))
      .slice(0, p.top ?? 5)
      .map((f) => ({ name: f.study.name, psi: f.study.psi ?? null, score: r2(f.total), why: f.why, tested_o2: f.study.o2, tested_kpa: f.study.kpa, fuel: f.study.fuel, about: f.study.plain })),
    note: 'score 0..1: how well the conditions a study tested cover this atmosphere.',
  }
}

export function nearestTests(p: { o2: number; psia: number; n?: number; material?: string }) {
  let rows = allEvidence()
  if (p.material) {
    const q = p.material.toLowerCase()
    rows = rows.filter((e) => `${e.material ?? ''} ${e.fuel}`.toLowerCase().includes(q))
    if (!rows.length) throw new ToolError(`No test point mentions "${p.material}".`)
  }
  const max = maxAmbientO2(allEvidence())
  return {
    target: { o2: p.o2, psia: p.psia },
    tests: nearest(rows, targetOf(p.o2, p.psia), p.n ?? 5).map(({ e, m }) => ({
      id: e.id, study: e.src, material: e.material ?? e.fuel, o2: e.o2, psia: e.psia, ignited: e.ign === 1, result: e.result ?? null, source: e.ref, where: e.file, match: r2(m),
    })),
    richest_o2_tested: max,
    warning: p.o2 > max ? `No real test reached ${Math.round(p.o2 * 100)} % O₂. The richest ambient O₂ in the data is ${Math.round(max * 100)} %; anything above it is extrapolation.` : null,
    points_searched: rows.length,
  }
}

type Burn = { material: string; flow_cm_s?: number; g?: number; psia?: number }

export function limitingO2Tool(p: Burn) {
  const m = material(p.material)
  const flow = p.flow_cm_s ?? 20, g = p.g ?? 0, psia = p.psia ?? 14.7
  const fit = FITS.limitingO2
  return {
    material: m.label,
    conditions: { flow_cm_s: flow, gravity: gLabel(g), psia },
    limiting_o2: r2(limitingO2(flow, g, psia, m), 3),
    meaning: 'Below this O₂ mole fraction the model says a flame on this material goes out.',
    model_check: { against: fit.source, rms_error_before_fit: r2(fit.rmsModel, 3), rms_error_after_fit: r2(fit.rmsFit, 3), caveat: fit.caveat },
  }
}

export function spreadRateTool(p: Burn & { o2: number }) {
  const m = material(p.material)
  const flow = p.flow_cm_s ?? 20, g = p.g ?? 0, psia = p.psia ?? 14.7
  const lim = limitingO2(flow, g, psia, m)
  const v = spreadRate(p.o2, flow, g, psia, m)
  const vs = spreadVsEarth(p.o2, flow, g, psia, m)
  const fit = FITS.spread
  return {
    material: m.label,
    conditions: { o2: p.o2, flow_cm_s: flow, gravity: gLabel(g), psia },
    burns: v > 0,
    spread_mm_s: r2(v),
    limiting_o2: r2(lim, 3),
    vs_earth_air: Number.isFinite(vs) ? r2(vs) : 'burns here, not in Earth air',
    model_check: { against: fit.source, scale_from_fit: r2(fit.params.scale), caveat: fit.caveat },
    caution: 'A simple thin-fuel model for triage. It is not a substitute for NASA-STD-6001 Test 1.',
  }
}

export function dropletTool(p: { o2: number; co2?: number; diameter_mm?: number }) {
  const d = droplet(p.o2, p.co2 ?? 0, p.diameter_mm ?? 3)
  return {
    conditions: { o2: p.o2, co2: p.co2 ?? 0, diameter_mm: p.diameter_mm ?? 3 },
    burns: d.burns,
    effective_o2: r2(d.xo2, 3),
    limiting_o2: r2(d.loi, 3),
    burn_rate_mm2_s: r2(d.K, 3),
    lifetime_s: r2(d.life, 1),
    cool_flame: d.coolFlame,
    model_check: { against: FITS.droplet.source, caveat: FITS.droplet.caveat },
  }
}

export type WhatIf = { o2?: number; psia?: number; g?: number; replace?: { from: string; to: string }[] }

/** The example cabin with an agent's what-if applied: another atmosphere, gravity, or swapped materials. */
function cabinWith(p: WhatIf) {
  const { spec, rows, model } = loadCabin()
  const swapped = rows.map((r) => {
    const s = p.replace?.find((x) => x.from.toLowerCase() === r.key)
    return s ? { ...r, key: material(s.to).id as MaterialRow['key'], material: material(s.to).label } : r
  })
  const unknown = p.replace?.filter((x) => !rows.some((r) => r.key === x.from.toLowerCase())) ?? []
  if (unknown.length) throw new ToolError(`The cabin has no "${unknown[0].from}". It has: ${[...new Set(rows.map((r) => r.key).filter(Boolean))].join(', ')}.`)
  const s2: CabinSpec = { ...spec, o2: p.o2 ?? spec.o2, psi: p.psia ?? spec.psi, g: p.g ?? spec.g }
  return { spec: s2, rows: swapped, model, pkg: toPackage(s2, swapped) }
}

export function fireSpread(p: WhatIf) {
  const { spec, model, pkg } = cabinWith(p)
  const variant: Variant = { id: 'as-built', label: 'tool run', short: 'run', o2: spec.o2, psi: spec.psi, g: spec.g, flow: spec.ventFlow }
  const run = simulateFire(model, pkg, variant)
  const peak = run.pressure.reduce((a, b) => (b.psia > a.psia ? b : a))
  return {
    cabin: spec.vehicle,
    conditions: { o2: spec.o2, psia: spec.psi, gravity: gLabel(spec.g), replaced: p.replace ?? [] },
    zones: run.zones.map((z) => ({ zone: z.zone, lead_material: z.lead?.material ?? null, burns: z.burns, spread_mm_s: r2(z.rate), catches_at_s: run.ignite[z.zone] === null ? null : r2(run.ignite[z.zone]!, 1) })),
    hull_rupture_at_s: run.rupture ?? null,
    hull_burst_psia: run.burstPsia,
    peak_pressure: { psia: r2(peak.psia, 1), at_s: peak.t },
    all_burnable_zones_alight_at_s: run.fullAt === undefined ? null : r2(run.fullAt, 1),
    hatch_open_s: spec.hatch.openTime,
    crew_can_get_out_first: run.rupture === undefined ? true : spec.hatch.openTime < run.rupture,
    caution: 'A zone model (front speed between zones, lumped pressure) tuned to the Apollo 1 record. Use run_fds for a CFD check.',
  }
}

export function smokeAlarm(p: { g: number; seconds?: number }) {
  const { model, pkg } = cabinWith({})
  const t0 = Date.now()
  const s = smokeStudy({ model, pkg, seconds: p.seconds ?? 60, gCases: [{ label: gLabel(p.g), g: p.g }] })
  const table = (cs: typeof s.cases) => cs.map((c) => ({ smoke_source: c.source, first_alarm_s: c.firstAlarm, per_detector_s: c.alarms }))
  return {
    gravity: gLabel(p.g),
    simulated_s: s.seconds,
    smoke_particle_um: s.smokeD,
    designed_layout: { detectors: s.designed.map((d) => ({ id: d.id, type: d.type })), cases: table(s.cases), worst_first_alarm_s: s.worstDesigned, missed: s.cases.filter((c) => c.firstAlarm === null).map((c) => c.source) },
    proposed_layout: { detectors: s.proposed.map((d) => ({ id: d.id, type: d.type, x_m: r2(d.x), y_m: r2(d.y) })), cases: table(s.proposedCases), worst_first_alarm_s: s.worstProposed },
    cfd_runs: s.runs,
    wall_clock_s: r2((Date.now() - t0) / 1000, 1),
    caution: 'null means no alarm within the simulated time. 2-D smoke CFD on the cabin cross-section.',
  }
}

let report: Report | undefined

/** Passages of the BASS-II Summary Report that best match a question. */
export function searchReport(p: { query: string; n?: number }) {
  if (!report) {
    const f = join(WEB, 'public/data/psi-25/report.json')
    if (!existsSync(f)) throw new ToolError('The BASS-II report is not prepared on this machine. Run scripts/prep-psi.sh (needs data/PSI-25).')
    report = JSON.parse(readFileSync(f, 'utf8')) as Report
  }
  const passages = searchPages(report.pages, p.query, p.n ?? 3)
  if (!passages.length) throw new ToolError(`Nothing in the report matches "${p.query}". Try other words.`)
  return { source: report.title, passages, pages_in_report: report.pages.length }
}
