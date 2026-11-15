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

export type SubtaskStatus = 'pending' | 'running' | 'asking' | 'review' | 'changes' | 'done' | 'failed' | 'skipped'

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
  /** Intake files the subtask reads, and what it hands back. */
  reads?: string[]
  produces?: string
  /** The lead will not run without it. */
  required?: boolean
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
  /** When the lead mediates: each side's position, so the person sees both before choosing. */
  positions?: { by: string; text: string }[]
}

/** Something for a person: a decision to make, a job to run (the technician), or an FYI from an agent. */
export type InboxItem = {
  id: string
  /** Which person it is for (you, or the WSTF technician). */
  to: string
  from: string
  kind: 'decide' | 'task' | 'fyi'
  text: string
  options?: string[]
  positions?: HumanAsk['positions']
  status: 'open' | 'done'
  answer?: string
  at: number
  doneAt?: number
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

/** One line of the materials matrix: a bill-of-materials item judged at the target atmosphere and gravity. */
export type MatrixRow = {
  id: string
  item: string
  material: string
  location: string
  qty: string
  zone?: string
  test1: 'pass' | 'fail' | 'none' // NASA-STD-6001 Test 1 at 21 % O₂ / 14.7 psia, 1 g (illustrative MAPTIS-style)
  limitO2: number // predicted limiting O₂ at the target conditions
  targetO2: number
  status: 'pass' | 'retest' | 'fail'
  action: string
  cites?: Cite[]
}

export type TestRequest = {
  id: string
  material: string
  test: string
  atmosphere: string
  lab: string
  reason: string
  status: 'draft' | 'requested' | 'scheduled'
  eta?: string
}

/** One fact in an agent's knowledge base, and where it came from. */
export type KbEntry = { id: string; agent: string; text: string; source: { kind: 'input' | 'dataset' | 'agent' | 'human' | 'tool'; ref: string }; tokens?: number }

/** A data-processing job an agent runs on its own org's compute (looks only in the demo). */
/** What a lab tile draws for a job. */
export type SceneId = 'acme-frames' | 'spread-duct' | 'lim-sweep' | 'gravity-flame' | 'smoke-cfd' | 'sensor-opt' | 'droplet' | 'chamber-test' | 'cabin-fire' | 'fds' | 'saffire-frames' | 'bass-stills'

export type Job = {
  id: string
  agent: string
  title: string
  dataset: string
  size: string
  where: string
  steps: string[]
  step: number
  progress: number // 0..1 overall
  stats: Record<string, string>
  /** A small series for the sparkline, 0..1. */
  series?: number[]
  done?: boolean
  /** data = processing a dataset, sim = a simulation run, test = a physical test run by a person. */
  kind?: 'data' | 'sim' | 'test'
  /** The live view of this job in the Lab panel. */
  scene?: SceneId
  params?: Record<string, number | string>
  /** Cluster node and accelerators it holds while running. */
  node?: string
  gpus?: number
  /** Model time (ms since run start) it was first seen and finished. */
  startedAt?: number
  endedAt?: number
}

export type ProposalReview = { by: string; stance: 'endorse' | 'object' | 'comment'; text: string; cites?: Cite[] }

/** A change an agent proposes; other agents review it, a person decides. */
export type Proposal = {
  id: string
  by: string
  title: string
  change: string
  why: string
  impact: { label: string; before: string; after: string }[]
  reviews: ProposalReview[]
  status: 'open' | 'escalated' | 'accepted' | 'rejected' | 'deferred'
  decidedBy?: string
}

/** What asking an agent saved, compared with reading the material yourself. */
export type Saving = { tokens: number; instead: string }

// Payload shapes carried in Entry.data (data.name discriminates).
export type Payload =
  | { name: 'fc.plan'; plan: Plan }
  | { name: 'fc.tool'; call: ToolCall }
  | { name: 'fc.note'; agent: string; text: string }
  | { name: 'fc.evidence'; ranking: Ranked[]; focus?: string[] }
  | { name: 'fc.sim'; run: SimRun }
  | { name: 'fc.dossier'; section: DossierSection }
  | { name: 'fc.alarm'; alarm: Alarm }
  | { name: 'fc.comm'; kind: CommKind; text: string; cites?: Cite[]; saved?: Saving }
  | { name: 'fc.run'; title: string; scenario: string; spec: Record<string, string | number> }
  | { name: 'fc.matrix'; rows: MatrixRow[] }
  | { name: 'fc.testreq'; request: TestRequest }
  | { name: 'fc.kb'; entry: KbEntry }
  | { name: 'fc.job'; job: Job }
  | { name: 'fc.proposal'; proposal: Proposal }
  | { name: 'fc.case'; file?: Omit<CaseFile, 'items' | 'verdict'>; item?: CaseItem; verdict?: Verdict }
