// Right panel: talk to the Review Lead like any assistant chat. You see your messages, the lead's answers,
// questions that need a person, and milestones. "All messages" shows every A2A message on the network.
import { ArrowRight, ArrowUp, CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AskHuman } from '@/components/AskHuman'
import { AgentTag, Avatar, CiteChip, KindBadge, KIND_COLOR, fmtTime } from '@/components/bits'
import { HUMAN, isPerson, PEOPLE } from '@/demo/crew'
import type { ScenarioId } from '@/demo/scenarios'
import type { Comm, Milestone } from '@/live/model'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

const SUGGEST: { text: string; run: ScenarioId }[] = [
  { text: 'Review the PR-2 rover cabin for Phase II: 34 % O₂ / 8.2 psia', run: 'habitat' },
  { text: 'Smoke alarm in the aft avionics bay — what do we do?', run: 'incident' },
  { text: 'Would this review have caught Apollo 1?', run: 'apollo1' },
]

type Item = { at: number; c?: Comm; m?: Milestone }

export function ChatPanel() {
  const [view, setView] = useState<'chat' | 'all'>('chat')
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <Avatar handle="flight" size={22} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight">Review Lead</div>
          <div className="text-[11px] leading-tight text-muted-foreground">coordinates the department agents</div>
        </div>
        <div className="flex rounded-md border border-line p-0.5">
          {(
            [
              ['chat', 'Chat'],
              ['all', 'All messages'],
            ] as const
          ).map(([id, l]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={cn('rounded px-2 py-0.5 text-[11.5px]', view === id ? 'bg-surface-3 font-medium' : 'text-muted-foreground')}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {view === 'chat' ? <Chat /> : <AllMessages />}
      <Composer />
    </div>
  )
}

function useStickToBottom(dep: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [dep])
  return ref
}

function Chat() {
  const comms = useMission((s) => s.model.comms)
  const milestones = useMission((s) => s.model.milestones)
  const extra = useMission((s) => s.people)
  const waiting = useMission((s) => s.model.waiting)
  const items = useMemo(() => {
    const handles = new Set([...PEOPLE, ...extra].map((p) => p.handle))
    const xs: Item[] = [
      ...comms.filter((c) => (handles.has(c.from) || handles.has(c.to)) && !(c.kind === 'task' && c.to === HUMAN && waiting?.taskId === c.taskId)).map((c) => ({ at: c.at, c })),
      ...milestones.map((m) => ({ at: m.at, m })),
    ]
    return xs.sort((a, b) => a.at - b.at)
  }, [comms, milestones, extra, waiting])
  const ref = useStickToBottom(items.length + (waiting ? 1 : 0))

  return (
    <div ref={ref} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
      {items.length === 0 && (
        <div className="px-2 py-8 text-center text-[12.5px] leading-relaxed text-muted-foreground">
          Ask the Review Lead to review your design package. It plans the work, hands it to the departments, and comes back to you for decisions.
        </div>
      )}
      {items.map((it) => (it.m ? <MilestoneRow key={it.m.id} m={it.m} /> : it.c ? <Bubble key={it.c.id} c={it.c} /> : null))}
      <AskHuman />
    </div>
  )
}

function Bubble({ c }: { c: Comm }) {
  const mode = useMission((s) => s.mode)
  const mine = c.from === HUMAN
  if (mine)
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-3 px-3 py-2 text-[13px] leading-snug">{c.text}</div>
      </div>
    )
  const toPerson = isPerson(c.to) && c.to !== HUMAN
  const fromPerson = isPerson(c.from)
  return (
    <div className="flex gap-2">
      <Avatar handle={c.from} size={24} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <AgentTag handle={c.from} />
          {c.to !== HUMAN && (
            <>
              <ArrowRight size={11} className="text-faint" />
              <AgentTag handle={c.to} />
            </>
          )}
          {(toPerson || fromPerson) && <KindBadge kind={c.kind} />}
          {fromPerson && mode === 'demo' && <span className="text-[10.5px] text-faint">simulated reply</span>}
        </div>
        <div className={cn('mt-0.5 text-[13px] leading-snug', toPerson && 'rounded-md border border-warn/30 bg-warn/5 px-2 py-1.5')}>{c.text}</div>
        {c.cites && c.cites.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {c.cites.map((ct) => (
              <CiteChip key={ct.id} id={ct.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MilestoneRow({ m }: { m: Milestone }) {
  const setTab = useMission((s) => s.setTab)
  return (
    <button type="button" onClick={() => setTab(m.view)} className="flex w-full items-start gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-left hover:border-line-2">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" />
      <span className="min-w-0 flex-1 text-[12px] leading-snug">
        {m.by && <AgentTag handle={m.by} className="mr-1 text-[12px]" />}
        <span className="text-muted-foreground">{m.text}</span>
      </span>
      <ArrowRight size={12} className="mt-1 shrink-0 text-faint" />
    </button>
  )
}

function AllMessages() {
  const comms = useMission((s) => s.model.comms)
  const [hideTasks, setHideTasks] = useState(false)
  const list = useMemo(() => comms.filter((c) => !hideTasks || c.kind !== 'task'), [comms, hideTasks])
  const ref = useStickToBottom(list.length)
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-1.5 text-[11.5px] text-muted-foreground">
        <span>{comms.length} messages on the network</span>
        <button type="button" onClick={() => setHideTasks(!hideTasks)} className="hover:text-ink">
          {hideTasks ? 'Show task hand-offs' : 'Hide task hand-offs'}
        </button>
      </div>
      <div ref={ref} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {list.map((c) => (
          <div key={c.id} className="group mb-1 rounded-md border-l-2 px-2.5 py-1.5 hover:bg-surface-2" style={{ borderColor: KIND_COLOR[c.kind] }}>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <AgentTag handle={c.from} className="text-[11.5px]" />
              <ArrowRight size={10} className="text-faint" />
              <AgentTag handle={c.to} className="text-[11.5px]" />
              <KindBadge kind={c.kind} />
              <span className="tnum ml-auto text-[10px] text-faint opacity-0 group-hover:opacity-100">{fmtTime(c.at)}</span>
            </div>
            <div className={cn('mt-0.5 text-[12.5px] leading-snug', c.kind === 'task' && 'text-muted-foreground')}>{c.text}</div>
            {c.cites && c.cites.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.cites.map((ct) => (
                  <CiteChip key={ct.id} id={ct.id} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function Composer() {
  const [text, setText] = useState('')
  const load = useMission((s) => s.load)
  const mode = useMission((s) => s.mode)
  const started = useMission((s) => s.model.comms.length > 0)
  const submit = (q: string, run?: ScenarioId) => {
    if (!q.trim()) return
    if (mode === 'demo') {
      // Demo: the prompt starts the closest scripted review. Live: it goes to the Review Lead on Lagrange.
      const t = q.toLowerCase()
      load(run ?? (/apollo|1967|case/.test(t) ? 'apollo1' : /smoke|alarm|incident|bay/.test(t) ? 'incident' : 'habitat'), true)
    } else {
      fetch('/api/lagrange/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'flight', text: q }) }).catch(() => {})
    }
    setText('')
  }
  return (
    <div className="no-print shrink-0 border-t border-line p-2.5">
      {!started && (
        <div className="mb-2 flex flex-col gap-1">
          {SUGGEST.map((s) => (
            <button key={s.run} type="button" onClick={() => submit(s.text, s.run)} className="rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:border-line-2 hover:text-ink">
              {s.text}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
        className="flex items-end gap-2 rounded-xl border border-line-2 bg-surface px-3 py-2 focus-within:border-primary/60"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(text)
            }
          }}
          rows={2}
          placeholder="Message the Review Lead…"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-faint"
        />
        <button type="submit" disabled={!text.trim()} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30" aria-label="Send">
          <ArrowUp size={14} />
        </button>
      </form>
      <div className="mt-1 text-center text-[10.5px] text-faint">{mode === 'demo' ? 'Demo mode: a message starts the closest scripted review' : 'Live: sent to the Review Lead on Lagrange'}</div>
    </div>
  )
}
