// A real review: send the brief to one connected agent over Lagrange, follow its tool calls and its answer as
// they arrive, and keep the turns of the conversation. Nothing here is replayed.
import { create } from 'zustand'
import { reviewBrief } from './brief'
import { PROXY, replyText, type TaskRow } from './roster'
import { DEFAULT_REQUEST, EXAMPLE_DIR, EXAMPLE_FILES, useMission } from './store'

export type Call = { id: string; tool: string; status: 'running' | 'done' | 'failed'; input?: string; at: string; doneAt?: string }

export type Turn = {
  taskId: string
  /** What was asked, as shown in the UI (the first turn is the brief). */
  label: string
  kind: 'brief' | 'follow-up'
  state: 'working' | 'asking' | 'done' | 'failed'
  calls: Call[]
  text: string
  startedAt: number
  endedAt?: number
  error?: string
}

type ToolCall = { id?: string; title?: string; status?: string; input?: unknown }
type ActivityEntry = { at: string; data?: { toolCall?: ToolCall } }
type TaskResponse = { task?: TaskRow & { contextId?: string }; activity?: ActivityEntry[] }

const stateOf = (s?: string): Turn['state'] => (/COMPLETED/.test(s ?? '') ? 'done' : /FAILED|CANCEL|REJECT/.test(s ?? '') ? 'failed' : /INPUT_REQUIRED/.test(s ?? '') ? 'asking' : 'working')

/** Tool calls of a task, one row per call id, in the order they started. */
export function callsOf(activity: ActivityEntry[]): Call[] {
  const by = new Map<string, Call>()
  for (const e of activity) {
    const c = e.data?.toolCall
    if (!c?.id) continue
    const status: Call['status'] = c.status === 'completed' ? 'done' : c.status === 'failed' ? 'failed' : 'running'
    const old = by.get(c.id)
    const input = c.input === undefined || c.input === null ? old?.input : typeof c.input === 'string' ? c.input : JSON.stringify(c.input)
    by.set(c.id, { id: c.id, tool: (c.title ?? old?.tool ?? 'tool').replace(/^mcp__firefall__/, ''), status, input: input === '{}' ? undefined : input, at: old?.at ?? e.at, doneAt: status === 'running' ? undefined : e.at })
  }
  return [...by.values()]
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(PROXY + path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const isJson = (res.headers.get('content-type') ?? '').includes('json')
  const data = isJson ? ((await res.json()) as T & { error?: string }) : undefined
  if (!res.ok) throw new Error(data?.error ?? `Lagrange answered ${res.status}`)
  return data as T
}

type State = {
  agent?: string
  contextId?: string
  turns: Turn[]
  error?: string
  /** Start a review with this agent. Goes to the live screen. */
  start: (agent: string) => Promise<void>
  followUp: (text: string) => Promise<void>
  /** Answer a question the agent asked back. */
  answer: (text: string) => Promise<void>
  cancel: () => Promise<void>
}

let timer: ReturnType<typeof setInterval> | undefined

export const useReview = create<State>((set, get) => {
  const patch = (taskId: string, p: Partial<Turn>) => set((s) => ({ turns: s.turns.map((t) => (t.taskId === taskId ? { ...t, ...p } : t)) }))

  const poll = async () => {
    const turn = get().turns.at(-1)
    if (!turn || turn.state === 'done' || turn.state === 'failed') return
    try {
      const r = await call<TaskResponse>(`/api/tasks/${encodeURIComponent(turn.taskId)}`)
      const state = stateOf(r.task?.state)
      const text = r.task ? replyText(r.task) : ''
      patch(turn.taskId, {
        state,
        calls: callsOf(r.activity ?? []),
        // While it works, `status` is a progress line, not the answer: only show streamed artifact text.
        text: state === 'working' && !r.task?.task?.artifacts?.length ? '' : text,
        endedAt: state === 'done' || state === 'failed' ? Date.now() : undefined,
        error: state === 'failed' ? text || 'The task failed.' : undefined,
      })
      if (r.task?.contextId && !get().contextId) set({ contextId: r.task.contextId })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  }

  const send = async (agent: string, text: string, label: string, kind: Turn['kind']) => {
    set({ error: undefined })
    const sent = await call<{ result?: { task?: { id?: string; contextId?: string }; id?: string; contextId?: string } }>('/api/send', { to: agent, text, contextId: get().contextId, tags: { app: 'firefall', kind } })
    const taskId = sent.result?.task?.id ?? sent.result?.id
    if (!taskId) throw new Error('Lagrange returned no task.')
    set((s) => ({ contextId: s.contextId ?? sent.result?.task?.contextId ?? sent.result?.contextId, turns: [...s.turns, { taskId, label, kind, state: 'working', calls: [], text: '', startedAt: Date.now() }] }))
    clearInterval(timer)
    timer = setInterval(() => void poll(), 1200)
    void poll()
  }

  return {
    turns: [],

    start: async (agent) => {
      const m = useMission.getState()
      const file = async (slot: 'cabin' | 'materials') => m.intake[slot]?.text ?? (await (await fetch(`${EXAMPLE_DIR}/${EXAMPLE_FILES[slot]}`)).text())
      set({ agent, contextId: undefined, turns: [], error: undefined })
      m.setPhase('live')
      try {
        const request = m.request || DEFAULT_REQUEST
        await send(agent, reviewBrief({ request, cabinYaml: await file('cabin'), materialsCsv: await file('materials') }), request, 'brief')
      } catch (e) {
        set({ error: (e as Error).message })
      }
    },

    followUp: async (text) => {
      const { agent } = get()
      if (!agent || !text.trim()) return
      try {
        await send(agent, text.trim(), text.trim(), 'follow-up')
      } catch (e) {
        set({ error: (e as Error).message })
      }
    },

    answer: async (text) => {
      const turn = get().turns.at(-1)
      if (!turn || !text.trim()) return
      try {
        await call(`/api/tasks/${encodeURIComponent(turn.taskId)}/answer`, { text: text.trim() })
        patch(turn.taskId, { state: 'working' })
      } catch (e) {
        set({ error: (e as Error).message })
      }
    },

    cancel: async () => {
      const turn = get().turns.at(-1)
      if (!turn || turn.state === 'done' || turn.state === 'failed') return
      try {
        await call(`/api/tasks/${encodeURIComponent(turn.taskId)}/cancel`, {})
      } catch (e) {
        set({ error: (e as Error).message })
      }
      void poll()
    },
  }
})
