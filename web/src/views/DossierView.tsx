import { FileText, Printer } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { AgentTag, Avatar, CiteChip, Empty } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { PILLAR_COLOR } from '@/data/psi'
import { useMission } from '@/live/store'
import type { DossierSection } from '@/live/types'
import { cn } from '@/lib/utils'

const RISK: Record<string, { label: string; color: string }> = {
  low: { label: 'LOW', color: 'var(--k-reply)' },
  moderate: { label: 'MODERATE', color: 'var(--k-ask)' },
  high: { label: 'HIGH', color: 'var(--flame)' },
  critical: { label: 'CRITICAL', color: 'var(--k-fail)' },
}

const SECTION_COLOR: Record<DossierSection['pillar'], string> = {
  ...PILLAR_COLOR,
  summary: 'var(--flame)',
  limits: 'var(--k-ask)',
  earth: 'var(--k-reply)',
  actions: 'var(--ug)',
}

export function DossierView() {
  const run = useMission((s) => s.model.run)
  const sections = useMission((s) => s.model.dossier)
  const allSims = useMission((s) => s.model.sims)
  const sims = useMemo(() => allSims.filter((x) => x.metrics), [allSims])
  const done = useMission((s) => s.model.done)
  if (!sections.length) return <Empty icon={<FileText size={28} />} title="Dossier not started" hint="SCRIBE assembles it once SKEPTIC has reviewed every claim." />
  const summary = sections.find((s) => s.pillar === 'summary' || s.id === 'actions')
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-flame">{run?.scenario === 'incident' ? 'Crew action card' : 'Fire safety dossier'}</div>
            <h2 className="mt-1 text-lg font-semibold leading-tight">{run?.title}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {run &&
                Object.entries(run.spec).map(([k, v]) => (
                  <span key={k} className="mono rounded bg-surface-3 px-1.5 py-px text-[10px] text-muted-foreground">
                    {v}
                  </span>
                ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {summary?.risk && (
              <div className="mono rounded-md px-2 py-1 text-[11px] font-semibold tracking-widest" style={{ color: RISK[summary.risk].color, background: `color-mix(in oklab, ${RISK[summary.risk].color} 14%, transparent)` }}>
                RISK {RISK[summary.risk].label}
              </div>
            )}
            <Button size="sm" variant="outline" className="no-print h-7 text-xs" onClick={() => window.print()} disabled={!done}>
              <Printer size={12} /> Export
            </Button>
          </div>
        </div>
        {summary?.metrics && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.metrics.map((m) => (
              <div key={m.label} className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <div className="mono text-[17px] font-medium">{m.value}</div>
                <div className="text-[10.5px] text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {sections.map((s) => (
            <motion.section key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-line bg-surface/70 p-3" style={{ borderLeft: `3px solid ${SECTION_COLOR[s.pillar]}` }}>
              <div className="flex items-center gap-2">
                <h3 className="text-[13.5px] font-semibold" style={{ color: SECTION_COLOR[s.pillar] }}>
                  {s.title}
                </h3>
                {s.risk && s.pillar !== 'summary' && (
                  <span className="mono rounded px-1 text-[9px]" style={{ color: RISK[s.risk].color, background: `color-mix(in oklab, ${RISK[s.risk].color} 14%, transparent)` }}>
                    {RISK[s.risk].label}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <Avatar handle={s.author} size={14} />
                  <AgentTag handle={s.author} className="text-[9.5px]" />
                </span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {s.body.map((b, i) => (
                  <p key={i} className={cn('text-[12.5px] leading-relaxed', s.pillar === 'actions' ? 'text-ink' : 'text-ink/85')}>
                    {b}
                  </p>
                ))}
              </div>
              {s.cites && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.cites.map((c) => (
                    <CiteChip key={c.id} id={c.id} />
                  ))}
                </div>
              )}
            </motion.section>
          ))}
        </AnimatePresence>
        {sims.length > 0 && (
          <section className="mt-4">
            <h3 className="mono text-[10px] uppercase tracking-widest text-faint">Simulation evidence</h3>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {sims.map((r) => (
                <div key={r.id} className="rounded-lg border border-ug/25 bg-ug/5 p-2">
                  <div className="text-[11.5px] font-medium">{r.label}</div>
                  {Object.entries(r.metrics ?? {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10.5px]">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="mono">{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-faint">Illustrative engineering models for triage; confirm with FDS and calibrated PSI datasets.</div>
          </section>
        )}
      </div>
    </div>
  )
}
