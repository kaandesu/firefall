// LIBRARY: every dataset the review can draw on (the PSI archive's 20 studies), how well each one covers this cabin,
// and, for the ACME studies, the real test data opened right here: camera frames, brightness, sensor channels and
// the chamber test points.
import { Database, FileStack, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CiteChip } from '@/components/bits'
import { loadSensors, sensorStats, type SensorLog } from '@/data/acme'
import { STUDIES, fit, targetOf, type Pillar, type Study } from '@/data/library'
import { BrightnessChart, FrameCanvas, useAcmeFrames } from '@/lab/tiles'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'
import { TestpointScatter, useEvidenceRows } from './EvidenceScreen'

const PILLARS: (Pillar | 'all')[] = ['all', 'prevention', 'detection', 'suppression', 'supporting']
const PILLAR_COLOR: Record<Pillar, string> = { prevention: 'var(--flame)', detection: 'var(--k-ask)', suppression: 'var(--k-task)', supporting: 'var(--muted)' }
const pct = (v: number) => `${Math.round(v * 100)} %`

export function LibraryScreen() {
  const pkg = useMission((s) => s.pkg)
  const jobs = useMission((s) => s.model.jobs)
  const target = targetOf(pkg?.atmosphere.o2 ?? 1, pkg?.atmosphere.psi ?? 16.7)
  const [pillar, setPillar] = useState<Pillar | 'all'>('all')
  const [onlyData, setOnlyData] = useState(false)
  const [qtext, setQ] = useState('')
  const [open, setOpen] = useState<string>()
  const rows = useMemo(
    () =>
      STUDIES.map((s) => fit(s, target))
        .filter((f) => (pillar === 'all' || f.study.pillars.includes(pillar)) && (!onlyData || f.study.status === 'ingested') && `${f.study.name} ${f.study.psi} ${f.study.hw} ${f.study.plain}`.toLowerCase().includes(qtext.toLowerCase()))
        .sort((a, b) => b.total - a.total),
    [pillar, onlyData, qtext, target.o2, target.kpa], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const sel = STUDIES.find((s) => s.id === open)
  // Which datasets the agents actually processed in this review.
  const used = (s: Study) => jobs.some((j) => j.done && (j.dataset.includes(s.name.split(' ')[0]) || (s.psi && j.dataset.includes(s.psi))))
  const total = STUDIES.reduce((a, s) => a + parseFloat(s.size), 0)

  return (
    <div className="flex min-h-0 flex-1">
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-end gap-4">
          <div>
            <div className="label text-ug">library · PSI archive, held by NASA PSI</div>
            <h1 className="sans mt-1 text-headline font-medium text-ink">{STUDIES.length} microgravity combustion studies · ≈ {Math.round(total)} GB</h1>
            <div className="mt-1 text-body text-muted-foreground">
              Ranked by how well each one covers this cabin ({pct(target.o2)} O₂ · {(target.kpa / 6.894757).toFixed(1)} psia). The Archivist reads them on its own cluster; other agents ask it instead of downloading.
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-body">
          {PILLARS.map((p) => (
            <button key={p} type="button" onClick={() => setPillar(p)} className={cn('rounded-sm border px-2 py-0.5', pillar === p ? 'border-ug/60 bg-ug/10 text-ink' : 'border-line-2 text-muted-foreground hover:text-ink')}>
              {p}
            </button>
          ))}
          <button type="button" onClick={() => setOnlyData((v) => !v)} className={cn('rounded-sm border px-2 py-0.5', onlyData ? 'border-ok/60 bg-ok/10 text-ok' : 'border-line-2 text-muted-foreground hover:text-ink')}>
            ingested only
          </button>
          <label className="ml-auto flex items-center gap-1.5 rounded-sm border border-line-2 px-2 py-0.5">
            <Search size={11} className="text-faint" />
            <input value={qtext} onChange={(e) => setQ(e.target.value)} placeholder="search studies" className="w-44 bg-transparent text-ink outline-none placeholder:text-faint" />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-3">
          {rows.map((f) => {
            const s = f.study
            return (
              <button key={s.id} type="button" onClick={() => setOpen(s.id)} className={cn('flex flex-col gap-1.5 rounded-sm border bg-surface-2 p-3 text-left transition hover:border-ug/60', open === s.id ? 'border-ug/70' : 'border-line')}>
                <div className="flex items-center gap-2 text-body">
                  {s.psi && <span className="text-ug">{s.psi}</span>}
                  <span className="text-faint">{s.hw}</span>
                  <span className="ml-auto flex gap-1">
                    {s.pillars.map((p) => (
                      <span key={p} className="size-1.5 rounded-full" style={{ background: PILLAR_COLOR[p] }} title={p} />
                    ))}
                  </span>
                </div>
                <div className="sans text-emph font-medium leading-tight text-ink">{s.name}</div>
                <div className="sans line-clamp-2 text-body leading-snug text-muted-foreground">{s.plain}</div>
                <div className="mt-auto flex items-center gap-2 pt-1 text-label">
                  <span className="text-faint">{s.size}</span>
                  <span className={s.status === 'ingested' ? 'text-ok' : 'text-faint'}>{s.status}</span>
                  {s.data && <span className="rounded-sm border border-k-ask/50 px-1 text-k-ask">real data</span>}
                  {used(s) && <span className="text-k-task">used in this review</span>}
                  <span className="ml-auto text-faint">fit</span>
                  <div className="h-1 w-14 rounded bg-surface-3">
                    <div className="h-full rounded bg-ug" style={{ width: `${f.total * 100}%` }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      {sel && <StudyDrawer study={sel} target={target} onClose={() => setOpen(undefined)} />}
    </div>
  )
}

function StudyDrawer({ study, target, onClose }: { study: Study; target: ReturnType<typeof targetOf>; onClose: () => void }) {
  const f = fit(study, target)
  const [tab, setTab] = useState<'about' | 'data'>(study.data ? 'data' : 'about')
  useEffect(() => setTab(study.data ? 'data' : 'about'), [study.id, study.data])
  return (
    <aside className="scroll-thin flex w-[520px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-body">
            {study.psi && <CiteChip id={study.psi} />}
            <span className="text-faint">
              {study.hw} · {study.years}
            </span>
          </div>
          <div className="sans mt-1 text-title font-medium text-ink">{study.name}</div>
        </div>
        <button type="button" onClick={onClose} className="ml-auto text-faint hover:text-ink">
          <X size={14} />
        </button>
      </header>
      {study.data && (
        <div className="flex gap-1 border-b border-line px-4 py-1.5 text-body">
          {(['data', 'about'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn('rounded-sm px-2 py-0.5', tab === t ? 'bg-surface-2 text-ink' : 'text-muted-foreground hover:text-ink')}>
              {t === 'data' ? 'open test data' : 'about'}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-4 px-4 py-3">
        {tab === 'about' || !study.data ? (
          <>
            <p className="sans text-emph leading-snug text-ink">{study.obj}</p>
            <div className="rounded-sm border-l-2 border-ok bg-surface-2 px-3 py-2">
              <div className="label text-ok">key finding</div>
              <div className="sans mt-0.5 text-emph leading-snug text-ink">{study.key}</div>
            </div>
            <div className="space-y-1.5 text-body">
              <Row k="varied" v={study.varied} />
              <Row k="held fixed" v={study.fixed} />
              <Row k="sensors" v={study.sensors} />
              <Row k="O₂ range" v={`${pct(study.o2[0])} – ${pct(study.o2[1])}`} />
              <Row k="pressure" v={`${study.kpa[0]} – ${study.kpa[1]} kPa`} />
              <Row k="flow" v={study.flow} />
              <Row k="on storage" v={`${study.size}${study.files ? ` · ${study.files} files` : ''} · ${study.status}`} />
            </div>
            <div>
              <div className="label mb-1.5">fit to this cabin · {f.total.toFixed(2)}</div>
              {Object.entries(f.parts).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-body">
                  <span className="w-24 text-faint">{k}</span>
                  <div className="h-1 flex-1 rounded bg-surface-3">
                    <div className="h-full rounded bg-ug" style={{ width: `${v * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-muted-foreground tnum">{v.toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-1.5 text-label text-muted-foreground">{f.why}</div>
            </div>
          </>
        ) : study.data === 'acme-cfi-g' ? (
          <CfigData />
        ) : (
          <FlameDesignData target={target} />
        )}
      </div>
    </aside>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-faint">{k}</span>
      <span className="sans text-ink">{v}</span>
    </div>
  )
}

/** ACME CFI-G test 21256C2: scrub the intensified-camera frames against the brightness series. */
function CfigData() {
  const d = useAcmeFrames()
  const [i, setI] = useState(0)
  if (!d) return <div className="text-faint">loading 21256C2…</div>
  const b = d.f.burst[Math.min(i, d.f.burst.length - 1)]
  const near = d.ev.reduce((a, e) => (Math.abs(e.t - b.t_s) < Math.abs(a.t - b.t_s) ? e : a), d.ev[0])
  return (
    <>
      <div className="flex items-center gap-2 text-body">
        <FileStack size={12} className="text-k-ask" />
        <span className="text-ink">test 21256C2 · {d.f.camera}</span>
        <span className="text-faint">
          {d.f.frames_total} frames · σ {d.f.noise_sigma}
        </span>
      </div>
      <FrameCanvas src={b.src} className="w-full rounded-sm border border-line" />
      <div className="flex items-center gap-2 text-body">
        <input type="range" min={0} max={d.f.burst.length - 1} value={i} onChange={(e) => setI(+e.target.value)} className="flex-1 accent-[var(--ug)]" />
        <span className="w-28 text-right text-ink tnum">
          frame {b.frame} · T+{b.t_s.toFixed(1)} s
        </span>
      </div>
      <div className="text-body text-muted-foreground">
        sum above background {b.sum.toLocaleString()} · lit blocks {b.lit} · nearest event <span className="text-k-ask">{near?.label}</span>
      </div>
      <div className="rounded-sm border border-line bg-viewport p-2">
        <BrightnessChart f={d.f} ev={d.ev} upTo={72} h={90} w={480} cursor={b.t_s} />
      </div>
      <div className="space-y-1">
        <div className="label">events found from the series (no hand-picked times)</div>
        {d.ev.map((e) => (
          <div key={e.id} className="flex gap-2 text-body">
            <span className="w-16 text-faint tnum">T+{e.t.toFixed(2)}</span>
            <span className="w-28 text-k-ask">{e.label}</span>
            <span className="text-muted-foreground">{e.note}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** ACME Flame Design: the 19175A4 sensor log, and every chamber test point against this cabin. */
function FlameDesignData({ target }: { target: ReturnType<typeof targetOf> }) {
  const [log, setLog] = useState<SensorLog>()
  const rows = useEvidenceRows()
  useEffect(() => {
    void loadSensors().then(setLog)
  }, [])
  const st = log ? sensorStats(log) : undefined
  return (
    <>
      <div className="flex items-center gap-2 text-body">
        <Database size={12} className="text-k-ask" />
        <span className="text-ink">test 19175A4 · sensor channels</span>
        {log && (
          <span className="text-faint">
            {log.date} · {log.rate_hz} Hz · {log.t.length} samples
          </span>
        )}
      </div>
      {log && st && (
        <div className="space-y-0.5 rounded-sm border border-line bg-viewport p-2">
          {log.channels.map((c, k) => (
            <Channel key={c} name={c} t={log.t} v={log.v[k]} marks={[st.fuelOn, st.ignition, st.fuelOff]} />
          ))}
          <div className="flex justify-between pt-1 text-label text-faint">
            <span>fuel on {st.fuelOn?.toFixed(1)} s · ignition {st.ignition?.toFixed(1)} s · fuel off {st.fuelOff?.toFixed(1)} s</span>
            <span>burn {st.burn?.toFixed(1)} s</span>
          </div>
        </div>
      )}
      <div>
        <div className="label mb-1">{rows.length} test points · O₂ vs pressure · the cabin is the white cross</div>
        <TestpointScatter rows={rows} target={target} h={220} />
      </div>
    </>
  )
}

function Channel({ name, t, v, marks }: { name: string; t: number[]; v: number[]; marks: (number | undefined)[] }) {
  const W = 360
  const H = 18
  const lo = Math.min(...v)
  const hi = Math.max(...v)
  const t0 = t[0]
  const t1 = t[t.length - 1]
  const X = (x: number) => ((x - t0) / (t1 - t0)) * W
  const pts = v.map((y, i) => `${X(t[i]).toFixed(1)},${(H - ((y - lo) / (hi - lo || 1)) * H).toFixed(1)}`).join(' ')
  return (
    <div className="flex items-center gap-2">
      <span className="w-[120px] shrink-0 truncate text-label text-muted-foreground">{name}</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[18px] flex-1" preserveAspectRatio="none">
        {marks.map((m, i) => m !== undefined && <line key={i} x1={X(m)} x2={X(m)} y1={0} y2={H} stroke="var(--orange)" strokeWidth={0.6} strokeDasharray="2 2" />)}
        <polyline points={pts} fill="none" stroke="var(--navy)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="w-14 shrink-0 text-right text-label text-faint tnum">{hi.toPrecision(3)}</span>
    </div>
  )
}
