import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Bot, Info, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AgentTag } from '@/components/bits'
import { Slider } from '@/components/ui/slider'
import { useMission } from '@/live/store'
import type { SimKind } from '@/live/types'
import { cn } from '@/lib/utils'
import { DropletScene, type DropletState } from '@/sims/Droplet'
import { FlameSpreadScene } from '@/sims/FlameSpread'
import { GravityFlameScene } from '@/sims/GravityFlame'
import { ATMOS, GRAVITY, MATERIALS, droplet, flameShape, limitingO2, pct, spreadRate, spreadVsEarth } from '@/sims/models'
import { DETECTORS, SMOKE_TIME_SCALE, SmokeModuleScene, type SmokeReadout } from '@/sims/SmokeModule'

const TABS: { id: SimKind; label: string; anchor: string }[] = [
  { id: 'flame', label: 'Flame', anchor: 'CFI · s-Flame · µg vs 1 g' },
  { id: 'smoke', label: 'Smoke', anchor: 'SAME · SAME-R · DAFT' },
  { id: 'spread', label: 'Spread', anchor: 'Saffire · BASS-II' },
  { id: 'droplet', label: 'Droplet', anchor: 'FLEX · FLEX-2' },
]

export function SimView() {
  const tab = useMission((s) => s.simTab)
  const setTab = useMission((s) => s.setSimTab)
  const p = useMission((s) => s.params)
  const driver = useMission((s) => s.simDriver)
  const lastRun = useMission((s) => [...s.model.sims].reverse().find((r) => r.sim === s.simTab))
  const [smoke, setSmoke] = useState<{ r: SmokeReadout; t: number } | null>(null)
  const [drop, setDrop] = useState<DropletState | null>(null)
  const [showCool, setShowCool] = useState(true)
  const [showControls, setShowControls] = useState<boolean | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(true)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setWide(width > 760)
      setCompact(width < 560 || height < 380)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const controlsOpen = showControls ?? wide
  const material = MATERIALS[p.material] ?? MATERIALS.cotton

  return (
    <div ref={box} className="relative flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn('mono rounded px-2 py-0.5 text-[10.5px]', tab === t.id ? 'bg-surface-3 text-ink' : 'text-muted-foreground hover:text-ink')}>
            {t.label}
          </button>
        ))}
        <span className="mono ml-auto hidden text-[9.5px] text-faint md:inline">{TABS.find((t) => t.id === tab)?.anchor}</span>
        <button type="button" onClick={() => setShowControls(!controlsOpen)} className={cn('ml-1 rounded p-1', controlsOpen ? 'text-ink' : 'text-muted-foreground')} title="Controls">
          <SlidersHorizontal size={13} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <Canvas key={tab} camera={camFor(tab)} dpr={[1, 2]}>
          <color attach="background" args={['#0b0f14']} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 5, 4]} intensity={0.8} />
          {tab === 'flame' && <GravityFlameScene g={p.g} o2={p.o2} flow={p.flow} />}
          {tab === 'smoke' && <SmokeModuleScene g={p.g} flow={p.flow} material={p.material} onReadout={(r, t) => setSmoke({ r, t })} />}
          {tab === 'spread' && <FlameSpreadScene o2={p.o2} psi={p.psi} g={p.g} flow={p.flow} material={p.material} />}
          {tab === 'droplet' && <DropletScene o2={p.o2} co2={p.co2 ?? 0} d0={p.diameter ?? 2.5} showCool={showCool} onState={setDrop} />}
          <OrbitControls enablePan={false} minDistance={2.5} maxDistance={14} />
          <EffectComposer>
            <Bloom intensity={tab === 'smoke' ? 0.6 : 1.3} luminanceThreshold={0.2} mipmapBlur />
          </EffectComposer>
        </Canvas>

        {driver && driver.sim === tab && (
          <div className="absolute left-2 top-2 border border-line flex items-center gap-1.5 rounded-md bg-surface/90 px-2 py-1 text-[11px]">
            <Bot size={12} className="text-ug" />
            <AgentTag handle={driver.by} /> <span className="text-muted-foreground">driving</span>
            {!compact && <span className="max-w-[240px] truncate">· {driver.label}</span>}
          </div>
        )}

        <div className={cn('pointer-events-none absolute bottom-2 left-2 flex max-h-[calc(100%-2.75rem)] flex-col justify-end gap-1.5 overflow-hidden', compact ? 'max-w-[min(260px,70%)]' : 'max-w-[60%]')}>
          <Metrics tab={tab} smoke={smoke} drop={drop} />
          {lastRun?.metrics && !compact && (
            <div className="rounded-md border border-ug/30 bg-surface/85 px-2 py-1.5">
              <div className="text-[11px] font-medium text-ug">Result · {lastRun.label}</div>
              <div className="mt-0.5 grid grid-cols-2 gap-x-3 text-[10.5px]">
                {Object.entries(lastRun.metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={cn('mono flex items-center gap-1 text-[9px] text-faint', compact && 'hidden')}>
            <Info size={9} /> engineering visualisation · illustrative model · calibrate with PSI datasets
          </div>
        </div>

        {controlsOpen && (
          <div className="scroll-thin absolute right-2 top-2 max-h-[calc(100%-1rem)] w-56 overflow-y-auto rounded-lg border border-line bg-surface/90 p-2.5 backdrop-blur">
            <Controls tab={tab} showCool={showCool} setShowCool={setShowCool} />
            {tab === 'spread' && <FlammabilityMap o2={p.o2} flow={p.flow} g={p.g} psi={p.psi} materialId={material.id} />}
          </div>
        )}
      </div>
    </div>
  )
}

function camFor(tab: SimKind) {
  switch (tab) {
    case 'flame':
      return { position: [0, 0.6, 5.2] as [number, number, number], fov: 45 }
    case 'smoke':
      return { position: [1.5, 3.2, 6.2] as [number, number, number], fov: 45 }
    case 'spread':
      return { position: [0, 2.6, 3.6] as [number, number, number], fov: 45 }
    case 'droplet':
      return { position: [0, 0.3, 3.4] as [number, number, number], fov: 45 }
  }
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-[10.5px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="mono">{value}</span>
      </div>
      {children}
    </div>
  )
}

function Controls({ tab, showCool, setShowCool }: { tab: SimKind; showCool: boolean; setShowCool: (b: boolean) => void }) {
  const p = useMission((s) => s.params)
  const set = useMission((s) => s.setParams)
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {Object.entries(ATMOS)
          .filter(([k]) => k !== 'suit' || tab === 'flame')
          .map(([k, a]) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ o2: a.o2, psi: a.psi })}
              className={cn('mono rounded border px-1.5 py-0.5 text-[9.5px]', Math.abs(p.o2 - a.o2) < 0.005 && Math.abs(p.psi - a.psi) < 0.05 ? 'border-ug/60 text-ug' : 'border-line text-muted-foreground hover:text-ink')}
            >
              {a.label}
            </button>
          ))}
      </div>
      <Row label="O₂ mole fraction" value={pct(p.o2, 1)}>
        <Slider min={0.12} max={1} step={0.005} value={[p.o2]} onValueChange={([v]) => set({ o2: v })} />
      </Row>
      <Row label="Pressure" value={`${p.psi.toFixed(1)} psia`}>
        <Slider min={3} max={16.7} step={0.1} value={[p.psi]} onValueChange={([v]) => set({ psi: v })} />
      </Row>
      {tab !== 'droplet' && (
        <Row label="Gravity" value={`${p.g.toFixed(3)} g`}>
          <div className="mb-1.5 flex gap-1">
            {Object.entries(GRAVITY).map(([k, g]) => (
              <button key={k} type="button" onClick={() => set({ g })} className={cn('mono flex-1 rounded border px-1 py-0.5 text-[9.5px] capitalize', Math.abs(p.g - g) < 0.001 ? 'border-ug/60 text-ug' : 'border-line text-muted-foreground hover:text-ink')}>
                {k === 'micro' ? 'µg' : k}
              </button>
            ))}
          </div>
          <Slider min={0} max={1} step={0.005} value={[p.g]} onValueChange={([v]) => set({ g: v })} />
        </Row>
      )}
      {tab !== 'droplet' && (
        <Row label={tab === 'smoke' ? 'Vent flow' : 'Forced flow'} value={`${p.flow.toFixed(0)} cm/s`}>
          <Slider min={0} max={60} step={1} value={[p.flow]} onValueChange={([v]) => set({ flow: v })} />
        </Row>
      )}
      {(tab === 'spread' || tab === 'smoke') && (
        <div className="mb-2.5">
          <div className="mb-1 text-[10.5px] text-muted-foreground">{tab === 'smoke' ? 'Overheating material' : 'Sample'}</div>
          <div className="flex flex-wrap gap-1">
            {Object.values(MATERIALS).map((m) => (
              <button key={m.id} type="button" onClick={() => set({ material: m.id })} title={m.note} className={cn('rounded border px-1.5 py-0.5 text-[10px]', p.material === m.id ? 'border-flame/60 text-flame' : 'border-line text-muted-foreground hover:text-ink')}>
                {m.label.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === 'droplet' && (
        <>
          <Row label="CO₂ diluent" value={pct(p.co2 ?? 0)}>
            <Slider min={0} max={0.6} step={0.01} value={[p.co2 ?? 0]} onValueChange={([v]) => set({ co2: v })} />
          </Row>
          <Row label="Initial diameter" value={`${(p.diameter ?? 2.5).toFixed(1)} mm`}>
            <Slider min={1} max={5} step={0.1} value={[p.diameter ?? 2.5]} onValueChange={([v]) => set({ diameter: v })} />
          </Row>
          <label className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <input type="checkbox" checked={showCool} onChange={(e) => setShowCool(e.target.checked)} />
            reveal invisible cool flame
          </label>
        </>
      )}
    </div>
  )
}

function Metric({ k, v, tone }: { k: string; v: string; tone?: 'bad' | 'good' | 'warn' }) {
  return (
    <div className="flex justify-between gap-3 text-[10.5px]">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn('mono', tone === 'bad' && 'text-k-fail', tone === 'good' && 'text-k-reply', tone === 'warn' && 'text-k-ask')}>{v}</span>
    </div>
  )
}

function Metrics({ tab, smoke, drop }: { tab: SimKind; smoke: { r: SmokeReadout; t: number } | null; drop: DropletState | null }) {
  const p = useMission((s) => s.params)
  const mat = MATERIALS[p.material] ?? MATERIALS.cotton
  let body: React.ReactNode = null
  if (tab === 'flame') {
    const f = flameShape(p.g, p.o2, p.flow)
    body = (
      <>
        <Metric k="shape" v={p.g < 0.02 ? 'sphere (diffusion)' : f.stretch < 2 ? 'squat teardrop' : 'teardrop'} />
        <Metric k="aspect ratio" v={f.stretch.toFixed(2)} />
        <Metric k="flicker" v={f.flickerHz < 0.1 ? 'none' : `${f.flickerHz.toFixed(1)} Hz`} />
        <Metric k="luminous soot" v={pct(f.soot)} />
        <Metric k="T ad (est.)" v={`${Math.round(f.tempK)} K`} tone={f.tempK > 2200 ? 'warn' : undefined} />
      </>
    )
  } else if (tab === 'spread') {
    const lim = limitingO2(p.flow, p.g, p.psi, mat)
    const v = spreadRate(p.o2, p.flow, p.g, p.psi, mat)
    const x = spreadVsEarth(p.o2, p.flow, p.g, p.psi, mat)
    body = (
      <>
        <Metric k="sample" v={mat.label} />
        <Metric k="limiting O₂" v={pct(lim, 1)} />
        <Metric k="verdict" v={v > 0 ? 'SUSTAINS FLAME' : 'self-extinguishes'} tone={v > 0 ? 'bad' : 'good'} />
        <Metric k="spread rate" v={`${v.toFixed(2)} mm/s`} />
        <Metric k="vs Earth cabin" v={x === Infinity ? 'burns here, not on Earth' : x === 0 ? '—' : `${x.toFixed(1)}×`} tone={x > 1.5 || x === Infinity ? 'bad' : undefined} />
      </>
    )
  } else if (tab === 'smoke') {
    body = (
      <>
        <Metric k="source" v={`${mat.label.split(' (')[0]} · median ${mat.smokeD} µm`} />
        <Metric k="sim time" v={smoke ? `${smoke.t.toFixed(0)} s (×${SMOKE_TIME_SCALE})` : '—'} />
        {DETECTORS.map((d) => {
          const r = smoke?.r[d.id]
          return <Metric key={d.id} k={d.label} v={r?.alarmAt != null ? `ALARM @ ${r.alarmAt.toFixed(0)} s` : `${Math.round((r?.level ?? 0) * 100)}%`} tone={r?.alarmAt != null ? 'bad' : undefined} />
        })}
      </>
    )
  } else {
    const m = droplet(p.o2, p.co2 ?? 0, p.diameter ?? 2.5)
    const need = 1 - 0.17 / p.o2
    body = (
      <>
        <Metric k="effective O₂" v={pct(m.xo2, 1)} />
        <Metric k="LOI (FLEX)" v={m.loi.toFixed(3)} />
        <Metric k="burning constant K" v={m.burns ? `${m.K.toFixed(2)} mm²/s` : '—'} />
        <Metric k="phase" v={drop?.phase === 'cool' ? 'COOL FLAME (invisible)' : drop?.phase === 'hot' ? 'hot flame' : m.burns ? '—' : 'extinguished'} tone={drop?.phase === 'cool' ? 'warn' : !m.burns ? 'good' : undefined} />
        <Metric k="CO₂ to extinguish" v={need > 0 ? pct(need) : '—'} tone={need > 0.35 ? 'bad' : undefined} />
      </>
    )
  }
  return <div className="rounded-md border border-line bg-surface/85 px-2 py-1.5 backdrop-blur">{body}</div>
}

/** Limiting O₂ vs forced flow for the chosen material: flammable above the curve. */
function FlammabilityMap({ o2, flow, g, psi, materialId }: { o2: number; flow: number; g: number; psi: number; materialId: string }) {
  const mat = MATERIALS[materialId]
  const W = 200
  const H = 120
  const x = (u: number) => 22 + (u / 60) * (W - 28)
  const y = (o: number) => H - 16 - ((o - 0.1) / 0.32) * (H - 24)
  const curve = (gg: number) =>
    Array.from({ length: 61 }, (_, u) => `${u === 0 ? 'M' : 'L'}${x(u).toFixed(1)},${y(Math.min(0.42, limitingO2(u, gg, psi, mat))).toFixed(1)}`).join(' ')
  const lines = [
    { o: 0.21, l: '21%' },
    { o: 0.34, l: '34%' },
  ]
  return (
    <div className="mt-2 border-t border-line pt-2">
      <div className="mono mb-1 text-[9px] uppercase tracking-widest text-faint">flammability map · {mat.label.split(' (')[0]}</div>
      <svg width={W} height={H} className="overflow-visible">
        <path d={`${curve(g)} L${x(60)},${y(0.42)} L${x(0)},${y(0.42)} Z`} fill="color-mix(in oklab, var(--flame) 14%, transparent)" />
        <path d={curve(0)} stroke="var(--ug)" strokeWidth={1} fill="none" strokeDasharray="3 2" opacity={0.7} />
        <path d={curve(1)} stroke="var(--muted)" strokeWidth={1} fill="none" strokeDasharray="3 2" opacity={0.7} />
        <path d={curve(g)} stroke="var(--flame)" strokeWidth={1.6} fill="none" />
        {lines.map((l) => (
          <g key={l.l}>
            <line x1={x(0)} x2={x(60)} y1={y(l.o)} y2={y(l.o)} stroke="var(--line-2)" strokeDasharray="2 3" />
            <text x={2} y={y(l.o) + 3} fontSize={8} fill="var(--muted)" className="mono">
              {l.l}
            </text>
          </g>
        ))}
        <circle cx={x(Math.min(60, flow))} cy={y(Math.min(0.42, o2))} r={3.5} fill="var(--ink)" stroke="var(--flame)" strokeWidth={1.5} />
        <text x={x(0)} y={H - 4} fontSize={8} fill="var(--muted)">
          0
        </text>
        <text x={x(60) - 26} y={H - 4} fontSize={8} fill="var(--muted)">
          60 cm/s
        </text>
        <text x={x(30) - 22} y={y(0.42) - 3} fontSize={8} fill="var(--flame)">
          burns
        </text>
      </svg>
      <div className="mono mt-0.5 flex gap-2 text-[8.5px] text-faint">
        <span className="text-flame">— current g</span>
        <span className="text-ug">-- µg</span>
        <span>-- 1 g</span>
      </div>
    </div>
  )
}
