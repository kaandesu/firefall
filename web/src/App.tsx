import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMission } from '@/live/store'
import { IntakeScreen } from '@/screens/IntakeScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { RunScreen } from '@/screens/RunScreen'
import { SetupScreen } from '@/screens/SetupScreen'
import { TopBar } from '@/screens/TopBar'
import { ComputeScreen } from '@/screens/ComputeScreen'
import { EvidenceScreen } from '@/screens/EvidenceScreen'
import { LibraryScreen } from '@/screens/LibraryScreen'
import { ReportScreen } from '@/screens/ReportScreen'

export default function App() {
  const phase = useMission((s) => s.phase)
  const view = useMission((s) => s.view)

  useEffect(() => {
    // Deep links: ?example=1 loads the Apollo files, &start=1 goes straight to the plan, &speed=4, &live=<lagrange url>
    const q = new URLSearchParams(location.search)
    const s = useMission.getState()
    if (q.get('speed')) s.setSpeed(Number(q.get('speed')))
    if (q.get('live')) return s.goLive(q.get('live')!)
    if (q.get('example') === '1') void s.loadExample().then(() => {
      if (q.get('start') === '1') void useMission.getState().start()
    })
  }, [])

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full flex-col">
        <TopBar />
        {view === 'library' && <LibraryScreen />}
        {view === 'evidence' && <EvidenceScreen />}
        {view === 'compute' && <ComputeScreen />}
        {view === 'review' && (
          <>
            {phase === 'setup' && <SetupScreen />}
            {phase === 'intake' && <IntakeScreen />}
            {phase === 'plan' && <PlanScreen />}
            {phase === 'run' && <RunScreen />}
            {phase === 'done' && <ReportScreen />}
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
