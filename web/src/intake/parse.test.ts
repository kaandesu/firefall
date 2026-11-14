/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cabinSummary, crossCheck, csvRows, IntakeError, materialKey, materialsSummary, modelSummary, parseCabin, parseMaterials, parseModel, toPackage, zonesOf } from './parse'

const ex = (f: string) => readFileSync(new URL(`../../public/examples/apollo-cm012/${f}`, import.meta.url), 'utf8')

describe('cabin.yaml', () => {
  it('parses the Apollo example', () => {
    const s = parseCabin(ex('cabin.yaml'))
    expect(s.o2).toBe(1)
    expect(s.psi).toBe(16.7)
    expect(s.g).toBe(1)
    expect(s.volume).toBe(6.2)
    expect(s.crew).toBe(3)
    expect(s.ignition[0].zone).toBe('wiring')
    expect(s.hatch.openTime).toBe(90)
    expect(s.hull.burstPsia).toBe(29)
    expect(cabinSummary(s)).toBe('100 % O₂ · 16.7 psia · 1 g')
    expect(s.sensors.map((d) => `${d.id}:${d.type}`)).toEqual(['D1:ionization', 'D2:photoelectric'])
    expect(s.sensors[1].pos).toEqual([1.45, 0.55, 0])
  })
  it('rejects a sensor without a position or with an unknown type', () => {
    const base = 'atmosphere: { o2_pct: 21, pressure_psia: 14.7 }\ngravity_g: 1\nvolume_m3: 5\n'
    expect(() => parseCabin(base + 'sensors:\n  - { id: D1, type: laser, pos: [0, 1, 0] }')).toThrow(/photoelectric or ionization/)
    expect(() => parseCabin(base + 'sensors:\n  - { id: D1, type: ionization }')).toThrow(/pos must be/)
  })
  it('rejects bad YAML and out-of-range numbers with a readable message', () => {
    expect(() => parseCabin('atmosphere: [')).toThrow(IntakeError)
    expect(() => parseCabin('atmosphere: { o2_pct: 140, pressure_psia: 14.7 }\ngravity_g: 1\nvolume_m3: 5')).toThrow(/o2_pct: 140 is outside/)
    expect(() => parseCabin('atmosphere: { o2_pct: 21 }\ngravity_g: 1\nvolume_m3: 5')).toThrow(/pressure_psia/)
  })
})

describe('materials.csv', () => {
  it('parses the Apollo example and maps every material', () => {
    const rows = parseMaterials(ex('materials.csv'))
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => r.key)).toBe(true)
    expect(rows[4]).toMatchObject({ part: 'Wiring insulation', key: 'teflon', zone: 'wiring', distance: 0 })
  })
  it('handles quotes, CRLF and blank lines', () => {
    expect(csvRows('a,b\r\n"x, y","he said ""hi"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ])
  })
  it('requires the key columns', () => {
    expect(() => parseMaterials('part,zone\nnet,cabin')).toThrow(/missing column "material"/)
  })
  it('maps free-text names onto modelled materials', () => {
    expect(materialKey('PTFE')).toBe('teflon')
    expect(materialKey('Velcro hook')).toBe('nylon')
    expect(materialKey('unobtainium')).toBeUndefined()
  })
})

describe('cabin.model.json', () => {
  it('parses the Apollo example', () => {
    const m = parseModel(ex('cabin.model.json'))
    expect(m.primitives.find((p) => p.shell)?.kind).toBe('cone')
    expect(zonesOf(m)).toEqual(expect.arrayContaining(['couches', 'wiring', 'netting', 'walls', 'floor', 'hatch', 'leb']))
    expect(modelSummary(m)).toMatch(/^15 primitives · \d+ zones$/)
  })
  it('rejects malformed primitives', () => {
    expect(() => parseModel('{"primitives":[{"id":"a","zone":"z","kind":"box","pos":[0,0,0]}]}')).toThrow(/needs size/)
    expect(() => parseModel('{"primitives":[{"id":"a","zone":"z","kind":"torus","pos":[0,0,0]}]}')).toThrow(/kind must be/)
    expect(() => parseModel('{"primitives":[]}')).toThrow(/non-empty/)
  })
})

describe('zone mapping', () => {
  const spec = parseCabin(ex('cabin.yaml'))
  const model = parseModel(ex('cabin.model.json'))
  it('finds no issues in the example', () => {
    const rows = parseMaterials(ex('materials.csv'))
    expect(crossCheck(spec, rows, model)).toEqual([])
    expect(materialsSummary(rows, model)).toBe('7 materials · 7 mapped to zones')
  })
  it('flags rows whose zone is not in the model, and unknown materials', () => {
    const rows = parseMaterials('part,material,zone\nNet,nylon,netting\nBag,nylon,galley\nGoo,unobtainium,floor')
    const issues = crossCheck(spec, rows, model)
    expect(issues.map((i) => i.text)).toEqual(['line 3: zone "galley" is not in the cabin model', 'line 4: "unobtainium" is not a modelled material'])
    expect(materialsSummary(rows, model)).toBe('3 materials · 1 mapped to zones')
  })
  it('builds a package with zones on every BOM item', () => {
    const pkg = toPackage(spec, parseMaterials(ex('materials.csv')))
    expect(pkg.bom).toHaveLength(7)
    expect(pkg.bom.every((b) => b.zone)).toBe(true)
    expect(pkg.ignitionZones).toEqual(['wiring'])
    expect(pkg.atmosphere).toMatchObject({ o2: 1, psi: 16.7 })
  })
})
