// The header line on every screen: product, case, phase stepper, run status.
import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMission, type Phase } from '@/live/store'
import { cn } from '@/lib/utils'
import { useFinish } from '@/lib/theme'
import { Logo } from '@/components/Logo'

const STEPS: { id: Phase; label: string }[] = [
  { id: 'setup', label: 'network' },
  { id: 'intake', label: 'intake' },
  { id: 'plan', label: 'plan' },
  { id: 'run', label: 'run' },
  { id: 'done', label: 'report' },
]

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
  const setView = useMission((s) => s.setView)
  const subs = plan?.subtasks.filter((s) => s.status !== 'skipped') ?? []
  const nDone = subs.filter((s) => s.status === 'done').length
  const clock = useClock(startedAt, phase === 'run' && !done)
  const [finish, setFinish] = useFinish()
  const idx = STEPS.findIndex((s) => s.id === phase)
  const online = phase === 'intake' || phase === 'setup' ? 0 : 9
  const working = Object.values(agents).filter((a) => a.state === 'working' || a.state === 'asking').length
  const state = done ? 'done' : waiting ? 'waiting on you' : status.playing ? 'running' : phase === 'intake' ? 'idle' : 'paused'

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-b border-line px-3 text-[12px]">
      <button type="button" onClick={reset} className="flex items-center gap-2" title="back to intake">
        <Logo size={26} />
        <span className="text-[17px] font-medium tracking-[-0.03em] text-ink">firefall</span>
        <span
          className={cn('led', (waiting || (status.playing && !done)) && 'animate-pulse')}
          style={{ ['--led' as string]: done ? 'var(--green)' : waiting ? 'var(--orange)' : status.playing ? 'var(--orange)' : 'var(--faint)' }}
        />
      </button>
      <span className="hidden text-muted-foreground 2xl:inline">apollo-cm012</span>

      {/* phase stepper as numbered keys */}
      <nav className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const enabled = s.id === 'done' ? done : s.id === 'run' ? done : s.id === 'setup' || s.id === 'intake' ? phase === 'setup' || phase === 'intake' : false
          return (
            <button
              key={s.id}
              type="button"
              disabled={!enabled}
              data-down={i === idx}
              onClick={() => {
                setView('review')
                if (s.id === 'setup' || s.id === 'intake') setPhase(s.id)
                else showVerdict(s.id === 'done')
              }}
              className={cn('key h-[30px] gap-1.5 rounded-[9px] px-2 text-[11.5px] disabled:cursor-default disabled:opacity-100', i > idx && 'text-faint')}
            >
              <span className={cn('tnum text-[13px] font-medium', i === idx ? 'text-orange' : i < idx ? 'text-ink' : 'text-faint')}>{i}</span>
              <span className={i === idx ? 'text-ink' : i < idx ? 'text-muted-foreground' : 'text-faint'}>{s.label}</span>
            </button>
          )
        })}
      </nav>

      {/* view selector: a slide switch */}
      <nav className="slide text-[11.5px]">
        {(['review', 'library', 'evidence', 'compute'] as const).map((v) => (
          <button key={v} type="button" data-on={view === v} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </nav>

      {view !== 'review' && waiting && (
        <button type="button" onClick={() => setView('review')} className="key key-orange h-[28px] animate-pulse px-2.5 text-[11.5px]">
          decision waiting →
        </button>
      )}
      {phase !== 'intake' && (
        <span className="flex items-center gap-2">
          <span className={cn(waiting ? 'text-warn' : done ? 'text-ok' : 'text-ink')}>{state}</span>
          {plan && (
            <span className="tnum text-muted-foreground">
              {nDone}/{subs.length}
            </span>
          )}
        </span>
      )}

      <span className="ml-auto flex items-center gap-3.5 text-muted-foreground">
        {phase !== 'intake' && !done && (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => (status.playing ? pause() : play())}
              className={cn('key size-[30px] rounded-full p-0', status.playing && 'key-dark')}
              title="pause / resume the demo (space)"
            >
              {status.playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="text-orange" />}
            </button>
            <span className="slide text-[11px]">
              {[1, 2, 4].map((x) => (
                <button key={x} type="button" data-on={speed === x} onClick={() => setSpeed(x)} className="tnum !px-2">
                  {x}×
                </button>
              ))}
            </span>
          </span>
        )}
        {saved.asks > 0 && (
          <span className="tnum text-ok" title="Tokens an agent would have spent reading the material itself, saved by asking the agent that owns it">
            ↯ {saved.asks} asks · {Math.round(saved.tokens / 1000)}k saved
          </span>
        )}
        {online > 0 && (
          <span>
            <b className="tnum font-medium text-ink">{online}</b> agents · 4 orgs · <b className="tnum font-medium text-navy">{working}</b> working
          </span>
        )}
        <span className="lcd flex h-[30px] items-center px-2.5">
          <span className="lcd-font tnum text-[19px] leading-none text-screen-ink">{clock}</span>
        </span>
        <span className="text-faint">demo</span>
        <span className="flex flex-col items-center gap-0.5">
          <span className="slide text-[10.5px]">
            {(['field', 'xy'] as const).map((f) => (
              <button key={f} type="button" data-on={finish === f} onClick={() => setFinish(f)} className="!px-2 !py-px">
                {f}
              </button>
            ))}
          </span>
        </span>
      </span>
    </header>
  )
}
