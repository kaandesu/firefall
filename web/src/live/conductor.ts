// A real review, shown in the same run screen as the demo. The conductor hands each department's subtask to the
// agent that fills that role on your Lagrange server, follows the agent's real tool calls, and turns each call's
// result into the events the screens draw (jobs, matrix rows, sims, proposals, knowledge). The plan and the briefs
// are fixed; the tool calls, the numbers, the reviews and the report are the agents'.
import { DECISIONS, MEDIATE_GATE, PLAN_GATE, SENSOR_GATE, SIGN_GATE, SIGN_OPTIONS, fixLabel, type Fix } from '@/demo/apollo1'
import { AGENT, HUMAN } from '@/demo/crew'
import { computeMatrix, type DesignPackage } from '@/demo/packages'
import { MATERIALS } from '@/sims/models'
import { briefFor, type RoleId } from './brief'
import { replyText, type TaskRow } from './roster'
import type { Entry, Job, KbEntry, MatrixRow, Plan, Proposal, Subtask } from './types'

type Out = Omit<Entry, 'seq' | 'at'>
type Rec = { n: number; tool: string; args: Record<string, unknown>; ok: boolean; result: unknown; at: string; ms: number }
type ToolCall = { id?: string; title?: string; status?: string; input?: unknown; output?: unknown }
type TaskResponse = { task?: TaskRow & { state?: string }; activity?: { data?: { toolCall?: ToolCall } }[] }

export type ConductorInput = {
  request: string
  pkg: DesignPackage
  files: { cabin: string; materials: string; model: string }
  /** Which address fills a role. */
  agentFor: (role: RoleId) => string
  emit: (e: Out) => void
  /** The stage shows this change as PR-1. */
  onFix: (f: Fix) => void
  lagrange: string
  tools: string
  fetch?: typeof fetch
}

const ROOT = 'run-real'
const SUB: Record<RoleId, string> = { archivist: 'P1', prevent: 'P2', sim: 'P3', detect: 'PD', suppress: 'PS', skeptic: 'P4', scribe: 'P5' }
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)} %`
const secs = (v: unknown) => (typeof v === 'number' ? `T+${v.toFixed(0)} s` : 'none in 30 s')
const alarm = (v: unknown) => (typeof v === 'number' ? `${v.toFixed(0)} s` : 'no alarm')
const canon = (v: unknown): string => (v && typeof v === 'object' ? (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`) : JSON.stringify(v))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const short = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function realPlan(): Subtask[] {
  const m = (r: RoleId) => AGENT[r].model
  return [
    { id: 'P1', title: 'Find the real tests closest to this cabin', agent: 'archivist', model: m('archivist'), status: 'pending', reads: ['PSI test points', 'BASS-II report'], produces: 'evidence and its limits' },
    { id: 'P2', title: 'Judge every material at the cabin atmosphere', agent: 'prevent', model: m('prevent'), status: 'pending', reads: ['materials.csv', 'cabin.yaml'], produces: 'materials matrix' },
    { id: 'P3', title: 'Fire spread, cabin pressure, a fix, FDS check', agent: 'sim', model: m('sim'), deps: ['P2'], status: 'pending', reads: ['cabin.model.json', 'matrix'], produces: 'spread + pressure + PR-1' },
    { id: 'PD', title: 'Smoke detection: would the sensors see it?', agent: 'detect', model: m('detect'), deps: ['P1'], status: 'pending', reads: ['cabin.model.json', 'cabin.yaml sensors'], produces: 'time to alarm + PR-2' },
    { id: 'PS', title: 'Suppression: would CO₂ put it out?', agent: 'suppress', model: m('suppress'), deps: ['P1'], status: 'pending', reads: ['cabin.yaml'], produces: 'extinguisher check' },
    { id: 'P4', title: 'Independent review of findings and proposals', agent: 'skeptic', model: m('skeptic'), deps: ['P3', 'PD', 'PS'], status: 'pending', reads: ['all findings'], produces: 'endorse / object' },
    { id: 'P5', title: 'Verdict and hazard report', agent: 'scribe', model: m('scribe'), deps: ['P4'], status: 'pending', reads: ['all findings', 'decisions'], produces: 'verdict + report', required: true },
  ]
}

export class Conductor {
  private f: typeof fetch
  private plan: Plan
  private stopped = false
  private log: Rec[] = []
  private cursor = 0
  private used = new Set<number>()
  private gates = new Map<string, (text: string) => void>()
  private findings: Partial<Record<RoleId, string>> = {}
  private decisions: string[] = []
  private kbN = 0
  private plays = new Map<string, number>()
  private jobs = new Map<string, Job>()
  private matrix: MatrixRow[]
  private asBuilt?: Record<string, unknown>
  private fix?: { args: Fix; result: Record<string, unknown> }
  private smoke?: Record<string, unknown>
  private proposals = new Map<string, Proposal>()
  private taskIds: string[] = []

  private x: ConductorInput

  constructor(x: ConductorInput) {
    this.x = x
    this.f = x.fetch ?? fetch.bind(globalThis)
    this.plan = { goal: x.request, approved: false, subtasks: realPlan() }
    this.matrix = computeMatrix(x.pkg, [])
  }

  // ── small emitters ──────────────────────────────────────────────────────────────────────
  private emit = (e: Out) => !this.stopped && this.x.emit(e)
  private sub(id: string, patch: Partial<Subtask>) {
    this.plan.subtasks = this.plan.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s))
    this.emit({ kind: 'artifact', taskId: ROOT, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })
  }
  private learn(agent: string, text: string, source: KbEntry['source']) {
    this.emit({ kind: 'artifact', sender: agent, data: { name: 'fc.kb', entry: { id: `kb-${agent}-${++this.kbN}`, agent, text, source, tokens: 0 } } })
  }
  private say(from: string, to: string, kind: string, text: string, taskId?: string) {
    this.emit({ kind: 'message', taskId, sender: from, recipient: to, data: { name: 'fc.comm', kind, text } })
  }
  private proposal(p: Proposal) {
    this.proposals.set(p.id, p)
    this.emit({ kind: 'artifact', sender: p.by, data: { name: 'fc.proposal', proposal: structuredClone(p) } })
  }
  private sim(id: string, by: string, label: string, metrics?: Record<string, string>) {
    this.emit({ kind: 'artifact', sender: by, data: { name: 'fc.sim', run: { id, sim: id === 'cabin-smoke' ? 'smoke' : 'spread', by, label, params: {}, metrics } } })
  }

  /** Show a job in the Lab: the tile plays the result over `ms`, then the job is done. A new call with the same id restarts it. */
  private play(j: Omit<Job, 'step' | 'progress' | 'done'>, ms = 3500, hold = false) {
    const token = (this.plays.get(j.id) ?? 0) + 1
    this.plays.set(j.id, token)
    const prev = this.jobs.get(j.id)
    const job: Job = { ...j, stats: { ...prev?.stats, ...j.stats }, step: 0, progress: 0, done: false }
    this.jobs.set(j.id, job)
    const n = 7
    const tick = (i: number) => {
      if (this.stopped || this.plays.get(j.id) !== token) return
      const p = hold ? Math.min(0.92, 1 - Math.exp(-i / 14)) : i / n
      const done = !hold && i === n
      const cur = this.jobs.get(j.id)!
      this.emit({ kind: 'artifact', sender: j.agent, data: { name: 'fc.job', job: { ...cur, step: done ? cur.steps.length : Math.min(cur.steps.length - 1, Math.floor(p * cur.steps.length)), progress: p, done } } })
      if (!done) setTimeout(() => tick(i + 1), hold ? 1500 : ms / n)
    }
    tick(0)
  }
  /** End a held job (FDS) with its final stats. */
  private finish(id: string, stats: Record<string, string>) {
    const cur = this.jobs.get(id)
    if (!cur) return
    this.plays.set(id, (this.plays.get(id) ?? 0) + 1)
    const job = { ...cur, stats: { ...cur.stats, ...stats }, step: cur.steps.length, progress: 1, done: true }
    this.jobs.set(id, job)
    this.emit({ kind: 'artifact', sender: cur.agent, data: { name: 'fc.job', job } })
  }

  private gate(id: string, question: string, options: string[], data: Record<string, unknown> = {}): Promise<string> {
    this.emit({ kind: 'task', taskId: id, parentTaskId: ROOT, sender: 'flight', recipient: HUMAN, state: 'TASK_STATE_SUBMITTED', summary: question })
    this.emit({ kind: 'task', taskId: id, parentTaskId: ROOT, sender: 'flight', recipient: HUMAN, state: 'TASK_STATE_INPUT_REQUIRED', summary: question, data: { awaiting: HUMAN, options, ...data } })
    return new Promise((res) => this.gates.set(id, res))
  }

  /** A person answered a question the review is waiting on. */
  answer(id: string, text: string) {
    const res = this.gates.get(id)
    if (!res) return false
    this.gates.delete(id)
    this.emit({ kind: 'message', taskId: id, sender: HUMAN, recipient: 'flight', data: { name: 'fc.comm', kind: 'human', text } })
    this.emit({ kind: 'task', taskId: id, parentTaskId: ROOT, sender: 'flight', recipient: HUMAN, state: 'TASK_STATE_COMPLETED', summary: text })
    res(text)
    return true
  }

  stop() {
    this.stopped = true
    for (const id of this.taskIds) void this.api(`/api/tasks/${encodeURIComponent(id)}/cancel`, {}).catch(() => undefined)
  }

  // ── network ────────────────────────────────────────────────────────────────────────────
  private async api<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.f(this.x.lagrange + path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = (res.headers.get('content-type') ?? '').includes('json') ? ((await res.json()) as T & { error?: string }) : undefined
    if (!res.ok) throw new Error(data?.error ?? `Lagrange answered ${res.status}`)
    return data as T
  }
  private pulling?: Promise<void>
  private pull() {
    this.pulling ??= this.f(`${this.x.tools}/calls?since=${this.cursor}`)
      .then((r) => r.json() as Promise<{ calls: Rec[] }>)
      .then(({ calls }) => {
        for (const c of calls) {
          this.log.push(c)
          this.cursor = Math.max(this.cursor, c.n)
        }
      })
      .catch(() => undefined)
      .finally(() => (this.pulling = undefined))
    return this.pulling
  }
  /** The tools server's record of a call an agent made (full result), matched by tool and arguments. */
  private async record(tool: string, input: unknown, output: unknown): Promise<Rec | undefined> {
    const key = canon(input ?? {})
    for (let i = 0; i < 6; i++) {
      await this.pull()
      const r = this.log.find((c) => c.tool === tool && !this.used.has(c.n) && canon(c.args ?? {}) === key)
      if (r) return this.used.add(r.n), r
      await sleep(400)
    }
    // Not in the log (the server restarted): fall back to what Lagrange kept, which may be cut at 4 KB.
    try {
      return { n: -1, tool, args: (input ?? {}) as Rec['args'], ok: true, result: JSON.parse(String(output)), at: '', ms: 0 }
    } catch {
      return undefined
    }
  }

  // ── the run ────────────────────────────────────────────────────────────────────────────
  async start() {
    const { pkg, request } = this.x
    try {
      const r = await this.f(`${this.x.tools}/cabin`, { method: 'POST', body: JSON.stringify(this.x.files) })
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'the tools server refused the files')
      await this.pull() // skip calls from before this review
      this.used = new Set(this.log.map((c) => c.n))
    } catch (e) {
      throw new Error(`The tools server is not reachable (${(e as Error).message}). Start it with \`pnpm tools\` in web/.`)
    }
    this.emit({ kind: 'artifact', taskId: ROOT, sender: HUMAN, recipient: 'flight', data: { name: 'fc.run', title: pkg.vehicle, scenario: 'real', spec: { vehicle: pkg.vehicle, atmosphere: pkg.atmosphere.label, gravity: pkg.gravity.label, volume: pkg.volume, crew: pkg.crew, materials: pkg.bom.length } } })
    this.emit({ kind: 'task', taskId: ROOT, sender: HUMAN, recipient: 'flight', state: 'TASK_STATE_SUBMITTED', summary: request })
    this.emit({ kind: 'task', taskId: ROOT, state: 'TASK_STATE_WORKING', summary: 'reading the three files' })
    this.learn('flight', `Cabin: ${pkg.atmosphere.label}, ${pkg.gravity.label}, ${pkg.volume}, crew ${pkg.crew}`, { kind: 'input', ref: 'cabin.yaml' })
    this.learn('flight', `Ignition at ${pkg.ignitionZones?.join(', ') || '?'}; hatch ${pkg.hatch?.type} (${pkg.hatch?.openTime} s); hull bursts at ${pkg.hull?.burstPsia} psia`, { kind: 'input', ref: 'cabin.yaml' })
    this.emit({ kind: 'artifact', sender: 'flight', data: { name: 'fc.note', agent: 'flight', text: 'the plan is FIREFALL’s fixed template; the work in each step is done by a real agent' } })
    for (const s of this.plan.subtasks) {
      const role = s.agent as RoleId
      this.learn(role, `This role is filled by @${this.x.agentFor(role)}, a real agent on your Lagrange server`, { kind: 'input', ref: 'team' })
    }
    this.emit({ kind: 'artifact', taskId: ROOT, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })
    await this.gate(PLAN_GATE, 'Approve the plan? Nothing runs until you do.', ['Approve plan'])
  }

  /** After the plan is approved. `skip` are the subtasks the person switched off. */
  async run(skip: string[] = []) {
    const on = (r: RoleId) => !skip.includes(SUB[r])
    this.plan.approved = true
    this.plan.subtasks = this.plan.subtasks.map((s) => (skip.includes(s.id) ? { ...s, status: 'skipped' } : s))
    this.emit({ kind: 'artifact', taskId: ROOT, sender: 'flight', data: { name: 'fc.plan', plan: structuredClone(this.plan) } })

    await Promise.all((['archivist', 'prevent'] as const).filter(on).map((r) => this.role(r)))
    await Promise.all((['sim', 'detect', 'suppress'] as const).filter(on).map((r) => this.role(r)))
    this.propose()
    if (on('skeptic')) await this.role('skeptic')
    await this.decide()
    await this.role('scribe')
    if (this.stopped) return
    // Only a person signs. The report is a draft until then; the review itself is finished.
    void this.gate(SIGN_GATE, 'Sign the hazard report? It stays a draft until a person signs.', SIGN_OPTIONS)
    this.emit({ kind: 'task', taskId: ROOT, state: 'TASK_STATE_COMPLETED', summary: 'Review complete' })
  }

  private digest(): string {
    const lines = (Object.keys(this.findings) as RoleId[]).map((r) => `[${AGENT[r].name}]\n${this.findings[r]}`)
    for (const p of this.proposals.values()) lines.push(`[${p.id} by ${AGENT[p.by]?.name ?? p.by}] ${p.title}. ${p.impact.map((i) => `${i.label}: ${i.before} → ${i.after}`).join('; ')}. Status: ${p.status}.${p.reviews.map((r) => ` ${AGENT[r.by]?.name ?? r.by}: ${r.stance}.`).join('')}`)
    if (this.decisions.length) lines.push(`[Decisions by the lead engineer]\n${this.decisions.join('\n')}`)
    return lines.join('\n\n') || '(none yet)'
  }

  /** One department's subtask: brief the agent, follow its tool calls, keep its answer. */
  private async role(role: RoleId) {
    if (this.stopped) return
    const sub = SUB[role]
    const agent = this.x.agentFor(role)
    const tid = `t-${role}`
    const title = this.plan.subtasks.find((s) => s.id === sub)!.title
    this.sub(sub, { status: 'running' })
    this.emit({ kind: 'task', taskId: tid, parentTaskId: ROOT, sender: 'flight', recipient: role, state: 'TASK_STATE_SUBMITTED', summary: `${sub} · ${title}` })
    this.emit({ kind: 'task', taskId: tid, parentTaskId: ROOT, sender: 'flight', recipient: role, state: 'TASK_STATE_WORKING', summary: `${sub} · ${title}` })
    const fail = (why: string) => {
      this.say(role, 'flight', 'fail', why, tid)
      this.emit({ kind: 'task', taskId: tid, state: 'TASK_STATE_FAILED', summary: short(why, 120) })
      this.sub(sub, { status: 'failed' })
      this.findings[role] = `(this step failed: ${why})`
    }
    try {
      const sent = await this.api<{ result?: { task?: { id?: string }; id?: string } }>('/api/send', { to: agent, text: briefFor(role, { request: this.x.request, pkg: this.x.pkg, files: this.x.files, findings: this.digest() }), tags: { app: 'firefall', role, subtask: sub } })
      const id = sent.result?.task?.id ?? sent.result?.id
      if (!id) throw new Error('Lagrange returned no task')
      this.taskIds.push(id)
      const seen = new Map<string, 'running' | 'done'>()
      const t0 = Date.now()
      for (;;) {
        await sleep(1000)
        if (this.stopped) return
        const r = await this.api<TaskResponse>(`/api/tasks/${encodeURIComponent(id)}`)
        for (const e of r.activity ?? []) {
          const c = e.data?.toolCall
          if (!c?.id || !c.title?.startsWith('mcp__firefall__')) continue
          const tool = c.title.slice('mcp__firefall__'.length)
          const over = c.status === 'completed' || c.status === 'failed'
          if (!seen.has(c.id)) {
            seen.set(c.id, 'running')
            this.emit({ kind: 'artifact', sender: role, data: { name: 'fc.tool', call: { callId: c.id, agent: role, tool, args: {}, status: 'running' } } })
          }
          if (over && seen.get(c.id) === 'running') {
            seen.set(c.id, 'done')
            const rec = await this.record(tool, c.input, c.output)
            const ok = c.status === 'completed' && rec?.ok !== false
            this.emit({ kind: 'artifact', sender: role, data: { name: 'fc.tool', call: { callId: c.id, agent: role, tool, args: (c.input ?? {}) as Record<string, unknown>, status: ok ? 'ok' : 'error', result: rec ? summarize(tool, rec.result) : undefined } } })
            if (ok && rec) this.effect(role, tool, rec.args ?? {}, rec.result as Record<string, unknown>)
          }
        }
        const state = r.task?.state ?? ''
        if (/COMPLETED/.test(state)) {
          const text = (r.task ? replyText(r.task) : '').trim() || '(empty answer)'
          this.findings[role] = text
          this.after(role, text, tid)
          this.emit({ kind: 'task', taskId: tid, state: 'TASK_STATE_COMPLETED' })
          this.sub(sub, { status: 'done' })
          return
        }
        if (/FAILED|CANCEL|REJECT/.test(state)) return fail(r.task ? replyText(r.task) || 'the agent’s task failed' : 'the agent’s task failed')
        if (/INPUT_REQUIRED/.test(state)) {
          // The brief says not to ask. Answer for it so the run does not stall on a permission prompt.
          await this.api(`/api/tasks/${encodeURIComponent(id)}/answer`, { text: 'Do not ask. Use only the firefall tools and continue.', decision: 'reject' }).catch(() => undefined)
        }
        if (Date.now() - t0 > 6 * 60_000) {
          void this.api(`/api/tasks/${encodeURIComponent(id)}/cancel`, {}).catch(() => undefined)
          return fail('no answer after 6 minutes; stopped')
        }
      }
    } catch (e) {
      fail((e as Error).message)
    }
  }

  /** What a finished tool call puts on the screens. */
  private effect(role: RoleId, tool: string, a: Record<string, unknown>, r: Record<string, unknown>) {
    const { pkg } = this.x
    const here = { o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow }
    const base = { agent: role, kind: 'sim' as const, where: 'firefall-tools · this machine', dataset: 'cabin files' }
    const matId = String(a.material ?? '').toLowerCase()
    const tref = { kind: 'tool' as const, ref: tool }
    switch (tool) {
      case 'get_cabin':
        return this.learn(role, `${r.vehicle}: ${((r.materials as unknown[]) ?? []).length} parts, ${((r.detectors as unknown[]) ?? []).length} detectors, hatch ${r.hatch_open_s} s, hull ${r.hull_burst_psia} psia`, tref)
      case 'limiting_o2': {
        const lim = Number(r.limiting_o2)
        this.play({ ...base, id: 'j-lim', scene: 'lim-sweep', params: { material: matId, ...here, ...cond(a) }, title: `Limiting O₂ · ${r.material}`, size: 'flow × O₂ map', steps: ['model', 'sweep', 'cabin point'], stats: { [matId]: pct(lim, 1) } })
        this.learn(role, `${r.material}: flame goes out below ${pct(lim, 1)} O₂ here; the cabin is at ${pct(here.o2)}`, tref)
        const rows = this.matrix.filter((m) => m.material === MATERIALS[matId]?.label).map((m) => ({ ...m, limitO2: lim }))
        // Only the Materials agent's calls at the cabin's own conditions fill the matrix.
        if (rows.length && role === 'prevent') this.emit({ kind: 'artifact', sender: role, data: { name: 'fc.matrix', rows } })
        return
      }
      case 'spread_rate':
        this.play({ ...base, id: 'j-spread', scene: 'spread-duct', params: { material: matId, ...here, ...cond(a), o2: Number(a.o2 ?? here.o2) }, title: `Flame spread · ${r.material}`, size: '1 sample', steps: ['ignite', 'spread', 'measure'], stats: { [matId]: r.burns ? `${r.spread_mm_s} mm/s` : 'does not burn' } })
        return this.learn(role, `${r.material} at ${pct(Number(a.o2 ?? here.o2))} O₂: ${r.burns ? `spreads at ${r.spread_mm_s} mm/s` : 'does not burn'}`, tref)
      case 'search_studies': {
        const top = ((r.studies as { name: string; psi: string | null; score: number }[]) ?? []).slice(0, 3)
        this.play({ ...base, kind: 'data', id: 'j-studies', scene: 'saffire-frames', title: 'PSI studies ranked for this atmosphere', dataset: 'PSI catalogue', size: '20 studies', steps: ['conditions', 'score', 'rank'], stats: Object.fromEntries(top.map((s) => [s.name, s.score.toFixed(2)])) })
        return this.learn(role, `Best-covering studies: ${top.map((s) => `${s.name} (${s.score.toFixed(2)})`).join(', ')}`, { kind: 'dataset', ref: 'PSI catalogue' })
      }
      case 'nearest_tests': {
        const t = ((r.tests as { id: string; study: string; o2: number; psia: number; match: number }[]) ?? [])[0]
        this.play({ ...base, kind: 'data', id: 'j-tests', scene: 'acme-frames', title: 'Nearest real tests · ACME, BASS-II, Saffire, FLEX', dataset: `${r.points_searched} test points`, size: `${r.points_searched} rows`, steps: ['load', 'distance', 'rank', 'limit'], stats: { closest: t ? `${t.id} (${pct(t.o2)} O₂, match ${t.match})` : 'none', 'richest O₂ tested': pct(Number(r.richest_o2_tested)) } }, 5000)
        if (t) this.learn(role, `Closest real test: ${t.id} (${t.study}) at ${pct(t.o2)} O₂, ${t.psia} psia, match ${t.match}`, { kind: 'dataset', ref: t.study })
        if (r.warning) this.learn(role, String(r.warning), { kind: 'dataset', ref: 'all test points' })
        return
      }
      case 'search_report': {
        const p = ((r.passages as { page: number; text: string }[]) ?? [])[0]
        if (!p) return
        this.play({ ...base, kind: 'data', id: 'j-report', scene: 'bass-stills', params: { page: p.page, query: String(a.query ?? '') }, title: `BASS-II report · “${short(String(a.query ?? ''), 40)}”`, dataset: 'PSI-25', size: `${r.pages_in_report} pages`, steps: ['search', 'rank pages', 'passage'], stats: { passage: short(p.text.replace(/\s+/g, ' '), 300), page: `p. ${p.page}` } }, 5000)
        return this.learn(role, `BASS-II report p. ${p.page}: “${short(p.text.replace(/\s+/g, ' '), 180)}”`, { kind: 'dataset', ref: `PSI-25 p. ${p.page}` })
      }
      case 'fire_spread': {
        const zones = (r.zones as { zone: string; burns: boolean; catches_at_s: number | null }[]) ?? []
        const caught = zones.filter((z) => z.catches_at_s !== null).length
        const whatIf = a.o2 !== undefined || a.psia !== undefined || a.g !== undefined || ((a.replace as unknown[]) ?? []).length > 0
        const metrics = { zones: `${caught}/${zones.length}`, rupture: secs(r.hull_rupture_at_s), 'peak pressure': `${(r.peak_pressure as { psia: number }).psia} psia` }
        if (!whatIf) {
          this.asBuilt = r
          this.play({ ...base, id: 'j-fire', scene: 'spread-duct', params: { material: 'nylon', ...here }, title: 'Fire spread + pressure · as built', dataset: 'cabin.model.json', size: `${zones.length} zones`, steps: ['zones', 'spread', 'pressure'], stats: metrics })
          this.sim('cabin-spread', role, 'Spread through the cabin · as built')
          setTimeout(() => this.sim('cabin-spread', role, 'Spread through the cabin · as built', metrics), 3600)
          setTimeout(() => this.sim('cabin-pressure', role, 'Cabin pressure vs hull', { rupture: metrics.rupture, hatch: `${r.hatch_open_s} s` }), 9000)
          return this.learn(role, `As built: fire reaches ${caught} of ${zones.length} zones, hull ruptures at ${metrics.rupture}; the hatch needs ${r.hatch_open_s} s`, tref)
        }
        const fix: Fix = { o2: a.o2 as number | undefined, psia: a.psia as number | undefined, g: a.g as number | undefined, replace: a.replace as Fix['replace'] }
        // Keep the latest what-if that holds the hull; otherwise the latest one.
        if (!this.fix || r.hull_rupture_at_s === null || this.fix.result.hull_rupture_at_s !== null) {
          this.fix = { args: fix, result: r }
          this.x.onFix(fix)
        }
        this.play({ ...base, id: 'j-whatif', scene: 'spread-duct', params: { material: fix.replace?.[0]?.to ?? 'nylon', ...here, o2: fix.o2 ?? here.o2, psi: fix.psia ?? here.psi, g: fix.g ?? here.g }, title: `What-if · ${fixLabel(fix)}`, dataset: 'cabin.model.json', size: `${zones.length} zones`, steps: ['zones', 'spread', 'pressure'], stats: metrics })
        setTimeout(() => this.sim('cabin-whatif', role, `What-if · ${fixLabel(fix)}`, metrics), 12_000)
        return this.learn(role, `With ${fixLabel(fix)}: ${caught} of ${zones.length} zones, rupture ${metrics.rupture}, peak ${metrics['peak pressure']}`, tref)
      }
      case 'smoke_alarm': {
        // PR-2 is judged at the cabin's own gravity; other gravities are shown but do not replace it.
        const own = Number(a.g) === pkg.gravity.g
        if (own || !this.smoke) this.smoke = r
        const d = r.designed_layout as { worst_first_alarm_s: number | null; missed: string[]; cases: unknown[] }
        const p = r.proposed_layout as { worst_first_alarm_s: number | null; detectors: { id: string; type: string }[] }
        this.play({ ...base, id: 'j-smoke', scene: 'smoke-cfd', title: `Smoke CFD · cabin section · ${r.gravity}`, dataset: 'cabin.model.json', size: `${r.cfd_runs} runs`, steps: ['mesh section', 'solve', 'alarms'], stats: { 'designed layout': d.missed.length ? `misses ${d.missed.join(', ')}` : `worst ${alarm(d.worst_first_alarm_s)}` } }, 6000)
        this.sim('cabin-smoke', role, 'Smoke in the cabin · designed sensors')
        if (own || this.smoke === r) setTimeout(() => this.play({ ...base, id: 'j-place', scene: 'sensor-opt', title: 'Sensor placement · worst-case arrival map', dataset: 'CFD runs', size: `${r.cfd_runs} runs`, steps: ['arrival maps', 'search', 'verify'], stats: { designed: alarm(d.worst_first_alarm_s), proposed: alarm(p.worst_first_alarm_s) } }, 4500), 6200)
        this.learn(role, `Designed layout at ${r.gravity}: worst first alarm ${alarm(d.worst_first_alarm_s)}${d.missed.length ? `, misses ${d.missed.join(', ')}` : ''}; smoke ≈ ${r.smoke_particle_um} µm`, tref)
        return this.learn(role, `Proposed layout (${p.detectors.map((x) => x.type).join(' + ')}): worst first alarm ${alarm(p.worst_first_alarm_s)}`, tref)
      }
      case 'droplet_burn': {
        const c = r.conditions as { o2: number; co2: number; diameter_mm: number }
        this.play({ ...base, id: 'j-droplet', scene: 'droplet', params: { o2: c.o2, co2: c.co2, d0: c.diameter_mm }, title: `Droplet with ${pct(c.co2)} CO₂ at ${pct(c.o2)} O₂`, dataset: 'FLEX model', size: '1 case', steps: ['ignite', 'flood CO₂', 'burn'], stats: { 'effective O₂': pct(Number(r.effective_o2)), result: r.burns ? 'keeps burning' : 'goes out' } })
        return this.learn(role, `${pct(c.co2)} CO₂ leaves ${pct(Number(r.effective_o2))} effective O₂ (limit ${pct(Number(r.limiting_o2))}): the flame ${r.burns ? 'keeps burning' : 'goes out'}`, tref)
      }
      case 'run_fds': {
        const p = r.params as { g: number; o2: number; burner_kw: number; t_end: number }
        this.play({ ...base, id: 'j-fds', scene: 'fds', params: { run: String(r.id) }, title: `FDS · ${r.label} · ${p.t_end} s`, dataset: `${r.id}.fds`, size: `${Number(r.cells).toLocaleString()} cells`, where: 'NIST FDS 6.11 · this machine', steps: ['generate .fds', 'run', 'post'], stats: { solver: 'FDS 6.11.1', run: String(r.id) } }, 0, true)
        return this.learn(role, `Started FDS run ${r.id}: ${Number(r.cells).toLocaleString()} cells, ${p.burner_kw} kW burner, ${p.t_end} s`, tref)
      }
      case 'fds_status': {
        if (r.state === 'running') return
        const s = r.summary as { peakHrrKw: number; peakPsia: number; burstAt: number | null; spreadAt: number | null } | undefined
        if (!this.jobs.has('j-fds')) return
        this.finish('j-fds', s ? { 'peak HRR': `${s.peakHrrKw.toFixed(0)} kW`, 'peak pressure': `${s.peakPsia.toFixed(1)} psia`, 'wall clock': `${r.wall_clock_s} s` } : { result: String(r.error ?? r.state) })
        if (s) this.learn(role, `FDS ${r.id}: peak ${s.peakHrrKw.toFixed(0)} kW, ${s.peakPsia.toFixed(1)} psia, spread beyond the burner ${s.spreadAt === null ? 'not seen' : `at ${s.spreadAt.toFixed(0)} s`}, hull burst ${s.burstAt === null ? 'not reached' : `at ${s.burstAt.toFixed(0)} s`}`, tref)
      }
    }
  }

  /** The agent's own words go to the lead; the skeptic's and the scribe's answers have structure to read. */
  private after(role: RoleId, text: string, tid: string) {
    if (role === 'scribe') {
      const { headline, would, body } = parseReport(text)
      this.emit({ kind: 'artifact', sender: 'flight', data: { name: 'fc.case', verdict: { outcome: 'prevented', headline, would } } })
      this.emit({ kind: 'artifact', sender: role, data: { name: 'fc.dossier', section: { id: 'agent-report', title: 'Hazard report', pillar: 'summary', author: role, body: [body] } } })
      return this.say(role, 'flight', 'reply', headline, tid)
    }
    this.say(role, 'flight', 'reply', text, tid)
    if (role !== 'skeptic') return
    for (const p of this.proposals.values()) {
      const m = text.match(new RegExp(`${p.id}\\s*[:\\-–]?\\s*\\**\\s*(ENDORSE|OBJECT)`, 'i'))
      const stance = m ? (m[1].toUpperCase() === 'OBJECT' ? 'object' : 'endorse') : 'comment'
      const line = text.split('\n').find((l) => l.includes(p.id)) ?? ''
      const why = line.replace(new RegExp(`^.*?${p.id}\\s*[:\\-–]?\\s*\\**\\s*(ENDORSE|OBJECT)?\\**\\s*[:.,\\-–]?\\s*`, 'i'), '').trim()
      this.proposal({ ...p, reviews: [...p.reviews, { by: 'skeptic', stance, text: why || short(text, 400) }], status: 'escalated' })
      this.say('skeptic', p.by, 'review', `${p.id}: ${stance}. ${why}`)
    }
  }

  /** Proposals, built from what the agents' tool calls returned. */
  private propose() {
    if (this.stopped) return
    const a = this.asBuilt, f = this.fix
    if (a && f) {
      const n = (r: Record<string, unknown>) => ((r.zones as { catches_at_s: number | null }[]) ?? []).filter((z) => z.catches_at_s !== null).length
      this.proposal({
        id: 'PR-1',
        by: 'sim',
        title: fixLabel(f.args),
        change: `Change the cabin: ${fixLabel(f.args)}.`,
        why: 'The Simulation agent tried this change with the fire_spread tool; the numbers are from that run.',
        impact: [
          { label: 'zones the fire reaches', before: String(n(a)), after: String(n(f.result)) },
          { label: 'hull rupture', before: secs(a.hull_rupture_at_s), after: secs(f.result.hull_rupture_at_s) },
          { label: 'peak pressure', before: `${(a.peak_pressure as { psia: number }).psia} psia`, after: `${(f.result.peak_pressure as { psia: number }).psia} psia` },
        ],
        reviews: [],
        status: 'open',
      })
    }
    const s = this.smoke
    if (s) {
      const d = s.designed_layout as { worst_first_alarm_s: number | null; missed: string[]; cases: unknown[] }
      const p = s.proposed_layout as { worst_first_alarm_s: number | null; detectors: { id: string; type: string; x_m: number; y_m: number }[] }
      this.proposal({
        id: 'PR-2',
        by: 'detect',
        title: `Move the detectors: ${p.detectors.length}× ${p.detectors[0]?.type ?? 'ionization'}`,
        change: `Place ${p.detectors.map((x) => `${x.id} ${x.type} at x ${x.x_m} m, y ${x.y_m} m`).join('; ')}.`,
        why: `Positions and type found by the smoke_alarm tool for ${s.smoke_particle_um} µm smoke at ${s.gravity}.`,
        impact: [
          { label: 'worst first alarm', before: alarm(d.worst_first_alarm_s), after: alarm(p.worst_first_alarm_s) },
          { label: 'sources missed', before: String(d.missed.length), after: '0' },
        ],
        reviews: [],
        status: 'open',
      })
    }
  }

  /** People decide on the proposals. */
  private async decide() {
    const pr1 = this.proposals.get('PR-1'), pr2 = this.proposals.get('PR-2')
    if (pr1 && !this.stopped) {
      const rev = pr1.reviews.find((r) => r.by === 'skeptic')
      const ans = await this.gate(MEDIATE_GATE, rev?.stance === 'object' ? 'Simulation proposes PR-1 and Safety Assurance objects. Your call.' : `Accept PR-1 (${pr1.title})?`, DECISIONS.map((d) => d.label), {
        positions: [{ by: 'sim', text: `${pr1.title}: ${pr1.impact.map((i) => `${i.label} ${i.before} → ${i.after}`).join('; ')}.` }, ...(rev ? [{ by: 'skeptic', text: `${rev.stance}: ${rev.text}` }] : [])],
      })
      const rejected = /reject/i.test(ans)
      this.proposal({ ...this.proposals.get('PR-1')!, status: rejected ? 'rejected' : 'accepted', decidedBy: HUMAN })
      this.decisions.push(`PR-1 (${pr1.title}): ${ans}`)
      this.learn('flight', `PR-1 ${rejected ? 'rejected' : 'accepted'} by the lead engineer: “${ans}”`, { kind: 'human', ref: '@you' })
    }
    if (pr2 && !this.stopped) {
      const ans = await this.gate(SENSOR_GATE, `Adopt PR-2? ${pr2.impact.map((i) => `${i.label}: ${i.before} → ${i.after}`).join('; ')}.`, ['Adopt PR-2', 'Keep the designed layout'])
      const keep = /keep/i.test(ans)
      this.proposal({ ...this.proposals.get('PR-2')!, status: keep ? 'rejected' : 'accepted', decidedBy: HUMAN })
      this.decisions.push(`PR-2 (${pr2.title}): ${ans}`)
      this.learn('flight', `PR-2 ${keep ? 'not adopted' : 'adopted'} by the lead engineer`, { kind: 'human', ref: '@you' })
    }
  }

  /** A question typed to the lead during the run: a real message to the lead's agent, with the findings so far. */
  async chat(text: string) {
    this.emit({ kind: 'message', sender: HUMAN, recipient: 'flight', data: { name: 'fc.comm', kind: 'human', text } })
    try {
      const sent = await this.api<{ result?: { task?: { id?: string }; id?: string } }>('/api/send', {
        to: this.x.agentFor('scribe'),
        text: `You are the Review Lead of a spacecraft fire-safety review. Answer the lead engineer's question in at most 4 short lines, using only the findings below (you may call a firefall tool if a number is missing).\n\nFINDINGS SO FAR\n${this.digest()}\n\nQUESTION\n${text}`,
        tags: { app: 'firefall', role: 'flight' },
      })
      const id = sent.result?.task?.id ?? sent.result?.id
      for (let i = 0; id && i < 120; i++) {
        await sleep(1000)
        const r = await this.api<TaskResponse>(`/api/tasks/${encodeURIComponent(id)}`)
        if (/COMPLETED|FAILED|CANCEL/.test(r.task?.state ?? '')) return this.say('flight', HUMAN, 'reply', (r.task && replyText(r.task)) || 'no answer')
      }
    } catch (e) {
      this.say('flight', HUMAN, 'fail', (e as Error).message)
    }
  }
}

const cond = (a: Record<string, unknown>) => ({ ...(a.flow_cm_s !== undefined ? { flow: Number(a.flow_cm_s) } : {}), ...(a.g !== undefined ? { g: Number(a.g) } : {}), ...(a.psia !== undefined ? { psi: Number(a.psia) } : {}) })

/** A short form of a tool result for the agent panel. */
export function summarize(tool: string, r: unknown): unknown {
  if (!r || typeof r !== 'object') return r
  const x = r as Record<string, unknown>
  const pick = (...ks: string[]) => Object.fromEntries(ks.filter((k) => x[k] !== undefined).map((k) => [k, x[k]]))
  switch (tool) {
    case 'limiting_o2': return pick('limiting_o2')
    case 'spread_rate': return pick('burns', 'spread_mm_s', 'limiting_o2')
    case 'fire_spread': return pick('hull_rupture_at_s', 'peak_pressure', 'crew_can_get_out_first')
    case 'nearest_tests': return { ...pick('richest_o2_tested', 'points_searched'), closest: (x.tests as { id: string }[] | undefined)?.[0]?.id }
    case 'search_studies': return { top: (x.studies as { name: string }[] | undefined)?.slice(0, 3).map((s) => s.name) }
    case 'smoke_alarm': return { designed: (x.designed_layout as { worst_first_alarm_s: unknown })?.worst_first_alarm_s, proposed: (x.proposed_layout as { worst_first_alarm_s: unknown })?.worst_first_alarm_s }
    case 'droplet_burn': return pick('burns', 'effective_o2', 'limiting_o2')
    case 'run_fds': return pick('id', 'state', 'cells')
    case 'fds_status': return { ...pick('id', 'state', 'wall_clock_s'), ...(x.summary ? { peakHrrKw: (x.summary as { peakHrrKw: number }).peakHrrKw } : {}) }
    case 'search_report': return { pages: (x.passages as { page: number }[] | undefined)?.map((p) => p.page) }
    case 'get_cabin': return pick('vehicle', 'atmosphere', 'gravity_g')
    default: return undefined
  }
}

/** The scribe's answer: "VERDICT: …", a few "- " key facts, then the report in Markdown. Anything else is kept as the body. */
export function parseReport(text: string): { headline: string; would: string[]; body: string } {
  const lines = text.split('\n')
  const vi = lines.findIndex((l) => /^\W*VERDICT\W*:/i.test(l))
  const headline = vi >= 0 ? lines[vi].replace(/^\W*VERDICT\W*:[\s*]*/i, '').replace(/\*+$/, '').trim() : 'Review complete'
  const would: string[] = []
  let i = vi + 1
  for (; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) continue
    if (/^[-*•]\s+/.test(l) && would.length < 5) would.push(l.replace(/^[-*•]\s+/, ''))
    else break
  }
  const body = lines.slice(vi >= 0 ? i : 0).join('\n').trim()
  return { headline, would, body: body || text.trim() }
}
