// Center: one view at a time, chosen by tabs. A dot marks tabs with new content; "Follow the run" moves
// between tabs as the team produces things (off = you navigate yourself).
import { Siren, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { agentName } from '@/demo/crew'
import { SCENARIOS } from '@/demo/scenarios'
import { tabCount, useMission, VIEWS, type ViewId } from '@/live/store'
import { cn } from '@/lib/utils'
import { CaseView } from '@/views/CaseView'
import { EvidenceView } from '@/views/EvidenceView'
import { GuideView } from '@/views/GuideView'
import { MaterialsView } from '@/views/MaterialsView'
import { OverviewView } from '@/views/OverviewView'
import { ReportView } from '@/views/ReportView'
import { SimView } from '@/views/SimView'
import { WorkspaceView } from '@/views/WorkspaceView'

const RENDER: Record<ViewId, () => React.ReactElement> = {
  guide: () => <GuideView />,
  overview: () => <OverviewView />,
  case: () => <CaseView />,
  materials: () => <MaterialsView />,
  evidence: () => <EvidenceView />,
  sim: () => <SimView />,
  report: () => <ReportView />,
  agent: () => <WorkspaceView />,
}

export function CenterPanel() {
  const tab = useMission((s) => s.tab)
  const setTab = useMission((s) => s.setTab)
  const scenario = useMission((s) => s.scenario)
  const model = useMission((s) => s.model)
  const seen = useMission((s) => s.seen)
  const follow = useMission((s) => s.follow)
  const setFollow = useMission((s) => s.setFollow)
  const selected = useMission((s) => s.selectedAgent)
  const kind = SCENARIOS[scenario].kind
  const alarm = model.alarms[model.alarms.length - 1]
  const tabs = VIEWS.filter((v) => (v.id === 'case' ? kind === 'case' : v.id === 'agent' ? tab === 'agent' : true))

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="no-print flex shrink-0 items-center gap-0.5 border-b border-line bg-surface px-2">
        {tabs.map((v) => {
          const fresh = v.id !== tab && tabCount(model, v.id) > (seen[v.id] ?? 0)
          const label = v.id === 'agent' ? agentName(selected) : v.id === 'report' && kind === 'incident' ? 'Crew card' : v.label
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setTab(v.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 py-2.5 text-[12.5px] transition',
                tab === v.id ? 'font-medium text-ink' : 'text-muted-foreground hover:text-ink',
              )}
            >
              {label}
              {fresh && <span className="size-1.5 rounded-full bg-primary" />}
              {v.id === 'agent' && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTab('overview')
                  }}
                  className="rounded p-0.5 text-faint hover:text-ink"
                >
                  <X size={11} />
                </span>
              )}
              {tab === v.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          )
        })}
        <label className="ml-auto flex shrink-0 items-center gap-2 pl-3 text-[12px] text-muted-foreground" title="Switch tabs automatically as the team produces results">
          Follow the run
          <Switch checked={follow} onCheckedChange={setFollow} />
        </label>
      </div>
      {alarm && (
        <div className="no-print flex shrink-0 items-center gap-2 border-b border-bad/30 bg-bad/10 px-4 py-1.5 text-[12.5px] text-bad">
          <Siren size={14} />
          <span className="font-semibold">Smoke alarm</span>
          <span>
            {alarm.module} · {alarm.detector}
          </span>
          <span className="ml-auto text-[12px] opacity-80">{alarm.text}</span>
        </div>
      )}
      <div className="min-h-0 flex-1">{RENDER[tab]()}</div>
    </div>
  )
}
