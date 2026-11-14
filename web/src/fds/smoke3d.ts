// FDS Smoke3D files (.s3d): header (1, version, i1..k2), then per frame a time, (in, out) byte counts and an
// RLE-compressed byte field (255, value, count runs). Values are 0–254 opacity for soot.
// Ported from fds-viewer js/smoke3d-reader.js (MIT, Prof Rino Lovreglio).
import { RecordCursor, detectEndian } from './fortran'

export type Smoke3D = {
  ijk: [number, number, number, number, number, number]
  dims: [number, number, number]
  times: number[]
  /** Lazily decompressed frames. */
  frame: (n: number) => Uint8Array
}

export function readSmoke3D(buf: ArrayBuffer): Smoke3D {
  const le = detectEndian(buf, (n) => n >= 32 && n <= 128)
  const c = new RecordCursor(buf, le)
  const h = c.ints(c.read(), 8)
  const ijk = h.slice(2, 8) as Smoke3D['ijk']
  const dims: Smoke3D['dims'] = [ijk[1] - ijk[0] + 1, ijk[3] - ijk[2] + 1, ijk[5] - ijk[4] + 1]
  const frames: { time: number; inChars: number; offset: number; length: number }[] = []
  while (c.remaining() >= 8) {
    try {
      const time = c.real(c.read())
      if (c.remaining() < 8) break
      const [inChars, outChars] = c.ints(c.read(), 2)
      let offset = 0, length = 0
      if (outChars > 0) ({ offset, length } = c.read())
      frames.push({ time, inChars, offset, length })
    } catch {
      break // a truncated last frame: keep what was read
    }
  }
  if (!frames.length) throw new Error('no Smoke3D frames')
  const cache = new Map<number, Uint8Array>()
  return {
    ijk,
    dims,
    times: frames.map((f) => f.time),
    frame(n) {
      const hit = cache.get(n)
      if (hit) return hit
      const fr = frames[n]
      const out = new Uint8Array(fr.inChars)
      const input = new Uint8Array(buf, fr.offset, fr.length)
      let s = 0, d = 0
      while (s < input.length && d < out.length) {
        const m = input[s++]
        if (m === 255) {
          if (s + 1 >= input.length) break
          const v = input[s++]
          const count = input[s++]
          const end = Math.min(d + count, out.length)
          out.fill(v, d, end)
          d = end
        } else out[d++] = m
      }
      cache.set(n, out)
      return out
    },
  }
}
