// PRESENT: the review sized for a projector. The question, four headline readings, the cabin stage, the
// materials matrix and the decisions, in type large enough to read from the back of the room. Esc leaves.
import { useEffect, useMemo } from 'react'
import { AgentTag } from '@/components/bits'
import { Gauge, Logo, Reading } from '@/components/Logo'
import { stageRuns } from '@/demo/apollo1'
import { isPerson } from '@/demo/crew'
import { useSmokeStudy } from '@/lab/useSmokeStudy'
import { useMission } from '@/live/store'
import { Stage } from '@/stage/Stage'
import { FindingsView } from '@/views/FindingsView'

export function PresentScreen() {
  const request = useMission((s) => s.request)
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const model = useMission((s) => s.model)
  const setView = useMission((s) => s.setView)
  const answer = useMission((s) => s.answer)
  const { study } = useSmokeStudy(pkg, cabin)
  const runs = useMemo(() => (pkg && cabin ? stageRuns(pkg, cabin) : []), [pkg, cabin])

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setView('review')
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [setView])

  const m = model.matrix
  const burn = m.filter((r) => r.status !== 'pass').length
  const asBuilt = runs[0]
  const hatch = pkg?.hatch?.openTime ?? 90
  const missed = study?.cases.filter((c) => c.firstAlarm === null).length
  const decisions = [
    ...model.comms.filter((c) => c.kind === 'human' && isPerson(c.from)).map((c) => ({ id: c.id, who: c.from, text: c.text })),
    ...model.proposals.filter((p) => p.status !== 'open').map((p) => ({ id: p.id, who: p.decidedBy ?? p.by, text: `${p.id} ${p.title}: ${p.status}` })),
  ].slice(-5)
  const plan = model.plan?.subtasks.filter((s) => s.status !== 'skipped') ?? []
  const done = plan.filter((s) => s.status === 'done').length

  return (
    <div className="present flex min-h-0 flex-1 flex-col gap-4 p-5">
      <header className="flex items-end gap-6">
        <div className="min-w-0 flex-1">
          <div className="label flex items-center gap-2">
            {pkg?.vehicle ?? 'no cabin loaded'} · {pkg?.atmosphere.label}
            <span className="flex items-center gap-1 text-faint">
              <span className="kbd">esc</span> leave
            </span>
          </div>
          <h1 className="sans mt-1 text-display font-normal leading-[1.05] tracking-[-0.035em]">{request}</h1>
        </div>
        {plan.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 text-emph text-muted-foreground">
            <Gauge value={done / plan.length} size={48} busy={!model.done} />
            <span>
              <span className="tnum text-ink">{done}</span>/{plan.length} steps
            </span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-4 gap-3">
        <Big v={m.length ? `${burn}/${m.length}` : '—'} l="materials burn in this atmosphere" color={burn ? 'var(--pink)' : undefined} />
        <Big v={asBuilt?.rupture !== undefined ? `T+${asBuilt.rupture.toFixed(0)}` : asBuilt ? 'holds' : '—'} u={asBuilt?.rupture !== undefined ? 's' : undefined} l="hull rupture after ignition" color={asBuilt?.rupture !== undefined && asBuilt.rupture < hatch ? 'var(--pink)' : undefined} />
        <Big v={`${hatch}`} u="s" l="to open the hatch" />
        <Big v={study ? `${missed}/${study.cases.length}` : '—'} l="smoke cases the designed detectors miss" color={missed ? 'var(--pink)' : undefined} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-4">
        <section className="pane overflow-hidden">
          <div className="relative min-h-0 flex-1">
            <Stage />
          </div>
        </section>
        <div className="flex min-h-0 flex-col gap-4">
          <section className="pane min-h-0 flex-1 pt-3">
            <div className="pane-head shrink-0 px-4 pb-1 text-emph">
              <span className="font-medium text-ink">materials</span>
              <span className="normal-case text-faint">O₂ margin: graphite safe · orange thin · pink burns</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <FindingsView />
            </div>
          </section>
          <section className="pane shrink-0 gap-2 p-4">
            <div className="pane-head text-emph">
              <span className="font-medium text-ink">decisions</span>
            </div>
            {model.waiting && (
              <div className="you-card flex items-center gap-3 rounded-[12px] p-3">
                <Logo size={22} busy />
                <span className="sans min-w-0 flex-1 text-emph text-ink">{model.waiting.question}</span>
                <button type="button" onClick={() => answer(model.waiting!.options[0])} className="key key-you h-10 px-4 text-emph normal-case">
                  <span className="kbd">a</span>
                  {model.waiting.options[0]}
                </button>
              </div>
            )}
            {decisions.length === 0 && !model.waiting && <div className="text-emph text-faint">none yet</div>}
            {decisions.map((d) => (
              <div key={d.id} className="flex items-baseline gap-2.5 text-emph">
                <AgentTag handle={d.who} className="shrink-0 text-emph" />
                <span className="sans min-w-0 text-muted-foreground">{d.text}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

function Big({ v, u, l, color }: { v: string; u?: string; l: string; color?: string }) {
  return (
    <div className="lcd flex flex-col gap-1.5 px-4 py-3">
      <Reading v={v} u={u} color={color} size={34} className="!bg-transparent !p-0 !shadow-none" />
      <span className="text-emph text-[var(--muted)]">{l}</span>
    </div>
  )
}
