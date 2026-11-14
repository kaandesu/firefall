// A historical incident replayed through the crew: what happened (sourced timeline), what the evidence
// says, and an honest verdict — prevented, caught earlier, better response, or outside PSI's scope.
import { BookOpen, CheckCircle2, ExternalLink, Flame, ShieldAlert, Wrench } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Empty } from '@/components/bits'
import { useMission } from '@/live/store'
import type { CaseItem, Verdict } from '@/live/types'

const KIND: Record<CaseItem['kind'], { color: string; icon: typeof Flame; label: string }> = {
  event: { color: 'var(--k-task)', icon: Flame, label: 'event' },
  cause: { color: 'var(--flame)', icon: ShieldAlert, label: 'cause' },
  response: { color: 'var(--k-reply)', icon: Wrench, label: 'response' },
  finding: { color: 'var(--k-review)', icon: BookOpen, label: 'finding' },
}

const OUTCOME: Record<Verdict['outcome'], { label: string; color: string }> = {
  prevented: { label: 'WOULD HAVE BEEN FLAGGED', color: 'var(--k-reply)' },
  earlier: { label: 'CAUGHT EARLIER', color: 'var(--ug)' },
  'better-response': { label: 'BETTER RESPONSE', color: 'var(--k-ask)' },
  'out-of-scope': { label: 'OUTSIDE PSI SCOPE', color: 'var(--muted)' },
}

export function CaseView() {
  const cf = useMission((s) => s.model.caseFile)
  if (!cf) return <Empty icon={<BookOpen size={28} />} title="No case file open" hint="Pick a case file (e.g. Apollo 1) in the top bar to replay a real incident through the crew." />
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="p-3">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-flame">Case file</div>
        <h2 className="mt-0.5 text-[16px] font-semibold leading-tight">{cf.title}</h2>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {cf.when} · {cf.where}
        </div>
        <div className="mono mt-1.5 inline-block rounded bg-flame/10 px-1.5 py-0.5 text-[10.5px] text-flame">{cf.atmosphere}</div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink/85">{cf.summary}</p>

        <ol className="relative mt-3 border-l border-line-2 pl-4">
          <AnimatePresence initial={false}>
            {cf.items.map((it) => {
              const k = KIND[it.kind]
              const Icon = k.icon
              return (
                <motion.li key={it.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="relative mb-3">
                  <span className="absolute -left-[23px] top-0.5 flex size-[14px] items-center justify-center rounded-full ring-2 ring-surface" style={{ background: k.color }}>
                    <Icon size={8} className="text-black" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px] uppercase tracking-wider" style={{ color: k.color }}>
                      {it.when}
                    </span>
                    {it.source && (
                      <a href={it.source.url} target="_blank" rel="noreferrer" className="mono flex items-center gap-0.5 text-[9.5px] text-faint hover:text-ug">
                        {it.source.label} <ExternalLink size={8} />
                      </a>
                    )}
                  </div>
                  <div className="text-[12.5px] leading-snug">{it.text}</div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>

        {cf.verdict && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 rounded-lg border p-3" style={{ borderColor: OUTCOME[cf.verdict.outcome].color, background: `color-mix(in oklab, ${OUTCOME[cf.verdict.outcome].color} 7%, var(--surface-2))` }}>
            <div className="mono flex items-center gap-1.5 text-[10.5px] font-semibold tracking-widest" style={{ color: OUTCOME[cf.verdict.outcome].color }}>
              <CheckCircle2 size={13} /> {OUTCOME[cf.verdict.outcome].label}
            </div>
            <div className="mt-1 text-[13.5px] font-semibold leading-snug">{cf.verdict.headline}</div>
            <ul className="mt-1.5 space-y-1">
              {cf.verdict.would.map((w) => (
                <li key={w} className="text-[12px] leading-snug text-ink/85">
                  · {w}
                </li>
              ))}
            </ul>
            {cf.verdict.bridge && (
              <div className="mt-2 rounded-md border border-flame/40 bg-flame/10 p-2 text-[12px] leading-snug">
                <span className="mono mr-1 text-[9.5px] uppercase tracking-widest text-flame">bridge → base camp</span>
                {cf.verdict.bridge}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
