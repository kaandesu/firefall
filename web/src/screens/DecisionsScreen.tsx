// DECISIONS: the audit trail. Every call a person made (with the question that led to it and the agents who
// argued each side), every change an agent proposed (with the reviews and the before/after), and anything still
// waiting on you at the top. Built only from what is already on the network: comms, proposals, the open ask.
import { useMemo } from 'react'
import { AgentTag, Avatar, CiteChip } from '@/components/bits'
import { Logo, OrbNote, Reading } from '@/components/Logo'
import { agentName, isPerson } from '@/demo/crew'
import type { Comm } from '@/live/model'
import { useMission } from '@/live/store'
import type { Proposal } from '@/live/types'
import { cn } from '@/lib/utils'

type Row =
  | { kind: 'decision'; at: number; by: string; text: string; question?: Comm; context: Comm[] }
  | { kind: 'proposal'; at: number; p: Proposal }

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

const STANCE = { endorse: 'var(--green)', object: 'var(--pink)', comment: 'var(--muted)' } as const

export function DecisionsScreen() {
  const comms = useMission((s) => s.model.comms)
  const proposals = useMission((s) => s.model.proposals)
  const waiting = useMission((s) => s.model.waiting)
  const answer = useMission((s) => s.answer)
  const setView = useMission((s) => s.setView)

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    comms.forEach((c, i) => {
      if (c.kind !== 'human' || !isPerson(c.from)) return
      // the question this answers: the last message to this person before it, on the same task if we know it
      const before = comms.slice(0, i).reverse()
      const question = before.find((q) => q.to === c.from && (!c.taskId || q.taskId === c.taskId)) ?? before.find((q) => q.to === c.from)
      const context = question?.taskId ? comms.slice(0, i).filter((q) => q.taskId === question.taskId && q.id !== question.id && q.kind !== 'task').slice(-3) : []
      out.push({ kind: 'decision', at: c.at, by: c.from, text: c.text, question, context })
    })
    // proposals sit where their decision happened; open ones go last
    proposals.forEach((p, i) => {
      const decided = comms.find((c) => c.kind === 'human' && c.text.includes(p.id))
      out.push({ kind: 'proposal', at: decided ? decided.at + 0.001 : Number.MAX_SAFE_INTEGER - proposals.length + i, p })
    })
    return out.sort((a, b) => a.at - b.at)
  }, [comms, proposals])

  const nDecisions = rows.filter((r) => r.kind === 'decision').length
  const nAccepted = proposals.filter((p) => p.status === 'accepted').length

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[980px] flex-col gap-5 px-6 py-7">
        <div className="flex items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="label">decision log</div>
            <h1 className="sans mt-1.5 text-display font-normal tracking-[-0.035em]">Who decided what, and on what evidence.</h1>
            <p className="sans mt-1 max-w-[680px] text-body text-muted-foreground">
              Every call a person made on this review, the question that led to it and what each agent argued. Proposed changes show their reviews and what they change. This is the trail a safety panel reads.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Stat v={nDecisions} l="decisions by people" />
            <Stat v={`${nAccepted}/${proposals.length}`} l="proposals accepted" />
          </div>
        </div>

        {waiting && (
          <article className="you-card rounded-[14px] p-4">
            <div className="flex items-center gap-2 text-label lowercase text-you">
              <Logo size={16} busy /> waiting on you · asked by {agentName(waiting.from)} · {fmtTime(waiting.at)}
            </div>
            <div className="sans mt-1.5 text-title leading-snug text-ink">{waiting.question}</div>
            {waiting.positions && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {waiting.positions.map((p) => (
                  <div key={p.by} className="rounded-[10px] border border-line bg-surface p-2.5">
                    <AgentTag handle={p.by} className="text-body" />
                    <div className="sans mt-1 text-body text-muted-foreground">{p.text}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {waiting.options.map((o, i) => (
                <button key={o} type="button" onClick={() => answer(o)} className={cn('key h-8 px-3.5 text-body normal-case', i === 0 && 'key-you')}>
                  {i === 0 && <span className="kbd">a</span>}
                  {o}
                </button>
              ))}
              <button type="button" onClick={() => setView('review')} className="key h-8 px-3.5 text-body">
                open in review
              </button>
            </div>
          </article>
        )}

        {rows.length === 0 && !waiting && <OrbNote className="py-16">No decisions yet. Calls you make on the review, and changes agents propose, collect here with their evidence.</OrbNote>}

        <ol className="relative flex flex-col gap-3 before:absolute before:bottom-2 before:left-[66px] before:top-2 before:w-px before:bg-line-2">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[56px_20px_1fr] items-start gap-0">
              <span className="tnum pt-3 text-right text-label text-faint">{r.kind === 'decision' || r.at < Number.MAX_SAFE_INTEGER - 100 ? fmtTime(Math.floor(r.at)) : 'open'}</span>
              <span className="relative z-10 mt-3.5 flex justify-center">
                <span className="led" style={{ ['--led' as string]: r.kind === 'decision' ? 'var(--you)' : r.p.status === 'accepted' ? 'var(--green)' : r.p.status === 'rejected' ? 'var(--red)' : 'var(--faint)' }} />
              </span>
              {r.kind === 'decision' ? <DecisionCard r={r} /> : <ProposalCard p={r.p} />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Stat({ v, l }: { v: string | number; l: string }) {
  return (
    <div className="lcd px-3 py-2">
      <div className="lcd-font tnum text-headline leading-none">{v}</div>
      <div className="mt-1 text-label text-[var(--muted)]">{l}</div>
    </div>
  )
}

function DecisionCard({ r }: { r: Extract<Row, { kind: 'decision' }> }) {
  return (
    <article className="pane gap-2 p-3.5">
      <div className="flex items-center gap-2 text-label text-muted-foreground">
        <Avatar handle={r.by} size={20} />
        <span className="text-ink">{agentName(r.by)}</span> decided
      </div>
      <div className="sans text-emph font-medium leading-snug text-ink">{r.text}</div>
      {r.question && (
        <div className="rounded-[10px] border border-line bg-surface-2 p-2.5 text-body">
          <div className="flex items-center gap-1.5 text-label text-faint">
            asked by <AgentTag handle={r.question.from} className="text-label" />
          </div>
          <div className="sans mt-0.5 text-muted-foreground">{r.question.text}</div>
          {r.question.cites && r.question.cites.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {r.question.cites.map((c) => (
                <CiteChip key={c.id} id={c.id} note={c.note} />
              ))}
            </div>
          )}
        </div>
      )}
      {r.context.length > 0 && (
        <div className="space-y-1">
          <div className="text-label text-faint">what led to it</div>
          {r.context.map((c) => (
            <div key={c.id} className="flex items-baseline gap-2 text-body">
              <AgentTag handle={c.from} className="shrink-0 text-body" />
              <span className="sans min-w-0 text-muted-foreground">{c.text}</span>
              {c.cites?.map((ct) => <CiteChip key={ct.id} id={ct.id} note={ct.note} className="shrink-0" />)}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function ProposalCard({ p }: { p: Proposal }) {
  const status = { accepted: 'var(--green)', rejected: 'var(--red)', open: 'var(--muted)', escalated: 'var(--pink)', deferred: 'var(--muted)' }[p.status]
  return (
    <article className="pane gap-2.5 p-3.5">
      <div className="flex items-center gap-2 text-label text-muted-foreground">
        <Avatar handle={p.by} size={20} />
        <AgentTag handle={p.by} className="text-label" /> proposed
        <span className="tnum text-faint">{p.id}</span>
        <span className="ml-auto lowercase" style={{ color: status }}>
          {p.status}
          {p.decidedBy && <span className="text-faint"> · by {agentName(p.decidedBy)}</span>}
        </span>
      </div>
      <div className="sans text-emph font-medium leading-snug text-ink">{p.title}</div>
      <div className="sans text-body text-muted-foreground">{p.change}</div>
      {p.impact.length > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(3, p.impact.length)}, minmax(0, 1fr))` }}>
          {p.impact.map((im) => (
            <div key={im.label} className="rounded-[10px] border border-line bg-surface-2 px-2.5 py-2">
              <div className="text-label text-faint">{im.label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Reading v={im.before} color="var(--pink)" size={12} />
                <span className="text-faint">→</span>
                <Reading v={im.after} color="var(--green)" size={12} />
              </div>
            </div>
          ))}
        </div>
      )}
      {p.reviews.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-label text-faint">reviews</div>
          {p.reviews.map((rv, i) => (
            <div key={i} className="flex items-baseline gap-2 text-body">
              <span className="w-[54px] shrink-0 text-label lowercase" style={{ color: STANCE[rv.stance] }}>
                {rv.stance === 'object' ? 'objects' : rv.stance === 'endorse' ? 'endorses' : 'comments'}
              </span>
              <AgentTag handle={rv.by} className="shrink-0 text-body" />
              <span className="sans min-w-0 text-muted-foreground">{rv.text}</span>
              {rv.cites?.map((ct) => <CiteChip key={ct.id} id={ct.id} note={ct.note} className="shrink-0" />)}
            </div>
          ))}
        </div>
      )}
      <div className="text-label text-faint">why: {p.why}</div>
    </article>
  )
}
