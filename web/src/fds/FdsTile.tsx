// Lab tile for the FDS job: the same 3-D view as the FDS tab (geometry, temperature slice, Smoke3D soot and flame),
// advancing with the job while it runs, then looping the 30 s run. 1 g / µg switch; "open" jumps to the FDS tab.
import { useEffect, useMemo, useState } from 'react'
import { useMission } from '@/live/store'
import type { Job } from '@/live/types'
import { cn } from '@/lib/utils'
import { firstCrossing } from './csv'
import { FdsScene, type SliceView } from './FdsScene'
import { loadRun, type FdsRun } from './load'
import { fdsCase } from './manifest'
import { sliceRange } from './slice'
import { OBSCURATION_ALARM, PA_PER_PSI } from './summary'

export function FdsTile({ job, live = true }: { job: Job; live?: boolean }) {
  const [caseId, setCaseId] = useState<'1g' | 'ug'>('1g')
  // A run an agent started (job.params.run): its files appear in /data/fds/runs/<id>/ when FDS finishes.
  const own = typeof job.params?.run === 'string' ? job.params.run : undefined
  const [mine, setMine] = useState<{ id: string; chid: string; dir: string; cells: number; g: number }>()
  useEffect(() => {
    if (!own || !job.done) return
    void fetch(`/data/fds/runs/${own}/run.json`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then(setMine, () => undefined)
  }, [own, job.done])
  const c = own ? mine : fdsCase(caseId)
  const setView = useMission((s) => s.setView)
  const [run, setRun] = useState<FdsRun>()
  useEffect(() => {
    if (c) void loadRun(c.id, c.chid, mine?.dir).then(setRun, () => undefined)
  }, [c, mine])
  const slice = run?.slices.find((s) => s.quantity === 'TEMPERATURE' && s.dims[1] === 1)
  const last = slice ? slice.frames.length - 1 : 0
  // While the job runs, its progress drives the frame; afterwards the run loops.
  // Start the loop on the last frame (the result), hold it, then play the run again.
  const [loop, setLoop] = useState(0)
  useEffect(() => setLoop(last), [job.done, last])
  useEffect(() => {
    if (!job.done || !live || !last) return
    const t = setInterval(() => setLoop((f) => (f >= last + 10 ? 0 : f + 1)), 220)
    return () => clearInterval(t)
  }, [job.done, live, last])
  const n = slice ? (job.done ? Math.min(last, loop) : Math.min(last, Math.floor(job.progress * last))) : 0
  const t = slice?.times[n] ?? 0
  const range = useMemo(() => (slice ? ([20, Math.max(200, Math.min(900, sliceRange(slice)[1]))] as [number, number]) : ([20, 900] as [number, number])), [slice])
  const view: SliceView | undefined = slice ? { slice, frame: n, range, map: 'heat' } : undefined
  const alarmed = useMemo(() => {
    const s = new Set<string>()
    if (!run) return s
    for (const d of run.input.devcs.filter((x) => x.prop)) {
      const a = firstCrossing(run.devc.cols.Time, run.devc.cols[d.id] ?? [], OBSCURATION_ALARM)
      if (a !== undefined && a <= t) s.add(d.id)
    }
    return s
  }, [run, t])
  const at = (tt: number[], y: number[] | undefined) => {
    if (!y) return 0
    let i = 0
    while (i < tt.length - 1 && tt[i + 1] <= t) i++
    return y[i]
  }
  const psia = run ? at(run.devc.cols.Time, run.devc.cols.P_cabin) / PA_PER_PSI : 0
  return (
    <div className="relative h-full min-h-0">
      {run && run.id === (own ?? caseId) ? (
        <FdsScene input={run.input} mode="output" slice={view} smoke={run.smoke} fire={run.fire} time={t} alarmed={alarmed} compact />
      ) : (
        <div className="flex h-full items-center justify-center text-[10.5px] text-faint">{own && !job.done ? `FDS is solving ${own} on this machine…` : 'loading FDS output…'}</div>
      )}
      <div className="pointer-events-none absolute left-1 top-1 space-y-0.5 text-[9px]">
        <div className="text-muted-foreground">NIST FDS 6.11 · {c?.cells.toLocaleString()} cells · {own ? (mine ? (mine.g === 0 ? 'µg' : `${mine.g} g`) : own) : caseId === 'ug' ? 'µg' : '1 g'}</div>
        {run && (
          <div className="flex flex-wrap gap-x-2">
            <span className="bg-bg/70 px-0.5 text-muted-foreground">
              T+<span className="text-ink">{t.toFixed(1)} s</span>
            </span>
            <span className="bg-bg/70 px-0.5 text-muted-foreground">
              HRR <span className="text-flame">{at(run.hrr.cols.Time, run.hrr.cols.HRR).toFixed(0)} kW</span>
            </span>
            <span className="bg-bg/70 px-0.5 text-muted-foreground">
              P <span className={psia >= 29 ? 'text-bad' : 'text-ink'}>{psia.toFixed(1)} psia</span>
            </span>
            {alarmed.size > 0 && <span className="bg-bg/70 px-0.5 text-bad">{[...alarmed].join(' ')} alarm</span>}
          </div>
        )}
      </div>
      <div className="absolute bottom-1 right-1 flex gap-1 text-[9px]">
        {(own ? [] : (['1g', 'ug'] as const)).map((k) => (
          <button key={k} type="button" onClick={() => setCaseId(k)} className={cn('rounded-sm border px-1', caseId === k ? 'border-ug/60 text-ink' : 'border-line text-faint hover:text-ink')}>
            {k === 'ug' ? 'µg' : '1 g'}
          </button>
        ))}
        <button type="button" onClick={() => (own ? window.open(`?view=fds&run=${own}`, '_blank') : setView('fds'))} className="rounded-sm border border-line px-1 text-muted-foreground hover:text-ink">
          open →
        </button>
      </div>
    </div>
  )
}
