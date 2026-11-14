// Real ACME data (NASA PSI-10 / PSI-159), extracted by scripts/extract-fif.mjs into public/data/acme.
//   21256C2  CFI-G intensified-camera features: [t_s, frame, sum_above_bg, lit_blocks] every 4th frame + 18 frames
//   19175A4  Flame Design sensor channels at 4 Hz
//   testpoints  143 Flame Design chamber test points
// Everything below is computed from those files: no hand-picked numbers.

export type FrameSeries = {
  test: string
  camera: string
  frames_total: number
  stride: number
  noise_sigma: number
  series: [number, number, number, number][]
  burst: { frame: number; t_s: number; sum: number; lit: number; src: string }[]
}
export type SensorLog = { test: string; date: string; rate_hz: number; step_s: number; channels: string[]; t: number[]; v: number[][] }

export type CameraEvent = { id: 'ignition' | 'flash' | 'steady' | 'transient' | 'glow'; t: number; frame: number; level: number; label: string; note: string }

const BASE = '/data/acme'
const cache = new Map<string, Promise<unknown>>()
const load = <T,>(f: string): Promise<T> => {
  if (!cache.has(f)) cache.set(f, fetch(`${BASE}/${f}`).then((r) => r.json()))
  return cache.get(f) as Promise<T>
}
export const loadFrames = () => load<FrameSeries>('21256C2.json')
export const loadSensors = () => load<SensorLog>('19175A4.json')
export const loadTestpoints = () => load<{ columns: string[]; rows: (string | number)[][] }>('testpoints.json')
export const frameSrc = (src: string) => `${BASE}/${src}`

/** Background level: mean of the first frames, before anything happens. */
export const background = (s: FrameSeries, n = 12) => s.series.slice(0, n).reduce((a, r) => a + r[2], 0) / n

/** Brightness as a multiple of background, per sample. */
export const ratio = (s: FrameSeries) => {
  const bg = background(s)
  return s.series.map((r) => ({ t: r[0], frame: r[1], r: r[2] / bg, lit: r[3] }))
}

/**
 * Find what the camera saw, from the brightness series alone.
 *   ignition   first sample above `k`× background
 *   flash      brightest sample within 2 s of ignition
 *   steady     first point after the flash where 6 samples vary < 4 %: the plateau
 *   transient  first point after steady brighter than 1.6× the plateau
 *   glow       first point after the transient that stays below half the plateau
 */
export function detectEvents(s: FrameSeries, k = 3): CameraEvent[] {
  const x = ratio(s)
  const out: CameraEvent[] = []
  const at = (i: number, id: CameraEvent['id'], label: string, note: string) => out.push({ id, t: x[i].t, frame: x[i].frame, level: x[i].r, label, note })
  const ign = x.findIndex((p) => p.r > k)
  if (ign < 0) return out
  at(ign, 'ignition', 'Ignition', `brightness crosses ${k}× background`)
  let peak = ign
  for (let i = ign; i < x.length && x[i].t < x[ign].t + 2; i++) if (x[i].r > x[peak].r) peak = i
  at(peak, 'flash', 'Ignition flash', `peak ${Math.round(x[peak].r)}× background`)
  let steady = -1
  for (let i = peak + 1; i + 6 < x.length; i++) {
    const w = x.slice(i, i + 6).map((p) => p.r)
    const m = w.reduce((a, b) => a + b, 0) / w.length
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length)
    if (sd / m < 0.04) {
      steady = i
      break
    }
  }
  if (steady < 0) return out
  const plateau = x.slice(steady, steady + 6).reduce((a, p) => a + p.r, 0) / 6
  at(steady, 'steady', 'Steady flame', `plateau ≈ ${Math.round(plateau)}× background`)
  const tr = x.findIndex((p, i) => i > steady && p.r > 1.6 * plateau)
  if (tr < 0) return out
  at(tr, 'transient', 'Bright transient', `${(x[tr].r / plateau).toFixed(1)}× the plateau`)
  const glow = x.findIndex((_, i) => i > tr && x.slice(i, i + 6).every((q) => q.r < 0.5 * plateau))
  if (glow >= 0) at(glow, 'glow', 'Dim diffuse glow', `${(x[glow].r / plateau).toFixed(2)}× the plateau; not a cool flame (camera glow, see PSI-159)`)
  return out
}

/** Burning time from the camera: ignition to the end of the plateau. */
export const burnSeconds = (ev: CameraEvent[]) => {
  const a = ev.find((e) => e.id === 'ignition')
  const b = ev.find((e) => e.id === 'transient')
  return a && b ? b.t - a.t : undefined
}

export type SensorStats = { fuelOn?: number; fuelOff?: number; ignition?: number; burn?: number; peakRadiometer: number; channels: number }

/** Fuel on/off from the mass-flow controller, ignition from the ion current. */
export function sensorStats(s: SensorLog): SensorStats {
  const ch = (n: string) => s.v[s.channels.indexOf(n)] ?? []
  const flow = ch('MFCA3FuelFlow')
  const ion = ch('IonCurrent')
  const on = flow.findIndex((v) => v > 0.5)
  const off = on < 0 ? -1 : flow.findIndex((v, i) => i > on && v < 0.5)
  const ig = ion.findIndex((v, i) => i >= Math.max(0, on) && v > 0)
  const rad = ch('RadiometerCenter')
  return {
    fuelOn: on >= 0 ? s.t[on] : undefined,
    fuelOff: off >= 0 ? s.t[off] : undefined,
    ignition: ig >= 0 ? s.t[ig] : undefined,
    burn: ig >= 0 && off >= 0 ? s.t[off] - s.t[ig] : undefined,
    peakRadiometer: rad.length ? Math.max(...rad) : 0,
    channels: s.channels.length,
  }
}

/** False-colour lookup for the intensified camera (black → blue → cyan → white). */
export const LUT = (() => {
  const stops: [number, number[]][] = [[0, [0, 0, 0]], [0.18, [6, 14, 60]], [0.42, [32, 80, 255]], [0.68, [120, 220, 255]], [0.88, [220, 248, 255]], [1, [255, 255, 255]]]
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const v = i / 255
    let k = 0
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++
    const [a, ca] = stops[k]
    const [b, cb] = stops[k + 1]
    const f = (v - a) / (b - a)
    for (let j = 0; j < 3; j++) out[i * 3 + j] = ca[j] + (cb[j] - ca[j]) * f
  }
  return out
})()

const imgs = new Map<string, HTMLImageElement>()
/** Draw a grayscale frame into a canvas in false colour; `auto` stretches to the 99.7th percentile. */
export function drawFrame(canvas: HTMLCanvasElement, src: string, auto = false) {
  const go = (img: HTMLImageElement) => {
    const x = canvas.getContext('2d', { willReadFrequently: true })
    if (!x) return
    x.drawImage(img, 0, 0, canvas.width, canvas.height)
    const d = x.getImageData(0, 0, canvas.width, canvas.height)
    const p = d.data
    let k = 1
    if (auto) {
      const hist = new Uint32Array(256)
      for (let i = 0; i < p.length; i += 4) hist[p[i]]++
      let acc = 0
      let top = 255
      const lim = (p.length / 4) * 0.997
      for (let v = 0; v < 256; v++) {
        acc += hist[v]
        if (acc >= lim) {
          top = v
          break
        }
      }
      k = 255 / Math.max(top, 24)
    }
    for (let i = 0; i < p.length; i += 4) {
      const g = Math.min(255, (p[i] * k) | 0)
      p[i] = LUT[g * 3]
      p[i + 1] = LUT[g * 3 + 1]
      p[i + 2] = LUT[g * 3 + 2]
    }
    x.putImageData(d, 0, 0)
  }
  const url = frameSrc(src)
  const hit = imgs.get(url)
  if (hit) return go(hit)
  const img = new Image()
  img.onload = () => {
    imgs.set(url, img)
    go(img)
  }
  img.src = url
}
