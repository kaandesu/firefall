import { create } from 'zustand'
import { HUMAN, type PersonDef } from '@/demo/crew'
import { SCENARIOS, type ScenarioId } from '@/demo/scenarios'
import { emptyModel, reduce, type Model } from './model'
import { Replay, type ReplayStatus } from './replay'
import { LagrangeSource } from './lagrange'
import type { Entry, SimKind, SimParams, SimRun } from './types'

export type ViewId = 'guide' | 'overview' | 'materials' | 'evidence' | 'sim' | 'report' | 'case' | 'agent'

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'guide', label: 'How it works' },
  { id: 'overview', label: 'Overview' },
  { id: 'case', label: 'Case file' },
  { id: 'materials', label: 'Materials' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'sim', label: 'Simulations' },
  { id: 'report', label: 'Hazard report' },
  { id: 'agent', label: 'Agent' },
]

/** How much content a tab has, used to show a "new" dot on tabs you are not looking at. */
export function tabCount(m: Model, v: ViewId): number {
  switch (v) {
    case 'overview':
      return (m.plan?.subtasks.filter((s) => s.status === 'done').length ?? 0) + (m.plan ? 1 : 0)
    case 'materials':
      return m.matrix.length + m.tests.length * 10 + m.tests.filter((t) => t.status === 'scheduled').length
    case 'evidence':
      return m.ranking.length
    case 'sim':
      return m.sims.filter((s) => s.metrics).length
    case 'report':
      return m.dossier.length
    case 'case':
      return (m.caseFile?.items.length ?? 0) + (m.caseFile?.verdict ? 1 : 0)
    default:
      return 0
  }
}

export type Params = SimParams & { material: string }
export type Theme = 'light' | 'dark'

type State = {
  scenario: ScenarioId
  mode: 'demo' | 'live'
  liveUrl: string
  liveError?: string
  model: Model
  status: ReplayStatus
  speed: number
  tab: ViewId
  follow: boolean
  lastDirect: number
  seen: Partial<Record<ViewId, number>>
  chatOpen: boolean
  theme: Theme
  people: PersonDef[]
  params: Params
  simTab: SimKind
  simDriver?: SimRun
  selectedAgent: string
  selectedInv?: string

  load: (s: ScenarioId, autoplay?: boolean) => void
  play: () => void
  pause: () => void
  setSpeed: (s: number) => void
  answer: (text: string) => void
  goLive: (url: string) => void
  goDemo: () => void
  ingest: (e: Entry) => void
  setTab: (v: ViewId) => void
  directTo: (v: ViewId, force?: boolean) => void
  setFollow: (on: boolean) => void
  setChatOpen: (on: boolean) => void
  setTheme: (t: Theme) => void
  addPerson: (p: Omit<PersonDef, 'handle' | 'added'>) => void
  removePerson: (handle: string) => void
  setParams: (p: Partial<Params>) => void
  setSimTab: (k: SimKind) => void
  selectAgent: (h: string, open?: boolean) => void
  selectInv: (id?: string) => void
}

let replay: Replay | null = null
let live: LagrangeSource | null = null

const idleStatus: ReplayStatus = { playing: false, t: 0, total: 0, holding: false, finished: false }

const DEFAULT_PARAMS: Params = { o2: 0.34, psi: 8.2, g: 0.165, flow: 8, material: 'nomex', co2: 0, diameter: 2.5 }

function savedTheme(): Theme {
  try {
    return localStorage.getItem('firefall-theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const useMission = create<State>((set, get) => ({
  scenario: 'habitat',
  mode: 'demo',
  liveUrl: '/api/lagrange',
  model: emptyModel(),
  status: idleStatus,
  speed: 1,
  tab: 'guide',
  follow: true,
  lastDirect: 0,
  seen: {},
  chatOpen: true,
  theme: savedTheme(),
  people: [],
  params: DEFAULT_PARAMS,
  simTab: 'flame',
  selectedAgent: 'flight',

  load: (scenario, autoplay = false) => {
    replay?.dispose()
    live?.close()
    live = null
    const sc = SCENARIOS[scenario]
    const keepGuide = get().tab === 'guide' && !autoplay
    set({
      scenario,
      mode: 'demo',
      model: emptyModel(),
      status: idleStatus,
      params: { ...DEFAULT_PARAMS, ...sc.params },
      simTab: sc.simTab,
      simDriver: undefined,
      selectedAgent: 'flight',
      selectedInv: undefined,
      seen: {},
      tab: keepGuide ? 'guide' : sc.kind === 'case' ? 'case' : 'overview',
    })
    replay = new Replay(sc.build(), (e) => get().ingest(e), (status) => set({ status }))
    replay.setSpeed(get().speed)
    if (autoplay) replay.play()
  },
  play: () => {
    if (!replay) get().load(get().scenario)
    if (get().status.finished) get().load(get().scenario)
    if (get().tab === 'guide') set({ tab: SCENARIOS[get().scenario].kind === 'case' ? 'case' : 'overview' })
    replay?.play()
  },
  pause: () => replay?.pause(),
  setSpeed: (speed) => {
    replay?.setSpeed(speed)
    set({ speed })
  },
  answer: (text) => {
    if (get().mode === 'live') {
      const w = get().model.waiting
      if (w) live?.answer(w.taskId, text)
      return
    }
    replay?.answer(text)
  },
  goLive: (url) => {
    replay?.dispose()
    replay = null
    live?.close()
    set({ mode: 'live', liveUrl: url, liveError: undefined, model: emptyModel(), status: idleStatus })
    live = new LagrangeSource(url, (e) => get().ingest(e), (err) => set({ liveError: err }))
    live.open()
  },
  goDemo: () => get().load(get().scenario),

  ingest: (e) => {
    const s = get()
    const model = reduce(s.model, e)
    set({ model })
    // Keep the tab you are looking at marked as read.
    set((st) => ({ seen: { ...st.seen, [st.tab]: tabCount(model, st.tab) } }))
    const d = e.data ?? {}
    if (e.kind === 'task' && e.recipient === HUMAN && /INPUT_REQUIRED/.test(e.state ?? '')) set({ chatOpen: true })
    if (e.kind !== 'artifact') return
    switch (d.name) {
      case 'fc.plan':
        if (!s.model.plan) s.directTo('overview')
        break
      case 'fc.matrix':
        s.directTo('materials', true)
        break
      case 'fc.evidence':
        s.directTo('evidence')
        break
      case 'fc.sim': {
        const run = d.run as SimRun
        if (!run.metrics) {
          set({ simDriver: run, simTab: run.sim, params: { ...get().params, ...(run.params as Partial<Params>) } })
          s.directTo('sim', true)
        }
        break
      }
      case 'fc.alarm':
        set({ simTab: 'smoke' })
        s.directTo('sim', true)
        break
      case 'fc.case':
        if (d.verdict || !s.model.caseFile) s.directTo('case', true)
        break
      case 'fc.dossier':
        if (s.model.dossier.length === 0) s.directTo('report', true)
        break
      case 'fc.tool': {
        const call = d.call as { agent: string; status: string }
        if (s.follow && call.status === 'running') set({ selectedAgent: call.agent })
        break
      }
    }
  },

  setTab: (tab) => set((s) => ({ tab, seen: { ...s.seen, [tab]: tabCount(s.model, tab) } })),
  directTo: (v, force = false) => {
    const s = get()
    // Event-driven navigation: only while following the run. Clicks use setTab.
    if (!s.follow) return
    if (s.tab === 'guide' && !s.status.playing) return
    const now = Date.now()
    if (!force && now - s.lastDirect < 3000) return
    set({ tab: v, lastDirect: now, seen: { ...s.seen, [v]: tabCount(s.model, v) } })
  },
  setFollow: (follow) => set({ follow }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setTheme: (theme) => {
    try {
      localStorage.setItem('firefall-theme', theme)
    } catch {
      /* private mode: theme still applies for this session */
    }
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
  },
  addPerson: (p) => set((s) => ({ people: [...s.people, { ...p, handle: `p-${Date.now().toString(36)}`, added: true }] })),
  removePerson: (handle) => set((s) => ({ people: s.people.filter((p) => p.handle !== handle) })),
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p }, simDriver: undefined })),
  setSimTab: (simTab) => set({ simTab }),
  selectAgent: (selectedAgent, open = false) => {
    set({ selectedAgent })
    if (open) get().setTab('agent')
  },
  selectInv: (selectedInv) => set({ selectedInv }),
}))
