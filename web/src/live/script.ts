// A tiny DSL for writing demo runs as timelines of Lagrange entries.
// Times are script seconds at 1×. Anyone on the team can edit a scenario without touching the UI.
import { HUMAN } from '@/demo/crew'
import type { Job, KbEntry, Proposal, Saving, Subtask as Sub, Alarm, MatrixRow, TestRequest, CaseFile, CaseItem, CommKind, Cite, DossierSection, Entry, Plan, Ranked, SimRun, Subtask, Verdict } from './types'

export type Beat = { t: number; e: Omit<Entry, 'seq' | 'at'>; gate?: { auto: number } }

let callN = 0

export class Script {
  beats: Beat[] = []
  t = 0
  plan?: Plan
  readonly root: string

  constructor(root = 'run-1') {
    this.root = root
  }

  private push(e: Beat['e'], gate?: Beat['gate'], t = this.t) {
    this.beats.push({ t, e, gate })
    return this
  }

  /** Advance the cursor. */
  wait(s: number) {
    this.t += s
    return this
  }

  start(title: string, scenario: string, spec: Record<string, string | number>, prompt: string) {
    this.push({ kind: 'artifact', taskId: this.root, sender: HUMAN, recipient: 'flight', data: { name: 'fc.run', title, scenario, spec } })
    this.push({ kind: 'task', taskId: this.root, sender: HUMAN, recipient: 'flight', state: 'TASK_STATE_SUBMITTED', summary: prompt })
    this.wait(0.6)
    return this.state(this.root, 'working', 'reading the spec')
  }

  task(id: string, from: string, to: string, summary: string, parent = this.root) {
    this.push({ kind: 'task', taskId: id, parentTaskId: parent, sender: from, recipient: to, state: 'TASK_STATE_SUBMITTED', summary })
    this.push({ kind: 'task', taskId: id, parentTaskId: parent, sender: from, recipient: to, state: 'TASK_STATE_WORKING', summary }, undefined, this.t + 0.35)
    return this
  }

  state(id: string, state: 'working' | 'completed' | 'failed' | 'input_required', summary?: string) {
    return this.push({ kind: 'task', taskId: id, state: `TASK_STATE_${state.toUpperCase()}`, summary })
  }

  say(from: string, to: string, kind: CommKind, text: string, cites?: Cite[], taskId?: string, saved?: Saving) {
    return this.push({ kind: 'message', taskId, sender: from, recipient: to, data: { name: 'fc.comm', kind, text, cites, saved } })
  }

  /** Ask another agent instead of reading the material yourself; `saved` is what reading it would have cost. */
  ask(from: string, to: string, text: string, saved?: Saving) {
    return this.say(from, to, 'ask', text, undefined, undefined, saved)
  }

  /** A fact enters an agent's knowledge base. */
  learn(agent: string, text: string, source: KbEntry['source'], tokens = 0) {
    const entry: KbEntry = { id: `kb-${agent}-${++callN}`, agent, text, source, tokens }
    return this.push({ kind: 'artifact', sender: agent, data: { name: 'fc.kb', entry } })
  }

  /** A data job: published at the cursor, then `n` progress updates over `dur` seconds. The cursor does not move. */
  job(j: Omit<Job, 'step' | 'progress' | 'done'>, dur: number, n = 6, final: Record<string, string> = {}) {
    const t0 = this.t
    for (let i = 0; i <= n; i++) {
      const p = i / n
      const step = Math.min(j.steps.length - 1, Math.floor(p * j.steps.length))
      const done = i === n
      const series = j.series?.slice(0, Math.max(2, Math.round(j.series.length * p)))
      this.push(
        { kind: 'artifact', sender: j.agent, data: { name: 'fc.job', job: { ...j, series, step: done ? j.steps.length : step, progress: p, done, stats: done ? { ...j.stats, ...final } : j.stats } } },
        undefined,
        t0 + dur * p,
      )
    }
    return this
  }

  proposal(p: Proposal) {
    return this.push({ kind: 'artifact', sender: p.by, data: { name: 'fc.proposal', proposal: structuredClone(p) } })
  }

  /** The lead adds a subtask to the approved plan. */
  addSub(sub: Sub) {
    if (!this.plan) throw new Error('no plan')
    this.plan.subtasks = [...this.plan.subtasks, sub]
    return this.push({ kind: 'artifact', taskId: this.root, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })
  }

  /** A tool call: running now, finished `dur` seconds later. The cursor does not move. */
  tool(agent: string, tool: string, args: Record<string, unknown>, result: unknown, dur = 1.4, status: 'ok' | 'error' = 'ok') {
    const callId = `call-${++callN}`
    this.push({ kind: 'artifact', sender: agent, data: { name: 'fc.tool', call: { callId, agent, tool, args, status: 'running' } } })
    this.push({ kind: 'artifact', sender: agent, data: { name: 'fc.tool', call: { callId, agent, tool, args, status, result } } }, undefined, this.t + dur)
    return this
  }

  note(agent: string, text: string) {
    return this.push({ kind: 'artifact', sender: agent, data: { name: 'fc.note', agent, text } })
  }

  usage(agent: string, cost: number, ctx: number) {
    return this.push({ kind: 'usage', sender: agent, data: { cost, ctx } })
  }

  publishPlan(plan: Plan) {
    this.plan = structuredClone(plan)
    return this.push({ kind: 'artifact', taskId: this.root, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })
  }

  sub(id: string, patch: Partial<Subtask>) {
    if (!this.plan) throw new Error('no plan')
    this.plan.subtasks = this.plan.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s))
    return this.push({ kind: 'artifact', taskId: this.root, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })
  }

  /** The human approved the plan; subtasks they switched off are marked skipped. */
  approve(skip: string[] = []) {
    if (!this.plan) throw new Error('no plan')
    this.plan.approved = true
    this.plan.subtasks = this.plan.subtasks.map((s) => (skip.includes(s.id) ? { ...s, status: 'skipped' } : s))
    return this.push({ kind: 'artifact', taskId: this.root, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })
  }

  evidence(ranking: Ranked[], focus?: string[]) {
    return this.push({ kind: 'artifact', sender: 'archivist', data: { name: 'fc.evidence', ranking, focus } })
  }

  sim(run: Omit<SimRun, 'at'>) {
    return this.push({ kind: 'artifact', sender: run.by, data: { name: 'fc.sim', run } })
  }

  dossier(section: DossierSection) {
    return this.push({ kind: 'artifact', sender: section.author, data: { name: 'fc.dossier', section } })
  }

  matrix(rows: MatrixRow[], by = 'prevent') {
    return this.push({ kind: 'artifact', sender: by, data: { name: 'fc.matrix', rows } })
  }

  testRequest(request: TestRequest, by = 'prevent') {
    return this.push({ kind: 'artifact', sender: by, data: { name: 'fc.testreq', request } })
  }

  alarm(alarm: Omit<Alarm, 'at'>) {
    return this.push({ kind: 'artifact', sender: 'detect', data: { name: 'fc.alarm', alarm } })
  }

  caseFile(file: Omit<CaseFile, 'items' | 'verdict'>) {
    return this.push({ kind: 'artifact', sender: 'archivist', data: { name: 'fc.case', file } })
  }

  caseItem(item: CaseItem, by = 'archivist') {
    return this.push({ kind: 'artifact', sender: by, data: { name: 'fc.case', item } })
  }

  verdict(verdict: Verdict) {
    return this.push({ kind: 'artifact', sender: 'flight', data: { name: 'fc.case', verdict } })
  }

  /** FLIGHT asks you something. The replay holds here until you answer (or `auto` seconds pass; Infinity waits for you). */
  askHuman(id: string, question: string, options: string[], auto = 9, data: Record<string, unknown> = {}) {
    this.push({ kind: 'task', taskId: id, parentTaskId: this.root, sender: 'flight', recipient: HUMAN, state: 'TASK_STATE_SUBMITTED', summary: question })
    return this.push(
      { kind: 'task', taskId: id, parentTaskId: this.root, sender: 'flight', recipient: HUMAN, state: 'TASK_STATE_INPUT_REQUIRED', summary: question, data: { awaiting: HUMAN, options, ...data } },
      { auto },
    )
  }

  done(summary: string) {
    return this.state(this.root, 'completed', summary)
  }

  build(): Beat[] {
    return [...this.beats].sort((a, b) => a.t - b.t)
  }
}
