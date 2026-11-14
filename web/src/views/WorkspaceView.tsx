// One agent's workspace: its tools (its MCP server), the calls it made, its notes and what it produced.
import { ChevronRight, Loader2, StickyNote, Wrench, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { AgentTag, Avatar, StateDot, fmtTime } from '@/components/bits'
import { AGENT, MODEL_COLOR } from '@/demo/crew'
import { useMission } from '@/live/store'
import type { ToolCall } from '@/live/types'
import { cn } from '@/lib/utils'

export function WorkspaceView() {
  const handle = useMission((s) => s.selectedAgent)
  const agents = useMission((s) => s.model.agents)
  const sims = useMission((s) => s.model.sims)
  const dossier = useMission((s) => s.model.dossier)
  const rt = agents[handle]
  const def = AGENT[handle]
  const end = useRef<HTMLDivElement>(null)
  const timeline = [...(rt?.tools ?? []).map((c) => ({ at: c.at, c })), ...(rt?.notes ?? []).map((n) => ({ at: n.at, n }))].sort((a, b) => a.at - b.at)
  useEffect(() => {
    const el = end.current?.parentElement
    if (el) el.scrollTop = el.scrollHeight
  }, [timeline.length])
  if (!def || !rt) return null
  const counts: Record<string, number> = {}
  for (const c of rt.tools) counts[c.tool] = (counts[c.tool] ?? 0) + 1
  const running = new Set(rt.tools.filter((c) => c.status === 'running').map((c) => c.tool))
  const produced = [...sims.filter((s) => s.by === handle).map((s) => `sim · ${s.label}`), ...dossier.filter((d) => d.author === handle).map((d) => `report · ${d.title}`)]

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="scroll-thin flex w-[38%] min-w-[170px] max-w-[260px] flex-col gap-3 overflow-y-auto border-r border-line p-3">
          <div className="flex items-center gap-2.5">
            <Avatar handle={handle} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <AgentTag handle={handle} className="text-[14px] font-semibold" />
                <StateDot state={rt.state} />
              </div>
              <div className="truncate text-[11.5px] text-muted-foreground">{def.dept}</div>
            </div>
          </div>
          <p className="text-[11.5px] leading-snug text-muted-foreground">{def.blurb}</p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <Stat label="model" value={<span style={{ color: MODEL_COLOR[rt.model ?? def.model] }}>{rt.model ?? def.model}</span>} />
            <Stat label="cost" value={`$${rt.cost.toFixed(2)}`} />
            <Stat
              label="context"
              value={
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-surface-3">
                  <div className="h-full bg-ug" style={{ width: `${rt.ctx * 100}%` }} />
                </div>
              }
            />
            <Stat label="calls" value={rt.tools.length} />
          </div>
          <div>
            <div className="label mb-1 flex items-center gap-1">
              <Wrench size={10} /> tools (fire-tools MCP)
            </div>
            <div className="flex flex-col gap-1">
              {def.tools.map((t) => (
                <div key={t.name} className={cn('rounded-md border px-2 py-1', running.has(t.name) ? 'border-k-task/50 bg-k-task/5' : 'border-line bg-surface-2/50')}>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[11px]" style={{ color: def.color }}>
                      {t.name}
                    </span>
                    <span className="mono text-[9px] text-faint">{counts[t.name] ? `×${counts[t.name]}` : ''}</span>
                  </div>
                  <div className="text-[10px] leading-tight text-muted-foreground">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
          {produced.length > 0 && (
            <div>
              <div className="label mb-1">produced</div>
              {produced.map((p) => (
                <div key={p} className="truncate text-[11px] text-muted-foreground">
                  {p}
                </div>
              ))}
            </div>
          )}
        </aside>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {rt.state !== 'idle' && rt.doing && (
            <div className="mono mb-2 flex items-center gap-1.5 rounded bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground">
              {rt.state === 'working' && <Loader2 size={11} className="animate-spin text-k-task" />}
              {rt.doing}
            </div>
          )}
          {timeline.length === 0 && <div className="p-4 text-center text-xs text-faint">No activity yet.</div>}
          {timeline.map((x) =>
            'c' in x && x.c ? (
              <Call key={x.c.callId} c={x.c} color={def.color} />
            ) : 'n' in x && x.n ? (
              <motion.div key={`n${x.at}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-1.5 flex gap-2 rounded-md border border-dashed border-line-2 bg-surface/40 px-2 py-1.5">
                <StickyNote size={12} className="mt-0.5 shrink-0 text-warn" />
                <div className="text-[12.5px] leading-snug">{x.n.text}</div>
              </motion.div>
            ) : null,
          )}
          <div ref={end} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-2 px-1.5 py-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mono text-[11px]">{value}</div>
    </div>
  )
}

function Call({ c, color }: { c: ToolCall; color: string }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-1.5 rounded-md border border-line bg-surface-2/70">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left">
        <ChevronRight size={11} className={cn('shrink-0 text-faint transition', open && 'rotate-90')} />
        {c.status === 'running' ? <Loader2 size={11} className="shrink-0 animate-spin text-k-task" /> : c.status === 'error' ? <XCircle size={11} className="shrink-0 text-k-fail" /> : <span className="size-1.5 shrink-0 rounded-full bg-k-reply" />}
        <span className="mono text-[11.5px]" style={{ color }}>
          {c.tool}
        </span>
        <span className="mono truncate text-[10.5px] text-muted-foreground">({summarize(c.args)})</span>
        <span className="mono ml-auto shrink-0 text-[9px] text-faint">{fmtTime(c.at)}</span>
      </button>
      {!open && c.status !== 'running' && c.result !== undefined && <div className="mono truncate px-6 pb-1.5 text-[10.5px] text-k-reply/80">→ {summarize(c.result)}</div>}
      {open && (
        <div className="mono space-y-1 border-t border-line px-2 py-1.5 text-[10.5px]">
          <pre className="whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(c.args, null, 2)}</pre>
          {c.result !== undefined && <pre className={cn('whitespace-pre-wrap break-words', c.status === 'error' ? 'text-k-fail' : 'text-k-reply/90')}>{JSON.stringify(c.result, null, 2)}</pre>}
        </div>
      )}
    </motion.div>
  )
}

function summarize(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object') return String(v)
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
    .join(', ')
}
