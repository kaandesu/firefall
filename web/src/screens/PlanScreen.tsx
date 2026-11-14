// 2 PLAN: the lead's plan as a graph. Switch steps off, then approve. Nothing runs before that.
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Avatar } from '@/components/bits'
import { PLAN_GATE } from '@/demo/apollo1'
import { useMission } from '@/live/store'
import { PlanGraph } from '@/views/PlanGraph'
import { IntroScreen } from './IntroScreen'

export function PlanScreen() {
  const plan = useMission((s) => s.model.plan)
  const waiting = useMission((s) => s.model.waiting)
  const notes = useMission((s) => s.model.agents.flight?.notes ?? [])
  const skip = useMission((s) => s.skip)
  const approve = useMission((s) => s.approve)
  const pkg = useMission((s) => s.pkg)
  const request = useMission((s) => s.request)
  const intro = useMission((s) => s.intro)
  const canApprove = waiting?.taskId === PLAN_GATE
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'a' && canApprove && approve()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [canApprove, approve])
  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 p-4 pt-5">
      {intro && <IntroScreen />}
      <div className="flex items-start gap-3">
        <Avatar handle="flight" size={30} />
        <div className="min-w-0 flex-1">
          <div className="label">review lead · @flight</div>
          <div className="sans mt-0.5 text-[17px] font-medium leading-snug">{request}</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            {pkg?.vehicle} · {pkg?.atmosphere.label} · {pkg?.gravity.label} · {pkg?.bom.length} materials
            {notes.length > 0 && <span className="sans text-faint"> · {notes[notes.length - 1].text}</span>}
          </div>
        </div>
      </div>
      <div className="pane min-h-0 flex-1">
        <header className="pane-head shrink-0 px-3.5 pt-3 text-[11.5px]">
          <span className=" text-ink">plan</span>
          <span className="text-faint">{plan ? `${plan.subtasks.length} subtasks · click on/off to switch a step off` : 'planning…'}</span>
        </header>
        {plan ? (
          <PlanGraph plan={plan} />
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 size={14} className="animate-spin text-k-task" /> the lead is reading the three files
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-warn">{canApprove ? 'waiting for your approval · nothing has run yet' : plan ? '' : ''}</span>
        {skip.length > 0 && <span className="text-[11.5px] text-faint">switched off: {skip.join(', ')}</span>}
        <button type="button" disabled={!canApprove} onClick={approve} className="key key-orange ml-auto h-[38px] px-6 text-[13px] font-medium disabled:!bg-none disabled:!bg-surface-3 disabled:!text-faint disabled:!border-line">
          <span className="mr-2 opacity-60">a</span>approve plan
        </button>
      </div>
    </div>
  )
}
