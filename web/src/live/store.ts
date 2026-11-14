import { create } from 'zustand'
import { HUMAN } from '@/demo/crew'
import { SCENARIOS, type ScenarioId } from '@/demo/scenarios'
import { emptyModel, reduce, type Model } from './model'
import { Replay, type ReplayStatus } from './replay'
import { LagrangeSource } from './lagrange'
import type { Entry, SimKind, SimParams, SimRun } from './types'

export type ViewId = 'orbit' | 'plan' | 'comms' | 'workspace' | 'evidence' | 'sim' | 'dossier' | 'feed' | 'case'

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'plan', label: 'Plan' },
  { id: 'comms', label: 'Comms' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'sim', label: 'Sim lab' },
  { id: 'dossier', label: 'Dossier' },
  { id: 'case', label: 'Case file' },
  { id: 'feed', label: 'Events' },
]

export type Params = SimParams & { material: string }

type State = {
  scenario: ScenarioId
  mode: 'demo' | 'live'
  liveUrl: string
  liveError?: string
  model: Model
  status: ReplayStatus
  speed: number
  tiles: ViewId[]
  focus: number | null
  max: number | null
  minimized: number[]
  tileAt: number[]
  director: boolean
  lastDirect: number
  params: Params
  simTab: SimKind
  simDriver?: SimRun
  selectedAgent: string
  selectedInv?: string
  showBrief: boolean

  load: (s: ScenarioId, autoplay?: boolean) => void
  play: () => void
  pause: () => void
  setSpeed: (s: number) => void
  answer: (text: string) => void
  goLive: (url: string) => void
  goDemo: () => void
  ingest: (e: Entry) => void
  setTile: (i: number, v: ViewId) => void
  toggleFocus: (i: number) => void
  toggleMax: (i: number) => void
  minimize: (i: number) => void
  restore: (i: number) => void
  directTo: (v: ViewId, force?: boolean) => void
  setParams: (p: Partial<Params>) => void
  setSimTab: (k: SimKind) => void
  selectAgent: (h: string) => void
  selectInv: (id?: string) => void
  setDirector: (on: boolean) => void
  setBrief: (on: boolean) => void
}

let replay: Replay | null = null
let live: LagrangeSource | null = null

const idleStatus: ReplayStatus = { playing: false, t: 0, total: 0, holding: false, finished: false }

const DEFAULT_PARAMS: Params = { o2: 0.34, psi: 8.2, g: 0.165, flow: 8, material: 'nomex', co2: 0, diameter: 2.5 }

export const useMission = create<State>((set, get) => ({
  scenario: 'habitat',
  mode: 'demo',
  liveUrl: '/api/lagrange',
  model: emptyModel(),
  status: idleStatus,
  speed: 1,
  tiles: ['orbit', 'plan', 'comms', 'workspace'],
  focus: null,
  max: null,
  minimized: [],
  tileAt: [0, 0, 0, 0],
  director: true,
  lastDirect: 0,
  params: DEFAULT_PARAMS,
  simTab: 'flame',
  selectedAgent: 'flight',
  showBrief: false,

  load: (scenario, autoplay = false) => {
    replay?.dispose()
    live?.close()
    live = null
    const sc = SCENARIOS[scenario]
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
      tiles: sc.tiles,
      focus: null,
      max: null,
      minimized: [],
    })
    replay = new Replay(sc.build(), (e) => get().ingest(e), (status) => set({ status }))
    replay.setSpeed(get().speed)
    if (autoplay) replay.play()
  },
  play: () => {
    if (!replay) get().load(get().scenario)
    if (get().status.finished) get().load(get().scenario)
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
    const d = e.data ?? {}
    if (e.kind === 'task' && e.recipient === HUMAN && /INPUT_REQUIRED/.test(e.state ?? '')) s.directTo('comms', true)
    if (e.kind !== 'artifact') return
    switch (d.name) {
      case 'fc.plan':
        if (!s.model.plan) s.directTo('plan')
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
        if (d.verdict) s.directTo('case', true)
        else if (!s.model.caseFile) s.directTo('case', true)
        break
      case 'fc.dossier':
        if (s.model.dossier.length === 0) s.directTo('dossier', true)
        break
      case 'fc.tool': {
        const agent = (d.call as { agent: string; status: string }).agent
        if (s.director && (d.call as { status: string }).status === 'running') set({ selectedAgent: agent })
        break
      }
    }
  },

  setTile: (i, v) => {
    const tiles = [...get().tiles]
    const j = tiles.indexOf(v)
    if (j >= 0 && j !== i) tiles[j] = tiles[i]
    tiles[i] = v
    set({ tiles })
  },
  toggleFocus: (i) => set((s) => ({ focus: s.focus === i ? null : i, max: null, tileAt: s.tileAt.map((t, j) => (j === i ? Date.now() : t)) })),
  toggleMax: (i) => set((s) => ({ max: s.max === i ? null : i, minimized: s.minimized.filter((x) => x !== i) })),
  minimize: (i) =>
    set((s) => ({ minimized: s.minimized.includes(i) ? s.minimized : [...s.minimized, i], focus: s.focus === i ? null : s.focus, max: s.max === i ? null : s.max })),
  restore: (i) => set((s) => ({ minimized: s.minimized.filter((x) => x !== i) })),
  directTo: (v, force = false) => {
    const s = get()
    if (!s.director) return
    const now = Date.now()
    if (!force && now - s.lastDirect < 2500) return
    let i = s.tiles.indexOf(v)
    const tiles = [...s.tiles]
    if (i < 0) {
      // Replace the least recently focused tile that is not the orbit.
      const candidates = [0, 1, 2, 3].filter((j) => tiles[j] !== 'orbit')
      i = candidates.sort((a, b) => s.tileAt[a] - s.tileAt[b])[0]
      tiles[i] = v
    }
    set({
      tiles,
      focus: s.max !== null ? s.focus : i,
      max: s.max !== null ? i : null,
      minimized: s.minimized.filter((x) => x !== i),
      tileAt: s.tileAt.map((t, j) => (j === i ? now : t)),
      lastDirect: now,
    })
  },
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p }, simDriver: undefined })),
  setSimTab: (simTab) => set({ simTab }),
  selectAgent: (selectedAgent) => set({ selectedAgent }),
  selectInv: (selectedInv) => set({ selectedInv }),
  setDirector: (director) => set({ director }),
  setBrief: (showBrief) => set({ showBrief }),
}))
