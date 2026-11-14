// The crew, Halo-style: who is on the team, what each is doing, what it costs.
import { motion } from 'motion/react'
import { AgentTag, Avatar, StateDot } from '@/components/bits'
import { CREW, HUMAN, MODEL_COLOR } from '@/demo/crew'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

export function Roster() {
  const agents = useMission((s) => s.model.agents)
  const selected = useMission((s) => s.selectedAgent)
  const selectAgent = useMission((s) => s.selectAgent)
  const directTo = useMission((s) => s.directTo)
  const comms = useMission((s) => s.model.comms.length)
  const tasks = useMission((s) => Object.keys(s.model.tasks).length)
  const waiting = useMission((s) => s.model.waiting)
  const total = Object.values(agents).reduce((a, b) => a + b.cost, 0)

  return (
    <aside className="no-print flex w-[228px] shrink-0 flex-col border-r border-line bg-surface/50">
      <div className="mono px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.2em] text-faint">Crew · on Lagrange</div>
      <div className={cn('mx-2 mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5', waiting && 'bg-k-ask/10 ring-1 ring-k-ask/40')}>
        <Avatar handle={HUMAN} size={26} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <AgentTag handle={HUMAN} />
            <span className="text-[10px] text-muted-foreground">mission engineer</span>
          </div>
          <div className="truncate text-[10.5px] text-k-ask">{waiting ? 'FLIGHT needs your call' : ' '}</div>
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2">
        {CREW.map((a) => {
          const rt = agents[a.handle]
          return (
            <motion.button
              key={a.handle}
              type="button"
              layout
              onClick={() => {
                selectAgent(a.handle)
                directTo('workspace', true)
              }}
              className={cn('mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition', selected === a.handle ? 'bg-surface-3' : 'hover:bg-surface-2')}
            >
              <Avatar handle={a.handle} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <AgentTag handle={a.handle} />
                  <StateDot state={rt.state} />
                  <span className="mono ml-auto text-[9px]" style={{ color: MODEL_COLOR[rt.model ?? a.model] }}>
                    {rt.model ?? a.model}
                  </span>
                </div>
                <div className="truncate text-[10.5px] text-muted-foreground">{rt.state === 'idle' ? a.role : rt.state === 'done' ? 'done' : rt.doing || rt.state}</div>
              </div>
            </motion.button>
          )
        })}
      </div>
      <div className="mono grid grid-cols-3 gap-1 border-t border-line p-2 text-center text-[10px]">
        <div>
          <div className="text-ink">{tasks}</div>
          <div className="text-faint">tasks</div>
        </div>
        <div>
          <div className="text-ink">{comms}</div>
          <div className="text-faint">messages</div>
        </div>
        <div>
          <div className="text-ink">${total.toFixed(2)}</div>
          <div className="text-faint">spend</div>
        </div>
      </div>
    </aside>
  )
}
