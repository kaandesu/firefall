/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseModel } from '@/intake/parse'
import { Fluid, cabinSection, mountable, optimizeSensors, simulate, worstFirstAlarm, type FluidConfig } from './fluid'

const model = parseModel(readFileSync(new URL('../../public/examples/apollo-cm012/cabin.model.json', import.meta.url), 'utf8'))
const sec = cabinSection(model)
const cfg = (g: number, vent = 0.1): FluidConfig => ({
  ...sec,
  cell: 0.05,
  g,
  vent,
  inlet: [-1.3, 0.5],
  outlet: [1.3, 1.6],
  source: [-0.5, 0.32],
  smokeD: 0.18,
  sensors: [
    { id: 'D1', type: 'ionization', x: 0, y: 2.7 },
    { id: 'D2', type: 'photoelectric', x: 1.45, y: 0.55 },
  ],
})

describe('cabin smoke CFD', () => {
  it('builds the cross-section from the model', () => {
    expect(sec.open(0, 1.6)).toBe(true)
    expect(sec.open(1.9, 3)).toBe(false) // outside the cone near the top
    expect(sec.open(0, 0.98)).toBe(false) // centre couch
  })

  it('keeps smoke in the box without sources (projection + advection, small loss)', () => {
    const f = new Fluid(cfg(1, 0))
    for (let k = 0; k < f.d.length; k++) if (f.open[k] && k % 7 === 0) f.d[k] = 1
    const m0 = f.mass()
    for (let i = 0; i < 40; i++) f.step(0.1, false)
    expect(f.mass() / m0).toBeGreaterThan(0.8)
    expect(f.mass() / m0).toBeLessThan(1.05)
  })

  it('smoke rises with gravity and not in µg', () => {
    const t0 = performance.now()
    const up = simulate(cfg(1, 0), 20)
    const flat = simulate(cfg(0, 0), 20)
    const ms = performance.now() - t0
    const top = (r: typeof up) => {
      const f = r.frames[r.frames.length - 1]
      let a = 0
      let b = 0
      for (let j = 0; j < r.ny; j++)
        for (let i = 0; i < r.nx; i++) {
          a += f[j * r.nx + i] * j
          b += f[j * r.nx + i]
        }
      return a / b
    }
    console.log('2 runs', Math.round(ms), 'ms; centroid row 1g', top(up).toFixed(1), 'µg', top(flat).toFixed(1))
    expect(top(up)).toBeGreaterThan(top(flat) + 5)
  })

  it('alarm times differ by gravity, and the optimiser beats the as-designed layout', () => {
    const runs = [0, 0.165, 1].map((g) => simulate(cfg(g), 60))
    for (const r of runs) console.log('g', r.cfg.g, 'alarms', JSON.stringify(r.alarms))
    const f = new Fluid(cfg(1))
    const asIs = cfg(1).sensors.map((s) => {
      const [i, j] = f.cellOf(s.x, s.y)
      return j * f.nx + i
    })
    const cand = mountable(f).filter((_, i) => i % 3 === 0)
    const best = optimizeSensors(runs, cand, 2)
    const was = worstFirstAlarm(runs, asIs)
    console.log('worst first alarm as designed', was, '→ optimised', best.worst, best.cells.map((k) => f.pos(k % f.nx, Math.floor(k / f.nx)).map((v) => v.toFixed(2))))
    expect(best.worst).toBeLessThanOrEqual(was)
  })
})
