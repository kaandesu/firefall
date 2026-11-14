// The pitch, in-app: the hook, sixty years of spacecraft fires, why base camp is harder, and what exists today.
import { ArrowRight, ExternalLink, X } from 'lucide-react'
import { motion } from 'motion/react'
import { INCIDENTS, KIND_TONE } from '@/data/incidents'
import { useMission } from '@/live/store'
import type { ScenarioId } from '@/demo/scenarios'
import { cn } from '@/lib/utils'

const EXISTING = [
  { what: 'PSI website', limit: 'Keyword search; data files behind a login; no comparison or interpretation.', us: 'Ranks all 24 combustion investigations against your scenario.' },
  { what: 'NASA SDE / INDUS', limit: 'General science search; no fire-safety reasoning, no sims.', us: 'Specialists argue; SKEPTIC enforces citations and data limits.' },
  { what: 'FDS fire models', limit: '“Computationally intensive and not suitable for parametric studies” (NASA Glenn).', us: 'Instant parametric sims, bounded µg ↔ 1 g — triage before FDS.' },
  { what: 'Chat-with-papers', limit: 'One black-box answer.', us: 'A visible plan, delegation and evidence trail over A2A (Lagrange).' },
]

export function BriefView() {
  const open = useMission((s) => s.showBrief)
  const setBrief = useMission((s) => s.setBrief)
  const load = useMission((s) => s.load)
  if (!open) return null
  const start = (id: ScenarioId) => {
    setBrief(false)
    load(id, true)
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur">
      <button type="button" onClick={() => setBrief(false)} className="fixed right-5 top-4 z-10 rounded-full border border-line p-2 text-muted-foreground hover:text-ink">
        <X size={16} />
      </button>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-flame">April 2026 · Artemis II · 80,000 miles from home</div>
        <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.1]">
          “If you want to get somebody’s attention really quick, make the fire alarm go off in your spacecraft.”
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] text-muted-foreground">
          Orion’s smoke alarm shut down ventilation and power on the second-to-last day. The crew recovered in minutes. Sixty years of spaceflight say alarms like this are the rule, not the exception.
        </p>

        <h2 className="mono mt-10 text-[11px] uppercase tracking-[0.25em] text-faint">Every fire changed the rules</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {INCIDENTS.map((i) => (
            <div key={i.year + i.where} className="rounded-lg border border-line bg-surface/70 p-3" style={{ borderLeft: `3px solid ${KIND_TONE[i.kind]}` }}>
              <div className="flex items-center gap-2">
                <span className="mono text-[13px] font-semibold">{i.year}</span>
                <span className="text-[12px] text-muted-foreground">{i.where}</span>
                <span className="mono rounded px-1 text-[9px] uppercase" style={{ color: KIND_TONE[i.kind], background: `color-mix(in oklab, ${KIND_TONE[i.kind]} 14%, transparent)` }}>
                  {i.kind}
                </span>
                {i.status === 'team' && <span className="mono rounded bg-k-ask/10 px-1 text-[9px] text-k-ask">verify</span>}
                {i.source && (
                  <a href={i.source.url} target="_blank" rel="noreferrer" className="ml-auto text-faint hover:text-ug" title={i.source.label}>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="mt-1 text-[12.5px] leading-snug">{i.what}</div>
              <div className="mt-1 text-[11.5px] text-k-reply/90">→ {i.fix}</div>
              {i.caseFile && (
                <button type="button" onClick={() => start(i.caseFile as ScenarioId)} className="mono mt-1.5 flex items-center gap-1 text-[10.5px] text-gold hover:underline">
                  replay case file <ArrowRight size={10} />
                </button>
              )}
            </div>
          ))}
        </div>

        <h2 className="mono mt-10 text-[11px] uppercase tracking-[0.25em] text-faint">Spacecraft is where the data is. Base camp is where the danger is.</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            ['34 % O₂ at 8.2 psia', 'NASA’s exploration atmosphere for the Moon base and rovers. It cuts prebreathe time and makes materials far more flammable.'],
            ['70 % of subsystems', 'A 2026 NASA ECLSS study: flammability is the most critical hurdle, and most assessed subsystems need replacement materials.'],
            ['0 partial-g tests', 'Every PSI combustion test ran in µg. Moon and Mars must be bounded between µg and 1 g until LUCI and FM2 fly.'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-flame/30 bg-flame/5 p-4">
              <div className="text-[22px] font-semibold text-flame">{k}</div>
              <div className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="mono mt-10 text-[11px] uppercase tracking-[0.25em] text-faint">What exists — and what a crew of agents adds</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          {EXISTING.map((e, i) => (
            <div key={e.what} className={cn('grid grid-cols-[160px_1fr_1fr] gap-3 px-3 py-2 text-[12.5px]', i % 2 ? 'bg-surface/40' : 'bg-surface/80')}>
              <div className="font-semibold">{e.what}</div>
              <div className="text-muted-foreground">{e.limit}</div>
              <div className="text-ug">{e.us}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          <button type="button" onClick={() => start('apollo1')} className="flex items-center gap-2 rounded-lg border border-gold/50 px-4 py-2 text-[13px] text-gold hover:bg-gold/10">
            1 · Case file: Apollo 1 <ArrowRight size={13} />
          </button>
          <button type="button" onClick={() => start('habitat')} className="flex items-center gap-2 rounded-lg bg-ug px-4 py-2 text-[13px] font-medium text-primary-foreground hover:brightness-110">
            2 · Habitat review: base camp rover <ArrowRight size={13} />
          </button>
          <button type="button" onClick={() => start('incident')} className="flex items-center gap-2 rounded-lg border border-k-fail/50 px-4 py-2 text-[13px] text-k-fail hover:bg-k-fail/10">
            3 · Live incident: smoke alarm <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
