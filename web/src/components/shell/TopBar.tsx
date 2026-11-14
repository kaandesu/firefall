import { BookOpen, Clapperboard, Pause, Play, Radio, RotateCcw, Siren, Telescope } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SCENARIOS, type ScenarioId } from '@/demo/scenarios'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

const ICON = { review: Telescope, incident: Siren, case: BookOpen }

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="var(--k-task)" strokeWidth="1.3" transform="rotate(-24 16 16)" opacity="0.8" />
        <ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="var(--flame)" strokeWidth="1" transform="rotate(38 16 16)" opacity="0.6" strokeDasharray="1.6 2.2" />
        <circle cx="16" cy="16" r="5" fill="#2a63c9" />
        <circle cx="16" cy="16" r="3.2" fill="var(--ug)" />
        <circle cx="16" cy="16" r="1.5" fill="#e9f6ff" />
        <circle cx="27.2" cy="10.4" r="1.8" fill="var(--flame)" />
      </svg>
      <div className="leading-none">
        <div className="text-[14px] font-bold tracking-[0.18em]">FIREFALL</div>
        <div className="mono mt-0.5 text-[9.5px] text-muted-foreground">flame in freefall · PSI × A2A</div>
      </div>
    </div>
  )
}

export function TopBar() {
  const scenario = useMission((s) => s.scenario)
  const load = useMission((s) => s.load)
  const status = useMission((s) => s.status)
  const play = useMission((s) => s.play)
  const pause = useMission((s) => s.pause)
  const speed = useMission((s) => s.speed)
  const setSpeed = useMission((s) => s.setSpeed)
  const director = useMission((s) => s.director)
  const setDirector = useMission((s) => s.setDirector)
  const mode = useMission((s) => s.mode)
  const goLive = useMission((s) => s.goLive)
  const goDemo = useMission((s) => s.goDemo)
  const liveError = useMission((s) => s.liveError)
  const setBrief = useMission((s) => s.setBrief)
  const run = useMission((s) => s.model.run)
  const progress = status.total ? Math.min(1, status.t / status.total) : 0

  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface/70 px-3 backdrop-blur">
      <Logo />
      <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
        {Object.values(SCENARIOS).map((sc) => {
          const Icon = ICON[sc.kind]
          return (
            <Tooltip key={sc.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => load(sc.id as ScenarioId, true)}
                  className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition', scenario === sc.id && mode === 'demo' ? 'bg-surface-3 text-ink' : 'text-muted-foreground hover:text-ink')}
                >
                  <Icon size={13} className={sc.kind === 'incident' ? 'text-k-fail' : sc.kind === 'case' ? 'text-gold' : 'text-ug'} />
                  {sc.title}
                </button>
              </TooltipTrigger>
              <TooltipContent>{sc.tagline}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => (status.playing ? pause() : play())}
          disabled={mode === 'live'}
          className="flex size-8 items-center justify-center rounded-full bg-ug text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          title={status.playing ? 'Pause' : 'Play demo run'}
        >
          {status.playing ? <Pause size={14} /> : <Play size={14} className="translate-x-px" />}
        </button>
        <button type="button" onClick={() => load(scenario, true)} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-3 hover:text-ink" title="Restart">
          <RotateCcw size={13} />
        </button>
        <div className="flex rounded-md border border-line">
          {[1, 4, 16].map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} className={cn('mono px-1.5 py-0.5 text-[10px]', speed === s ? 'bg-surface-3 text-ink' : 'text-muted-foreground')}>
              {s}×
            </button>
          ))}
        </div>
        <div className="w-36">
          <div className="mono flex justify-between text-[9px] text-faint">
            <span>{status.holding ? 'waiting on you' : status.finished ? 'complete' : status.playing ? 'running' : 'ready'}</span>
            <span>
              {status.t.toFixed(0)}s / {status.total.toFixed(0)}s
            </span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden rounded bg-surface-3">
            <div className={cn('h-full transition-[width]', status.holding ? 'bg-k-ask' : 'bg-ug')} style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 truncate text-[12px] text-muted-foreground xl:block">{run?.title}</div>

      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title="Focus follows what the crew is doing">
          <Clapperboard size={13} className={director ? 'text-ug' : ''} />
          Director
          <Switch checked={director} onCheckedChange={setDirector} />
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => (mode === 'live' ? goDemo() : goLive('/api/lagrange'))}
              className={cn('mono flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px]', mode === 'live' ? 'border-k-reply/50 text-k-reply' : 'border-line text-muted-foreground hover:text-ink')}
            >
              <Radio size={12} /> {mode === 'live' ? 'LIVE · Lagrange' : 'DEMO replay'}
            </button>
          </TooltipTrigger>
          <TooltipContent>{liveError ?? (mode === 'live' ? 'Streaming /api/events from Lagrange' : 'Scripted run in Lagrange entry format. Click to connect to Lagrange.')}</TooltipContent>
        </Tooltip>
        <button type="button" onClick={() => setBrief(true)} className="rounded-md border border-flame/40 px-2.5 py-1 text-[11.5px] text-flame transition hover:bg-flame/10">
          Why this matters
        </button>
      </div>
    </header>
  )
}
