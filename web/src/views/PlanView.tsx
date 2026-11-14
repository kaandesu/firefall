import { ArrowUpRight, CheckCircle2, GitBranch, ListTodo } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { Avatar, AgentTag, Empty } from '@/components/bits'
import { MODEL_COLOR } from '@/demo/crew'
import { PILLAR_COLOR } from '@/data/psi'
import { useMission } from '@/live/store'
import type { Subtask, SubtaskStatus } from '@/live/types'
import { cn } from '@/lib/utils'

const COLUMNS: { id: string; label: string; has: SubtaskStatus[]; color: string }[] = [
  { id: 'pending', label: 'Pending', has: ['pending'], color: 'var(--faint)' },
  { id: 'running', label: 'Running', has: ['running', 'asking', 'failed'], color: 'var(--k-task)' },
  { id: 'review', label: 'Review', has: ['review', 'changes'], color: 'var(--k-review)' },
  { id: 'done', label: 'Done', has: ['done'], color: 'var(--k-reply)' },
]

export function PlanView() {
  const plan = useMission((s) => s.model.plan)
  if (!plan) return <Empty icon={<ListTodo size={28} />} title="No plan yet" hint="FLIGHT publishes the plan as an fc.plan artifact on the run's root task." />
  const done = plan.subtasks.filter((s) => s.status === 'done').length
  return (
    <div className="@container flex h-full flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{plan.goal}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={cn('mono rounded px-1.5 py-px', plan.approved ? 'bg-k-reply/15 text-k-reply' : 'bg-k-ask/15 text-k-ask')}>{plan.approved ? 'approved' : 'awaiting approval'}</span>
            <span className="mono">
              {done}/{plan.subtasks.length} done
            </span>
          </div>
        </div>
        <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full bg-k-reply" animate={{ width: `${(done / plan.subtasks.length) * 100}%` }} />
        </div>
      </div>
      <LayoutGroup>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 @xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = plan.subtasks.filter((s) => col.has.includes(s.status))
            return (
              <div key={col.id} className="flex min-h-0 flex-col rounded-lg border border-line bg-surface/60">
                <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
                  <span className="mono text-[10px] uppercase tracking-widest" style={{ color: col.color }}>
                    {col.label}
                  </span>
                  <span className="mono text-[10px] text-faint">{items.length}</span>
                </div>
                <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                  {items.map((s) => (
                    <Card key={s.id} s={s} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </LayoutGroup>
    </div>
  )
}

function Card({ s }: { s: Subtask }) {
  const selectAgent = useMission((st) => st.selectAgent)
  const directTo = useMission((st) => st.directTo)
  const live = s.status === 'running' || s.status === 'asking'
  return (
    <motion.button
      layout
      layoutId={s.id}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      onClick={() => {
        selectAgent(s.agent)
        directTo('workspace', true)
      }}
      className={cn(
        'group relative w-full rounded-md border bg-surface-2 p-2 text-left transition hover:border-line-2',
        live ? 'border-k-task/40' : s.status === 'failed' ? 'border-k-fail/50' : s.status === 'changes' ? 'border-k-ask/50' : 'border-line',
      )}
    >
      {s.pillar && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: PILLAR_COLOR[s.pillar] }} />}
      <div className="flex items-center justify-between gap-1">
        <span className="mono text-[10px] text-faint">{s.id}</span>
        <div className="flex items-center gap-1">
          {s.escalated && (
            <span className="mono flex items-center rounded bg-k-review/15 px-1 text-[9px] text-k-review">
              <ArrowUpRight size={9} />
              esc
            </span>
          )}
          {s.round && s.round > 1 && <span className="mono rounded bg-k-ask/15 px-1 text-[9px] text-k-ask">r{s.round}</span>}
          {s.status === 'done' && <CheckCircle2 size={12} className="text-k-reply" />}
        </div>
      </div>
      <div className="mt-1 line-clamp-2 text-[12px] leading-snug">{s.title}</div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <Avatar handle={s.agent} size={16} />
          <AgentTag handle={s.agent} className="text-[10px]" />
        </div>
        <span className="mono text-[9px]" style={{ color: MODEL_COLOR[s.model] }}>
          {s.model}
        </span>
      </div>
      {s.deps && s.deps.length > 0 && (
        <div className="mono mt-1 flex items-center gap-1 text-[9px] text-faint">
          <GitBranch size={9} />
          {s.deps.join(' · ')}
        </div>
      )}
      {s.status === 'failed' && <div className="mono mt-1 text-[10px] text-k-fail">failed — escalating</div>}
      {s.status === 'changes' && <div className="mono mt-1 text-[10px] text-k-ask">changes requested</div>}
      {live && <motion.span className="absolute inset-x-2 bottom-0 h-px bg-k-task" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.4 }} />}
    </motion.button>
  )
}
