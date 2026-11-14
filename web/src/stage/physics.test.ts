/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCabin, parseMaterials, parseModel, toPackage } from '@/intake/parse'
import { burningAt, pressureAt, simulateFire, variantsFor } from './physics'

const ex = (f: string) => readFileSync(new URL(`../../public/examples/apollo-cm012/${f}`, import.meta.url), 'utf8')
const pkg = toPackage(parseCabin(ex('cabin.yaml')), parseMaterials(ex('materials.csv')))
const model = parseModel(ex('cabin.model.json'))
const [asBuilt, sixtyForty, ug, base] = variantsFor(pkg).map((v) => simulateFire(model, pkg, v))

describe('Apollo 1 as built', () => {
  it('ruptures the hull about 15 s after ignition, as the Review Board timeline has it', () => {
    expect(asBuilt.rupture).toBeGreaterThan(11)
    expect(asBuilt.rupture).toBeLessThan(19)
  })
  it('takes the cabin well before the hatch could open', () => {
    const reach = asBuilt.zones.filter((z) => z.burns).length
    expect(burningAt(asBuilt, asBuilt.rupture!)).toBeGreaterThanOrEqual(reach - 1)
    expect(asBuilt.rupture!).toBeLessThan(pkg.hatch!.openTime)
  })
  it('starts at the ignition zone and lights zones in order', () => {
    expect(asBuilt.ignite.wiring).toBe(0)
    expect(burningAt(asBuilt, 0.5)).toBeLessThan(burningAt(asBuilt, asBuilt.rupture!))
    expect(pressureAt(asBuilt, asBuilt.rupture! - 0.1)).toBeLessThan(29)
  })
})

describe('what-ifs', () => {
  it('60/40 on the pad is slower and does not rupture the hull before the hatch time', () => {
    expect(sixtyForty.rupture).toBeUndefined()
    const nylon = (r: typeof asBuilt) => r.zones.find((z) => z.zone === 'netting')!.speed
    expect(nylon(sixtyForty)).toBeLessThan(nylon(asBuilt))
  })
  it('µg and base camp are reported, each a pure function of its inputs', () => {
    expect(ug.variant.g).toBe(0)
    expect(base.variant.o2).toBe(0.34)
    expect(simulateFire(model, pkg, base.variant)).toEqual(base)
  })
})
