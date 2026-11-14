import { BookOpenText, Box, ClipboardCheck, Crown, FileText, FlaskConical, Radar, ShieldCheck, SprayCan, User, Network } from 'lucide-react'
import { AGENT, HUB, agentColor, agentName, isPerson, type AgentDef } from '@/demo/crew'
import { BY_ID, label } from '@/data/psi'
import { useMission } from '@/live/store'
import type { AgentState } from '@/live/model'
import type { CommKind } from '@/live/types'
import { cn } from '@/lib/utils'

export const KIND_COLOR: Record<CommKind, string> = {
  task: 'var(--k-task)',
  ask: 'var(--k-ask)',
  reply: 'var(--k-reply)',
  review: 'var(--k-review)',
  fail: 'var(--k-fail)',
  hub: 'var(--k-hub)',
  human: 'var(--ink)',
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
  working: 'var(--k-task)',
  asking: 'var(--k-ask)',
  waiting: 'var(--k-ask)',
  done: 'var(--k-reply)',
  failed: 'var(--k-fail)',
}

export const STATE_LABEL: Record<AgentState, string> = {
  idle: 'idle',
  working: 'working',
  asking: 'asking',
  waiting: 'waiting on you',
  done: 'done',
  failed: 'failed',
}

const ICON: Record<AgentDef['icon'], typeof User> = {
  lead: Crown,
  research: BookOpenText,
  materials: FlaskConical,
  detection: Radar,
  suppression: SprayCan,
  sim: Box,
  safety: ShieldCheck,
  report: FileText,
}

/** A flat, square department avatar: icon for agents, initials for people. */
export function Avatar({ handle, size = 28, className }: { handle: string; size?: number; className?: string }) {
  const color = agentColor(handle)
  const a = AGENT[handle]
  const Icon = a ? ICON[a.icon] : handle === HUB ? Network : null
  const person = isPerson(handle)
  const initials = agentName(handle)
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center font-semibold', person ? 'rounded-full' : 'rounded-md', className)}
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${color} 13%, var(--surface))`,
        color,
        border: `1px solid color-mix(in oklab, ${color} 28%, transparent)`,
        fontSize: size * 0.38,
      }}
      title={agentName(handle)}
    >
      {Icon ? <Icon size={Math.round(size * 0.55)} strokeWidth={1.8} /> : person ? initials || <User size={size * 0.55} /> : <ClipboardCheck size={size * 0.55} />}
    </span>
  )
}

export function AgentTag({ handle, className }: { handle: string; className?: string }) {
  return (
    <span className={cn('text-[12px] font-medium', className)} style={{ color: agentColor(handle) }}>
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
    <span className="rounded px-1.5 py-px text-[10.5px] font-medium" style={{ color: KIND_COLOR[kind], background: `color-mix(in oklab, ${KIND_COLOR[kind]} 11%, transparent)` }}>
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
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium', className)} style={{ color: map.c, background: `color-mix(in oklab, ${map.c} 12%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: map.c }} />
      {map.t}
    </span>
  )
}

export function CiteChip({ id, className }: { id: string; className?: string }) {
  const selectInv = useMission((s) => s.selectInv)
  const setTab = useMission((s) => s.setTab)
  const known = !!BY_ID[id]
  return (
    <button
      type="button"
      onClick={() => {
        selectInv(id)
        setTab('evidence')
      }}
      title={BY_ID[id]?.title ?? id}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-1.5 py-px text-[10.5px] text-ug transition hover:border-ug/50 hover:bg-ug/5',
        !known && 'text-muted-foreground',
        className,
      )}
    >
      <span className="mono">{id}</span>
      <span className="text-muted-foreground">{label(id)}</span>
    </button>
  )
}

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      {hint && <div className="max-w-sm text-xs leading-relaxed text-faint">{hint}</div>}
    </div>
  )
}

export function Section({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
