// 1 NETWORK: who is working and who is talking to whom. Ported from Lagrange's own live graph
// (lagrange/web/src/features/graph: AddressNode, FlowEdge): packets run along an edge while a task is in
// flight, a comet crosses it for each message, an edge turns amber while someone waits on a person.
// Lagrange sits in the middle: every A2A message and every tool call goes through it.
import { BaseEdge, Handle, Position, ReactFlow, useReactFlow, useStore, useViewport, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react'
import { Network } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, KIND_COLOR, STATE_COLOR, STATE_LABEL } from '@/components/bits'
import { AGENT, HUB, HUMAN, LAB, MODEL_COLOR, ORGS, agentColor, agentName, isPerson, orgOf } from '@/demo/crew'
import type { AgentState, Model } from '@/live/model'
import { NETWORK, useMission } from '@/live/store'
import type { CommKind } from '@/live/types'
import { cn } from '@/lib/utils'
import { useSyncedNodes } from './useSyncedNodes'

export const NODE_W = 156
export const NODE_H = 46
const HUB_D = 58
const COMET_MS = 1600

// ── flows: what the edges show ─────────────────────────────────────────────

export type Flow = {
  id: string
  a: string
  b: string
  active: number // tasks in flight a→b
  waiting: number // tasks waiting on a person
  total: number
  last?: { at: number; kind: CommKind; from: string }
}

const live = (st: string) => st === 'submitted' || st === 'working'

export function flows(m: Model): Flow[] {
  const out = new Map<string, Flow>()
  const get = (from: string, to: string) => {
    const k = out.has(`${to}|${from}`) ? `${to}|${from}` : `${from}|${to}`
    let f = out.get(k)
    if (!f) {
      const [a, b] = k.split('|')
      f = { id: k, a, b, active: 0, waiting: 0, total: 0 }
      out.set(k, f)
    }
    return f
  }
  for (const t of Object.values(m.tasks)) {
    if (!t.to || t.from === t.to) continue
    const f = get(t.from, t.to)
    f.total++
    if (live(t.state) && f.a === t.from) f.active++
    if (t.state === 'input_required') f.waiting++
  }
  for (const c of m.comms) {
    if (c.from === c.to || c.to === '?' || c.from === '?') continue
    const f = get(c.from, c.to)
    if (!f.last || c.at >= f.last.at) f.last = { at: c.at, kind: c.kind, from: c.from }
  }
  for (const a of Object.values(m.agents)) {
    if (!a.tools.length) continue
    const f = get(a.handle, HUB)
    f.total = a.tools.length
    f.active = a.tools.filter((c) => c.status === 'running').length
    const lastCall = a.tools[a.tools.length - 1]
    f.last = { at: lastCall.at, kind: 'hub', from: a.handle }
  }
  return [...out.values()]
}

// ── layout: an ellipse around the hub ──────────────────────────────────────

function ring(handles: string[]) {
  const pos: Record<string, { x: number; y: number }> = {
    [HUB]: { x: -HUB_D / 2, y: -HUB_D / 2 },
  }
  const n = handles.length
  // wide enough that neighbours at the top of the ring never overlap
  const rx = n > 6 ? 290 : n > 4 ? 185 : 170
  const ry = n > 6 ? 180 : n > 4 ? 150 : 110
  handles.forEach((h, i) => {
    // flight on top, you to its left, departments clockwise
    const ang = -Math.PI / 2 + ((i - 1) * 2 * Math.PI) / n
    pos[h] = {
      x: rx * Math.cos(ang) - NODE_W / 2,
      y: ry * Math.sin(ang) - NODE_H / 2,
    }
  })
  return pos
}

// ── nodes ──────────────────────────────────────────────────────────────────

type AgentData = {
  handle: string
  state: AgentState
  doing: string
  model?: string
  asked: boolean
  selected: boolean
}
type AgentNodeT = Node<AgentData, 'agent'>
type HubNodeT = Node<{ busy: number }, 'hub'>

const center = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

function AgentNode({ data }: NodeProps<AgentNodeT>) {
  const { handle, state, doing, asked, selected } = data
  const color = agentColor(handle)
  const human = isPerson(handle)
  const tone = asked ? 'var(--warn)' : state === 'failed' ? 'var(--bad)' : state === 'working' || state === 'asking' || state === 'waiting' ? STATE_COLOR[state] : selected ? 'var(--ug)' : 'var(--line-2)'
  return (
    <div
      className={cn('te-cap relative flex items-center gap-2 rounded-[10px] border px-2', asked && 'pulse-ring')}
      style={{
        width: NODE_W,
        height: NODE_H,
        borderColor: tone,
        color: asked ? 'var(--warn)' : undefined,
        boxShadow: selected ? '0 0 0 1px var(--ug)' : undefined,
      }}
    >
      <Handle type="source" position={Position.Top} style={center} />
      <Handle type="target" position={Position.Top} style={center} />
      {state === 'working' && <span className="work-halo" />}
      <span className="absolute inset-y-2 left-[3px] w-[3px] rounded-full" style={{ background: orgOf(handle)?.color }} />
      <Avatar handle={handle} size={26} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[11.5px] font-medium" style={{ color: human ? 'var(--ink)' : color }}>
          {agentName(handle)}
        </div>
        <div className="truncate text-[9.5px] text-muted-foreground">{asked ? (handle === HUMAN ? 'waiting on you' : 'on a task') : doing || (human ? 'lead engineer' : STATE_LABEL[state])}</div>
      </div>
      {data.model && (
        <span className="absolute -top-2 right-2 rounded-full border border-line bg-surface px-1.5 text-[8.5px] lowercase" style={{ color: MODEL_COLOR[data.model] }}>
          {data.model}
        </span>
      )}
      <span className="absolute -top-2 left-2 rounded-full border border-line bg-surface px-1.5 text-[8.5px]" style={{ color: orgOf(handle)?.color }}>
        {orgOf(handle)?.id}
        <span className="text-faint"> @{handle}</span>
      </span>
    </div>
  )
}

function HubNode({ data }: NodeProps<HubNodeT>) {
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-full border bg-bg text-gold"
      style={{
        width: HUB_D,
        height: HUB_D,
        borderColor: data.busy ? 'var(--gold)' : 'color-mix(in oklab, var(--gold) 35%, transparent)',
      }}
      title="Lagrange: every A2A message and tool call goes through it"
    >
      <Handle type="source" position={Position.Top} style={center} />
      <Handle type="target" position={Position.Top} style={center} />
      {data.busy > 0 && <span className="absolute inset-[-5px] animate-ping rounded-full border border-gold/30" />}
      <Network size={16} />
      <span className="mt-0.5 text-[8.5px]">lagrange</span>
    </div>
  )
}

const nodeTypes = { agent: AgentNode, hub: HubNode }

// ── edges ──────────────────────────────────────────────────────────────────

type LinkData = {
  flow: Flow
  now: number
  hub: boolean
  dim: boolean
  cross: boolean
}
type LinkEdgeT = Edge<LinkData, 'link'>

function LinkEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<LinkEdgeT>) {
  const { flow, now, hub, dim, cross } = data!
  // Bend every agent-to-agent edge towards the hub: the message goes through Lagrange.
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2
  const cx = hub ? mx : mx * 0.35
  const cy = hub ? my : my * 0.35
  const path = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`
  const dots = Math.min(4, flow.active)
  const dur = hub ? 1.1 : 1.6
  const waiting = flow.waiting > 0
  const recent = flow.last && now - flow.last.at < COMET_MS ? flow.last : undefined
  const color = waiting ? 'var(--warn)' : hub ? 'var(--gold)' : flow.active ? 'var(--k-task)' : 'var(--line-2)'
  const liveEdge = dots > 0 || waiting || !!recent
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: liveEdge ? (hub ? 1.4 : 2) : 1,
          strokeDasharray: hub ? '3 4' : waiting && !dots ? '2 5' : cross && !liveEdge ? '6 4' : undefined,
          opacity: dim ? 0.15 : liveEdge ? 0.95 : hub ? 0.35 : 0.55,
          transition: 'stroke 300ms, opacity 300ms',
        }}
      />
      {recent && (
        <path
          key={`c${recent.at}`}
          d={path}
          fill="none"
          stroke={KIND_COLOR[recent.kind]}
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1000}
          className="edge-comet"
          style={{
            animationDirection: recent.from === flow.a ? 'normal' : 'reverse',
          }}
        />
      )}
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} r={hub ? 2.5 : 3.5} fill={hub ? 'var(--gold)' : 'var(--k-task)'} stroke="var(--bg)" strokeWidth={1}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} begin={`${(i * dur) / dots}s`} />
        </circle>
      ))}
      {waiting && (
        <circle r={4.5} fill="var(--warn)">
          <animateMotion dur="2.4s" repeatCount="indefinite" path={path} keyPoints="0;0.9;0.9" keyTimes="0;0.6;1" calcMode="linear" />
        </circle>
      )}
    </>
  )
}

const edgeTypes = { link: LinkEdge }

// ── the view ───────────────────────────────────────────────────────────────

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Refit when the set of nodes changes or the panel is resized. */
function AutoFit({ shape, box }: { shape: string; box: React.RefObject<HTMLDivElement | null> }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const t = setTimeout(() => void fitView({ padding: 0.12, duration: 300 }), 50)
    return () => clearTimeout(t)
  }, [shape, fitView])
  useEffect(() => {
    const el = box.current
    if (!el) return
    let t: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => void fitView({ padding: 0.12 }), 80)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [box, fitView])
  return null
}

/** The question waiting on you, above your node, at screen scale so it stays readable when the graph is zoomed out. */
function Callout({ at }: { at?: { x: number; y: number } }) {
  const w = useMission((s) => s.model.waiting)
  const answer = useMission((s) => s.answer)
  const { x, y, zoom } = useViewport()
  const paneW = useStore((s) => s.width)
  if (!w || !at) return null
  // keep the whole card inside the pane; the arrow stays over the node
  const cardW = Math.min(300, paneW - 16)
  const nodeX = (at.x + NODE_W / 2) * zoom + x
  const left = Math.min(Math.max(nodeX, cardW / 2 + 8), paneW - cardW / 2 - 8)
  // below the node: "you" sits near the top of the ring, so above it would leave the pane
  const top = (at.y + NODE_H) * zoom + y + 10
  return (
    <AnimatePresence>
      <div
        key={w.taskId}
        className="pointer-events-auto absolute z-20"
        style={{
          width: cardW,
          left,
          top,
          transform: 'translateX(-50%)',
        }}
      >
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="relative rounded border border-warn/70 bg-[color-mix(in_oklab,var(--warn)_12%,var(--bg))] p-2.5 text-[11px] shadow-2xl">
          <div className="mb-1 flex items-center gap-1.5 text-[9.5px] lowercase text-warn">
            <span className="size-1.5 animate-pulse rounded-full bg-warn" /> @{w.from} asks you
          </div>
          <div className="sans text-[12px] leading-snug text-ink">{w.question}</div>
          {w.positions?.map((p) => (
            <div key={p.by} className="mt-1.5 border-l-2 pl-2 text-[10.5px] leading-snug" style={{ borderColor: agentColor(p.by) }}>
              <span style={{ color: agentColor(p.by) }}>{agentName(p.by)}</span>
              <span className="sans text-muted-foreground"> · {p.text}</span>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {w.options.map((o, i) => (
              <button key={o} type="button" onClick={() => answer(o)} className={cn('rounded-sm border px-2 py-0.5 text-[11px]', i === 0 ? 'border-warn bg-warn text-bg hover:brightness-110' : 'border-line-2 text-ink hover:border-warn')}>
                {i === 0 && <span className="mr-1 opacity-70">a</span>}
                {o}
              </button>
            ))}
          </div>
          <span style={{ left: `calc(50% + ${nodeX - left}px)` }} className="absolute bottom-full -mb-[5px] size-2.5 -translate-x-1/2 rotate-45 border-l border-t border-warn/70 bg-[color-mix(in_oklab,var(--warn)_12%,var(--bg))]" />
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export function NetworkView() {
  const model = useMission((s) => s.model)
  const selected = useMission((s) => s.selectedAgent)
  const selectAgent = useMission((s) => s.selectAgent)
  const focusPanel = useMission((s) => s.focusPanel)
  const now = useNow(250)
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string>()

  const handles = useMemo(() => [HUMAN, ...NETWORK], [])
  const shape = handles.join(',')
  const pos = useMemo(() => ring(shape.split(',')), [shape])
  const fl = useMemo(() => flows(model), [model])

  // Baseline edges from the plan, so the graph shows who reports to whom before any traffic.
  const all = useMemo(() => {
    const have = new Set(fl.map((f) => f.id))
    const base: Flow[] = handles
      .filter((h) => h !== 'flight')
      .map((h) => {
        const a = h === HUMAN ? HUMAN : h === LAB ? 'wstf' : 'flight'
        const b = h === HUMAN ? 'flight' : h
        return { id: `${a}|${b}`, a, b, active: 0, waiting: 0, total: 0 }
      })
      .filter((f) => !have.has(f.id) && !have.has(`${f.b}|${f.a}`))
    return [...fl.filter((f) => pos[f.a] && pos[f.b]), ...base]
  }, [fl, handles, pos])

  const asked = model.waiting ? HUMAN : undefined
  const labBusy = Object.values(model.tasks).find((t) => t.to === LAB && (t.state === 'input_required' || t.state === 'working' || t.state === 'submitted'))
  const busyHub = fl.filter((f) => f.b === HUB).reduce((s, f) => s + f.active, 0)

  const derived: (AgentNodeT | HubNodeT)[] = useMemo(
    () => [
      {
        id: HUB,
        type: 'hub',
        position: pos[HUB],
        data: { busy: busyHub },
        draggable: false,
      },
      ...handles.map((h): AgentNodeT => ({
        id: h,
        type: 'agent',
        position: pos[h],
        draggable: false,
        style: hover && hover !== h && !all.some((f) => (f.a === hover && f.b === h) || (f.b === hover && f.a === h)) ? { opacity: 0.4 } : undefined,
        data: {
          handle: h,
          state: h === HUMAN ? (asked ? 'waiting' : 'idle') : h === LAB ? (labBusy ? 'working' : 'idle') : (model.agents[h]?.state ?? 'idle'),
          doing: h === HUMAN ? '' : h === LAB ? (labBusy ? 'running Test 1 in chamber 3' : 'test technician') : (model.agents[h]?.doing ?? ''),
          model: AGENT[h]?.model,
          asked: h === asked || (h === LAB && !!labBusy),
          selected: h === selected,
        },
      })),
    ],
    [pos, busyHub, handles, hover, all, asked, labBusy, model.agents, selected],
  )
  const [nodes, onNodesChange] = useSyncedNodes(derived)
  const edges: LinkEdgeT[] = all.map((f) => ({
    id: f.id,
    source: f.a,
    target: f.b,
    type: 'link',
    data: {
      flow: f,
      now,
      hub: f.b === HUB,
      dim: !!hover && f.a !== hover && f.b !== hover,
      cross: f.b !== HUB && orgOf(f.a)?.id !== orgOf(f.b)?.id,
    },
    zIndex: f.active || f.waiting ? 1 : 0,
  }))

  const working = Object.values(model.agents).filter((a) => a.state === 'working' || a.state === 'asking').length
  const inFlight = Object.values(model.tasks).filter((t) => live(t.state)).length

  return (
    <div ref={box} className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        zoomOnScroll={false}
        panOnDrag
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => {
          if (n.id === HUB || n.id === HUMAN) return
          selectAgent(n.id)
          focusPanel(3)
        }}
        onNodeMouseEnter={(_, n) => setHover(n.id)}
        onNodeMouseLeave={() => setHover(undefined)}
      >
        <AutoFit shape={shape} box={box} />
        <Callout at={asked ? pos[asked] : undefined} />
      </ReactFlow>
      <div className="pointer-events-none absolute bottom-1.5 left-2 flex gap-3 text-[10px] text-faint">
        <span>
          <b className="font-normal text-k-task">{working}</b> working
        </span>
        <span>
          <b className="font-normal text-ink">{inFlight}</b> tasks in flight
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-1.5 right-2 flex gap-2 text-[9.5px] text-faint">
        {Object.values(ORGS).map((o) => (
          <span key={o.id} className="flex items-center gap-1" title={`${o.name} · ${o.provider} · ${o.hosting}`}>
            <span className="h-2 w-[3px] rounded" style={{ background: o.color }} />
            {o.id}
          </span>
        ))}
      </div>
    </div>
  )
}
