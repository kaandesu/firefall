// 3 AGENT: the selected agent's workspace. One line per tool call; click (or enter) expands it.
import { ChevronLeft, ChevronRight, Loader2, StickyNote } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, STATE_COLOR, STATE_LABEL } from '@/components/bits'
import { AGENT, MODEL_COLOR } from '@/demo/crew'
import { useMission } from '@/live/store'
import type { ToolCall } from '@/live/types'
import { cn } from '@/lib/utils'

const short = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object') return String(v)
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
    .join(' · ')
}

export function AgentView() {
  const handle = useMission((s) => s.selectedAgent)
  const rt = useMission((s) => s.model.agents[s.selectedAgent])
  const follow = useMission((s) => s.followAgent)
  const cycle = useMission((s) => s.cycleAgent)
  const def = AGENT[handle]
  const end = useRef<HTMLDivElement>(null)
  const items = [...(rt?.tools ?? []).map((c) => ({ at: c.at, c })), ...(rt?.notes ?? []).map((n) => ({ at: n.at, n }))].sort((a, b) => a.at - b.at)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [items.length, handle])
  if (!def || !rt) return null
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 pb-2">
        <button type="button" onClick={() => cycle(-1)} className="text-faint hover:text-ink" title="previous agent (h)">
          <ChevronLeft size={13} />
        </button>
        <Avatar handle={handle} size={24} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: def.color }}>
            {def.name}
            <span className="text-[9.5px] uppercase tracking-wider" style={{ color: MODEL_COLOR[def.model] }}>
              {def.model}
            </span>
          </div>
          <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ background: STATE_COLOR[rt.state] }} />
            {STATE_LABEL[rt.state]}
            {rt.doing && rt.state !== 'idle' && rt.state !== 'done' && <span className="truncate text-faint">· {rt.doing}</span>}
          </div>
        </div>
        <span className="text-[9.5px] text-faint">{follow ? 'following' : 'pinned'}</span>
        <button type="button" onClick={() => cycle(1)} className="text-faint hover:text-ink" title="next agent (l)">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {items.length === 0 && <div className="p-4 text-center text-[11px] text-faint">{def.role}. No calls yet.</div>}
        {items.map((x) =>
          'c' in x && x.c ? (
            <Call key={x.c.callId} c={x.c} />
          ) : 'n' in x && x.n ? (
            <div key={`n${x.at}`} className="flex gap-1.5 px-1.5 py-1 text-[11px]">
              <StickyNote size={11} className="mt-0.5 shrink-0 text-warn" />
              <span className="sans leading-snug text-ink">{x.n.text}</span>
            </div>
          ) : null,
        )}
        <div ref={end} />
      </div>
      <div className="flex shrink-0 gap-3 border-t border-line px-2 pt-1 text-[9.5px] text-faint">
        <span>{rt.tools.length} calls</span>
        <span>${rt.cost.toFixed(2)}</span>
        <span className="flex items-center gap-1">
          ctx
          <span className="inline-block h-1 w-10 overflow-hidden rounded bg-surface-3">
            <span className="block h-full bg-ug" style={{ width: `${rt.ctx * 100}%` }} />
          </span>
        </span>
        <span className="ml-auto">h / l switch</span>
      </div>
    </div>
  )
}

function Call({ c }: { c: ToolCall }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('rounded-sm', open && 'bg-surface-2')}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-1.5 py-0.5 text-left text-[11px] hover:bg-surface-2">
        {c.status === 'running' ? <Loader2 size={10} className="shrink-0 animate-spin text-k-task" /> : <span className={cn('size-1.5 shrink-0 rounded-full', c.status === 'error' ? 'bg-k-fail' : 'bg-k-reply')} />}
        <span className="shrink-0 text-k-task">{c.tool}</span>
        <span className="truncate text-faint">{c.status === 'running' ? short(c.args) : `→ ${short(c.result)}`}</span>
      </button>
      {open && (
        <div className="space-y-1 px-5 pb-1.5 text-[10.5px]">
          <pre className="whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(c.args, null, 2)}</pre>
          {c.result !== undefined && <pre className="whitespace-pre-wrap break-words text-k-reply/90">{JSON.stringify(c.result, null, 2)}</pre>}
        </div>
      )}
    </div>
  )
}
