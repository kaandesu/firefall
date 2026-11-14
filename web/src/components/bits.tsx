import { User } from 'lucide-react'
import { AGENT, HUMAN, HUB, agentColor, agentName } from '@/demo/crew'
import { BY_ID, label } from '@/data/psi'
import { useMission } from '@/live/store'
import type { AgentState } from '@/live/model'
import type { CommKind } from '@/live/types'
import { cn } from '@/lib/utils'
import { Orbitar } from './Orbitar'

export const KIND_COLOR: Record<CommKind, string> = {
  task: 'var(--k-task)',
  ask: 'var(--k-ask)',
  reply: 'var(--k-reply)',
  review: 'var(--k-review)',
  fail: 'var(--k-fail)',
  hub: 'var(--k-hub)',
  human: '#e6edf3',
}

export const STATE_COLOR: Record<AgentState, string> = {
  idle: 'var(--faint)',
  working: 'var(--k-task)',
  asking: 'var(--k-ask)',
  waiting: 'var(--k-ask)',
  done: 'var(--k-reply)',
  failed: 'var(--k-fail)',
}

export function Avatar({ handle, size = 28, className }: { handle: string; size?: number; className?: string }) {
  if (handle === HUMAN || handle === HUB || !AGENT[handle]) {
    return (
      <span
        className={cn('flex shrink-0 items-center justify-center rounded-xl', className)}
        style={{ width: size, height: size, background: `color-mix(in oklab, ${agentColor(handle)} 14%, var(--surface))`, color: agentColor(handle) }}
      >
        <User size={size * 0.55} />
      </span>
    )
  }
  return <Orbitar handle={handle} size={size} color={agentColor(handle)} className={className} />
}

export function AgentTag({ handle, className }: { handle: string; className?: string }) {
  return (
    <span className={cn('mono text-[11px] font-medium tracking-wide', className)} style={{ color: agentColor(handle) }}>
      {agentName(handle)}
    </span>
  )
}

export function StateDot({ state, className }: { state: AgentState; className?: string }) {
  const live = state === 'working' || state === 'asking' || state === 'waiting'
  return (
    <span className={cn('relative inline-block size-2 rounded-full', live && 'pulse-ring', className)} style={{ background: STATE_COLOR[state], color: STATE_COLOR[state] }} />
  )
}

export function KindBadge({ kind }: { kind: CommKind }) {
  return (
    <span
      className="mono rounded px-1.5 py-px text-[10px] uppercase tracking-wider"
      style={{ color: KIND_COLOR[kind], background: `color-mix(in oklab, ${KIND_COLOR[kind]} 14%, transparent)` }}
    >
      {kind}
    </span>
  )
}

export function CiteChip({ id, className }: { id: string; className?: string }) {
  const selectInv = useMission((s) => s.selectInv)
  const directTo = useMission((s) => s.directTo)
  const known = !!BY_ID[id]
  return (
    <button
      type="button"
      onClick={() => {
        selectInv(id)
        directTo('evidence', true)
      }}
      title={BY_ID[id]?.title ?? id}
      className={cn(
        'mono inline-flex items-center gap-1 rounded-md border border-line-2 bg-surface-2 px-1.5 py-px text-[10px] text-ug transition hover:border-ug/60 hover:bg-ug/10',
        !known && 'text-muted-foreground',
        className,
      )}
    >
      {id}
      <span className="text-muted-foreground">{label(id)}</span>
    </button>
  )
}

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="text-sm text-muted-foreground">{title}</div>
      {hint && <div className="max-w-xs text-xs text-faint">{hint}</div>}
    </div>
  )
}

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
