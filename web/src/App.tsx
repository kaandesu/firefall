import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMission } from '@/live/store'
import { useRoster } from '@/live/roster'
import { IntakeScreen } from '@/screens/IntakeScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { RunScreen } from '@/screens/RunScreen'
import { SetupScreen } from '@/screens/SetupScreen'
import { StartScreen } from '@/screens/StartScreen'
import { LiveReviewScreen } from '@/screens/LiveReviewScreen'
import { TopBar } from '@/screens/TopBar'
import { ComputeScreen } from '@/screens/ComputeScreen'
import { EvidenceScreen } from '@/screens/EvidenceScreen'
import { LibraryScreen } from '@/screens/LibraryScreen'
import { ReportScreen } from '@/screens/ReportScreen'
import { FdsScreen } from '@/screens/FdsScreen'
import { InboxScreen } from '@/screens/InboxScreen'

export default function App() {
  const phase = useMission((s) => s.phase)
  const view = useMission((s) => s.view)

  useEffect(() => {
    // Deep links: ?example=1 loads the Apollo files, &start=1 goes straight to the plan, &speed=4, &live=<lagrange url>, ?team=lagrange
    const q = new URLSearchParams(location.search)
    const s = useMission.getState()
    const v = q.get('view')
    if (v === 'fds' || v === 'library' || v === 'evidence' || v === 'compute' || v === 'inbox') s.setView(v)
    if (q.get('speed')) s.setSpeed(Number(q.get('speed')))
    if (q.get('live')) return s.goLive(q.get('live')!)
    // ?team=lagrange opens the team from the connected Lagrange server, when one is saved.
    if (q.get('team') === 'lagrange') {
      void useRoster.getState().check().then(() => {
        if (useRoster.getState().conn.state !== 'ok') return
        useRoster.setState({ net: 'lagrange' })
        s.setPhase('setup')
      })
      return
    }
    // A deep link into the demo skips the start screen.
    if (v || q.get('example') === '1') s.setPhase('setup')
    if (q.get('example') === '1') void s.loadExample().then(() => {
      if (q.get('start') === '1') void useMission.getState().start()
    })
  }, [])

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full flex-col">
        {!(phase === 'start' && view === 'review') && <TopBar />}
        {view === 'library' && <LibraryScreen />}
        {view === 'evidence' && <EvidenceScreen />}
        {view === 'compute' && <ComputeScreen />}
        {view === 'fds' && <FdsScreen />}
        {view === 'inbox' && <InboxScreen />}
        {view === 'review' && (
          <>
            {phase === 'start' && <StartScreen />}
            {phase === 'setup' && <SetupScreen />}
            {phase === 'live' && <LiveReviewScreen />}
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
