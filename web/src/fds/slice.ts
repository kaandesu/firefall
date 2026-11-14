// FDS slice files (.sf): quantity, short name, units, i1..k2, then (time, values) per frame.
// Ported from fds-viewer js/slice-reader.js (MIT, Prof Rino Lovreglio).
import { RecordCursor, detectEndian } from './fortran'

export type Slice = {
  quantity: string
  shortName: string
  units: string
  /** Node index bounds in the mesh: i1, i2, j1, j2, k1, k2. */
  ijk: [number, number, number, number, number, number]
  dims: [number, number, number]
  times: number[]
  /** One Float32Array per frame, x fastest then y then z (Fortran order). */
  frames: Float32Array[]
}

export function readSlice(buf: ArrayBuffer): Slice {
  if (buf.byteLength < 64) throw new Error('too small to be an FDS slice file')
  const le = detectEndian(buf, (n) => n >= 8 && n <= 4096)
  const c = new RecordCursor(buf, le)
  const quantity = c.str(c.read())
  const shortName = c.str(c.read())
  const units = c.str(c.read())
  const ijk = c.ints(c.read(), 6) as Slice['ijk']
  const dims: Slice['dims'] = [ijk[1] - ijk[0] + 1, ijk[3] - ijk[2] + 1, ijk[5] - ijk[4] + 1]
  if (dims.some((d) => !(d > 0))) throw new Error('invalid slice index bounds')
  const count = dims[0] * dims[1] * dims[2]
  const times: number[] = []
  const frames: Float32Array[] = []
  while (c.remaining() >= 8) {
    const t = c.real(c.read())
    if (c.remaining() < 8) break
    const r = c.read()
    const width = r.length / count
    if (width !== 4 && width !== 8) throw new Error(`slice frame has ${r.length} bytes, expected ${count} values`)
    const out = new Float32Array(count)
    for (let i = 0; i < count; i++) out[i] = width === 4 ? c.view.getFloat32(r.offset + i * 4, le) : c.view.getFloat64(r.offset + i * 8, le)
    times.push(t)
    frames.push(out)
  }
  if (!frames.length) throw new Error('no time frames in the slice file')
  return { quantity, shortName, units, ijk, dims, times, frames }
}

/** Min/max over all frames. */
export function sliceRange(s: Slice): [number, number] {
  let lo = Infinity, hi = -Infinity
  for (const fr of s.frames) for (const v of fr) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return [lo, hi]
}

/** Write a slice file (tests and fixtures). Adapted from fds-viewer tests/make-test-sim.mjs. */
export function writeSlice(s: Pick<Slice, 'quantity' | 'shortName' | 'units' | 'ijk' | 'times' | 'frames'>): ArrayBuffer {
  const parts: Uint8Array[] = []
  const rec = (payload: Uint8Array) => {
    const head = new Uint8Array(4)
    new DataView(head.buffer).setUint32(0, payload.length, true)
    parts.push(head, payload, head)
  }
  const text = (t: string) => rec(new TextEncoder().encode(t.padEnd(30)))
  text(s.quantity)
  text(s.shortName)
  text(s.units)
  const idx = new Uint8Array(24)
  s.ijk.forEach((v, i) => new DataView(idx.buffer).setInt32(i * 4, v, true))
  rec(idx)
  s.frames.forEach((fr, n) => {
    const t = new Uint8Array(4)
    new DataView(t.buffer).setFloat32(0, s.times[n], true)
    rec(t)
    const d = new Uint8Array(fr.length * 4)
    const dv = new DataView(d.buffer)
    fr.forEach((v, i) => dv.setFloat32(i * 4, v, true))
    rec(d)
  })
  const total = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out.buffer
}
