// 4 LAB: where the work runs. Every org's machines (their own GPU farms and the WSTF chamber), the job queue,
// and a live view of every job the agents start: real ACME frames being processed, flame and smoke runs, sweeps,
// the physical test the technician runs. Jobs run on the owner's hardware; only results go back over Lagrange.
import { Cpu, FlaskConical, Maximize2, Minimize2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AGENT, NODES, ORGS, agentColor, agentName } from '@/demo/crew'
import { JobScene, THREE_SCENES } from '@/lab/tiles'
import { useSmokeStudy } from '@/lab/useSmokeStudy'
import { useMission } from '@/live/store'
import type { Job } from '@/live/types'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = { pending: 'var(--faint)', running: 'var(--k-task)', done: 'var(--ok)', skipped: 'var(--line-2)', failed: 'var(--bad)' }

export function LabView() {
  const size = useMission((s) => s.sizes[4])
  const jobs = useMission((s) => s.model.jobs)
  const plan = useMission((s) => s.model.plan)
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const extra = useMission((s) => s.nodes)
  const showPlan = useMission((s) => s.setPlanOpen)
  const { study, progress } = useSmokeStudy(pkg, cabin)
  const [focus, setFocus] = useState<string>()
  const real = useMission((s) => s.mode === 'agents')
  const nodes = real ? [] : [...NODES, ...extra]

  const scened = jobs.filter((j) => j.scene)
  const running = scened.filter((j) => !j.done)
  const recent = scened.filter((j) => j.done).reverse()
  const max = size === 'normal' ? 3 : 6
  const shown = useMemo(() => {
    const list = [...running, ...recent].slice(0, max)
    const f = focus ? scened.find((j) => j.id === focus) : undefined
    return f ? [f, ...list.filter((j) => j.id !== f.id)].slice(0, max) : list
  }, [running, recent, max, focus, scened])
  // WebGL contexts are limited: keep at most 3 three.js tiles mounted.
  let threeLeft = 3
  const use = (busy: Map<string, number>, j: Job) => j.node && !j.done && busy.set(j.node, (busy.get(j.node) ?? 0) + (j.gpus ?? 0))
  const busy = new Map<string, number>()
  for (const j of jobs) use(busy, j)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* plan as chips */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto px-2 pb-1 text-[9.5px] scroll-thin">
        {plan?.subtasks.map((s) => (
          <span key={s.id} title={`${s.title} · @${s.agent}`} className="flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-[1px]" style={{ borderColor: STATUS_COLOR[s.status] ?? 'var(--line-2)', color: s.status === 'pending' ? 'var(--faint)' : 'var(--ink)' }}>
            <span style={{ color: STATUS_COLOR[s.status] }}>{s.status === 'running' ? '●' : s.status === 'done' ? '✓' : s.status === 'skipped' ? '–' : '○'}</span>
            {s.id}
            <span className="max-w-[120px] truncate text-muted-foreground">{s.title}</span>
          </span>
        ))}
        <button type="button" onClick={() => showPlan(true)} className="ml-auto shrink-0 text-faint hover:text-ink" title="the whole plan (p)">
          plan graph
        </button>
      </div>

      {/* clusters */}
      {real && <div className="shrink-0 px-2 pb-1.5 text-[9.5px] text-faint">real review · every job is a tool call an agent made; the models and FDS run on this machine (firefall-tools)</div>}
      <div className={cn('flex shrink-0 gap-1.5 overflow-x-auto px-2 pb-1.5 scroll-thin', real && 'hidden')}>
        {nodes.map((n) => {
          const used = busy.get(n.id) ?? 0
          const org = ORGS[n.org]
          const active = jobs.some((j) => j.node === n.id && !j.done)
          return (
            <div key={n.id} className={cn('flex min-w-[118px] shrink-0 flex-col gap-0.5 rounded-sm border bg-surface-2 px-1.5 py-1 text-[9px]', active ? 'border-k-task/60' : 'border-line')} title={`${n.host} · ${n.scheduler}`}>
              <div className="flex items-center gap-1">
                <span className="h-2 w-[3px] rounded" style={{ background: org.color }} />
                {n.chamber ? <FlaskConical size={9} className="text-faint" /> : <Cpu size={9} className="text-faint" />}
                <span className="truncate text-ink">{n.id}</span>
                {n.added && <span className="text-ok">new</span>}
                <span className="ml-auto text-faint">{org.id}</span>
              </div>
              {n.chamber ? (
                <div className={active ? 'text-k-task' : 'text-faint'}>{active ? 'test running' : 'idle'}</div>
              ) : (
                <>
                  <div className="flex gap-[2px]">
                    {Array.from({ length: Math.min(16, n.gpus) }, (_, i) => (
                      <span key={i} className={cn('h-1.5 flex-1 rounded-[1px]', i < Math.round((used / n.gpus) * Math.min(16, n.gpus)) ? 'bg-k-task' : 'bg-surface-3')} />
                    ))}
                  </div>
                  <div className="text-faint">
                    {used}/{n.gpus} {n.gpu} · {n.scheduler}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 gap-2 px-2">
        {/* queue */}
        <div className="scroll-thin w-[190px] shrink-0 overflow-y-auto border-r border-line pr-1.5 text-[9.5px]">
          <div className="label mb-1">queue · {running.length} running</div>
          {!jobs.length && <div className="text-faint">No jobs yet. They appear when the plan is approved and the agents start work.</div>}
          {[...jobs].reverse().map((j) => (
            <button key={j.id} type="button" onClick={() => j.scene && setFocus(j.id)} className={cn('mb-1 block w-full rounded-sm px-1 py-0.5 text-left hover:bg-surface-2', focus === j.id && 'bg-surface-2')}>
              <div className="flex items-center gap-1">
                <span className={cn('size-1.5 shrink-0 rounded-full', j.done ? 'bg-ok' : 'animate-pulse bg-k-task')} />
                <span className="truncate text-ink">{j.title}</span>
              </div>
              <div className="flex gap-1.5 pl-2.5 text-faint">
                <span style={{ color: agentColor(j.agent) }}>@{j.agent}</span>
                <span>{j.node ?? j.where}</span>
                {j.gpus ? <span>{j.gpus} GPU</span> : null}
                <span className="ml-auto">{j.done ? (j.endedAt !== undefined && j.startedAt !== undefined ? `${((j.endedAt - j.startedAt) / 1000).toFixed(1)} s` : 'done') : `${Math.round(j.progress * 100)} %`}</span>
              </div>
            </button>
          ))}
        </div>

        {/* live tiles */}
        <div className={cn('grid min-h-0 flex-1 gap-1.5 pb-1', shown.length <= 1 ? 'grid-cols-1' : size === 'normal' ? 'grid-cols-3' : 'grid-cols-3 grid-rows-2')}>
          {!shown.length && <div className="col-span-full flex items-center justify-center text-[11px] text-faint">Simulations and data jobs appear here as the agents start them.</div>}
          {shown.map((j) => {
            const three = j.scene ? THREE_SCENES.has(j.scene) : false
            const mount = !three || threeLeft-- > 0
            const big = focus === j.id && shown.length > 1
            return (
              <div key={j.id} className={cn('flex min-h-0 min-w-0 flex-col rounded-sm border bg-viewport', j.done ? 'border-line' : 'border-k-task/50', big && 'col-span-2 row-span-2')}>
                <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-1.5 py-0.5 text-[9.5px]">
                  <span className={cn('size-1.5 shrink-0 rounded-full', j.done ? 'bg-ok' : 'animate-pulse bg-k-task')} />
                  <span className="truncate text-ink">{j.title}</span>
                  <span className="ml-auto shrink-0" style={{ color: agentColor(j.agent) }}>
                    {agentName(j.agent)}
                  </span>
                  {!real && <span className="shrink-0 text-faint">{ORGS[AGENT[j.agent]?.org ?? 'prime'].id}</span>}
                  <button type="button" onClick={() => setFocus(big ? undefined : j.id)} className="shrink-0 text-faint hover:text-ink" title={big ? 'shrink' : 'enlarge'}>
                    {big ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                  </button>
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden p-1">
                  {mount ? <JobScene job={j} study={study} studyProgress={progress} live={!j.done || big} /> : <div className="flex h-full items-center justify-center text-[10px] text-faint">{j.title} · click to view</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2 border-t border-line px-1.5 py-0.5 text-[9px] text-faint">
                  <div className="h-0.5 w-12 overflow-hidden rounded bg-surface-3">
                    <div className={cn('h-full', j.done ? 'bg-ok' : 'bg-k-task')} style={{ width: `${j.progress * 100}%` }} />
                  </div>
                  <span className="truncate">{j.steps[Math.min(j.step, j.steps.length - 1)]}</span>
                  <span className="ml-auto truncate">
                    {j.node} {j.gpus ? `· ${j.gpus}× ${nodes.find((n) => n.id === j.node)?.gpu ?? 'GPU'}` : ''}
                  </span>
                  {j.done &&
                    Object.entries(j.stats)
                      .slice(-1)
                      .map(([k, v]) => (
                        <span key={k} className="shrink-0 text-ink">
                          {k} {v}
                        </span>
                      ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
