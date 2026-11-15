// Live views of lab jobs. Each tile draws one job; while the job runs, the view advances with its progress.
//   acme-frames    real ACME CFI-G 21256C2 camera frames, false colour, brightness curve and detected events
//   spread-duct    Saffire/BASS-style flow duct with a burning sheet (three.js)
//   gravity-flame  candle flame at the cabin atmosphere, µg and 1 g bounds (three.js)
//   droplet        FLEX droplet with a suppressant (three.js)
//   lim-sweep      limiting O₂ over flow × O₂, cell by cell, with the cabin point
//   smoke-cfd      smoke CFD in the cabin section, µg / Moon / 1 g side by side, sensors light up
//   sensor-opt     worst-case smoke arrival map, designed vs proposed sensors
//   chamber-test   WSTF Test 1: five samples, burn lengths
import { OrbitControls } from '@react-three/drei'
import { FdsTile } from '@/fds/FdsTile'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import { detectEvents, drawFrame, loadFrames, ratio, type CameraEvent, type FrameSeries } from '@/data/acme'
import type { Job } from '@/live/types'
import { MATERIALS, limitingO2, spreadRate } from '@/sims/models'
import { DropletScene } from './Droplet'
import { FlameSpreadScene } from './FlameSpread'
import { GravityFlameScene } from './GravityFlame'
import type { SmokeStudy } from './smokeStudy'
import { LAB_BURN } from '@/demo/apollo1'

const num = (v: unknown, d: number) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !Number.isNaN(+v) ? +v : d)

// ── ACME frames (real data) ─────────────────────────────────────────────────────────────

export function useAcmeFrames() {
  const [data, setData] = useState<{ f: FrameSeries; ev: CameraEvent[] }>()
  useEffect(() => {
    let on = true
    void loadFrames().then((f) => on && setData({ f, ev: detectEvents(f) }))
    return () => {
      on = false
    }
  }, [])
  return data
}

export function BrightnessChart({ f, ev, upTo, h = 70, cursor, w = 300 }: { f: FrameSeries; ev: CameraEvent[]; upTo: number; h?: number; cursor?: number; w?: number }) {
  const x = useMemo(() => ratio(f), [f])
  const W = w
  const t0 = 30
  const t1 = 72
  const lo = Math.log10(0.5)
  const hi = Math.log10(Math.max(...x.map((p) => p.r)) * 1.2)
  const X = (t: number) => ((t - t0) / (t1 - t0)) * W
  const Y = (r: number) => h - ((Math.log10(Math.max(0.5, r)) - lo) / (hi - lo)) * h
  const pts = x.filter((p) => p.t >= t0 && p.t <= upTo).map((p) => `${X(p.t).toFixed(1)},${Y(p.r).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${W} ${h + 12}`} className="w-full" preserveAspectRatio="none">
      <line x1={0} x2={W} y1={Y(1)} y2={Y(1)} stroke="#263242" strokeDasharray="2 3" />
      <polyline points={pts.join(' ')} fill="none" stroke="#5aa9ff" strokeWidth={1.4} />
      {ev
        .filter((e) => e.t <= upTo)
        .map((e, i) => (
          <g key={e.id}>
            <line x1={X(e.t)} x2={X(e.t)} y1={0} y2={h} stroke="#ffb547" strokeWidth={0.8} strokeDasharray="2 2" />
            <text x={X(e.t) + 2} y={8 + (i % 3) * 8} fill="#ffb547" fontSize={7}>
              {e.label}
            </text>
          </g>
        ))}
      {cursor !== undefined && <line x1={X(cursor)} x2={X(cursor)} y1={0} y2={h} stroke="#e6edf3" strokeWidth={0.8} />}
      <text x={0} y={h + 10} fill="#4a5665" fontSize={7}>
        T+{t0} s
      </text>
      <text x={W} y={h + 10} fill="#4a5665" fontSize={7} textAnchor="end">
        T+{t1} s · brightness / background (log)
      </text>
    </svg>
  )
}

export function FrameCanvas({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawFrame(ref.current, src, true)
  }, [src])
  return <canvas ref={ref} width={348} height={260} className={className} />
}

function AcmeTile({ job }: { job: Job }) {
  const d = useAcmeFrames()
  if (!d) return <Wait text="loading 21256C2 frames" />
  const { f, ev } = d
  const t = 30 + (72 - 30) * job.progress
  const frame = [...f.burst].reverse().find((b) => b.t_s <= Math.max(t, f.burst[0].t_s)) ?? f.burst[0]
  const seen = ev.filter((e) => e.t <= t)
  return (
    <div className="flex h-full min-h-0 gap-2">
      <div className="relative shrink-0">
        <FrameCanvas src={frame.src} className="h-full max-h-[150px] w-auto rounded-sm border border-line" />
        <span className="absolute left-1 top-1 bg-bg/80 px-1 text-[9px] text-ug">
          INTNS f{frame.frame} · T+{frame.t_s.toFixed(1)} s
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <BrightnessChart f={f} ev={ev} upTo={t} />
        <div className="space-y-0.5 text-[9.5px]">
          {seen.slice(-3).map((e) => (
            <div key={e.id} className="truncate">
              <span className="text-warn">T+{e.t.toFixed(1)} s</span> <span className="text-ink">{e.label}</span> <span className="text-faint">{e.note}</span>
            </div>
          ))}
          {!seen.length && <div className="text-faint">scanning frames for the ignition flash…</div>}
        </div>
      </div>
    </div>
  )
}

// ── three.js scenes ───────────────────────────────────────────────────────────────────

function Three({ cam, children, live }: { cam: [number, number, number]; children: React.ReactNode; live: boolean }) {
  return (
    <Canvas camera={{ position: cam, fov: 45 }} dpr={[1, 1.5]} frameloop={live ? 'always' : 'demand'} gl={{ antialias: false, powerPreference: 'low-power' }}>
      <color attach="background" args={['#070a0f']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} />
      {children}
      <OrbitControls enablePan={false} enableZoom={false} />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}

function SpreadTile({ job, live }: { job: Job; live: boolean }) {
  const p = job.params ?? {}
  const mat = String(p.material ?? 'cotton')
  const [st, setSt] = useState<{ front: number; rate: number; burning: boolean }>()
  return (
    <div className="relative h-full">
      <Three cam={[0, 2.6, 3.6]} live={live}>
        <FlameSpreadScene o2={num(p.o2, 0.21)} psi={num(p.psi, 14.7)} g={num(p.g, 0)} flow={num(p.flow, 20)} material={mat} onState={setSt} />
      </Three>
      <Readout
        items={[
          [MATERIALS[mat]?.label ?? mat, ''],
          ['O₂', `${Math.round(num(p.o2, 0.21) * 100)} %`],
          ['g', String(num(p.g, 0))],
          ['flow', `${num(p.flow, 20)} cm/s`],
          ['spread', st ? `${st.rate.toFixed(1)} mm/s` : '…'],
        ]}
      />
    </div>
  )
}

function FlameTile({ job, live }: { job: Job; live: boolean }) {
  const p = job.params ?? {}
  return (
    <div className="relative h-full">
      <Three cam={[0, 0.6, 5.6]} live={live}>
        <GravityFlameScene g={num(p.g, 1)} o2={num(p.o2, 0.21)} flow={num(p.flow, 0)} />
      </Three>
      <Readout items={[['O₂', `${Math.round(num(p.o2, 0.21) * 100)} %`], ['g', String(num(p.g, 1))], ['ghosts', 'µg · 1 g bounds']]} />
    </div>
  )
}

function DropletTile({ job, live }: { job: Job; live: boolean }) {
  const p = job.params ?? {}
  const [st, setSt] = useState<{ d: number; t: number; phase: string }>()
  return (
    <div className="relative h-full">
      <Three cam={[0, 0.3, 3.4]} live={live}>
        <DropletScene o2={num(p.o2, 0.21)} co2={num(p.co2, 0)} d0={num(p.d0, 2.5)} showCool onState={setSt} />
      </Three>
      <Readout items={[['O₂', `${Math.round(num(p.o2, 0.21) * 100)} %`], ['CO₂', `${Math.round(num(p.co2, 0) * 100)} %`], ['phase', st?.phase ?? '…'], ['d', st ? `${st.d.toFixed(2)} mm` : '…']]} />
    </div>
  )
}

// ── limiting-O₂ sweep ─────────────────────────────────────────────────────────────────

function SweepTile({ job }: { job: Job }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const p = job.params ?? {}
  const mat = MATERIALS[String(p.material ?? 'nylon')]
  const g = num(p.g, 1)
  const psi = num(p.psi, 14.7)
  const cabin = { o2: num(p.o2, 1), flow: num(p.flow, 10) }
  const NX = 30
  const NY = 24
  const FMAX = 60
  const OMIN = 0.1
  const OMAX = 1
  useEffect(() => {
    const c = ref.current?.getContext('2d')
    if (!c || !mat) return
    const W = c.canvas.width
    const H = c.canvas.height
    c.fillStyle = '#070a0f'
    c.fillRect(0, 0, W, H)
    const filled = Math.floor(job.progress * NX * NY)
    const vmax = spreadRate(OMAX, 20, g, psi, mat) || 1
    for (let k = 0; k < filled; k++) {
      const i = k % NX
      const j = Math.floor(k / NX)
      const flow = ((i + 0.5) / NX) * FMAX
      const o2 = OMIN + ((j + 0.5) / NY) * (OMAX - OMIN)
      const v = spreadRate(o2, flow, g, psi, mat) / vmax
      c.fillStyle = v <= 0 ? '#0f1a26' : `hsl(${28 - 20 * v}, 95%, ${18 + 45 * Math.min(1, v)}%)`
      c.fillRect((i / NX) * W, H - ((j + 1) / NY) * H, W / NX + 0.5, H / NY + 0.5)
    }
    // the fitted limit curve
    c.strokeStyle = '#5aa9ff'
    c.lineWidth = 1.5
    c.beginPath()
    for (let i = 0; i <= 60; i++) {
      const flow = (i / 60) * FMAX
      const lim = limitingO2(flow, g, psi, mat)
      const x = (flow / FMAX) * W
      const y = H - ((lim - OMIN) / (OMAX - OMIN)) * H
      if (i) c.lineTo(x, y)
      else c.moveTo(x, y)
    }
    c.stroke()
    // the cabin
    const cx = (cabin.flow / FMAX) * W
    const cy = H - ((cabin.o2 - OMIN) / (OMAX - OMIN)) * H
    c.strokeStyle = '#ffffff'
    c.beginPath()
    c.arc(cx, Math.max(5, cy), 4, 0, Math.PI * 2)
    c.stroke()
  }, [job.progress, mat, g, psi, cabin.o2, cabin.flow])
  const lim = mat ? limitingO2(cabin.flow, g, psi, mat) : 0
  return (
    <div className="flex h-full min-h-0 gap-2">
      <div className="relative min-w-0 flex-1">
        <canvas ref={ref} width={300} height={200} className="h-full w-full rounded-sm border border-line" />
        <span className="absolute bottom-1 right-1 text-[8.5px] text-faint">flow 0–60 cm/s →</span>
        <span className="absolute left-1 top-1 text-[8.5px] text-faint">O₂ 10–100 % ↑</span>
      </div>
      <div className="w-[96px] shrink-0 space-y-1 text-[9.5px] text-muted-foreground">
        <div className="text-ink">{mat?.label}</div>
        <div>
          cells <span className="text-ink">{Math.floor(job.progress * NX * NY)}</span>/{NX * NY}
        </div>
        <div>
          <span className="text-ug">—</span> fitted limit
        </div>
        <div>
          ○ cabin: {Math.round(cabin.o2 * 100)} % at {cabin.flow} cm/s
        </div>
        <div>
          limit here <span className="text-ink">{Math.round(lim * 100)} %</span>
        </div>
        <div className={cabin.o2 > lim ? 'text-bad' : 'text-ok'}>{cabin.o2 > lim ? `burns: ${Math.round((cabin.o2 - lim) * 100)} pts over` : 'below limit'}</div>
      </div>
    </div>
  )
}

// ── smoke CFD ─────────────────────────────────────────────────────────────────────────

const SMOKE = (v: number) => {
  const a = Math.min(1, v * 6)
  return [Math.round(40 + 200 * a), Math.round(46 + 190 * a), Math.round(58 + 170 * a)]
}

export function SectionCanvas({ study, field, sensors = 'both', className, scale }: { study: SmokeStudy; field: Float32Array | ((k: number) => [number, number, number]); sensors?: 'designed' | 'proposed' | 'both' | 'none'; className?: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const S = scale ?? 3
  useEffect(() => {
    const c = ref.current?.getContext('2d')
    if (!c) return
    const { nx, ny, open, cell, w } = study
    const img = c.createImageData(nx, ny)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        const o = ((ny - 1 - j) * nx + i) * 4
        const [r, g, b] = !open[k] ? [14, 18, 24] : typeof field === 'function' ? field(k) : SMOKE(field[k])
        img.data[o] = r
        img.data[o + 1] = g
        img.data[o + 2] = b
        img.data[o + 3] = 255
      }
    const off = document.createElement('canvas')
    off.width = nx
    off.height = ny
    off.getContext('2d')!.putImageData(img, 0, 0)
    c.imageSmoothingEnabled = true
    c.clearRect(0, 0, c.canvas.width, c.canvas.height)
    c.drawImage(off, 0, 0, nx * S, ny * S)
    const px = (x: number) => ((x + w / 2) / cell) * S
    const py = (y: number) => (ny - y / cell) * S
    for (const s of study.sources) {
      c.fillStyle = s.listed ? '#ff6b3d' : '#ff6b3d88'
      c.beginPath()
      c.arc(px(s.at[0]), py(s.at[1]), 3, 0, Math.PI * 2)
      c.fill()
    }
    const draw = (list: typeof study.designed, color: string) => {
      for (const s of list) {
        c.strokeStyle = color
        c.lineWidth = 1.5
        c.strokeRect(px(s.x) - 4, py(s.y) - 4, 8, 8)
        c.fillStyle = color
        c.font = '9px DM Mono, monospace'
        c.fillText(s.id, px(s.x) + 6, py(s.y) + 3)
      }
    }
    if (sensors === 'designed' || sensors === 'both') draw(study.designed, '#9aa3ae')
    if (sensors === 'proposed' || sensors === 'both') draw(study.proposed, '#3fd07a')
  }, [study, field, sensors, S])
  return <canvas ref={ref} width={study.nx * S} height={study.ny * S} className={className} />
}

function SmokeTile({ job, study, progress }: { job: Job; study?: SmokeStudy; progress: number }) {
  if (!study) return <Wait text={`solving ${Math.round(progress * 100)} % · ${Math.round(progress * 18)}/18 runs`} />
  const t = job.progress * study.seconds
  return (
    <div className="grid h-full min-h-0 grid-cols-3 gap-1.5">
      {study.frames.map((c) => {
        const i = Math.min(c.frames.length - 1, Math.round(t / c.every))
        return (
          <div key={c.gLabel} className="flex min-h-0 flex-col">
            <div className="flex items-center gap-1 text-[9.5px]">
              <span className="text-ink">{c.gLabel}</span>
              <span className="text-faint">T+{Math.round(t)} s</span>
            </div>
            <SectionCanvas study={study} field={c.frames[i]} sensors="designed" className="min-h-0 w-full flex-1 rounded-sm border border-line object-contain" />
            <div className="flex flex-wrap gap-x-2 text-[9px]">
              {Object.entries(c.alarms).map(([id, a]) => (
                <span key={id} className={a !== null && a <= t ? 'text-bad' : 'text-faint'}>
                  {id} {a === null ? 'no alarm' : a <= t ? `ALARM ${a.toFixed(0)} s` : '…'}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SensorTile({ job, study, progress }: { job: Job; study?: SmokeStudy; progress: number }) {
  if (!study) return <Wait text={`waiting for the CFD runs · ${Math.round(progress * 100)} %`} />
  const shown = job.progress
  const field = (k: number): [number, number, number] => {
    if (k / study.reach.length > shown) return [20, 26, 34]
    const v = Math.max(0, study.reach[k])
    return v < 0.5 ? [Math.round(90 + 60 * v), Math.round(24 + 90 * v), 30] : [Math.round(120 - 200 * (v - 0.5)), Math.round(70 + 140 * (v - 0.5)), Math.round(30 + 40 * (v - 0.5))]
  }
  const fmt = (t: number | null) => (t === null ? 'never in 60 s' : `${t.toFixed(0)} s`)
  return (
    <div className="flex h-full min-h-0 gap-2 overflow-hidden">
      <SectionCanvas study={study} field={field} sensors={job.done ? 'both' : 'designed'} className="h-full min-h-0 w-auto max-w-[58%] rounded-sm border border-line object-contain" />
      <div className="min-w-[96px] flex-1 space-y-1 overflow-hidden text-[9.5px] text-muted-foreground">
        <div className="text-ink">worst-case first alarm</div>
        <div>
          designed <span className="text-bad">{fmt(study.worstDesigned)}</span>
        </div>
        {job.done && (
          <div>
            proposed <span className="text-ok">{fmt(study.worstProposed)}</span>
          </div>
        )}
        <div className="text-faint">
          {study.sources.length} sources × 3 g · {study.runs} CFD runs · smoke {study.smokeD} µm
        </div>
        <div className="text-faint">colour = share of cases smoke reaches · green all, red few</div>
      </div>
    </div>
  )
}

// ── WSTF chamber ──────────────────────────────────────────────────────────────────────

const BURN = LAB_BURN // fraction of the 30 cm sample; > 0.5 counts as burned

function ChamberTile({ job }: { job: Job }) {
  const n = BURN.length
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="text-[9.5px] text-muted-foreground">NASA-STD-6001 Test 1 · upward burn · 30 cm samples · pass if &lt; 15 cm</div>
      <div className="flex min-h-0 flex-1 items-end gap-3 px-2">
        {BURN.map((b, i) => {
          const start = i / n
          const p = Math.max(0, Math.min(1, (job.progress - start) * n))
          const len = b * p
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="relative h-full w-5 rounded-sm border border-line-2 bg-surface-2">
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#3a1a0c] to-[#ff7a3d]" style={{ height: `${len * 100}%` }} />
                <div className="absolute inset-x-0 border-t border-dashed border-warn" style={{ bottom: '50%' }} />
              </div>
              <span className={`text-[9px] ${p >= 1 ? (b > 0.5 ? 'text-bad' : 'text-ok') : 'text-faint'}`}>{p >= 1 ? `${Math.round(b * 30)} cm` : p > 0 ? 'burning' : `#${i + 1}`}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── shared ───────────────────────────────────────────────────────────────────────────

function useJsonFile<T>(url: string) {
  const [d, setD] = useState<T>()
  useEffect(() => {
    let on = true
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : undefined))
      .then((x) => on && setD(x))
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [url])
  return d
}

/** Real Saffire-I frames (PSI-98, series F1C2) playing while the studies are ranked, with the ranking the tool returned. */
function SaffireTile({ job }: { job: Job }) {
  const d = useJsonFile<{ frames: { t: number; src: string }[] }>('/data/psi-98/index.json')
  const [loop, setLoop] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLoop((x) => x + 1), 180)
    return () => clearInterval(t)
  }, [])
  const n = d?.frames.length ?? 0
  const f = d && n ? d.frames[job.done ? loop % n : Math.min(n - 1, Math.floor(job.progress * n))] : undefined
  return (
    <div className="flex h-full min-h-0 gap-2">
      <div className="relative min-h-0 min-w-0 flex-1">
        {f ? <img src={`/data/psi-98/${f.src}`} alt="Saffire-I flow visualisation frame" className="h-full w-full rounded-sm object-contain" /> : <Wait text="Saffire-I frames" />}
        <div className="absolute left-1 top-1 bg-bg/70 px-0.5 text-[9px] text-muted-foreground">Saffire-I · PSI-98 · F1C2 pre-test flow {f && <span className="text-ink">T+{f.t.toFixed(1)} s</span>}</div>
      </div>
      <div className="flex w-[42%] shrink-0 flex-col justify-center gap-1 text-[9.5px]">
        <div className="label">coverage of this atmosphere</div>
        {Object.entries(job.stats).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-24 truncate text-ink">{k}</span>
            <div className="h-1 flex-1 rounded bg-surface-3">
              <div className="h-full rounded bg-ug" style={{ width: `${Math.min(100, num(v, 0) * 100 * job.progress)}%` }} />
            </div>
            <span className="w-7 text-right text-muted-foreground tnum">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Real BASS-II crew stills (PSI-25) beside the report passage the search returned. */
function BassTile({ job }: { job: Job }) {
  const d = useJsonFile<{ stills: { id: string; src: string }[] }>('/data/psi-25/index.json')
  const [loop, setLoop] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLoop((x) => x + 1), 1400)
    return () => clearInterval(t)
  }, [])
  const s = d?.stills.length ? d.stills[(Math.floor(job.progress * 6) + loop) % d.stills.length] : undefined
  const text = job.stats.passage ?? ''
  return (
    <div className="flex h-full min-h-0 gap-2">
      <div className="relative min-h-0 w-[45%] shrink-0">
        {s ? <img src={`/data/psi-25/${s.src}`} alt={`BASS-II still ${s.id}`} className="h-full w-full rounded-sm object-cover" /> : <Wait text="BASS-II stills" />}
        <div className="absolute left-1 top-1 bg-bg/70 px-0.5 text-[9px] text-muted-foreground">BASS-II · PSI-25 · {s?.id}</div>
      </div>
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto text-[10px] leading-snug">
        <div className="text-k-ask">summary report · {job.stats.page}</div>
        <div className="sans text-muted-foreground">{text.slice(0, Math.max(40, Math.floor(text.length * (job.done ? 1 : job.progress))))}</div>
      </div>
    </div>
  )
}

function Wait({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-[10.5px] text-faint">{text}</div>
}

function Readout({ items }: { items: [string, string][] }) {
  return (
    <div className="pointer-events-none absolute left-1.5 top-1 flex flex-wrap gap-x-2 text-[9px]">
      {items.map(([k, v]) => (
        <span key={k} className="bg-bg/70 px-0.5 text-muted-foreground">
          {k} {v && <span className="text-ink">{v}</span>}
        </span>
      ))}
    </div>
  )
}

export function JobScene({ job, study, studyProgress, live }: { job: Job; study?: SmokeStudy; studyProgress: number; live: boolean }) {
  switch (job.scene) {
    case 'acme-frames':
      return <AcmeTile job={job} />
    case 'spread-duct':
      return <SpreadTile job={job} live={live} />
    case 'gravity-flame':
      return <FlameTile job={job} live={live} />
    case 'droplet':
      return <DropletTile job={job} live={live} />
    case 'lim-sweep':
      return <SweepTile job={job} />
    case 'smoke-cfd':
      return <SmokeTile job={job} study={study} progress={studyProgress} />
    case 'sensor-opt':
      return <SensorTile job={job} study={study} progress={studyProgress} />
    case 'chamber-test':
      return <ChamberTile job={job} />
    case 'fds':
      return <FdsTile job={job} live={live} />
    case 'saffire-frames':
      return <SaffireTile job={job} />
    case 'bass-stills':
      return <BassTile job={job} />
    default:
      return <Wait text={job.title} />
  }
}

/** Scenes that need a WebGL context. */
export const THREE_SCENES = new Set(['spread-duct', 'gravity-flame', 'droplet', 'fds'])
