// Proposals: a change one agent puts forward, reviewed by agents in other departments and orgs, decided by a person.
import { CiteChip } from '@/components/bits'
import { OrbNote } from '@/components/Logo'
import { agentColor, agentName, orgOf } from '@/demo/crew'
import { useMission } from '@/live/store'
import type { Proposal } from '@/live/types'

const STATUS: Record<Proposal['status'], { t: string; c: string }> = {
  open: { t: 'in review', c: 'var(--k-task)' },
  escalated: { t: 'waiting on you', c: 'var(--warn)' },
  accepted: { t: 'accepted', c: 'var(--ok)' },
  rejected: { t: 'rejected', c: 'var(--bad)' },
  deferred: { t: 'deferred', c: 'var(--faint)' },
}
const STANCE = { endorse: { t: 'endorses', c: 'var(--ok)' }, object: { t: 'objects', c: 'var(--bad)' }, comment: { t: 'comments', c: 'var(--muted)' } }

export function ProposalsView() {
  const proposals = useMission((s) => s.model.proposals)
  if (!proposals.length) return <OrbNote className="!p-3">no proposals yet. agents propose design changes here; other agents review them; you decide.</OrbNote>
  return (
    <div className="scroll-thin h-full space-y-2 overflow-y-auto px-2">
      {proposals.map((p) => (
        <div key={p.id} className="rounded-sm border border-line-2 bg-surface-2 p-2.5 text-body">
          <div className="flex items-center gap-2">
            <span className="text-faint">{p.id}</span>
            <span className="sans text-emph font-medium text-ink">{p.title}</span>
            <span className="ml-auto" style={{ color: STATUS[p.status].c }}>
              {STATUS[p.status].t}
              {p.decidedBy && ` · by ${agentName(p.decidedBy)}`}
            </span>
          </div>
          <div className="mt-0.5 text-label" style={{ color: agentColor(p.by) }}>
            proposed by {agentName(p.by)} · {orgOf(p.by)?.name}
          </div>
          <div className="sans mt-1.5 leading-snug text-ink">{p.change}</div>
          <div className="sans mt-0.5 leading-snug text-muted-foreground">{p.why}</div>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-label">
            {p.impact.map((i) => (
              <div key={i.label} className="contents">
                <span className="text-faint">{i.label}</span>
                <span className="text-bad">{i.before}</span>
                <span className="text-faint">→</span>
                <span className="text-ok">{i.after}</span>
              </div>
            ))}
          </div>
          {p.reviews.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-line pt-1.5">
              {p.reviews.map((r) => (
                <div key={r.by} className="flex gap-2">
                  <span className="w-[120px] shrink-0" style={{ color: agentColor(r.by) }}>
                    {agentName(r.by)}
                    <span className="block text-label lowercase" style={{ color: STANCE[r.stance].c }}>
                      {STANCE[r.stance].t}
                    </span>
                  </span>
                  <span className="sans leading-snug text-ink">
                    {r.text} {r.cites?.map((c) => <CiteChip key={c.id} id={c.id} />)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
