import { ArchiveGlyph, ChamberGlyph, DetectGlyph, DropGlyph, HubGlyph, LeadGlyph, MaterialGlyph, PageGlyph, PersonGlyph, ShieldGlyph, SimGlyph, TaskGlyph } from '@/components/icons'
import { AGENT, HUB, agentColor, agentName, isPerson, type AgentDef } from '@/demo/crew'
import { BY_ID, label } from '@/data/psi'
import { Popover } from 'radix-ui'
import type { AgentState } from '@/live/model'
import type { CommKind } from '@/live/types'
import { cn } from '@/lib/utils'

export const KIND_COLOR: Record<CommKind, string> = {
  task: 'var(--faint)',
  ask: 'var(--muted)',
  reply: 'var(--muted)',
  review: 'var(--muted)',
  fail: 'var(--red)',
  hub: 'var(--faint)',
  human: 'var(--you)',
}

export const KIND_LABEL: Record<CommKind, string> = {
  task: 'task',
  ask: 'question',
  reply: 'answer',
  review: 'review',
  fail: 'failed',
  hub: 'tool',
  human: 'decision',
}

export const STATE_COLOR: Record<AgentState, string> = {
  idle: 'var(--faint)',
  working: 'var(--you)',
  asking: 'var(--you)',
  waiting: 'var(--pink)',
  done: 'var(--green)',
  failed: 'var(--red)',
}

export const STATE_LABEL: Record<AgentState, string> = {
  idle: 'idle',
  working: 'working',
  asking: 'asking',
  waiting: 'waiting on you',
  done: 'done',
  failed: 'failed',
}

const ICON: Record<AgentDef['icon'], typeof LeadGlyph> = {
  lead: LeadGlyph,
  research: ArchiveGlyph,
  materials: MaterialGlyph,
  detection: DetectGlyph,
  suppression: DropGlyph,
  sim: SimGlyph,
  safety: ShieldGlyph,
  report: PageGlyph,
  lab: ChamberGlyph,
}

/** A flat, square department avatar: icon for agents, initials for people. */
export function Avatar({ handle, size = 28, className }: { handle: string; size?: number; className?: string }) {
  const color = agentColor(handle)
  const a = AGENT[handle]
  const Icon = a ? ICON[a.icon] : handle === HUB ? HubGlyph : null
  const person = isPerson(handle)
  const initials = agentName(handle)
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cn('te-cap flex shrink-0 items-center justify-center font-medium', person ? 'rounded-full' : 'rounded-[30%]', className)}
      style={{
        width: size,
        height: size,
        color,
        borderWidth: 1,
        fontSize: size * 0.38,
      }}
      title={agentName(handle)}
    >
      {Icon ? <Icon size={Math.round(size * 0.58)} /> : person ? initials || <PersonGlyph size={size * 0.58} /> : <TaskGlyph size={size * 0.58} />}
    </span>
  )
}

export function AgentTag({ handle, className }: { handle: string; className?: string }) {
  return (
    <span className={cn('text-body font-medium', className)} style={{ color: agentColor(handle) }}>
      {agentName(handle)}
    </span>
  )
}

export function StateDot({ state, className }: { state: AgentState; className?: string }) {
  const live = state === 'working' || state === 'asking' || state === 'waiting'
  return <span className={cn('relative inline-block size-2 shrink-0 rounded-full', live && 'pulse-ring', className)} style={{ background: STATE_COLOR[state], color: STATE_COLOR[state] }} />
}

export function KindBadge({ kind }: { kind: CommKind }) {
  return (
    <span className="rounded px-1.5 py-px text-label font-medium" style={{ color: KIND_COLOR[kind], background: `color-mix(in oklab, ${KIND_COLOR[kind]} 11%, transparent)` }}>
      {KIND_LABEL[kind]}
    </span>
  )
}

export function StatusPill({ status, className }: { status: 'pass' | 'retest' | 'fail' | 'none'; className?: string }) {
  const map = {
    pass: { t: 'Pass', c: 'var(--ok)' },
    retest: { t: 'Retest', c: 'var(--warn)' },
    fail: { t: 'Fails', c: 'var(--bad)' },
    none: { t: 'No data', c: 'var(--faint)' },
  }[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-px text-body font-medium', className)} style={{ color: map.c, background: `color-mix(in oklab, ${map.c} 12%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: map.c }} />
      {map.t}
    </span>
  )
}

/** A citation hangs on the claim it supports: click for the investigation, its finding and the source. */
export function CiteChip({ id, note, className }: { id: string; note?: string; className?: string }) {
  const inv = BY_ID[id]
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn('inline-flex items-center gap-1 rounded-full border border-line-2 bg-surface-2 px-2 py-px text-label text-navy shadow-[inset_0_1px_0_var(--hi)] transition hover:border-orange', !inv && 'text-muted-foreground', className)}
        >
          <span>{id}</span>
          <span className="text-muted-foreground">{label(id)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="start" sideOffset={6} className="z-50 w-[320px] rounded border border-line-2 bg-surface-2 p-3 text-body shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-baseline gap-2">
            <span className="text-ug">{id}</span>
            <span className="font-medium text-ink">{label(id)}</span>
          </div>
          {inv && <div className="sans mt-1 text-body leading-snug text-ink">{inv.title}</div>}
          {note && <div className="mt-2 text-muted-foreground">used for: {note}</div>}
          {inv?.c.finding && <div className="sans mt-2 leading-snug text-muted-foreground">{inv.c.finding}</div>}
          <div className="mt-2 flex flex-wrap gap-x-3 text-label text-faint">
            {inv?.c.platform && <span>{inv.c.platform}</span>}
            {inv?.c.o2 && <span>O₂ {inv.c.o2}</span>}
          </div>
          {(inv?.c.source?.url || inv?.url) && (
            <a href={inv.c.source?.url ?? inv.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-ug underline-offset-2 hover:underline">
              {inv.c.source?.label ?? 'PSI record'} ↗
            </a>
          )}
          <Popover.Arrow className="fill-line-2" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="text-body font-medium text-muted-foreground">{title}</div>
      {hint && <div className="max-w-sm text-label leading-relaxed text-faint">{hint}</div>}
    </div>
  )
}

export function Section({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3 className="text-emph font-medium">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
