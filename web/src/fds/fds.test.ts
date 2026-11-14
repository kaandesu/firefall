import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCabin, parseMaterials, parseModel } from '@/intake/parse'
import { firstCrossing, readFdsCsv } from './csv'
import { parseFds } from './namelist'
import { readSlice, writeSlice } from './slice'
import { readSmv } from './smv'
import { halfExtents, toFds } from './toFds'

const EX = 'public/examples/apollo-cm012'
const read = (f: string) => readFileSync(`${EX}/${f}`, 'utf8')
const apollo = () => toFds(parseCabin(read('cabin.yaml')), parseMaterials(read('materials.csv')), parseModel(read('cabin.model.json')), { chid: 'apollo_cm012_1g', g: 1 })

describe('toFds', () => {
  it('writes a parseable case with the hull, every part, the burner and the detectors', () => {
    const c = apollo()
    const p = parseFds(c.text)
    expect(p.head.CHID).toBe('apollo_cm012_1g')
    expect(p.meshes).toHaveLength(1)
    expect(p.meshes[0].ijk).toEqual([40, 40, 32])
    expect(c.cells).toBe(51200)
    expect(p.misc.P_INF).toBeCloseTo(16.7 * 6894.757, -1)
    expect(p.obsts.length).toBe(c.obstCount + 1) // + burner block
    expect(p.obsts.find((o) => o.id === 'net')?.surf).toBe('NYLON')
    expect(p.obsts.find((o) => o.id === 'ecu')?.surf).toBe('STRUCTURE')
    expect(p.vents.find((v) => v.id === 'IGNITER')?.surf).toBe('IGNITER')
    expect(p.devcs.map((d) => d.id)).toEqual(expect.arrayContaining(['D1', 'D2', 'P_cabin']))
    expect(p.props.ionization.QUANTITY).toBe('CHAMBER OBSCURATION')
    expect(c.burner.under).toBe('Debris nets')
    expect([...c.text].every((ch) => ch.charCodeAt(0) < 128)).toBe(true)
  })
  it('µg sets GVEC to zero', () => {
    const c = toFds(parseCabin(read('cabin.yaml')), parseMaterials(read('materials.csv')), parseModel(read('cabin.model.json')), { chid: 'x', g: 0 })
    expect((parseFds(c.text).misc.GVEC as number[]).map(Math.abs)).toEqual([0, 0, 0])
  })
  it('rotated boxes grow to their bounding box', () => {
    const he = halfExtents({ id: 'b', zone: 'z', kind: 'box', pos: [0, 0, 0], size: [2, 0, 0], rot: [0, 0, Math.PI / 2] })
    expect(he[0]).toBeCloseTo(0, 6)
    expect(he[1]).toBeCloseTo(1, 6)
  })
})

describe('namelist parser', () => {
  it('handles multi-line records, quotes with slashes, logicals and comments', () => {
    const p = parseFds(`comment &not a record\n&HEAD CHID='a/b' /\n&MISC GVEC=0.,0.,-9.81, STRATIFICATION=.FALSE.\n  TMPA=22. /\n&TAIL /`)
    expect(p.head.CHID).toBe('a/b')
    expect(p.misc.GVEC).toEqual([0, 0, -9.81])
    expect(p.misc.STRATIFICATION).toBe(false)
    expect(p.misc.TMPA).toBe(22)
  })
})

describe('slice reader', () => {
  it('round-trips a synthetic .sf', () => {
    const frames = [new Float32Array([1, 2, 3, 4, 5, 6]), new Float32Array([7, 8, 9, 10, 11, 12])]
    const buf = writeSlice({ quantity: 'TEMPERATURE', shortName: 'temp', units: 'C', ijk: [0, 2, 0, 0, 0, 1], times: [0, 0.5], frames })
    const s = readSlice(buf)
    expect(s.quantity).toBe('TEMPERATURE')
    expect(s.dims).toEqual([3, 1, 2])
    expect(s.times).toEqual([0, 0.5])
    expect(Array.from(s.frames[1])).toEqual([7, 8, 9, 10, 11, 12])
  })
})

describe('csv', () => {
  it('reads FDS csv and finds crossings', () => {
    const c = readFdsCsv('s,%/m\nTime,D1\n0,0\n1,2\n2,4\n')
    expect(c.cols.D1).toEqual([0, 2, 4])
    expect(firstCrossing(c.cols.Time, c.cols.D1, 3)).toBeCloseTo(1.5)
  })
})

// The shipped real FDS run (skipped until scripts/fds/run.sh has produced it).
const RUN = 'public/data/fds/apollo-cm012/1g'
describe.skipIf(!existsSync(`${RUN}/apollo_cm012_1g.smv`))('real FDS output', () => {
  it('slice frame dims match the .smv index', () => {
    const smv = readSmv(readFileSync(`${RUN}/apollo_cm012_1g.smv`, 'utf8'))
    expect(smv.version).toMatch(/^FDS-6/)
    const sf = smv.files.find((f) => f.kind === 'slice' && f.quantity === 'TEMPERATURE')!
    const b = readFileSync(`${RUN}/${sf.file}`)
    const s = readSlice(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    const ijk = sf.ijk!
    expect(s.dims).toEqual([ijk[1] - ijk[0] + 1, ijk[3] - ijk[2] + 1, ijk[5] - ijk[4] + 1])
    expect(s.frames.length).toBeGreaterThan(10)
  })
})
