// App state: the phase you are in (intake → plan → run → done), the intake files, the run model folded
// from Lagrange entries, and the Halo-style panel layout (focus + size per panel).
import { create } from 'zustand'
import { HUMAN, type ComputeNode } from '@/demo/crew'
import { apollo1, DECISIONS, LAB_GATE, MEDIATE_GATE, PLAN_GATE, SENSOR_GATE, type Decision, type ReviewInput } from '@/demo/apollo1'
import { detectEvents, loadFrames, loadSensors, loadTestpoints, sensorStats } from '@/data/acme'
import { buildEvidence } from '@/data/evidence'
import { getSmokeStudy, startSmokeStudy, whenSmokeStudy } from '@/lab/useSmokeStudy'
import type { DesignPackage } from '@/demo/packages'
import { IntakeError, parseCabin, parseMaterials, parseModel, toPackage, type CabinModel, type CabinSpec, type MaterialRow, type Slot } from '@/intake/parse'
import type { Variant } from '@/stage/physics'
import { emptyModel, reduce, type Model } from './model'
import { Replay, type ReplayStatus } from './replay'
import { LagrangeSource } from './lagrange'
import type { Entry, SimRun } from './types'

export type Phase = 'start' | 'setup' | 'live' | 'intake' | 'plan' | 'run' | 'done'

export type SlotState<T> = { name: string; text: string; value?: T; error?: string }

export type Intake = { cabin?: SlotState<CabinSpec>; materials?: SlotState<MaterialRow[]>; model?: SlotState<CabinModel> }

/** Halo's panel ladder: a one-line bar, the default, the whole column, the whole screen. */
export type Size = 'bar' | 'normal' | 'column' | 'full'
export const LADDER: Size[] = ['bar', 'normal', 'column', 'full']

export type PanelId = 1 | 2 | 3 | 4 | 5 | 6
export const PANELS: { id: PanelId; name: string }[] = [
  { id: 1, name: 'network' },
  { id: 2, name: 'stage' },
  { id: 3, name: 'agent' },
  { id: 4, name: 'lab' },
  { id: 5, name: 'findings' },
  { id: 6, name: 'comms' },
]
const DEFAULT_SIZES: Record<PanelId, Size> = { 1: 'normal', 2: 'normal', 3: 'normal', 4: 'normal', 5: 'normal', 6: 'normal' }

export type Layer = 'materials' | 'spread' | 'pressure' | 'smoke' | 'whatif'

export const EXAMPLE_DIR = '/examples/apollo-cm012'
export const EXAMPLE_FILES: Record<Slot, string> = { cabin: 'cabin.yaml', materials: 'materials.csv', model: 'cabin.model.json' }
export const DEFAULT_REQUEST = 'Would a materials review have caught this cabin before the plugs-out test?'

type State = {
  phase: Phase
  intake: Intake
  request: string
  /** Frozen at start: what the run is reviewing. */
  pkg?: DesignPackage
  cabin?: CabinModel
  skip: string[]
  labTest: boolean
  decision: Decision
  pr2: boolean
  acme?: ReviewInput['acme']
  /** Servers / GPU farms an org added on the compute screen (demo). */
  nodes: ComputeNode[]
  /** MCP servers added per agent (demo handshake). */
  mcp: Record<string, { name: string; url: string; tools: string[] }[]>
  /** Which top-level view is open beside the review. */
  view: 'review' | 'inbox' | 'library' | 'evidence' | 'fds' | 'compute'
  /** Evidence rows pinned for the report. */
  pins: string[]
  /** Whose inbox is open: you (lead engineer) or the WSTF technician. */
  persona: string
  planOpen: boolean
  /** The cabin intro is showing (once per review). */
  intro: boolean
  mode: 'demo' | 'live'
  liveError?: string
  model: Model
  status: ReplayStatus
  speed: number
  startedAt?: number

  focus: PanelId
  sizes: Record<PanelId, Size>
  help: boolean
  selectedAgent: string
  followAgent: boolean
  openRow?: string
  hoverZone?: string
  layer: Layer
  variant: Variant['id']
  /** Bumped when an agent asks the stage to play from T+0. */
  stagePlay: number

  setPhase: (p: Phase) => void
  addNode: (n: ComputeNode) => void
  addMcp: (agent: string, server: { name: string; url: string; tools: string[] }) => void
  setView: (v: State['view']) => void
  setPersona: (h: string) => void
  /** A person answers an inbox item (live: sent to Lagrange; demo: the held question, or ignored for the technician, who submits on the script's clock). */
  respond: (id: string, text: string) => void
  togglePin: (id: string) => void
  setPlanOpen: (on: boolean) => void
  skipIntro: () => void
  setSlot: (slot: Slot, name: string, text: string) => void
  clearSlot: (slot: Slot) => void
  loadExample: () => Promise<void>
  setRequest: (r: string) => void
  start: () => Promise<void>
  toggleSkip: (id: string) => void
  /** Approve the plan, with an optional note for the lead. */
  approve: (note?: string) => Promise<void>
  answer: (text: string) => void
  ask: (text: string) => void
  play: () => void
  pause: () => void
  setSpeed: (s: number) => void
  reset: () => void
  showVerdict: (on: boolean) => void
  goLive: (url: string) => void
  ingest: (e: Entry) => void

  focusPanel: (id: PanelId) => void
  grow: (d: 1 | -1, id?: PanelId) => void
  setHelp: (on: boolean) => void
  selectAgent: (h: string) => void
  cycleAgent: (d: 1 | -1) => void
  toggleRow: (id?: string) => void
  setHoverZone: (z?: string) => void
  setLayer: (l: Layer) => void
  setVariant: (v: Variant['id']) => void
}

let replay: Replay | null = null
let live: LagrangeSource | null = null
let doneTimer: ReturnType<typeof setTimeout> | null = null

const idleStatus: ReplayStatus = { playing: false, t: 0, total: 0, holding: false, finished: false }

function parseSlot(slot: Slot, text: string): { value?: unknown; error?: string } {
  try {
    const value = slot === 'cabin' ? parseCabin(text) : slot === 'materials' ? parseMaterials(text) : parseModel(text)
    return { value }
  } catch (e) {
    return { error: e instanceof IntakeError ? e.message : `Could not read the file: ${(e as Error).message}` }
  }
}

/** Everyone on the review network, grouped by organization (the order the network ring shows them). */
export const NETWORK = ['flight', 'prevent', 'detect', 'suppress', 'sim', 'scribe', 'archivist', 'wstf', 'lab', 'skeptic'] as const

/** The agents (not people) on the network: what h / l cycles through. */
export function runAgents(_m?: Model): string[] {
  return NETWORK.filter((h) => h !== 'lab')
}

export const useMission = create<State>((set, get) => ({
  phase: 'start',
  intake: {},
  labTest: true,
  decision: 'caveat',
  pr2: true,
  nodes: [],
  mcp: {},
  view: 'review',
  pins: [],
  persona: HUMAN,
  intro: false,
  planOpen: false,
  request: DEFAULT_REQUEST,
  skip: [],
  mode: 'demo',
  model: emptyModel(),
  status: idleStatus,
  speed: 1,
  focus: 2,
  sizes: { ...DEFAULT_SIZES },
  help: false,
  selectedAgent: 'flight',
  followAgent: true,
  layer: 'materials',
  variant: 'as-built',
  stagePlay: 0,

  setPhase: (phase) => set({ phase }),
  addNode: (n) => set((s) => ({ nodes: [...s.nodes.filter((x) => x.id !== n.id), { ...n, added: true }] })),
  addMcp: (agent, server) => set((s) => ({ mcp: { ...s.mcp, [agent]: [...(s.mcp[agent] ?? []), server] } })),
  setView: (view) => set({ view }),
  setPersona: (persona) => set({ persona }),
  respond: (id, text) => {
    const s = get()
    if (s.model.waiting?.taskId === id) return s.answer(text)
    if (s.mode === 'live') live?.answer(id, text)
  },
  skipIntro: () => set({ intro: false }),
  togglePin: (id) => set((s) => ({ pins: s.pins.includes(id) ? s.pins.filter((x) => x !== id) : [...s.pins, id] })),
  setPlanOpen: (planOpen) => set({ planOpen }),
  setSlot: (slot, name, text) => set((s) => ({ intake: { ...s.intake, [slot]: { name, text, ...parseSlot(slot, text) } } })),
  clearSlot: (slot) => set((s) => ({ intake: { ...s.intake, [slot]: undefined } })),
  loadExample: async () => {
    const entries = await Promise.all(
      (Object.entries(EXAMPLE_FILES) as [Slot, string][]).map(async ([slot, f]) => {
        const res = await fetch(`${EXAMPLE_DIR}/${f}`)
        return [slot, f, await res.text()] as const
      }),
    )
    for (const [slot, f, text] of entries) get().setSlot(slot, f, text)
    set({ request: DEFAULT_REQUEST })
  },
  setRequest: (request) => set({ request }),

  start: async () => {
    const { intake } = get()
    const spec = intake.cabin?.value
    const rows = intake.materials?.value
    const cabin = intake.model?.value
    if (!spec || !rows || !cabin) return
    const pkg = toPackage(spec, rows)
    startSmokeStudy(pkg, cabin)
    // Real ACME results, computed in the browser from public/data/acme before the agents use them.
    if (!get().acme) {
      try {
        const [f, sen, tp] = await Promise.all([loadFrames(), loadSensors(), loadTestpoints()])
        set({ acme: { events: detectEvents(f), sensors: sensorStats(sen), evidence: buildEvidence(tp).length } })
      } catch {
        /* the run still works without the real data */
      }
    }
    replay?.dispose()
    live?.close()
    live = null
    set({
      phase: 'plan',
      intro: new URLSearchParams(location.search).get('intro') !== '0',
      view: 'review',
      mode: 'demo',
      pkg,
      cabin,
      skip: [],
      labTest: true,
      decision: 'caveat',
      pr2: true,
      model: emptyModel(),
      status: idleStatus,
      startedAt: Date.now(),
      sizes: { ...DEFAULT_SIZES },
      focus: 2,
      selectedAgent: 'flight',
      followAgent: true,
      openRow: undefined,
      layer: 'materials',
      variant: 'as-built',
    })
    replay = new Replay(apollo1(input(get())), (e) => get().ingest(e), (status) => set({ status }))
    replay.setSpeed(get().speed)
    replay.play()
  },
  toggleSkip: (id) => {
    const sub = get().model.plan?.subtasks.find((s) => s.id === id)
    if (!sub || sub.required || get().model.plan?.approved) return
    set((s) => ({ skip: s.skip.includes(id) ? s.skip.filter((x) => x !== id) : [...s.skip, id] }))
  },
  approve: async (note) => {
    let s = get()
    if (s.model.waiting?.taskId !== PLAN_GATE) return
    const extra = note?.trim() ? `. Note: ${note.trim()}` : ''
    if (s.mode === 'live') {
      live?.answer(PLAN_GATE, `Approve plan${extra}`)
      return
    }
    // The detection agent needs its CFD results; they run in a worker from the moment the case is loaded.
    if (!getSmokeStudy().study) await whenSmokeStudy(20_000)
    s = get()
    if (s.model.waiting?.taskId !== PLAN_GATE) return
    // The skipped subtasks change what comes after the gate.
    replay?.swap(apollo1(input(s)))
    const off = s.skip.length ? ` (switched off: ${s.skip.join(', ')})` : ''
    replay?.answer(`Approve plan${off}${extra}`)
    set({ phase: 'run', intro: false, startedAt: Date.now() })
  },
  answer: (text) => {
    const s = get()
    const w = s.model.waiting
    if (!w) return
    if (w.taskId === PLAN_GATE) return s.approve()
    if (s.mode === 'live') {
      live?.answer(w.taskId, text)
      return
    }
    if (w.taskId === LAB_GATE) {
      set({ labTest: !/skip/i.test(text) })
      replay?.swap(apollo1(input(get())))
    }
    if (w.taskId === SENSOR_GATE) {
      set({ pr2: !/keep/i.test(text) })
      replay?.swap(apollo1(input(get())))
    }
    if (w.taskId === MEDIATE_GATE) {
      set({ decision: DECISIONS.find((d) => d.label === text)?.id ?? 'caveat' })
      replay?.swap(apollo1(input(get())))
    }
    replay?.answer(text)
  },
  ask: (text) => {
    const t = text.trim()
    if (!t || !replay) return
    replay.inject({ kind: 'message', sender: HUMAN, recipient: 'flight', data: { name: 'fc.comm', kind: 'human', text: t } })
    const m = get().model
    const reply = leadReply(t, m)
    setTimeout(() => replay?.inject({ kind: 'message', sender: 'flight', recipient: HUMAN, data: { name: 'fc.comm', kind: 'reply', text: reply } }), 1100)
  },
  play: () => replay?.play(),
  pause: () => replay?.pause(),
  setSpeed: (speed) => {
    replay?.setSpeed(speed)
    set({ speed })
  },
  reset: () => {
    replay?.dispose()
    replay = null
    live?.close()
    live = null
    if (doneTimer) clearTimeout(doneTimer)
    set({ phase: 'intake', model: emptyModel(), status: idleStatus, pkg: undefined, cabin: undefined, skip: [] })
  },
  showVerdict: (on) => set({ phase: on ? 'done' : 'run' }),
  goLive: (url) => {
    replay?.dispose()
    replay = null
    live?.close()
    set({ mode: 'live', phase: 'plan', liveError: undefined, model: emptyModel(), status: idleStatus })
    live = new LagrangeSource(url, (e) => get().ingest(e), (err) => set({ liveError: err }))
    void live.open()
  },

  ingest: (e) => {
    const prev = get().model
    const model = reduce(prev, e)
    if (model === prev) return
    set({ model })
    const d = e.data ?? {}
    const s = get()
    if (model.plan?.approved && s.phase === 'plan') set({ phase: 'run' })
    if (model.done && !prev.done) {
      if (doneTimer) clearTimeout(doneTimer)
      doneTimer = setTimeout(() => get().phase === 'run' && set({ phase: 'done' }), 2200)
    }
    if (e.kind === 'artifact' && d.name === 'fc.tool') {
      const call = d.call as { agent: string; status: string }
      if (s.followAgent && call.status === 'running') set({ selectedAgent: call.agent })
    }
    if (e.kind === 'artifact' && d.name === 'fc.matrix') set({ sizes: { ...get().sizes, 5: get().sizes[5] === 'bar' ? 'normal' : get().sizes[5] } })
    if (e.kind === 'artifact' && d.name === 'fc.sim') {
      const run = d.run as SimRun
      if (run.id === 'cabin-spread' && !run.metrics) set({ layer: 'spread', variant: 'as-built', stagePlay: get().stagePlay + 1 })
      if (run.id === 'cabin-pressure') set({ layer: 'pressure' })
      if (run.id === 'cabin-smoke') set({ layer: 'smoke', stagePlay: get().stagePlay + 1 })
      if (run.id === 'cabin-whatif' && run.metrics) set({ layer: 'whatif', variant: 'proposal', stagePlay: get().stagePlay + 1 })
    }
  },

  focusPanel: (id) =>
    set((s) => {
      // Like Halo: moving the focus puts grown panels back to normal; bars stay bars.
      const sizes = { ...s.sizes }
      for (const p of PANELS) if (LADDER.indexOf(sizes[p.id]) > 1) sizes[p.id] = 'normal'
      return { focus: id, sizes }
    }),
  grow: (d, id) =>
    set((s) => {
      const p = id ?? s.focus
      const i = Math.max(0, Math.min(LADDER.length - 1, LADDER.indexOf(s.sizes[p]) + d))
      const sizes = { ...s.sizes, [p]: LADDER[i] }
      if (LADDER[i] === 'full' || LADDER[i] === 'column') for (const q of PANELS) if (q.id !== p && LADDER.indexOf(sizes[q.id]) > 1) sizes[q.id] = 'normal'
      return { sizes, focus: p }
    }),
  setHelp: (help) => set({ help }),
  selectAgent: (selectedAgent) => set({ selectedAgent, followAgent: false }),
  cycleAgent: (d) => {
    const hs = runAgents(get().model)
    const i = hs.indexOf(get().selectedAgent)
    set({ selectedAgent: hs[(i + d + hs.length) % hs.length], followAgent: false })
  },
  toggleRow: (id) => set((s) => ({ openRow: s.openRow === id ? undefined : id })),
  setHoverZone: (hoverZone) => set({ hoverZone }),
  setLayer: (layer) => set({ layer }),
  setVariant: (variant) => set({ variant, stagePlay: get().stagePlay + 1 }),
}))

function input(s: State): ReviewInput {
  return { pkg: s.pkg!, model: s.cabin!, request: s.request, skip: s.skip, labTest: s.labTest, decision: s.decision, pr2: s.pr2, acme: s.acme, smoke: getSmokeStudy().study }
}

/** Demo stand-in for the lead's answer when you type into "ask the lead". */
function leadReply(q: string, m: Model): string {
  const fails = m.matrix.filter((r) => r.status === 'fail').length
  if (/hatch|egress|escape|door/i.test(q)) return 'The hatch is outside what combustion data can judge. Safety Assurance flagged it; it stays in the verdict as a known gap.'
  if (/why|burn|o2|oxygen|material/i.test(q)) return m.matrix.length ? `${fails} of ${m.matrix.length} materials are below their limiting O₂ here. Open a row in Findings for the margin and the source.` : 'Materials is still on it. The matrix lands in Findings when it is done.'
  if (/micro|µg|orbit|moon|base/i.test(q)) return 'The what-if step re-runs this cabin in µg and at base camp. It comes after the scope check.'
  return 'Noted. I will fold that into the review; ask me about materials, the spread, or the hatch.'
}
