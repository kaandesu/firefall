// Fire in the cabin, as a pure function of time. Illustrative, labelled as such in the UI.
//
// Spread: the front leaves the ignition zone at T+0 and enters each neighbouring zone after
// distance / front speed. The front speed in a zone comes from the thin-fuel spread model
// (sims/models.ts spreadRate) for the most flammable material listed in that zone, scaled up
// to an enclosure fire (radiation and hot-gas preheating carry a cabin fire much faster than
// a flame along a single sample). Zones with nothing that burns at these conditions stop it.
//
// Pressure: a sealed, rigid cabin heated by the fire, P = P0 + (γ − 1)·E / V, with E the heat
// released so far less a fixed wall-loss fraction. Checked against the Apollo 204 Review Board
// timeline: the hull ruptured about 15 s after the first fire call, at about 29 psia.
import type { BomItem, DesignPackage } from '@/demo/packages'
import type { CabinModel, Vec3 } from '@/intake/parse'
import { zonesOf } from '@/intake/parse'
import { MATERIALS, spreadRate } from '@/sims/models'

export type Variant = { id: 'as-built' | '60-40' | 'ug' | 'base'; label: string; short: string; o2: number; psi: number; g: number; flow: number }

/** The as-built case and the three what-ifs: the post-fire pad atmosphere, the same cabin in orbit, and Artemis base camp. */
export function variantsFor(pkg: DesignPackage): Variant[] {
  const { o2, psi } = pkg.atmosphere
  const g = pkg.gravity.g
  const flow = pkg.ventFlow
  return [
    { id: 'as-built', label: `As built · ${Math.round(o2 * 100)} % O₂ · ${psi} psia · ${g} g`, short: `${Math.round(o2 * 100)} % O₂`, o2, psi, g, flow },
    { id: '60-40', label: '60/40 O₂/N₂ on the pad (the post-fire fix)', short: '60/40', o2: 0.6, psi, g, flow },
    { id: 'ug', label: 'Same cabin in orbit · 100 % O₂ · 5 psia · µg', short: 'µg', o2, psi: 5, g: 0, flow },
    { id: 'base', label: 'Artemis base camp · 34 % O₂ · 8.2 psia · Moon g', short: 'Moon g', o2: 0.34, psi: 8.2, g: 0.165, flow },
  ]
}

export type Zone = {
  zone: string
  parts: BomItem[]
  /** The material that sets the front speed here. */
  lead?: BomItem
  rate: number // mm/s, thin-fuel spread
  speed: number // m/s, enclosure front speed
  burns: boolean
  center: Vec3
}

export type FireRun = {
  variant: Variant
  zones: Zone[]
  /** Seconds after ignition each zone catches, or null if it never does. */
  ignite: Record<string, number | null>
  pressure: { t: number; psia: number }[]
  rupture?: number
  /** Every zone that can burn is burning. */
  fullAt?: number
  burstPsia: number
  duration: number
  dt: number
}

export const FIRE_SCALE = 4 // enclosure front speed vs single-sample spread
const PEAK_KW = 30 // per part at the reference spread rate
const REF_RATE = 40 // mm/s
const RAMP_S = 2.5
const BURN_S = 9
const WALL_LOSS = 0.45
const GAMMA = 1.4
const PA_PER_PSI = 6894.76
const AMBIENT_PSIA = 14.7
const HORIZON_S = 30

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function zoneCenters(model: CabinModel): Record<string, Vec3[]> {
  const out: Record<string, Vec3[]> = {}
  for (const p of model.primitives) if (!p.shell) (out[p.zone] ??= []).push(p.pos)
  return out
}

/** Closest approach between two zones, measured centre to centre of their parts, less a part's reach. */
function gap(a: Vec3[], b: Vec3[]) {
  let m = Infinity
  for (const x of a) for (const y of b) m = Math.min(m, dist(x, y))
  return Math.max(0.05, m - 0.2)
}

export function zonesFor(model: CabinModel, bom: BomItem[], v: Pick<Variant, 'o2' | 'psi' | 'g' | 'flow'>): Zone[] {
  const centers = zoneCenters(model)
  return zonesOf(model).map((zone) => {
    const parts = bom.filter((b) => b.zone === zone)
    let lead: BomItem | undefined
    let rate = 0
    for (const b of parts) {
      const r = spreadRate(v.o2, v.flow, v.g, v.psi, MATERIALS[b.material])
      if (r > rate || !lead) {
        rate = Math.max(rate, r)
        lead = b
      }
    }
    const pts = centers[zone]
    const center = pts.reduce<Vec3>((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0])
    return { zone, parts, lead, rate, speed: (rate / 1000) * FIRE_SCALE, burns: rate > 0, center }
  })
}

export function simulateFire(model: CabinModel, pkg: DesignPackage, variant: Variant): FireRun {
  const zones = zonesFor(model, pkg.bom, variant)
  const centers = zoneCenters(model)
  const starts = (pkg.ignitionZones?.length ? pkg.ignitionZones : [zones[0]?.zone]).filter((z) => z && centers[z])

  // Dijkstra over zones: entering zone j costs gap / speed of j. The ignition zones start at T+0 (the arc).
  const ignite: Record<string, number | null> = Object.fromEntries(zones.map((z) => [z.zone, null]))
  const open = new Map<string, number>(starts.map((z) => [z, 0]))
  const done = new Set<string>()
  while (open.size) {
    const [cur, t] = [...open.entries()].sort((a, b) => a[1] - b[1])[0]
    open.delete(cur)
    if (done.has(cur)) continue
    done.add(cur)
    ignite[cur] = t
    for (const z of zones) {
      if (done.has(z.zone) || !z.burns) continue
      const nt = t + gap(centers[cur], centers[z.zone]) / z.speed
      if (nt <= HORIZON_S && nt < (open.get(z.zone) ?? Infinity)) open.set(z.zone, nt)
    }
  }
  // An ignition zone with nothing that burns in it lights its neighbours but does not feed the fire itself.

  const volume = pkg.volumeM3 ?? 6
  const burst = pkg.hull?.burstPsia ?? 0
  const P0 = variant.psi
  const dt = 0.1
  const pressure: FireRun['pressure'] = []
  let E = 0
  let rupture: number | undefined
  let P = P0
  for (let t = 0; t <= HORIZON_S + 1e-9; t += dt) {
    const t1 = Math.round(t * 10) / 10
    if (rupture === undefined) {
      E += hrr(zones, ignite, t1) * 1000 * dt * (1 - WALL_LOSS)
      P = P0 + ((GAMMA - 1) * E) / volume / PA_PER_PSI
      if (burst && P >= burst) rupture = t1
    } else {
      // After rupture the cabin vents to the outside within a second or so.
      const a = Math.min(1, (t1 - rupture) / 1.2)
      P = burst + (Math.min(AMBIENT_PSIA, P0) - burst) * a
    }
    pressure.push({ t: t1, psia: P })
  }
  const burnable = zones.filter((z) => ignite[z.zone] !== null && z.burns)
  const reach = zones.filter((z) => z.burns)
  const fullAt = burnable.length === reach.length && reach.length ? Math.max(...burnable.map((z) => ignite[z.zone]!)) : undefined
  const end = rupture !== undefined ? rupture + 3 : HORIZON_S
  return { variant, zones, ignite, pressure, rupture, fullAt, burstPsia: burst, duration: Math.min(HORIZON_S, Math.ceil(end)), dt }
}

/** Heat release in kW at time t: each part ramps up when its zone catches, then burns out. */
export function hrr(zones: Zone[], ignite: Record<string, number | null>, t: number) {
  let q = 0
  for (const z of zones) {
    const t0 = ignite[z.zone]
    if (t0 === null || t0 === undefined || t < t0 || !z.burns) continue
    const age = t - t0
    const shape = age < RAMP_S ? age / RAMP_S : age < RAMP_S + BURN_S ? 1 : Math.max(0, 1 - (age - RAMP_S - BURN_S) / 3)
    q += PEAK_KW * z.parts.length * Math.min(2.5, (z.rate / REF_RATE) ** 1.5) * shape
  }
  return q
}

/** 0 before the zone catches, rising to 1 while it burns, then 2 once it has burned out. */
export function zonePhase(run: FireRun, zone: string, t: number): number {
  const t0 = run.ignite[zone]
  if (t0 === null || t0 === undefined || t < t0) return 0
  const age = t - t0
  if (age < RAMP_S) return age / RAMP_S
  if (age < RAMP_S + BURN_S) return 1
  return 1 + Math.min(1, (age - RAMP_S - BURN_S) / 3)
}

export const pressureAt = (run: FireRun, t: number) => run.pressure[Math.max(0, Math.min(run.pressure.length - 1, Math.round(t / run.dt)))]?.psia ?? run.variant.psi

export const burningAt = (run: FireRun, t: number) => run.zones.filter((z) => z.burns && zonePhase(run, z.zone, t) > 0).length
