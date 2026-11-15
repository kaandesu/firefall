// A small 2D smoke CFD on a vertical cross-section of the cabin: Stam's stable fluids (semi-Lagrangian advection
// + pressure projection) with buoyancy ∝ g, a vent jet, thermal expansion at the source and eddy diffusion.
// It is a triage model, not FDS: good enough to show *where smoke goes first* in µg vs Moon vs 1 g and to
// compare detector positions. Deterministic and pure (no Math.random), so the same inputs give the same frames.
import type { CabinModel, Primitive } from '@/intake/parse'
import { detectorEfficiency } from '@/sims/models'

export type Vec2 = [number, number]
export type SensorSpec = { id: string; type: 'photoelectric' | 'ionization'; x: number; y: number; proposed?: boolean }

export type FluidConfig = {
  /** Domain in metres: x from -w/2..w/2, y from 0..h. */
  w: number
  h: number
  /** Cell size in metres. */
  cell: number
  g: number
  /** Vent jet speed (m/s), from inlet towards +x. */
  vent: number
  inlet: Vec2
  outlet: Vec2
  source: Vec2
  /** Mean smoke particle diameter (µm) of what is burning: drives detector response (SAME). */
  smokeD: number
  sensors: SensorSpec[]
  /** Inside the cabin air? */
  open: (x: number, y: number) => boolean
}

export type FluidRun = {
  nx: number
  ny: number
  cfg: FluidConfig
  dt: number
  /** Density snapshots (nx*ny, row-major from y=0) every `every` seconds. */
  frames: Float32Array[]
  every: number
  /** First time smoke above threshold reaches each cell (s), Infinity if never. */
  arrival: Float32Array
  alarms: Record<string, number | null>
  /** Total smoke in the domain per snapshot (for checks). */
  mass: number[]
}

export const SMOKE_THRESHOLD = 0.012

export class Fluid {
  readonly nx: number
  readonly ny: number
  readonly h: number
  u: Float32Array
  v: Float32Array
  d: Float32Array
  T: Float32Array
  open: Uint8Array
  private tmp: Float32Array
  private u0: Float32Array
  private v0: Float32Array
  private tmp2: Float32Array
  private p: Float32Array
  private div: Float32Array
  t = 0
  readonly cfg: FluidConfig

  // No parameter property: Node runs this file as is for the tools server and only strips plain types.
  constructor(cfg: FluidConfig) {
    this.cfg = cfg
    this.h = cfg.cell
    this.nx = Math.round(cfg.w / cfg.cell)
    this.ny = Math.round(cfg.h / cfg.cell)
    const n = this.nx * this.ny
    this.u = new Float32Array(n)
    this.v = new Float32Array(n)
    this.d = new Float32Array(n)
    this.T = new Float32Array(n)
    this.tmp = new Float32Array(n)
    this.u0 = new Float32Array(n)
    this.v0 = new Float32Array(n)
    this.tmp2 = new Float32Array(n)
    this.p = new Float32Array(n)
    this.div = new Float32Array(n)
    this.open = new Uint8Array(n)
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) this.open[j * this.nx + i] = cfg.open(...this.pos(i, j)) ? 1 : 0
  }

  pos(i: number, j: number): Vec2 {
    return [(i + 0.5) * this.h - this.cfg.w / 2, (j + 0.5) * this.h]
  }
  cellOf(x: number, y: number): [number, number] {
    return [Math.max(0, Math.min(this.nx - 1, Math.floor((x + this.cfg.w / 2) / this.h))), Math.max(0, Math.min(this.ny - 1, Math.floor(y / this.h)))]
  }
  at(f: Float32Array, x: number, y: number) {
    const [i, j] = this.cellOf(x, y)
    return f[j * this.nx + i]
  }

  /** Bilinear sample in cell coordinates over open cells only (weights renormalised), so walls don't eat smoke. */
  private sample(f: Float32Array, x: number, y: number, fallback: number) {
    const { nx, ny, open } = this
    x = Math.max(0, Math.min(nx - 1.001, x))
    y = Math.max(0, Math.min(ny - 1.001, y))
    const i = Math.floor(x)
    const j = Math.floor(y)
    const a = x - i
    const b = y - j
    const k = j * nx + i
    const w0 = (1 - a) * (1 - b) * open[k]
    const w1 = a * (1 - b) * open[k + 1]
    const w2 = (1 - a) * b * open[k + nx]
    const w3 = a * b * open[k + nx + 1]
    const w = w0 + w1 + w2 + w3
    if (w < 1e-6) return fallback
    return (w0 * f[k] + w1 * f[k + 1] + w2 * f[k + nx] + w3 * f[k + nx + 1]) / w
  }

  private advect(dst: Float32Array, src: Float32Array, dt: number) {
    const { nx, ny, u, v, open, h } = this
    const s = dt / h
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        dst[k] = open[k] ? this.sample(src, i - u[k] * s, j - v[k] * s, src[k]) : 0
      }
  }

  private project(iters = 14) {
    const { nx, ny, u, v, p, div, open, h } = this
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i
        div[k] = open[k] ? (-0.5 * h * (u[k + 1] - u[k - 1] + v[k + nx] - v[k - nx])) : 0
        p[k] = 0
      }
    for (let it = 0; it < iters; it++)
      for (let j = 1; j < ny - 1; j++)
        for (let i = 1; i < nx - 1; i++) {
          const k = j * nx + i
          if (!open[k]) continue
          const a = open[k - 1]
          const b = open[k + 1]
          const c = open[k - nx]
          const d = open[k + nx]
          const n = a + b + c + d
          p[k] = n ? (div[k] + a * p[k - 1] + b * p[k + 1] + c * p[k - nx] + d * p[k + nx]) / n : 0
        }
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i
        if (!open[k]) {
          u[k] = 0
          v[k] = 0
          continue
        }
        const pl = open[k - 1] ? p[k - 1] : p[k]
        const pr = open[k + 1] ? p[k + 1] : p[k]
        const pd = open[k - nx] ? p[k - nx] : p[k]
        const pu = open[k + nx] ? p[k + nx] : p[k]
        u[k] -= (0.5 * (pr - pl)) / h
        v[k] -= (0.5 * (pu - pd)) / h
      }
  }

  private diffuse(f: Float32Array, a: number) {
    const { nx, ny, open, tmp2 } = this
    tmp2.set(f)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i
        if (!open[k]) continue
        const o1 = open[k - 1]
        const o2 = open[k + 1]
        const o3 = open[k - nx]
        const o4 = open[k + nx]
        const sum = o1 * tmp2[k - 1] + o2 * tmp2[k + 1] + o3 * tmp2[k - nx] + o4 * tmp2[k + nx]
        f[k] = tmp2[k] + a * (sum - (o1 + o2 + o3 + o4) * tmp2[k])
      }
  }

  /** Paint a blob into a field around (x, y). */
  private splat(f: Float32Array, x: number, y: number, r: number, amount: number) {
    const [ci, cj] = this.cellOf(x, y)
    const R = Math.max(1, Math.round(r / this.h))
    for (let j = cj - R; j <= cj + R; j++)
      for (let i = ci - R; i <= ci + R; i++) {
        if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue
        const k = j * this.nx + i
        if (!this.open[k]) continue
        const w = Math.max(0, 1 - Math.hypot(i - ci, j - cj) / (R + 0.5))
        f[k] += amount * w
      }
  }

  step(dt: number, burning = true) {
    const { cfg, nx, u, v, T, d, tmp } = this
    // sources: smoke + heat at the ignition point, thermal expansion pushes outward (the only µg transport besides the vent)
    if (burning) {
      this.splat(d, cfg.source[0], cfg.source[1], 0.08, 2.5 * dt)
      this.splat(T, cfg.source[0], cfg.source[1], 0.08, 2.2 * dt)
      const [si, sj] = this.cellOf(cfg.source[0], cfg.source[1])
      for (let j = sj - 3; j <= sj + 3; j++)
        for (let i = si - 3; i <= si + 3; i++) {
          if (i < 0 || j < 0 || i >= nx || j >= this.ny || (i === si && j === sj)) continue
          const k = j * nx + i
          if (!this.open[k]) continue
          const r = Math.hypot(i - si, j - sj)
          u[k] += (dt * 0.6 * (i - si)) / (r * r)
          v[k] += (dt * 0.6 * (j - sj)) / (r * r)
        }
    }
    // vent jet in, sink out (cabin fan loop)
    if (cfg.vent > 0) {
      const [ii, ij] = this.cellOf(...cfg.inlet)
      const [oi, oj] = this.cellOf(...cfg.outlet)
      for (let dj = -2; dj <= 2; dj++) {
        const a = (ij + dj) * nx + ii
        const b = (oj + dj) * nx + oi
        if (this.open[a]) u[a] = cfg.vent
        if (this.open[b]) u[b] = cfg.vent
      }
    }
    // buoyancy (hot smoke rises only with gravity) and a little drag
    const buoy = 9.81 * cfg.g * 0.35
    for (let k = 0; k < u.length; k++) {
      if (!this.open[k]) continue
      v[k] += dt * buoy * T[k]
      u[k] *= 1 - 0.35 * dt
      v[k] *= 1 - 0.35 * dt
    }
    this.project()
    this.u0.set(u)
    this.v0.set(v)
    this.advect(u, this.u0, dt)
    this.advect(v, this.v0, dt)
    this.project()
    tmp.set(d)
    this.advect(d, tmp, dt)
    tmp.set(T)
    this.advect(T, tmp, dt)
    for (let k = 0; k < T.length; k++) T[k] *= 1 - 0.6 * dt
    // eddy diffusion: stronger where the air moves (turbulent mixing), a floor for µg molecular + fan mixing
    this.diffuse(d, Math.min(0.2, (0.0025 * dt) / (this.h * this.h)))
    this.t += dt
  }

  mass() {
    let m = 0
    for (let k = 0; k < this.d.length; k++) m += this.d[k]
    return m * this.h * this.h
  }

  reading(s: SensorSpec) {
    return this.at(this.d, s.x, s.y) * detectorEfficiency(s.type, this.cfg.smokeD)
  }
}

/** Run a scenario for `seconds`, keeping density snapshots and the time smoke first reaches every cell. */
export function simulate(cfg: FluidConfig, seconds = 60, dt = 0.1, every = 0.5): FluidRun {
  const f = new Fluid(cfg)
  const n = f.nx * f.ny
  const arrival = new Float32Array(n).fill(Infinity)
  const alarms: Record<string, number | null> = Object.fromEntries(cfg.sensors.map((s) => [s.id, null]))
  const frames: Float32Array[] = []
  const mass: number[] = []
  const steps = Math.round(seconds / dt)
  const snapEvery = Math.max(1, Math.round(every / dt))
  for (let s = 0; s <= steps; s++) {
    if (s % snapEvery === 0) {
      frames.push(Float32Array.from(f.d))
      mass.push(f.mass())
    }
    if (s === steps) break
    f.step(dt)
    for (let k = 0; k < n; k++) if (arrival[k] === Infinity && f.d[k] > SMOKE_THRESHOLD) arrival[k] = f.t
    for (const sen of cfg.sensors) if (alarms[sen.id] === null && f.reading(sen) > SMOKE_THRESHOLD) alarms[sen.id] = +f.t.toFixed(1)
  }
  return { nx: f.nx, ny: f.ny, cfg, dt, frames, every, arrival, alarms, mass }
}

// ── the cabin cross-section from cabin.model.json ──────────────────────────────────────────────

const shellOf = (m: CabinModel) => m.primitives.find((p) => p.shell && p.kind === 'cone')
/** Boxes that cut the z = 0 slice and are big enough to block air. */
const solidBoxes = (m: CabinModel) => m.primitives.filter((p) => !p.shell && p.kind === 'box' && (p.size?.[1] ?? 0) > 0.1 && Math.abs(p.pos[2]) < (p.size?.[2] ?? 0) / 2)

/** Vertical slice at z≈0 through the cabin model: the cone shell bounds the air; couches, LEB and ECU block it. */
export function cabinSection(m: CabinModel): { w: number; h: number; open: (x: number, y: number) => boolean } {
  const shell = shellOf(m)
  const rb = shell?.radiusBottom ?? 2
  const rt = shell?.radiusTop ?? 0.5
  const H = shell?.height ?? 3
  const base = (shell?.pos[1] ?? H / 2) - H / 2
  const boxes: Primitive[] = solidBoxes(m)
  const open = (x: number, y: number) => {
    const yy = y - base
    if (yy < 0.04 || yy > H - 0.04) return false
    const r = rb + (rt - rb) * (yy / H)
    if (Math.abs(x) > r - 0.04) return false
    for (const b of boxes) {
      const [sx, sy] = b.size ?? [0, 0, 0]
      if (Math.abs(x - b.pos[0]) < sx / 2 && Math.abs(y - b.pos[1]) < sy / 2) return false
    }
    return true
  }
  return { w: rb * 2 + 0.1, h: base + H, open }
}

/** Where a sensor can go: open cells right next to the shell or a solid (mountable). */
export function mountable(f: Fluid) {
  const out: number[] = []
  const { nx, ny, open } = f
  for (let j = 1; j < ny - 1; j++)
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i
      if (open[k] && (!open[k - 1] || !open[k + 1] || !open[k + nx] || !open[k - nx])) out.push(k)
    }
  return out
}

/** The worst case over scenarios of the best sensor in a layout: when does the first alarm go off? */
export function worstFirstAlarm(runs: FluidRun[], cells: number[]) {
  let worst = 0
  for (const r of runs) {
    let best = Infinity
    for (const k of cells) best = Math.min(best, r.arrival[k])
    worst = Math.max(worst, best)
  }
  return worst
}

/** Score a layout: worst case first (never-alarming cases count as `cap`), then the average as a tie-break. */
function layoutCost(runs: FluidRun[], cells: number[], cap: number) {
  let worst = 0
  let sum = 0
  for (const r of runs) {
    let best = cap
    for (const k of cells) best = Math.min(best, r.arrival[k])
    worst = Math.max(worst, best)
    sum += best
  }
  return worst * 1000 + sum / runs.length
}

/** Greedy placement: add sensors one at a time, each minimising the worst-case first alarm across scenarios. */
export function optimizeSensors(runs: FluidRun[], candidates: number[], n: number) {
  const cap = Math.max(...runs.map((r) => (r.frames.length - 1) * r.every)) + 30
  const chosen: number[] = []
  for (let s = 0; s < n; s++) {
    let best = -1
    let bestC = Infinity
    for (const k of candidates) {
      if (chosen.includes(k)) continue
      const c = layoutCost(runs, [...chosen, k], cap)
      if (c < bestC) {
        bestC = c
        best = k
      }
    }
    if (best >= 0) chosen.push(best)
  }
  return { cells: chosen, worst: worstFirstAlarm(runs, chosen) }
}

export const G_CASES = [
  { id: 'ug', label: 'µg', g: 0 },
  { id: 'moon', label: 'Moon', g: 0.165 },
  { id: '1g', label: '1 g', g: 1 },
] as const
