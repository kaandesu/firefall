// The one event model for both the scripted demo and live Lagrange runs.
// `Entry` is exactly Lagrange's activity-log entry (GET /api/events, SSE `event: activity`).
// FIREFALL's domain payloads ride inside `data` on artifact and message entries, keyed by `data.name`.

export type EntryKind = 'task' | 'artifact' | 'message' | 'input' | 'queued' | 'delivered' | 'presence' | 'address' | 'usage'

export type Entry = {
  seq: number
  at: string
  kind: EntryKind
  taskId?: string
  parentTaskId?: string
  contextId?: string
  sender?: string
  recipient?: string
  state?: string
  summary?: string
  data?: Record<string, unknown>
}

export type CommKind = 'task' | 'ask' | 'reply' | 'review' | 'fail' | 'hub' | 'human'

export type SubtaskStatus = 'pending' | 'running' | 'asking' | 'review' | 'changes' | 'done' | 'failed'

export type Subtask = {
  id: string
  title: string
  agent: string
  model: string
  deps?: string[]
  status: SubtaskStatus
  round?: number
  escalated?: boolean
  pillar?: Pillar
}

export type Plan = {
  goal: string
  approved: boolean
  subtasks: Subtask[]
}

export type Pillar = 'prevention' | 'detection' | 'suppression' | 'cross'

export type ToolCall = {
  callId: string
  agent: string
  tool: string
  args: Record<string, unknown>
  status: 'running' | 'ok' | 'error'
  result?: unknown
  at: number
  doneAt?: number
}

export type Ranked = { id: string; score: number; pillar: Pillar; why: string }

export type SimKind = 'flame' | 'smoke' | 'spread' | 'droplet'

export type SimParams = {
  o2: number // volume fraction, 0..1
  psi: number
  g: number // in Earth g
  flow: number // cm/s
  material?: string
  co2?: number // diluent fraction for droplet sim
  diameter?: number // mm, droplet
}

export type SimRun = {
  id: string
  sim: SimKind
  by: string
  params: Partial<SimParams>
  label: string
  metrics?: Record<string, number | string>
  at: number
}

export type Cite = { id: string; note?: string }

export type DossierSection = {
  id: string
  title: string
  pillar: Pillar | 'summary' | 'limits' | 'earth' | 'actions'
  author: string
  body: string[]
  cites?: Cite[]
  risk?: 'low' | 'moderate' | 'high' | 'critical'
  metrics?: { label: string; value: string }[]
}

export type HumanAsk = {
  taskId: string
  from: string
  question: string
  options: string[]
  at: number
}

export type Alarm = { id: string; module: string; detector: string; level: 'caution' | 'warning'; text: string; at: number }

export type CaseItem = { id: string; when: string; text: string; kind: 'event' | 'cause' | 'response' | 'finding'; source?: { label: string; url: string } }

export type Verdict = {
  outcome: 'prevented' | 'earlier' | 'better-response' | 'out-of-scope'
  headline: string
  would: string[]
  bridge?: string
}

export type CaseFile = { title: string; when: string; where: string; atmosphere: string; summary: string; items: CaseItem[]; verdict?: Verdict }

// Payload shapes carried in Entry.data (data.name discriminates).
export type Payload =
  | { name: 'fc.plan'; plan: Plan }
  | { name: 'fc.tool'; call: ToolCall }
  | { name: 'fc.note'; agent: string; text: string }
  | { name: 'fc.evidence'; ranking: Ranked[]; focus?: string[] }
  | { name: 'fc.sim'; run: SimRun }
  | { name: 'fc.dossier'; section: DossierSection }
  | { name: 'fc.alarm'; alarm: Alarm }
  | { name: 'fc.comm'; kind: CommKind; text: string; cites?: Cite[] }
  | { name: 'fc.run'; title: string; scenario: string; spec: Record<string, string | number> }
  | { name: 'fc.case'; file?: Omit<CaseFile, 'items' | 'verdict'>; item?: CaseItem; verdict?: Verdict }
