// Intake: the three files a vehicle team hands over, parsed into the DesignPackage the review runs on.
//   cabin.yaml        → CabinSpec      (atmosphere, gravity, volume, vents, crew, ignition sources, hatch, hull)
//   materials.csv     → MaterialRow[]  (part, material, rating, zone, quantity, distance to ignition)
//   cabin.model.json  → CabinModel     (named primitives, each in a zone; the stage is built from it)
// Parsers throw IntakeError with a line-level message; crossCheck() reports what does not line up between files.
import { parse as parseYaml } from 'yaml'
import type { BomItem, DesignPackage } from '@/demo/packages'
import { MATERIALS } from '@/sims/models'

export type MaterialKey = keyof typeof MATERIALS

export type SensorDef = { id: string; type: 'photoelectric' | 'ionization'; zone: string; pos: [number, number, number] }

export type CabinSpec = {
  vehicle: string
  program: string
  phase: string
  o2: number // fraction 0..1
  psi: number
  g: number
  volume: number // m³
  ventFlow: number // cm/s
  crew: number
  ignition: { id: string; zone: string; note: string }[]
  hatch: { type: string; openTime: number }
  hull: { burstPsia: number }
  /** Smoke detectors in the design: type and mount point (cabin coordinates, m). */
  sensors: SensorDef[]
}

export type MaterialRow = {
  line: number
  part: string
  material: string
  key?: MaterialKey
  rating: string
  zone: string
  quantity: string
  distance?: number
}

export type Vec3 = [number, number, number]

export type Primitive = {
  id: string
  zone: string
  kind: 'box' | 'cylinder' | 'cone'
  pos: Vec3
  rot?: Vec3
  size?: Vec3
  radius?: number
  radiusTop?: number
  radiusBottom?: number
  height?: number
  /** The pressure hull: drawn as a see-through outline, never burns. */
  shell?: boolean
}

export type CabinModel = { name: string; primitives: Primitive[] }

export type Slot = 'cabin' | 'materials' | 'model'

export type Issue = { slot: Slot; level: 'error' | 'warn'; text: string }

export class IntakeError extends Error {}

// ── cabin.yaml ─────────────────────────────────────────────────────────────

const num = (v: unknown, field: string, { min = -Infinity, max = Infinity } = {}) => {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new IntakeError(`${field}: expected a number, got ${JSON.stringify(v)}`)
  if (n < min || n > max) throw new IntakeError(`${field}: ${n} is outside ${min}–${max}`)
  return n
}

const str = (v: unknown, fallback = '') => (v === undefined || v === null ? fallback : String(v))

export function parseCabin(text: string): CabinSpec {
  let doc: Record<string, unknown>
  try {
    doc = (parseYaml(text) ?? {}) as Record<string, unknown>
  } catch (e) {
    throw new IntakeError(`cabin.yaml is not valid YAML: ${(e as Error).message.split('\n')[0]}`)
  }
  if (typeof doc !== 'object' || Array.isArray(doc)) throw new IntakeError('cabin.yaml: expected a mapping at the top level')
  const atm = (doc.atmosphere ?? {}) as Record<string, unknown>
  const hatch = (doc.hatch ?? {}) as Record<string, unknown>
  const hull = (doc.hull ?? {}) as Record<string, unknown>
  const ign = Array.isArray(doc.ignition_sources) ? (doc.ignition_sources as Record<string, unknown>[]) : []
  const sen = Array.isArray(doc.sensors) ? (doc.sensors as Record<string, unknown>[]) : []
  return {
    vehicle: str(doc.vehicle, 'Unnamed vehicle'),
    program: str(doc.program),
    phase: str(doc.phase),
    o2: num(atm.o2_pct, 'atmosphere.o2_pct', { min: 0, max: 100 }) / 100,
    psi: num(atm.pressure_psia, 'atmosphere.pressure_psia', { min: 0.5, max: 60 }),
    g: num(doc.gravity_g, 'gravity_g', { min: 0, max: 3 }),
    volume: num(doc.volume_m3, 'volume_m3', { min: 0.1 }),
    ventFlow: num(doc.vent_flow_cms ?? 0, 'vent_flow_cms', { min: 0 }),
    crew: num(doc.crew ?? 0, 'crew', { min: 0 }),
    ignition: ign.map((x, i) => ({ id: str(x.id, `ign-${i + 1}`), zone: str(x.zone), note: str(x.note) })),
    hatch: { type: str(hatch.type, 'unspecified'), openTime: num(hatch.open_time_s ?? 0, 'hatch.open_time_s', { min: 0 }) },
    hull: { burstPsia: num(hull.burst_psia ?? 0, 'hull.burst_psia', { min: 0 }) },
    sensors: sen.map((x, i) => {
      const type = str(x.type, 'photoelectric')
      if (type !== 'photoelectric' && type !== 'ionization') throw new IntakeError(`cabin.yaml: sensors[${i}].type must be photoelectric or ionization, got "${type}"`)
      const pos = Array.isArray(x.pos) && x.pos.length === 3 && x.pos.every((v) => typeof v === 'number') ? (x.pos as [number, number, number]) : undefined
      if (!pos) throw new IntakeError(`cabin.yaml: sensors[${i}].pos must be [x, y, z] in metres`)
      return { id: str(x.id, `D${i + 1}`), type, zone: str(x.zone), pos }
    }),
  }
}

// ── materials.csv ──────────────────────────────────────────────────────────

/** RFC 4180-ish: commas, double-quoted fields, "" escapes. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.map((c) => c.trim()))
}

const ALIASES: Record<string, MaterialKey> = {
  nylon: 'nylon',
  velcro: 'nylon',
  cotton: 'cotton',
  paper: 'cotton',
  cellulose: 'cotton',
  sibal: 'cotton',
  pmma: 'pmma',
  acrylic: 'pmma',
  polyurethane: 'pmma',
  foam: 'pmma',
  nomex: 'nomex',
  kapton: 'kapton',
  polyimide: 'kapton',
  teflon: 'teflon',
  ptfe: 'teflon',
  silicone: 'silicone',
}

/** Map a free-text material name onto one of the modelled materials. */
export function materialKey(raw: string): MaterialKey | undefined {
  const s = raw.toLowerCase()
  if (s in MATERIALS) return s as MaterialKey
  for (const [k, v] of Object.entries(ALIASES)) if (s.includes(k)) return v
  return undefined
}

const COLS = ['part', 'material', 'zone'] as const

export function parseMaterials(text: string): MaterialRow[] {
  const rows = csvRows(text)
  if (rows.length < 2) throw new IntakeError('materials.csv: needs a header row and at least one material')
  const head = rows[0].map((h) => h.toLowerCase())
  for (const c of COLS) if (!head.includes(c)) throw new IntakeError(`materials.csv: missing column "${c}" (have: ${head.join(', ')})`)
  const at = (r: string[], c: string) => {
    const i = head.indexOf(c)
    return i >= 0 ? (r[i] ?? '') : ''
  }
  return rows.slice(1).map((r, i) => {
    const d = at(r, 'distance_to_ignition_m')
    const material = at(r, 'material')
    return {
      line: i + 2,
      part: at(r, 'part'),
      material,
      key: materialKey(material),
      rating: at(r, 'rating') || '—',
      zone: at(r, 'zone'),
      quantity: at(r, 'quantity') || '—',
      distance: d === '' || Number.isNaN(Number(d)) ? undefined : Number(d),
    }
  })
}

// ── cabin.model.json ───────────────────────────────────────────────────────

const isVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x))

export function parseModel(text: string): CabinModel {
  let doc: { name?: unknown; primitives?: unknown }
  try {
    doc = JSON.parse(text)
  } catch (e) {
    throw new IntakeError(`cabin.model.json is not valid JSON: ${(e as Error).message}`)
  }
  if (!Array.isArray(doc.primitives) || doc.primitives.length === 0) throw new IntakeError('cabin.model.json: expected a non-empty "primitives" array')
  const primitives = (doc.primitives as Record<string, unknown>[]).map((p, i) => {
    const where = `primitives[${i}]${p.id ? ` (${String(p.id)})` : ''}`
    const kind = p.kind
    if (kind !== 'box' && kind !== 'cylinder' && kind !== 'cone') throw new IntakeError(`${where}: kind must be box, cylinder or cone`)
    if (!isVec(p.pos)) throw new IntakeError(`${where}: pos must be [x, y, z]`)
    if (kind === 'box' && !isVec(p.size)) throw new IntakeError(`${where}: a box needs size [w, h, d]`)
    if (p.rot !== undefined && !isVec(p.rot)) throw new IntakeError(`${where}: rot must be [x, y, z] radians`)
    if (!p.zone) throw new IntakeError(`${where}: needs a zone`)
    return {
      id: str(p.id, `p${i + 1}`),
      zone: String(p.zone),
      kind,
      pos: p.pos,
      rot: p.rot as Vec3 | undefined,
      size: p.size as Vec3 | undefined,
      radius: p.radius as number | undefined,
      radiusTop: p.radiusTop as number | undefined,
      radiusBottom: p.radiusBottom as number | undefined,
      height: p.height as number | undefined,
      shell: !!p.shell,
    } satisfies Primitive
  })
  return { name: str(doc.name, 'Cabin model'), primitives }
}

export const zonesOf = (m: CabinModel) => [...new Set(m.primitives.filter((p) => !p.shell).map((p) => p.zone))]

// ── cross-file checks and the package ──────────────────────────────────────

export function crossCheck(spec?: CabinSpec, rows?: MaterialRow[], model?: CabinModel): Issue[] {
  const out: Issue[] = []
  const zones = model ? new Set(zonesOf(model)) : undefined
  for (const r of rows ?? []) {
    if (!r.key) out.push({ slot: 'materials', level: 'error', text: `line ${r.line}: "${r.material}" is not a modelled material` })
    if (!r.zone) out.push({ slot: 'materials', level: 'error', text: `line ${r.line}: ${r.part} has no zone` })
    else if (zones && !zones.has(r.zone)) out.push({ slot: 'materials', level: 'error', text: `line ${r.line}: zone "${r.zone}" is not in the cabin model` })
  }
  if (spec && zones) for (const ig of spec.ignition) if (!zones.has(ig.zone)) out.push({ slot: 'cabin', level: 'warn', text: `ignition source ${ig.id}: zone "${ig.zone}" is not in the cabin model` })
  if (spec && !spec.ignition.length) out.push({ slot: 'cabin', level: 'warn', text: 'no ignition sources listed: spread starts at the first zone' })
  if (spec && zones) for (const d of spec.sensors) if (d.zone && !zones.has(d.zone)) out.push({ slot: 'cabin', level: 'warn', text: `sensor ${d.id}: zone "${d.zone}" is not in the cabin model` })
  if (spec && !spec.sensors.length) out.push({ slot: 'cabin', level: 'warn', text: 'no smoke sensors listed: detection is checked against a proposed layout only' })
  if (spec && !spec.hull.burstPsia) out.push({ slot: 'cabin', level: 'warn', text: 'no hull.burst_psia: the pressure layer cannot show rupture' })
  return out
}

export const mappedCount = (rows: MaterialRow[], model?: CabinModel) => {
  const zones = model ? new Set(zonesOf(model)) : undefined
  return rows.filter((r) => r.key && r.zone && (!zones || zones.has(r.zone))).length
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 3 : 1).replace(/0+$/, '').replace(/\.$/, ''))

export const cabinSummary = (s: CabinSpec) => `${fmt(s.o2 * 100)} % O₂ · ${fmt(s.psi)} psia · ${fmt(s.g)} g`
export const materialsSummary = (rows: MaterialRow[], model?: CabinModel) => `${rows.length} materials · ${mappedCount(rows, model)} mapped to zones`
export const modelSummary = (m: CabinModel) => `${m.primitives.length} primitives · ${zonesOf(m).length} zones`

/** Build the DesignPackage the matrix and the agents work from. */
export function toPackage(spec: CabinSpec, rows: MaterialRow[]): DesignPackage {
  const bom: BomItem[] = rows
    .filter((r) => r.key)
    .map((r, i) => ({ id: `M${i + 1}`, item: r.part, material: r.key!, location: r.zone, qty: r.quantity, zone: r.zone, distance: r.distance, rating: r.rating }))
  const gLabel = spec.g === 0 ? 'µg' : spec.g === 1 ? 'Earth · 1 g' : `${fmt(spec.g)} g`
  return {
    vehicle: spec.vehicle,
    program: spec.program,
    phase: spec.phase,
    atmosphere: { o2: spec.o2, psi: spec.psi, label: `${fmt(spec.o2 * 100)} % O₂ · ${fmt(spec.psi)} psia` },
    gravity: { g: spec.g, label: gLabel },
    volume: `${fmt(spec.volume)} m³`,
    volumeM3: spec.volume,
    ventFlow: spec.ventFlow,
    crew: spec.crew,
    bom,
    ignition: spec.ignition.map((x) => x.note || x.id),
    ignitionZones: spec.ignition.map((x) => x.zone),
    existingTests: rows.filter((r) => r.rating.toUpperCase() === 'X').map((r) => `${r.part}: not tested in the use atmosphere`),
    layout: 'cabin.model.json',
    hatch: spec.hatch,
    hull: spec.hull,
    sensors: spec.sensors,
  }
}
