// Folds Lagrange activity entries into the mission state the dashboard draws.
// Pure: reduce(m, e) returns a new model. Demo replay and live SSE share it, so a demo looks exactly like a live run.
import { CREW, HUB, HUMAN } from '@/demo/crew'
import type { Alarm, CaseFile, CaseItem, CommKind, Cite, DossierSection, Entry, HumanAsk, Payload, Plan, Ranked, SimRun, ToolCall, Verdict } from './types'

export type AgentState = 'idle' | 'working' | 'asking' | 'waiting' | 'done' | 'failed'

export type AgentRT = {
  handle: string
  state: AgentState
  doing: string
  model?: string
  cost: number
  ctx: number // context fill 0..1
  tools: ToolCall[]
  notes: { at: number; text: string }[]
  lastAt: number
}

export type Comm = { id: string; at: number; from: string; to: string; kind: CommKind; text: string; cites?: Cite[]; taskId?: string }

export type Packet = { id: string; from: string; to: string; kind: CommKind; at: number }

export type TaskRT = { id: string; parent?: string; from: string; to: string; state: string; summary: string; at: number }

export type Model = {
  seq: number
  now: number
  run?: { title: string; scenario: string; spec: Record<string, string | number>; at: number }
  agents: Record<string, AgentRT>
  tasks: Record<string, TaskRT>
  plan?: Plan
  comms: Comm[]
  packets: Packet[]
  ranking: Ranked[]
  focusIds: string[]
  sims: SimRun[]
  dossier: DossierSection[]
  waiting?: HumanAsk
  alarms: Alarm[]
  caseFile?: CaseFile
  feed: Entry[]
  done: boolean
}

const FEED_MAX = 200
const PACKET_MAX = 60

export function emptyModel(): Model {
  const agents: Record<string, AgentRT> = {}
  for (const a of CREW) agents[a.handle] = { handle: a.handle, state: 'idle', doing: '', model: a.model, cost: 0, ctx: 0, tools: [], notes: [], lastAt: 0 }
  return { seq: 0, now: 0, agents, tasks: {}, comms: [], packets: [], ranking: [], focusIds: [], sims: [], dossier: [], alarms: [], feed: [], done: false }
}

const ms = (iso?: string) => (iso ? Date.parse(iso) : 0)
const norm = (s?: string) => (s ?? '').replace(/^TASK_STATE_/, '').toLowerCase()

function touch(m: Model, handle: string | undefined, patch: Partial<AgentRT>, at: number) {
  if (!handle || handle === HUMAN || handle === HUB) return
  const prev = m.agents[handle]
  if (!prev) return
  m.agents = { ...m.agents, [handle]: { ...prev, ...patch, lastAt: at } }
}

function packet(m: Model, from: string | undefined, to: string | undefined, kind: CommKind, at: number, id: string) {
  if (!from || !to || from === to) return
  m.packets = [...m.packets, { id, from, to, kind, at }].slice(-PACKET_MAX)
}

export function reduce(prev: Model, e: Entry): Model {
  if (e.seq <= prev.seq) return prev
  const at = ms(e.at)
  const m: Model = { ...prev, seq: e.seq, now: Math.max(prev.now, at), feed: [...prev.feed, e].slice(-FEED_MAX) }
  const d = (e.data ?? {}) as Partial<Payload> & Record<string, unknown>

  switch (e.kind) {
    case 'usage': {
      const a = e.sender ? m.agents[e.sender] : undefined
      if (a) touch(m, e.sender, { cost: a.cost + Number(d.cost ?? 0), ctx: Math.min(1, Number(d.ctx ?? a.ctx)) }, at)
      return m
    }
    case 'presence':
      return m
    case 'task': {
      const id = e.taskId!
      const state = norm(e.state)
      const old = m.tasks[id]
      const t: TaskRT = old
        ? { ...old, state, at }
        : { id, parent: e.parentTaskId, from: e.sender ?? HUMAN, to: e.recipient ?? '', state, summary: e.summary ?? '', at }
      m.tasks = { ...m.tasks, [id]: t }
      if (!old) {
        m.comms = [...m.comms, { id: `c${e.seq}`, at, from: t.from, to: t.to, kind: 'task', text: e.summary ?? '', taskId: id }]
        packet(m, t.from, t.to, 'task', at, `p${e.seq}`)
      }
      if (state === 'working') touch(m, t.to, { state: 'working', doing: e.summary && old ? e.summary : t.summary }, at)
      else if (state === 'completed') {
        touch(m, t.to, { state: 'done', doing: '' }, at)
        if (old && t.from !== t.to) packet(m, t.to, t.from, 'reply', at, `p${e.seq}r`)
      } else if (state === 'failed') touch(m, t.to, { state: 'failed', doing: e.summary ?? 'failed' }, at)
      else if (state === 'input_required') {
        if (t.to === HUMAN || d.awaiting === HUMAN) {
          m.waiting = { taskId: id, from: t.from, question: e.summary ?? '', options: (d.options as string[]) ?? ['Approve'], at }
          touch(m, t.from, { state: 'waiting', doing: 'waiting on you' }, at)
        } else touch(m, t.to, { state: 'asking', doing: e.summary ?? '' }, at)
      }
      if (state === 'completed' && m.waiting?.taskId === id) m.waiting = undefined
      if (state === 'completed' && t.to === HUMAN) touch(m, t.from, { state: 'working', doing: `you: ${e.summary ?? 'answered'}` }, at)
      if (state === 'completed' && !t.parent && t.from === HUMAN) m.done = true
      return m
    }
    case 'message': {
      if (d.name !== 'fc.comm') return m
      const kind = (d.kind as CommKind) ?? 'reply'
      const from = e.sender ?? '?'
      const to = e.recipient ?? '?'
      m.comms = [...m.comms, { id: `c${e.seq}`, at, from, to, kind, text: String(d.text ?? ''), cites: d.cites as Cite[] | undefined, taskId: e.taskId }]
      packet(m, from, to, kind, at, `p${e.seq}`)
      if (kind === 'ask') touch(m, from, { state: 'asking', doing: `asking ${to}` }, at)
      else if (kind === 'reply' && m.agents[from]?.state === 'asking') touch(m, from, { state: 'working' }, at)
      if (kind === 'reply' && m.agents[to]?.state === 'asking') touch(m, to, { state: 'working', doing: m.agents[to].doing.replace(/^asking .*/, 'working') }, at)
      return m
    }
    case 'artifact': {
      switch (d.name) {
        case 'fc.run':
          m.run = { title: String(d.title), scenario: String(d.scenario), spec: (d.spec as Record<string, string | number>) ?? {}, at }
          return m
        case 'fc.plan':
          m.plan = d.plan as Plan
          return m
        case 'fc.tool': {
          const call = d.call as ToolCall
          const a = m.agents[call.agent]
          if (!a) return m
          const i = a.tools.findIndex((c) => c.callId === call.callId)
          const tools = i >= 0 ? a.tools.map((c, j) => (j === i ? { ...c, ...call, at: c.at, doneAt: at } : c)) : [...a.tools, { ...call, at }]
          touch(m, call.agent, { tools, state: a.state === 'idle' || a.state === 'done' ? 'working' : a.state, doing: call.status === 'running' ? `${call.tool}(…)` : a.doing }, at)
          if (call.status === 'running') packet(m, call.agent, HUB, 'hub', at, `p${e.seq}`)
          return m
        }
        case 'fc.note': {
          const h = String(d.agent)
          const a = m.agents[h]
          if (a) touch(m, h, { notes: [...a.notes, { at, text: String(d.text) }] }, at)
          return m
        }
        case 'fc.evidence':
          m.ranking = (d.ranking as Ranked[]) ?? m.ranking
          m.focusIds = (d.focus as string[]) ?? m.focusIds
          return m
        case 'fc.sim': {
          const run = { ...(d.run as SimRun), at }
          const i = m.sims.findIndex((s) => s.id === run.id)
          m.sims = i >= 0 ? m.sims.map((s, j) => (j === i ? { ...s, ...run } : s)) : [...m.sims, run]
          return m
        }
        case 'fc.dossier': {
          const s = d.section as DossierSection
          const i = m.dossier.findIndex((x) => x.id === s.id)
          m.dossier = i >= 0 ? m.dossier.map((x, j) => (j === i ? s : x)) : [...m.dossier, s]
          return m
        }
        case 'fc.alarm':
          m.alarms = [...m.alarms, { ...(d.alarm as Alarm), at }]
          return m
        case 'fc.case': {
          const cf: CaseFile = m.caseFile ?? { title: '', when: '', where: '', atmosphere: '', summary: '', items: [] }
          const file = d.file as Omit<CaseFile, 'items' | 'verdict'> | undefined
          const item = d.item as CaseItem | undefined
          const verdict = d.verdict as Verdict | undefined
          m.caseFile = { ...cf, ...file, items: item ? [...cf.items, item] : cf.items, verdict: verdict ?? cf.verdict }
          return m
        }
      }
      return m
    }
  }
  return m
}

export const fold = (es: Entry[], from = emptyModel()) => es.reduce(reduce, from)
