// The lead's plan as a node graph: one node per subtask (agent, model, the input it reads, what it hands back),
// edges are dependencies. Before approval each node can be switched off; nothing runs until you approve.
import dagre from '@dagrejs/dagre'
import { Handle, MarkerType, Position, ReactFlow, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { Check, FileText, Loader2, Lock } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Avatar } from '@/components/bits'
import { MODEL_COLOR, agentColor, agentName } from '@/demo/crew'
import { useMission } from '@/live/store'
import type { Plan, Subtask } from '@/live/types'
import { cn } from '@/lib/utils'
import { useSyncedNodes } from './useSyncedNodes'

const W = 236
const H = 112

export function layoutPlan(subs: Subtask[], rankdir: 'LR' | 'TB' = 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir, ranksep: 56, nodesep: 26, marginx: 10, marginy: 10 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const s of subs) g.setNode(s.id, { width: W, height: H })
  for (const s of subs) for (const d of s.deps ?? []) if (g.hasNode(d)) g.setEdge(d, s.id)
  dagre.layout(g)
  return Object.fromEntries(subs.map((s) => [s.id, { x: g.node(s.id).x - W / 2, y: g.node(s.id).y - H / 2 }]))
}

type SubData = { sub: Subtask; off: boolean; locked: boolean; onToggle: () => void }
type SubNodeT = Node<SubData, 'sub'>

const STATUS: Record<Subtask['status'], { t: string; c: string }> = {
  pending: { t: 'pending', c: 'var(--faint)' },
  running: { t: 'running', c: 'var(--k-task)' },
  asking: { t: 'asking', c: 'var(--k-ask)' },
  review: { t: 'in review', c: 'var(--k-review)' },
  changes: { t: 'changes', c: 'var(--k-ask)' },
  done: { t: 'done', c: 'var(--k-reply)' },
  failed: { t: 'failed', c: 'var(--k-fail)' },
  skipped: { t: 'off', c: 'var(--faint)' },
}

function SubNode({ data }: NodeProps<SubNodeT>) {
  const { sub, off, locked, onToggle } = data
  const st = off ? STATUS.skipped : STATUS[sub.status]
  const color = agentColor(sub.agent)
  return (
    <div
      className={cn('relative flex flex-col gap-1 rounded-[5px] border bg-surface-2 px-2.5 py-2 transition', off && 'opacity-40')}
      style={{ width: W, height: H, borderColor: sub.status === 'running' ? 'var(--k-task)' : sub.status === 'done' ? 'color-mix(in oklab, var(--k-reply) 45%, var(--line-2))' : 'var(--line-2)' }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {sub.status === 'running' && <span className="work-halo" />}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-faint">{sub.id}</span>
        <Avatar handle={sub.agent} size={15} />
        <span style={{ color }}>{agentName(sub.agent)}</span>
        <span className="uppercase tracking-wider" style={{ color: MODEL_COLOR[sub.model] }}>
          {sub.model}
        </span>
        <span className="ml-auto flex items-center gap-1" style={{ color: st.c }}>
          {sub.status === 'running' && <Loader2 size={10} className="animate-spin" />}
          {sub.status === 'done' && <Check size={10} />}
          {st.t}
        </span>
      </div>
      <div className={cn('sans line-clamp-2 text-[12.5px] font-medium leading-snug', off && 'line-through')}>{sub.title}</div>
      <div className="mt-auto flex items-center gap-1 overflow-hidden text-[9.5px] text-muted-foreground">
        {(sub.reads ?? []).map((r) => (
          <span key={r} className="flex shrink-0 items-center gap-0.5 rounded-sm border border-line-2 px-1">
            <FileText size={8} />
            {r}
          </span>
        ))}
        <span className="truncate text-faint">→ {sub.produces}</span>
      </div>
      {!locked && (
        <button
          type="button"
          onClick={onToggle}
          disabled={sub.required}
          className={cn('nodrag absolute -top-2 right-2 flex items-center gap-1 rounded-sm border bg-bg px-1.5 text-[9px] uppercase tracking-wider', off ? 'border-line-2 text-faint' : 'border-ok/50 text-ok', sub.required && 'cursor-not-allowed')}
          title={sub.required ? 'The lead needs this step' : off ? 'Switched off: click to run it' : 'Click to switch this step off'}
        >
          {sub.required ? <Lock size={8} /> : <span className={cn('size-1.5 rounded-full', off ? 'bg-faint' : 'bg-ok')} />}
          {sub.required ? 'required' : off ? 'off' : 'on'}
        </button>
      )}
    </div>
  )
}

const nodeTypes = { sub: SubNode }

function Fit({ shape, box }: { shape: string; box: React.RefObject<HTMLDivElement | null> }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const t = setTimeout(() => void fitView({ padding: 0.08, maxZoom: 1.15 }), 40)
    return () => clearTimeout(t)
  }, [shape, fitView])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => void fitView({ padding: 0.08, maxZoom: 1.15 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [box, fitView])
  return null
}

export function PlanGraph({ plan }: { plan: Plan }) {
  const skip = useMission((s) => s.skip)
  const toggleSkip = useMission((s) => s.toggleSkip)
  const box = useRef<HTMLDivElement>(null)
  const shape = plan.subtasks.map((s) => `${s.id}<${(s.deps ?? []).join('+')}`).join(',')
  const subsForLayout = plan.subtasks
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shape captures what the layout depends on
  const pos = useMemo(() => layoutPlan(subsForLayout), [shape])
  const locked = plan.approved
  const derived: SubNodeT[] = useMemo(() => plan.subtasks.map((sub) => ({
    id: sub.id,
    type: 'sub',
    position: pos[sub.id] ?? { x: 0, y: 0 },
    draggable: false,
    data: { sub, off: sub.status === 'skipped' || (!locked && skip.includes(sub.id)), locked, onToggle: () => toggleSkip(sub.id) },
  })), [plan, pos, skip, locked, toggleSkip])
  const [nodes, onNodesChange] = useSyncedNodes(derived)
  const edges: Edge[] = plan.subtasks.flatMap((s) =>
    (s.deps ?? []).map((d) => {
      const src = plan.subtasks.find((x) => x.id === d)
      const done = src?.status === 'done'
      const color = done ? 'var(--k-reply)' : s.status === 'running' ? 'var(--k-task)' : 'var(--line-2)'
      return { id: `${d}-${s.id}`, source: d, target: s.id, type: 'smoothstep', animated: s.status === 'running', style: { stroke: color, strokeWidth: 1.4 }, markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 } }
    }),
  )
  return (
    <div ref={box} className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} nodesConnectable={false} nodesDraggable={false} zoomOnScroll={false} fitView proOptions={{ hideAttribution: true }} minZoom={0.3}>
        <Fit shape={shape} box={box} />
      </ReactFlow>
    </div>
  )
}
