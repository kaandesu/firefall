import { MessageSquare, Moon, Pause, Play, Radio, RotateCcw, Sun } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SCENARIOS, type ScenarioId } from '@/demo/scenarios'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--flame)" />
        <path d="M12.4 4.5c.6 2.4-1.6 3.6-1.6 5.6 0 1 .7 1.7 1.5 1.7 1.2 0 1.6-1.1 1.4-2.4 1.9 1.3 3 3.2 3 5.1a4.7 4.7 0 0 1-9.4 0c0-3.6 3.3-5.7 5.1-10Z" fill="white" />
      </svg>
      <div className="text-[14px] font-semibold tracking-tight">FIREFALL</div>
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
  const mode = useMission((s) => s.mode)
  const goLive = useMission((s) => s.goLive)
  const goDemo = useMission((s) => s.goDemo)
  const liveError = useMission((s) => s.liveError)
  const theme = useMission((s) => s.theme)
  const setTheme = useMission((s) => s.setTheme)
  const chatOpen = useMission((s) => s.chatOpen)
  const setChatOpen = useMission((s) => s.setChatOpen)
  const progress = status.total ? Math.min(1, status.t / status.total) : 0
  const state = status.holding ? 'Waiting for your decision' : status.finished ? 'Review complete' : status.playing ? 'Review running' : status.t > 0 ? 'Paused' : 'Not started'

  return (
    <header className="no-print flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <Logo />
      <span className="hidden text-[12px] text-muted-foreground lg:inline">Fire safety review</span>
      <div className="mx-1 h-5 w-px bg-line" />

      <Select value={scenario} onValueChange={(v) => load(v as ScenarioId, false)}>
        <SelectTrigger size="sm" className="h-8 w-[250px] text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(SCENARIOS).map((sc) => (
            <SelectItem key={sc.id} value={sc.id}>
              <div className="flex flex-col">
                <span>{sc.title}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => (status.playing ? pause() : play())}
          disabled={mode === 'live'}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {status.playing ? <Pause size={13} /> : <Play size={13} />}
          {status.playing ? 'Pause' : status.t > 0 && !status.finished ? 'Resume' : 'Run demo'}
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => load(scenario, true)} className="rounded-md p-2 text-muted-foreground hover:bg-surface-3 hover:text-ink">
              <RotateCcw size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Restart this review</TooltipContent>
        </Tooltip>
        <div className="flex rounded-md border border-line">
          {[1, 4, 16].map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} className={cn('tnum px-1.5 py-1 text-[11px]', speed === s ? 'bg-surface-3 font-medium text-ink' : 'text-muted-foreground')}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="hidden w-48 md:block">
        <div className="flex justify-between text-[11px]">
          <span className={status.holding ? 'font-medium text-warn' : 'text-muted-foreground'}>{state}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className={cn('h-full transition-[width]', status.holding ? 'bg-warn' : 'bg-primary')} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => (mode === 'live' ? goDemo() : goLive('/api/lagrange'))}
              className={cn('flex h-8 items-center gap-1.5 rounded-md border px-2 text-[12px]', mode === 'live' ? 'border-ok/50 text-ok' : 'border-line text-muted-foreground hover:text-ink')}
            >
              <Radio size={13} /> {mode === 'live' ? 'Live' : 'Demo'}
            </button>
          </TooltipTrigger>
          <TooltipContent>{liveError ?? (mode === 'live' ? 'Streaming from the Lagrange network' : 'Scripted replay of a review. Click to connect to live agents on Lagrange.')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-md p-2 text-muted-foreground hover:bg-surface-3 hover:text-ink" aria-label="Toggle dark mode">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => setChatOpen(!chatOpen)} className={cn('rounded-md p-2 hover:bg-surface-3', chatOpen ? 'text-ink' : 'text-muted-foreground')} aria-label="Toggle chat">
              <MessageSquare size={15} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{chatOpen ? 'Hide chat' : 'Show chat'}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
