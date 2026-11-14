// The header line on every screen: product, case, phase stepper, run status.
import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMission, type Phase } from '@/live/store'
import { cn } from '@/lib/utils'
import { openFor } from '@/live/sign'
import { HUMAN, LAB } from '@/demo/crew'

const STEPS: { id: Phase; label: string }[] = [
  { id: 'setup', label: 'NETWORK' },
  { id: 'intake', label: 'INTAKE' },
  { id: 'plan', label: 'PLAN' },
  { id: 'run', label: 'RUN' },
  { id: 'done', label: 'REPORT' },
]

const VIEWS = [
  ['review', 'Review'],
  ['inbox', 'Inbox'],
  ['library', 'Library'],
  ['evidence', 'Test data'],
  ['fds', 'FDS'],
  ['compute', 'Compute'],
] as const

function useClock(from?: number, on = true) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [on])
  if (!from) return '0:00'
  const s = Math.max(0, Math.floor((now - from) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function TopBar() {
  const phase = useMission((s) => s.phase)
  const plan = useMission((s) => s.model.plan)
  const done = useMission((s) => s.model.done)
  const waiting = useMission((s) => s.model.waiting)
  const agents = useMission((s) => s.model.agents)
  const status = useMission((s) => s.status)
  const speed = useMission((s) => s.speed)
  const setSpeed = useMission((s) => s.setSpeed)
  const play = useMission((s) => s.play)
  const pause = useMission((s) => s.pause)
  const reset = useMission((s) => s.reset)
  const showVerdict = useMission((s) => s.showVerdict)
  const setPhase = useMission((s) => s.setPhase)
  const saved = useMission((s) => s.model.saved)
  const startedAt = useMission((s) => s.startedAt)
  const view = useMission((s) => s.view)
  const inbox = useMission((s) => s.model.inbox)
  const nYou = openFor(inbox, HUMAN), nLab = openFor(inbox, LAB)
  const setView = useMission((s) => s.setView)
  const clock = useClock(startedAt, phase === 'run' && !done)
  const idx = STEPS.findIndex((s) => s.id === phase)
  const subs = plan?.subtasks.filter((s) => s.status !== 'skipped') ?? []
  const nDone = subs.filter((s) => s.status === 'done').length
  const online = phase === 'intake' || phase === 'setup' ? 0 : 9
  const working = Object.values(agents).filter((a) => a.state === 'working' || a.state === 'asking').length
  const state = done ? 'done' : waiting ? 'waiting on you' : status.playing ? 'running' : phase === 'intake' ? 'idle' : 'paused'

  return (
    <header className="flex h-9 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-b border-line px-3 text-[11.5px]">
      <button type="button" onClick={reset} className="flex items-center gap-2" title="back to intake">
        <span className={cn('size-2 rounded-full', done ? 'bg-ok' : waiting ? 'animate-pulse bg-warn' : status.playing ? 'animate-pulse bg-flame' : 'bg-faint')} />
        <span className="tracking-[0.2em] text-ink">FIREFALL</span>
      </button>
      <span className="hidden text-muted-foreground 2xl:inline">apollo-cm012</span>
      <nav className="flex items-center gap-1 text-[10.5px]">
        {STEPS.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-line-2">▸</span>}
            <button
              type="button"
              disabled={!(s.id === 'done' ? done : s.id === 'run' ? done : s.id === 'setup' || s.id === 'intake' ? phase === 'setup' || phase === 'intake' : false)}
              onClick={() => {
                setView('review')
                if (s.id === 'setup' || s.id === 'intake') setPhase(s.id)
                else showVerdict(s.id === 'done')
              }}
              className={cn('px-1', i === idx ? 'text-k-ask' : i < idx ? 'text-muted-foreground' : 'text-faint', 'disabled:cursor-default')}
            >
              {i} {s.label}
            </button>
          </span>
        ))}
      </nav>
      <nav className="flex items-center rounded-sm border border-line text-[10.5px]">
        {VIEWS.map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cn('px-2 py-0.5', view === v ? 'bg-surface-2 text-ink' : 'text-muted-foreground hover:text-ink')}>
            {label}
            {v === 'inbox' && nYou + nLab > 0 && <span className="ml-1 rounded-full bg-warn px-1 text-[9.5px] font-semibold text-background">{nYou + nLab}</span>}
          </button>
        ))}
      </nav>
      {view !== 'review' && waiting && (
        <button type="button" onClick={() => setView('review')} className="animate-pulse rounded-sm border border-warn/60 px-1.5 text-warn">
          decision waiting →
        </button>
      )}
      {phase !== 'intake' && (
        <>
          <span className={cn(waiting ? 'text-warn' : done ? 'text-ok' : 'text-k-task')}>{state}</span>
          {plan && (
            <span className="text-muted-foreground">
              {nDone}/{subs.length}
            </span>
          )}
        </>
      )}
      <span className="ml-auto flex items-center gap-4 text-muted-foreground">
        {phase !== 'intake' && !done && (
          <span className="flex items-center gap-1.5">
            <button type="button" onClick={() => (status.playing ? pause() : play())} className="hover:text-ink" title="pause / resume the demo (space)">
              {status.playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
            {[1, 2, 4].map((x) => (
              <button key={x} type="button" onClick={() => setSpeed(x)} className={cn('px-0.5', speed === x ? 'text-ink' : 'text-faint hover:text-ink')}>
                {x}×
              </button>
            ))}
          </span>
        )}
        {saved.asks > 0 && (
          <span className="text-ok" title="Tokens an agent would have spent reading the material itself, saved by asking the agent that owns it">
            ↯ {saved.asks} asks · {Math.round(saved.tokens / 1000)}k saved
          </span>
        )}
        {online > 0 && (
          <span>
            <b className="font-normal text-ink">{online}</b> agents · 4 orgs · <b className="font-normal text-k-task">{working}</b> working
          </span>
        )}
        <span className="tnum text-ink">{clock}</span>
        <span className="text-faint">demo</span>
      </span>
    </header>
  )
}
