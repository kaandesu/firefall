// The deliverable: a draft fire hazard report in the shape a safety review panel expects
// (hazard, causes, controls, verification, open items), assembled from the agents' sections.
import { FileText, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { AgentTag, CiteChip, Empty, StatusPill } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { PACKAGES } from '@/demo/packages'
import { useMission } from '@/live/store'
import type { DossierSection } from '@/live/types'

const RISK: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'var(--ok)' },
  moderate: { label: 'Moderate', color: 'var(--warn)' },
  high: { label: 'High', color: 'var(--flame)' },
  critical: { label: 'Critical', color: 'var(--bad)' },
}

const HEADING: Record<DossierSection['pillar'], string> = {
  summary: 'Hazard summary',
  prevention: 'Cause control · prevention (materials)',
  detection: 'Cause control · detection',
  suppression: 'Cause control · suppression',
  cross: 'Analysis',
  limits: 'Verification limits & assumptions',
  actions: 'Open items & actions',
  earth: 'Benefit beyond this vehicle',
}

const ORDER: DossierSection['pillar'][] = ['summary', 'prevention', 'detection', 'suppression', 'cross', 'limits', 'actions', 'earth']

export function ReportView() {
  const scenario = useMission((s) => s.scenario)
  const run = useMission((s) => s.model.run)
  const raw = useMission((s) => s.model.dossier)
  const matrix = useMission((s) => s.model.matrix)
  const tests = useMission((s) => s.model.tests)
  const allSims = useMission((s) => s.model.sims)
  const done = useMission((s) => s.model.done)
  const sims = useMemo(() => allSims.filter((x) => x.metrics), [allSims])
  const sections = useMemo(() => {
    // A crew card leads with the actions; a hazard report with the summary.
    const order = scenario === 'incident' ? (['actions', ...ORDER.filter((p) => p !== 'actions')] as typeof ORDER) : ORDER
    return [...raw].sort((a, b) => order.indexOf(a.pillar) - order.indexOf(b.pillar))
  }, [raw, scenario])
  const pkg = PACKAGES[scenario]
  if (!raw.length)
    return <Empty icon={<FileText size={28} />} title="Hazard report not started" hint="The Report agent drafts it after Safety Assurance has checked every claim. Sections appear here as they are written." />
  const summary = sections.find((s) => s.pillar === 'summary')
  const docTitle = run?.scenario === 'incident' ? 'Crew response card' : run?.scenario === 'case' ? 'Case review' : 'Fire hazard report'

  return (
    <div className="scroll-thin h-full overflow-y-auto bg-surface-2">
      <article className="mx-auto my-5 max-w-3xl rounded-lg border border-line bg-surface px-8 py-7 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">{docTitle} · draft</div>
            <h1 className="mt-1 text-xl font-semibold leading-tight">{run?.title ?? pkg.vehicle}</h1>
          </div>
          <Button size="sm" variant="outline" className="no-print h-8 text-xs" onClick={() => window.print()} disabled={!done}>
            <Printer size={13} /> Export PDF
          </Button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 border-y border-line py-3 text-[12.5px] sm:grid-cols-3">
          <Meta k="Vehicle" v={pkg.vehicle} />
          <Meta k="Review" v={pkg.phase} />
          <Meta k="Atmosphere" v={pkg.atmosphere.label} />
          <Meta k="Gravity" v={pkg.gravity.label} />
          <Meta k="Status" v={done ? 'Draft · awaiting your sign-off' : 'Being written'} />
          {summary?.risk && <Meta k="Risk" v={RISK[summary.risk].label} color={RISK[summary.risk].color} />}
        </dl>

        {summary?.metrics && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.metrics.map((m) => (
              <div key={m.label} className="rounded-md border border-line px-3 py-2">
                <div className="tnum text-lg font-semibold">{m.value}</div>
                <div className="text-[11px] leading-tight text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {sections.map((s, i) => (
          <section key={s.id} className="mt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[15px] font-semibold">
                {i + 1}. {s.pillar === 'summary' ? HEADING.summary : s.title}
              </h2>
              {s.pillar !== 'summary' && <span className="text-[11px] text-faint">{HEADING[s.pillar]}</span>}
              <span className="ml-auto shrink-0 text-[11px] text-faint">
                by <AgentTag handle={s.author} className="text-[11px]" />
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {s.body.map((b, j) => (
                <p key={j} className="text-[13.5px] leading-relaxed">
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
          </section>
        ))}

        {matrix.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold">{sections.length + 1}. Materials at the target atmosphere</h2>
            <table className="mt-2 w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-muted-foreground">
                  <th className="py-1.5 font-medium">Item</th>
                  <th className="font-medium">Material</th>
                  <th className="font-medium">Result</th>
                  <th className="font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="py-1.5 pr-2">{r.item}</td>
                    <td className="pr-2 text-muted-foreground">{r.material}</td>
                    <td className="pr-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="text-muted-foreground">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tests.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold">{sections.length + 2}. Verification · test requests</h2>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              {tests.map((t) => (
                <li key={t.id}>
                  <span className="mono text-[12px] text-muted-foreground">{t.id}</span> {t.test} — {t.material} at {t.atmosphere}, {t.lab}.{' '}
                  <span className="text-muted-foreground">
                    Status: {t.status}
                    {t.eta ? `, ${t.eta}` : ''}.
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sims.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold">Appendix · simulation evidence</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {sims.map((r) => (
                <div key={r.id} className="rounded-md border border-line p-2.5">
                  <div className="text-[12.5px] font-medium">{r.label}</div>
                  {Object.entries(r.metrics ?? {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11.5px]">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="tnum">{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Simplified engineering models for triage. They show what to test first; they do not replace NASA-STD-6001 testing or FDS fire modelling.</p>
          </section>
        )}
      </article>
    </div>
  )
}

function Meta({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="font-medium" style={color ? { color } : undefined}>
        {v}
      </dd>
    </div>
  )
}
