// Folds Lagrange activity entries into the mission state the dashboard draws.
// Pure: reduce(m, e) returns a new model. Demo replay and live SSE share it, so a demo looks exactly like a live run.
import { CREW, HUB, HUMAN, isPerson } from '@/demo/crew'
import type { Job, KbEntry, Proposal, Saving, Alarm, MatrixRow, TestRequest, CaseFile, CaseItem, CommKind, Cite, DossierSection, Entry, HumanAsk, InboxItem, Payload, Plan, Ranked, SimRun, ToolCall, Verdict } from './types'

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

export type Comm = { id: string; at: number; from: string; to: string; kind: CommKind; text: string; cites?: Cite[]; taskId?: string; saved?: Saving }

/** Readable progress for the chat: things a lead engineer cares about, not every message. */
export type Milestone = { id: string; at: number; text: string; view: 'overview' | 'materials' | 'evidence' | 'sim' | 'report' | 'case'; by?: string }

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
  /** Everything that reached a person, open and done (the Inbox). */
  inbox: InboxItem[]
  alarms: Alarm[]
  caseFile?: CaseFile
  matrix: MatrixRow[]
  milestones: Milestone[]
  tests: TestRequest[]
  feed: Entry[]
  done: boolean
  kb: Record<string, KbEntry[]>
  jobs: Job[]
  proposals: Proposal[]
  saved: { tokens: number; asks: number }
}

const FEED_MAX = 200
const PACKET_MAX = 60

export function emptyModel(): Model {
  const agents: Record<string, AgentRT> = {}
  for (const a of CREW) agents[a.handle] = { handle: a.handle, state: 'idle', doing: '', model: a.model, cost: 0, ctx: 0, tools: [], notes: [], lastAt: 0 }
  return { seq: 0, now: 0, agents, tasks: {}, comms: [], packets: [], ranking: [], focusIds: [], sims: [], dossier: [], inbox: [], alarms: [], matrix: [], milestones: [], tests: [], feed: [], done: false, kb: {}, jobs: [], proposals: [], saved: { tokens: 0, asks: 0 } }
}

const ms = (iso?: string) => (iso ? Date.parse(iso) : 0)
const norm = (s?: string) => (s ?? '').replace(/^TASK_STATE_/, '').toLowerCase()

function touch(m: Model, handle: string | undefined, patch: Partial<AgentRT>, at: number) {
  if (!handle || handle === HUMAN || handle === HUB) return
  const prev = m.agents[handle]
  if (!prev) return
  m.agents = { ...m.agents, [handle]: { ...prev, ...patch, lastAt: at } }
}

function milestone(m: Model, id: string, at: number, text: string, view: Milestone['view'], by?: string) {
  if (m.milestones.some((x) => x.id === id)) return
  m.milestones = [...m.milestones, { id, at, text, view, by }]
}

function inboxPut(m: Model, item: InboxItem) {
  const i = m.inbox.findIndex((x) => x.id === item.id)
  m.inbox = i >= 0 ? m.inbox.map((x, k) => (k === i ? { ...x, ...item, at: x.at } : x)) : [...m.inbox, item]
}

function inboxDone(m: Model, id: string, answer: string | undefined, at: number) {
  m.inbox = m.inbox.map((x) => (x.id === id && x.status === 'open' ? { ...x, status: 'done', answer: answer ?? x.answer, doneAt: at } : x))
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
      // A job for a person (not the run itself, which the person started).
      if (!old && t.parent && isPerson(t.to) && t.to !== HUMAN) inboxPut(m, { id, to: t.to, from: t.from, kind: 'task', text: t.summary, status: 'open', at })
      if (state === 'working') touch(m, t.to, { state: 'working', doing: e.summary && old ? e.summary : t.summary }, at)
      else if (state === 'completed') {
        touch(m, t.to, { state: 'done', doing: '' }, at)
        if (old && t.from !== t.to) packet(m, t.to, t.from, 'reply', at, `p${e.seq}r`)
      } else if (state === 'failed') touch(m, t.to, { state: 'failed', doing: e.summary ?? 'failed' }, at)
      else if (state === 'input_required') {
        if (t.to === HUMAN || d.awaiting === HUMAN) {
          m.waiting = { taskId: id, from: t.from, question: e.summary ?? '', options: (d.options as string[]) ?? ['Approve'], at, positions: d.positions as HumanAsk['positions'] }
          inboxPut(m, { id, to: HUMAN, from: t.from, kind: 'decide', text: m.waiting.question, options: m.waiting.options, positions: m.waiting.positions, status: 'open', at })
          touch(m, t.from, { state: 'waiting', doing: 'waiting on you' }, at)
        } else touch(m, t.to, { state: 'asking', doing: e.summary ?? '' }, at)
      }
      if (state === 'completed' || state === 'failed') inboxDone(m, id, e.summary, at)
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
      const saved = d.saved as Saving | undefined
      m.comms = [...m.comms, { id: `c${e.seq}`, at, from, to, kind, text: String(d.text ?? ''), cites: d.cites as Cite[] | undefined, taskId: e.taskId, saved }]
      if (saved) m.saved = { tokens: m.saved.tokens + saved.tokens, asks: m.saved.asks + 1 }
      if (to === HUMAN && from !== HUMAN && kind !== 'human' && !e.taskId) inboxPut(m, { id: `fyi-${e.seq}`, to, from, kind: 'fyi', text: String(d.text ?? ''), status: 'done', at, doneAt: at })
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
        case 'fc.plan': {
          const plan = d.plan as Plan
          if (!m.plan) milestone(m, 'plan', at, `published a plan: ${plan.subtasks.length} subtasks across ${new Set(plan.subtasks.map((x) => x.agent)).size} departments`, 'overview', e.sender)
          if (plan.approved && !m.plan?.approved) milestone(m, 'plan-ok', at, 'plan approved, work started', 'overview', e.sender)
          m.plan = plan
          return m
        }
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
          milestone(m, 'evidence', at, `ranked ${(d.ranking as Ranked[]).length} PSI investigations against the design`, 'evidence', e.sender)
          m.ranking = (d.ranking as Ranked[]) ?? m.ranking
          m.focusIds = (d.focus as string[]) ?? m.focusIds
          return m
        case 'fc.sim': {
          const run = { ...(d.run as SimRun), at }
          const i = m.sims.findIndex((s) => s.id === run.id)
          if (run.metrics) milestone(m, `sim-${run.id}`, at, `finished: ${run.label}`, 'sim', run.by)
          m.sims = i >= 0 ? m.sims.map((s, j) => (j === i ? { ...s, ...run } : s)) : [...m.sims, run]
          return m
        }
        case 'fc.dossier': {
          const s = d.section as DossierSection
          if (!m.dossier.length) milestone(m, 'report', at, 'started writing the report', 'report', e.sender)
          const i = m.dossier.findIndex((x) => x.id === s.id)
          m.dossier = i >= 0 ? m.dossier.map((x, j) => (j === i ? s : x)) : [...m.dossier, s]
          return m
        }
        case 'fc.matrix': {
          const rows = d.rows as MatrixRow[]
          const byId = new Map(m.matrix.map((r) => [r.id, r]))
          for (const r of rows) byId.set(r.id, r)
          m.matrix = [...byId.values()]
          const c = (st: string) => m.matrix.filter((r) => r.status === st).length
          milestone(m, 'matrix', at, `finished the materials matrix: ${c('pass')} pass, ${c('retest')} need a retest, ${c('fail')} fail at the target atmosphere`, 'materials', e.sender)
          return m
        }
        case 'fc.testreq': {
          const r = d.request as TestRequest
          const i = m.tests.findIndex((x) => x.id === r.id)
          m.tests = i >= 0 ? m.tests.map((x, j) => (j === i ? { ...x, ...r } : x)) : [...m.tests, r]
          milestone(m, `${r.id}-${r.status}`, at, `test request ${r.id} ${r.status}: ${r.material} at ${r.atmosphere}${r.eta ? ` (${r.eta})` : ''}`, 'materials', e.sender)
          return m
        }
        case 'fc.kb': {
          const k = d.entry as KbEntry
          const list = m.kb[k.agent] ?? []
          if (!list.some((x) => x.id === k.id)) m.kb = { ...m.kb, [k.agent]: [...list, k] }
          return m
        }
        case 'fc.job': {
          const j = d.job as Job
          const i = m.jobs.findIndex((x) => x.id === j.id)
          m.jobs = i >= 0 ? m.jobs.map((x, k) => (k === i ? { ...x, ...j, startedAt: x.startedAt, endedAt: j.done ? (x.endedAt ?? at) : undefined } : x)) : [...m.jobs, { ...j, startedAt: at }]
          return m
        }
        case 'fc.proposal': {
          const p = d.proposal as Proposal
          const i = m.proposals.findIndex((x) => x.id === p.id)
          m.proposals = i >= 0 ? m.proposals.map((x, k) => (k === i ? { ...x, ...p } : x)) : [...m.proposals, p]
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
          if (verdict) milestone(m, 'verdict', at, `verdict: ${verdict.headline}`, 'case', e.sender)
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
