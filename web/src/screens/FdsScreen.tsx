// FDS: the Apollo CM-012 cabin run in real NIST FDS 6.11, generated from the intake files (web/src/fds/toFds.ts),
// run on this machine (scripts/fds/run.sh) and read back here from its binary output. Input shows what FDS was
// given; Output plays what it computed; the cross-check puts it beside FIREFALL's quick models.
// Viewer readers are ported from fds-viewer (Prof Rino Lovreglio, Massey University, MIT licence).
import { Download, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { firstCrossing } from '@/fds/csv'
import { TimeChart } from '@/fds/charts'
import { FdsScene, type SliceView } from '@/fds/FdsScene'
import { FDS_BASE, useFdsManifest, useFdsRun, type FdsManifest } from '@/fds/load'
import { sliceRange } from '@/fds/slice'
import { OBSCURATION_ALARM, PA_PER_PSI, type FdsSummary } from '@/fds/summary'
import { FDS_MATERIALS } from '@/fds/toFds'
import { useQuickModels } from '@/fds/useQuickModels'
import { cn } from '@/lib/utils'

type Case = FdsManifest['cases'][number]
const fmt = (v: number | null | undefined, d = 1, u = ' s') => (v === null || v === undefined ? 'never' : `${v.toFixed(d)}${u}`)

export function FdsScreen() {
  const { manifest, agentRuns, error } = useFdsManifest()
  // ?run=<id> opens a run an agent started.
  const [caseId, setCaseId] = useState(() => new URLSearchParams(location.search).get('run') ?? '1g')
  const [mode, setMode] = useState<'input' | 'output'>('output')
  const c = manifest?.cases.find((x) => x.id === caseId) ?? agentRuns.find((x) => x.id === caseId) ?? manifest?.cases[0]
  const { run, error: runErr } = useFdsRun(c?.id, c?.chid, c?.dir)
  const [sliceIdx, setSliceIdx] = useState(0)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [layers, setLayers] = useState({ slice: true, smoke: true, fire: true })

  const slice = run?.slices[sliceIdx]
  const nFrames = slice?.frames.length ?? 1
  const time = slice?.times[Math.min(frame, nFrames - 1)] ?? 0
  const ranges = useMemo(() => run?.slices.map((s) => (s.quantity === 'TEMPERATURE' ? ([20, Math.max(200, Math.min(900, sliceRange(s)[1]))] as [number, number]) : ([0, sliceRange(s)[1] || 1] as [number, number]))) ?? [], [run])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setFrame((f) => (f + 1 >= nFrames ? (setPlaying(false), f) : f + 1)), 180)
    return () => clearInterval(t)
  }, [playing, nFrames])
  useEffect(() => setFrame(0), [caseId])

  const alarmed = useMemo(() => {
    const s = new Set<string>()
    if (!run || mode !== 'output') return s
    for (const d of run.input.devcs.filter((x) => x.prop)) {
      const a = firstCrossing(run.devc.cols.Time, run.devc.cols[d.id] ?? [], OBSCURATION_ALARM)
      if (a !== undefined && a <= time) s.add(d.id)
    }
    return s
  }, [run, time, mode])

  const view: SliceView | undefined = slice && layers.slice ? { slice, frame, range: ranges[sliceIdx], map: slice.quantity === 'TEMPERATURE' ? 'heat' : 'soot' } : undefined

  if (error) return <Missing text={`No FDS run shipped yet (${error}). Run scripts/fds/run.sh.`} />
  if (!manifest || !c) return <Missing text="loading FDS runs…" />

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2">
          <div>
            <div className="label text-ug">fds · {manifest.fds}</div>
            <div className="sans text-[15px] font-semibold text-ink">Apollo CM-012 in real NIST FDS</div>
          </div>
          <Seg value={c.id} onChange={setCaseId} options={manifest.cases.map((x) => ({ id: x.id, label: x.label }))} />
          {agentRuns.length > 0 && (
            <select
              value={c.dir ? c.id : ''}
              onChange={(e) => e.target.value && setCaseId(e.target.value)}
              aria-label="runs started by agents"
              className={cn('rounded-sm border bg-bg px-1.5 py-1 text-[11px] outline-none', c.dir ? 'border-ug/60 text-ink' : 'border-line text-muted-foreground')}
            >
              <option value="">agent runs ({agentRuns.length})</option>
              {[...agentRuns].reverse().map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          )}
          <Seg value={mode} onChange={(v) => setMode(v as 'input' | 'output')} options={[{ id: 'input', label: 'Input' }, { id: 'output', label: 'Output' }]} />
          {mode === 'output' && run && (
            <div className="flex items-center gap-2 text-[10.5px]">
              {run.slices.map((s, i) => (
                <button key={s.file} type="button" onClick={() => setSliceIdx(i)} className={cn('rounded-sm border px-1.5 py-0.5', i === sliceIdx ? 'border-ug/60 text-ink' : 'border-line text-muted-foreground hover:text-ink')}>
                  {sliceName(run.input.slcfs[i], s.quantity)}
                </button>
              ))}
              {(['slice', 'smoke', 'fire'] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-muted-foreground">
                  <input type="checkbox" checked={layers[k]} onChange={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} />
                  {k === 'smoke' ? 'soot 3-D' : k === 'fire' ? 'flame 3-D' : 'slice'}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          {run ? (
            <FdsScene input={run.input} mode={mode} slice={view} smoke={layers.smoke ? run.smoke : undefined} fire={layers.fire ? run.fire : undefined} time={time} alarmed={alarmed} />
          ) : (
            <Missing text={runErr ?? `loading ${c.chid} (slices, Smoke3D, CSVs)…`} />
          )}
          {run && mode === 'output' && (
            <div className="pointer-events-none absolute left-3 top-3 flex gap-5 font-mono text-[11px]">
              <Readout label="time" value={`T+${time.toFixed(1)} s`} />
              <Readout label="hrr" value={`${at(run.hrr.cols.Time, run.hrr.cols.HRR, time).toFixed(0)} kW`} color="#ff7a3d" />
              <Readout label="cabin" value={`${(at(run.devc.cols.Time, run.devc.cols.P_cabin, time) / PA_PER_PSI).toFixed(2)} psia`} />
              <Readout label="alarms" value={alarmed.size ? [...alarmed].join(' ') : '—'} color={alarmed.size ? '#ff4d4d' : undefined} />
            </div>
          )}
          {run && mode === 'output' && view && <Legend view={view} />}
          {run && mode === 'input' && <InputLegend run={run} />}
        </div>
        {run && mode === 'output' && (
          <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px]">
            <button type="button" onClick={() => (frame >= nFrames - 1 ? (setFrame(0), setPlaying(true)) : setPlaying(!playing))} className="text-ink" title="play">
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <input type="range" min={0} max={nFrames - 1} value={frame} onChange={(e) => (setPlaying(false), setFrame(Number(e.target.value)))} className="flex-1 accent-[var(--ug)]" />
            <span className="tnum w-24 text-right text-muted-foreground">
              {time.toFixed(1)} / {(slice?.times.at(-1) ?? 0).toFixed(0)} s
            </span>
          </div>
        )}
      </div>
      <aside className="scroll-thin w-[440px] shrink-0 space-y-3 overflow-y-auto border-l border-line p-3">
        <RunCard c={c} manifest={manifest} />
        {run && mode === 'output' && <Charts run={run} c={c} time={time} />}
        <CrossCheck manifest={manifest} />
        {run && mode === 'input' && <SourceCard text={run.source} url={`${FDS_BASE}/${c.id}/${c.chid}.fds`} chid={c.chid} />}
        {mode === 'input' && <SurfCard c={c} />}
      </aside>
    </div>
  )
}

const sliceName = (p: Record<string, unknown> | undefined, q: string) => {
  const where = p?.PBY !== undefined ? `y=${p.PBY}` : p?.PBZ !== undefined ? `z=${p.PBZ}` : p?.PBX !== undefined ? `x=${p.PBX}` : ''
  return `${q === 'TEMPERATURE' ? 'temperature' : 'soot'} ${where}`
}

function at(t: number[], y: number[] | undefined, x: number) {
  if (!y?.length) return 0
  let i = 0
  while (i < t.length - 1 && t[i + 1] <= x) i++
  return y[i]
}

function Missing({ text }: { text: string }) {
  return <div className="flex h-full flex-1 items-center justify-center p-8 text-[12px] text-muted-foreground">{text}</div>
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <nav className="flex rounded-sm border border-line text-[10.5px]">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className={cn('px-2 py-0.5', value === o.id ? 'bg-surface-2 text-ink' : 'text-muted-foreground hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </nav>
  )
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="text-[15px]" style={{ color: color ?? 'var(--ink)' }}>
        {value}
      </div>
    </div>
  )
}

function Legend({ view }: { view: SliceView }) {
  const [lo, hi] = view.range
  const heat = view.map === 'heat'
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 w-56 rounded-sm border border-line bg-bg/80 p-2 text-[10px]">
      <div className="text-muted-foreground">{heat ? 'gas temperature, °C' : 'soot density, mg/m³'}</div>
      <div className="mt-1 h-2 rounded-sm" style={{ background: heat ? 'linear-gradient(90deg,#0a081e,#5a146e,#c83246,#fa8c14,#fcf0a0)' : 'linear-gradient(90deg,transparent,#b4bac4)' }} />
      <div className="mt-0.5 flex justify-between text-faint">
        <span>{heat ? lo.toFixed(0) : '0'}</span>
        <span>{heat ? hi.toFixed(0) : (hi * 1e6).toFixed(0)}</span>
      </div>
    </div>
  )
}

function InputLegend({ run }: { run: NonNullable<ReturnType<typeof useFdsRun>['run']> }) {
  const hull = run.input.obsts.filter((o) => o.surf === 'HULL').length
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-sm border border-line bg-bg/80 p-2 text-[10.5px] text-muted-foreground">
      <div>
        <span className="text-ink">{run.input.obsts.length}</span> &OBST · {hull} hull blocks (front half cut away) · {run.input.obsts.length - hull} parts
      </div>
      <div>
        <span style={{ color: '#ff3030' }}>■</span> burner &VENT · <span className="text-ink">■</span> detectors · <span className="text-ug">□</span> mesh
      </div>
    </div>
  )
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <h3 className="label text-ink">{title}</h3>
        <span className="ml-auto">{right}</span>
      </header>
      <div className="p-3 text-[11.5px]">{children}</div>
    </section>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-32 shrink-0 text-faint">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  )
}

function RunCard({ c, manifest }: { c: Case; manifest: FdsManifest }) {
  return (
    <Card title="the run" right={<span className="text-[10px] text-ok">STOP: FDS completed successfully</span>}>
      <Row k="solver" v={manifest.fds} />
      <Row k="mesh" v={`${c.ijk.join(' × ')} = ${c.cells.toLocaleString()} cells · ${c.dx * 100} cm`} />
      <Row k="simulated" v={`${c.t_end.toFixed(0)} s in ${c.steps} steps`} />
      <Row k="wall clock" v={c.dir ? `${c.runtime_s} s on this machine` : `${c.runtime_s} s on ${manifest.machine}`} />
      {c.params && <Row k="atmosphere" v={`${Math.round(c.params.o2 * 100)} % O₂ · ${c.params.psia} psia`} />}
      {c.started && <Row k="started" v={`by a tool call · ${new Date(c.started).toLocaleString()}`} />}
      <Row k="gravity" v={c.g ? `${c.g} g (GVEC 0, 0, −9.81)` : 'µg (GVEC 0, 0, 0)'} />
      <Row k="ignition" v={`${c.burner.kw} kW burner until ${c.burner.offAt} s${c.burner.under ? `, under ${c.burner.under.toLowerCase()}` : ''}`} />
      <div className="mt-2 text-[10.5px] leading-snug text-muted-foreground">
        Generated from cabin.yaml, materials.csv and cabin.model.json. FDS solved the flow, combustion, radiation and pressure; nothing here is scripted.
      </div>
    </Card>
  )
}

function Charts({ run, c, time }: { run: NonNullable<ReturnType<typeof useFdsRun>['run']>; c: Case; time: number }) {
  const s = c.summary
  const td = run.devc.cols.Time
  const dets = run.input.devcs.filter((d) => d.prop)
  const colors = ['#5aa9ff', '#c9a2ff', '#7ee787']
  return (
    <>
      <Card title="heat release rate" right={<span className="text-[10.5px] text-flame">peak {s.peakHrrKw.toFixed(0)} kW at {s.peakHrrAt.toFixed(0)} s</span>}>
        <TimeChart series={[{ label: 'HRR kW', t: run.hrr.cols.Time, y: run.hrr.cols.HRR, color: '#ff7a3d' }]} markers={[{ y: c.burner.kw, label: `burner ${c.burner.kw} kW`, color: '#4a5665' }]} yLabel="kW" time={time} />
        <div className="text-[10.5px] text-muted-foreground">{s.spreadAt !== null ? `Fire outgrows the burner at ${s.spreadAt.toFixed(1)} s: the ${c.burner.under?.toLowerCase() ?? 'nearest item'} has caught.` : 'The fire never grows past the burner: nothing else catches in this run.'}</div>
      </Card>
      <Card title="cabin pressure" right={<span className="text-[10.5px] text-muted-foreground">peak {s.peakPsia.toFixed(2)} psia</span>}>
        <TimeChart series={[{ label: 'P cabin psia', t: td, y: run.devc.cols.P_cabin.map((v) => v / PA_PER_PSI), color: '#ffb547' }]} markers={[{ y: 29, label: 'hull burst 29 psia', color: '#ff6b6b' }]} yMin={14} yMax={31} yLabel="psia" time={time} />
        <div className="text-[10.5px] text-muted-foreground">{s.burstAt !== null ? `Passes hull burst at ${s.burstAt.toFixed(1)} s.` : `Rises ${(s.peakPsia - s.startPsia).toFixed(2)} psi; stays below hull burst within ${s.tEnd.toFixed(0)} s.`}</div>
      </Card>
      <Card title="detectors · chamber obscuration">
        <TimeChart
          series={dets.map((d, i) => ({ label: `${d.id} ${d.prop}`, t: td, y: run.devc.cols[d.id] ?? [], color: colors[i % 3] }))}
          markers={[{ y: OBSCURATION_ALARM, label: `alarm ${OBSCURATION_ALARM} %/m`, color: '#ff6b6b' }]}
          yLabel="%/m"
          time={time}
        />
        <div className="flex gap-4 text-[10.5px]">
          {dets.map((d) => (
            <span key={d.id} className={s.alarms[d.id] === null ? 'text-bad' : 'text-ok'}>
              {d.id} alarms {fmt(s.alarms[d.id])}
            </span>
          ))}
        </div>
      </Card>
    </>
  )
}

/** FDS against FIREFALL's quick models: where they agree and where they do not is the point. */
function CrossCheck({ manifest }: { manifest: FdsManifest }) {
  const q = useQuickModels()
  const by = (id: string) => manifest.cases.find((x) => x.id === id)?.summary
  const g1 = by('1g'), ug = by('ug')
  const rows: { what: string; fds: string; quick: string; note: string }[] = []
  if (g1 && ug) {
    rows.push(
      { what: 'fire spreads, 1 g', fds: g1.spreadAt !== null ? `yes, ${g1.spreadAt.toFixed(0)} s` : 'no', quick: q ? (q.g1.burning > 1 ? `yes, ${q.g1.burning} zones` : 'no') : '…', note: 'FDS heats the net until it ignites; the quick model assumes a front speed.' },
      { what: 'fire spreads, µg', fds: ug.spreadAt !== null ? `yes, ${ug.spreadAt.toFixed(0)} s` : 'no', quick: q ? (q.ug.burning > 1 ? `yes, ${q.ug.burning} zones` : 'no') : '…', note: 'Without buoyancy the burner flame is small and slow (BASS / Saffire); FDS shows it starving.' },
      { what: 'peak pressure, 1 g', fds: `${g1.peakPsia.toFixed(1)} psia`, quick: q ? `${q.g1.peakPsia.toFixed(1)} psia` : '…', note: 'FDS burns air cone data; real 100 % O₂ burning is faster, so FDS is a lower bound.' },
      { what: 'hull rupture (29 psia)', fds: g1.burstAt !== null ? `${g1.burstAt.toFixed(0)} s` : `not in ${g1.tEnd.toFixed(0)} s`, quick: q ? fmt(q.g1.rupture ?? null, 0) : '…', note: 'Review Board: about 15 s after the first call. Our quick model is tuned to that; FDS is not.' },
      ...Object.keys(g1.alarms).map((d) => ({
        what: `${d} first alarm, 1 g`,
        fds: fmt(g1.alarms[d], 0),
        quick: q?.alarms1g ? fmt(q.alarms1g[d] ?? null, 0) : '…',
        note: d === 'D2' ? 'FDS sees soot mass only; the quick model also asks if a photoelectric head can see 0.18 µm PTFE smoke.' : 'Ceiling ionization head: both put it among the first to see smoke.',
      })),
      { what: 'any alarm, µg', fds: Object.values(ug.alarms).some((a) => a !== null) ? 'yes' : `none in ${ug.tEnd.toFixed(0)} s`, quick: q?.alarmsUg ? (Object.values(q.alarmsUg).some((a) => a !== null) ? 'yes' : 'none') : '…', note: 'No buoyant plume carries smoke to the detectors in orbit.' },
    )
  }
  return (
    <Card title="cross-check · FDS vs FIREFALL quick models">
      <table className="w-full text-[10.5px]">
        <thead className="text-left text-faint">
          <tr className="border-b border-line">
            <th className="py-1 font-normal">what</th>
            <th className="font-normal">FDS</th>
            <th className="font-normal">quick model</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what} className="border-b border-line/50 align-top" title={r.note}>
              <td className="py-1 pr-2 text-muted-foreground">{r.what}</td>
              <td className="tnum pr-2 text-ink">{r.fds}</td>
              <td className="tnum text-ink">{r.quick}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 space-y-1 text-[10.5px] leading-snug text-muted-foreground">
        {rows.map((r) => (
          <li key={r.what}>
            <span className="text-faint">{r.what}:</span> {r.note}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function SourceCard({ text, url, chid }: { text: string; url: string; chid: string }) {
  const lines = text.split('\n')
  // Collapse the ~1000 hull blocks so the interesting records are visible.
  const shown: string[] = []
  let hull = 0
  for (const l of lines) {
    if (/SURF_ID='HULL'/.test(l) && l.startsWith('&OBST')) {
      if (hull++ === 2) shown.push(`… ${'{hull}'}`)
      if (hull > 2) continue
    }
    shown.push(l)
  }
  return (
    <Card
      title={`${chid}.fds`}
      right={
        <a href={url} download className="flex items-center gap-1 text-[10.5px] text-ug hover:underline">
          <Download size={11} /> download .fds · rerun it yourself
        </a>
      }
    >
      <pre className="scroll-thin max-h-[420px] overflow-auto whitespace-pre text-[10px] leading-[1.45]">
        {shown.map((l, i) => (
          <div key={i}>{l === '… {hull}' ? <span className="text-faint">… {hull - 2} more hull &OBST blocks …</span> : <Hl line={l} />}</div>
        ))}
      </pre>
    </Card>
  )
}

function Hl({ line }: { line: string }) {
  const m = /^(\s*)&(\w+)(.*?)(\/)(.*)$/.exec(line)
  if (!m) return <span className="text-faint">{line || ' '}</span>
  const parts = m[3].split(/('[^']*')/)
  return (
    <span>
      {m[1]}
      <span className="text-k-review">&amp;{m[2]}</span>
      {parts.map((p, i) =>
        p.startsWith("'") ? (
          <span key={i} className="text-k-reply">
            {p}
          </span>
        ) : (
          <span key={i} className="text-ink">
            {p.split(/([A-Z_]+(?:\(\d+\))?=)/).map((x, j) => (x.endsWith('=') ? <span key={j} className="text-k-task">{x}</span> : x))}
          </span>
        ),
      )}
      <span className="text-k-review">{m[4]}</span>
      <span className="text-faint">{m[5]}</span>
    </span>
  )
}

function SurfCard({ c }: { c: Case }) {
  return (
    <Card title="surfaces · what each material does in FDS">
      <table className="w-full text-[10.5px]">
        <thead className="text-left text-faint">
          <tr className="border-b border-line">
            <th className="py-1 font-normal">zone</th>
            <th className="font-normal">&SURF</th>
            <th className="font-normal">HRRPUA</th>
            <th className="font-normal">ignites at</th>
          </tr>
        </thead>
        <tbody>
          {c.surfs.map((s) => (
            <tr key={s.zone} className="border-b border-line/50">
              <td className="py-1 text-muted-foreground">{s.zone}</td>
              <td className="text-ink">{s.id}</td>
              <td className="tnum">{s.hrrpua} kW/m²</td>
              <td className="tnum">{s.ignitionC} °C</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] leading-snug text-faint">{FDS_MATERIALS.nylon?.ref}. Air values: in 100 % O₂ real items ignite sooner and burn harder, so this run under-predicts the fire.</div>
    </Card>
  )
}

export type { FdsSummary }
