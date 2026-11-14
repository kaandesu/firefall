// Overview: what was asked, the plan the team is working through, and where the outputs stand.
import { FileText, FlaskConical, Play, Table2 } from 'lucide-react'
import { Avatar } from '@/components/bits'
import { HUMAN } from '@/demo/crew'
import { PACKAGES } from '@/demo/packages'
import { SCENARIOS } from '@/demo/scenarios'
import { useMission, type ViewId } from '@/live/store'
import { PlanView } from './PlanView'

export function OverviewView() {
  const scenario = useMission((s) => s.scenario)
  const tasks = useMission((s) => s.model.tasks)
  const matrix = useMission((s) => s.model.matrix)
  const tests = useMission((s) => s.model.tests)
  const dossier = useMission((s) => s.model.dossier)
  const plan = useMission((s) => s.model.plan)
  const play = useMission((s) => s.play)
  const setTab = useMission((s) => s.setTab)
  const sc = SCENARIOS[scenario]
  const pkg = PACKAGES[scenario]
  const root = Object.values(tasks).find((t) => !t.parent && t.from === HUMAN)

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3">
        <Avatar handle={HUMAN} size={28} />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-muted-foreground">Request to the Review Lead · {pkg.vehicle}</div>
          <div className="mt-0.5 text-[14px] leading-snug">{root?.summary ?? sc.tagline}</div>
        </div>
        {!root && (
          <button type="button" onClick={play} className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground">
            <Play size={13} /> Start review
          </button>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-2">
        <Out icon={<Table2 size={15} />} title="Materials matrix" value={matrix.length ? `${matrix.filter((r) => r.status !== 'pass').length} of ${matrix.length} need action` : 'pending'} to="materials" go={setTab} />
        <Out icon={<FlaskConical size={15} />} title="Test requests" value={tests.length ? tests.map((t) => `${t.id} ${t.status}`).join(', ') : 'none yet'} to="materials" go={setTab} />
        <Out icon={<FileText size={15} />} title={scenario === 'incident' ? 'Crew response card' : 'Hazard report'} value={dossier.length ? `${dossier.length} sections drafted` : 'not started'} to="report" go={setTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">{plan ? <PlanView /> : <PlanView />}</div>
    </div>
  )
}

function Out({ icon, title, value, to, go }: { icon: React.ReactNode; title: string; value: string; to: ViewId; go: (v: ViewId) => void }) {
  return (
    <button type="button" onClick={() => go(to)} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-line-2 hover:bg-surface-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium">{title}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{value}</span>
      </span>
    </button>
  )
}
