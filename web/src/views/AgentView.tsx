// 3 AGENT: the selected agent's workspace.
//   work       data jobs on its org's compute, tool calls (one line each, click to expand), notes
//   knowledge  what it knows and where each fact came from: an input file, a dataset, its own tool, another agent, a person
import { ChevronLeft, ChevronRight, Database, FileText, Loader2, StickyNote, User, Wrench, Bot } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, STATE_COLOR, STATE_LABEL } from '@/components/bits'
import { AGENT, MODEL_COLOR, ORGS } from '@/demo/crew'
import { useMission } from '@/live/store'
import type { Job, KbEntry, ToolCall } from '@/live/types'
import { cn } from '@/lib/utils'

const short = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object') return String(v)
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
    .join(' · ')
}

const SRC_ICON: Record<KbEntry['source']['kind'], typeof FileText> = { input: FileText, dataset: Database, agent: Bot, human: User, tool: Wrench }
const SRC_COLOR: Record<KbEntry['source']['kind'], string> = { input: 'var(--k-ask)', dataset: 'var(--ug)', agent: 'var(--k-reply)', human: 'var(--ink)', tool: 'var(--k-task)' }

export function AgentView() {
  const handle = useMission((s) => s.selectedAgent)
  const rt = useMission((s) => s.model.agents[s.selectedAgent])
  const jobs = useMission((s) => s.model.jobs)
  const kb = useMission((s) => s.model.kb[s.selectedAgent])
  const comms = useMission((s) => s.model.comms)
  const follow = useMission((s) => s.followAgent)
  const cycle = useMission((s) => s.cycleAgent)
  const [tab, setTab] = useState<'work' | 'knowledge'>('work')
  const def = AGENT[handle]
  const end = useRef<HTMLDivElement>(null)
  const mine = jobs.filter((j) => j.agent === handle)
  const items = [...(rt?.tools ?? []).map((c) => ({ at: c.at, c })), ...(rt?.notes ?? []).map((n) => ({ at: n.at, n }))].sort((a, b) => a.at - b.at)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [items.length, handle, tab, kb?.length])
  if (!def || !rt) return null
  const org = ORGS[def.org]
  const saved = comms.filter((c) => c.from === handle && c.saved).reduce((n, c) => n + c.saved!.tokens, 0)
  const facts = kb ?? []
  const fromAgents = facts.filter((f) => f.source.kind === 'agent' || f.source.kind === 'human').length

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-2 pb-1.5">
        <button type="button" onClick={() => cycle(-1)} className="text-faint hover:text-ink" title="previous agent (h)">
          <ChevronLeft size={13} />
        </button>
        <Avatar handle={handle} size={24} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: def.color }}>
            {def.name}
            <span className="text-[9.5px] lowercase" style={{ color: MODEL_COLOR[def.model] }}>
              {def.model}
            </span>
          </div>
          <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATE_COLOR[rt.state] }} />
            {STATE_LABEL[rt.state]}
            {rt.doing && rt.state !== 'idle' && rt.state !== 'done' && <span className="truncate text-faint">· {rt.doing}</span>}
          </div>
        </div>
        <span className="text-[9.5px] text-faint">{follow ? 'following' : 'pinned'}</span>
        <button type="button" onClick={() => cycle(1)} className="text-faint hover:text-ink" title="next agent (l)">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-2 pb-1.5 text-[9.5px] text-faint">
        <span className="shrink-0 whitespace-nowrap rounded-sm border px-1" style={{ borderColor: org.color, color: org.color }}>
          {org.name}
        </span>
        <span className="truncate">{org.provider}</span>
        <span className="ml-auto truncate">mcp: {def.mcp.join(', ')}</span>
      </div>
      <div className="flex shrink-0 gap-3 px-2 pt-1 text-[10.5px]">
        {(['work', 'knowledge'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('pb-0.5', tab === t ? 'border-b border-ug text-ink' : 'text-faint hover:text-ink')}>
            {t}
            {t === 'knowledge' && facts.length > 0 && <span className="ml-1 text-faint">{facts.length}</span>}
            {t === 'work' && mine.some((j) => !j.done) && <span className="ml-1 text-k-task">●</span>}
          </button>
        ))}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {tab === 'work' ? (
          <>
            {mine.map((j) => (
              <JobCard key={j.id} j={j} />
            ))}
            {items.length === 0 && mine.length === 0 && <div className="p-4 text-center text-[11px] text-faint">{def.role}. No calls yet.</div>}
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
          </>
        ) : facts.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-faint">Nothing learned yet. Facts arrive from the inputs, its own tools and other agents.</div>
        ) : (
          facts.map((f) => {
            const Icon = SRC_ICON[f.source.kind]
            return (
              <div key={f.id} className="flex gap-2 px-1.5 py-1 text-[11px]">
                <Icon size={11} className="mt-0.5 shrink-0" style={{ color: SRC_COLOR[f.source.kind] }} />
                <div className="min-w-0">
                  <div className="sans leading-snug text-ink">{f.text}</div>
                  <div className="text-[9.5px]" style={{ color: SRC_COLOR[f.source.kind] }}>
                    {f.source.kind} · {f.source.ref}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={end} />
      </div>
      <div className="flex shrink-0 gap-3 border-t border-line px-2 pt-1 text-[9.5px] text-faint">
        <span>{rt.tools.length} calls</span>
        <span>{facts.length} facts{fromAgents ? ` · ${fromAgents} from others` : ''}</span>
        {saved > 0 && <span className="text-ok">↯ {Math.round(saved / 1000)}k tokens saved by asking</span>}
        <span className="ml-auto">h / l switch</span>
      </div>
    </div>
  )
}

function Spark({ series, done }: { series: number[]; done?: boolean }) {
  const W = 120
  const H = 22
  if (series.length < 2) return <svg width={W} height={H} />
  const pts = series.map((v, i) => `${((i / (series.length - 1)) * W).toFixed(1)},${(H - v * (H - 2) - 1).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline points={pts} fill="none" stroke={done ? 'var(--k-reply)' : 'var(--ug)'} strokeWidth={1.4} />
    </svg>
  )
}

function JobCard({ j }: { j: Job }) {
  return (
    <div className="mb-1.5 rounded-sm border border-line-2 bg-surface-2 px-2 py-1.5 text-[10.5px]">
      <div className="flex items-center gap-1.5">
        {j.done ? <span className="size-1.5 rounded-full bg-k-reply" /> : <Loader2 size={10} className="animate-spin text-ug" />}
        <span className="truncate text-ink">{j.title}</span>
        <span className="ml-auto shrink-0 text-faint">
          {j.dataset} · {j.size}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded bg-surface-3">
          <div className={cn('h-full transition-all duration-500', j.done ? 'bg-k-reply' : 'bg-ug')} style={{ width: `${j.progress * 100}%` }} />
        </div>
        <span className="w-[30px] text-right tnum text-faint">{Math.round(j.progress * 100)}%</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {j.steps.map((st, i) => (
            <span key={st} className={cn('rounded-sm px-1 text-[9px]', i < j.step ? 'bg-k-reply/10 text-k-reply' : i === j.step ? 'bg-ug/15 text-ug' : 'text-faint')}>
              {st}
            </span>
          ))}
        </div>
        {j.series && <Spark series={j.series} done={j.done} />}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9.5px] text-faint">
        <span>{j.where}</span>
        {Object.entries(j.stats).map(([k, v]) => (
          <span key={k}>
            {k} <span className={j.done ? 'text-ink' : 'text-muted-foreground'}>{v}</span>
          </span>
        ))}
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
