// The team before a review: which address fills which role.
// Demo: the scripted crew, marked simulated. Connected: the addresses on a real Lagrange server, read through
// the dev server's proxy (/api/lagrange, web/server/lagrange.ts), kept current by its event stream.
import { create } from 'zustand'
import { CREW, PEOPLE } from '@/demo/crew'

export const PROXY = '/api/lagrange'
/** The firefall-tools MCP server (web/tools/mcp.ts, `pnpm tools`). */
export const TOOLS_URL = 'http://localhost:8765/mcp'

export type Address = {
  handle: string
  kind: 'agent' | 'human'
  name: string
  description: string
  online: boolean
  /** The name the connected agent gives itself, when it has one of its own. */
  runs?: string
  workers: number
}

/** A person added on the roster. It is a card in this browser, not an account on the server. */
export type LocalPerson = { handle: string; name: string; role: string }

export type Role = { id: string; name: string; does: string; person?: boolean }

/** The seats of a review. Ids are the handles the scripted review uses. */
export const ROLES: Role[] = [
  ...CREW.map((a) => ({ id: a.handle, name: a.name, does: a.role })),
  ...PEOPLE.map((p) => ({ id: p.handle, name: p.name, does: p.role, person: true })),
]

export type Conn = {
  state: 'checking' | 'none' | 'ok'
  /** False on the static deploy: there is no dev server to hold the key. */
  proxy: boolean
  url?: string
  user?: string
  handle?: string
  workspace?: string
  role?: string
  error?: string
}

export type TestResult = { state: 'sending' | 'working' | 'done' | 'failed'; text?: string }

type RawAddress = { handle: string; kind?: string; displayName?: string; description?: string; online?: boolean; sessions?: { agent?: string; capacity?: number }[] }

export function toAddress(a: RawAddress): Address {
  const sessions = a.sessions ?? []
  return {
    handle: a.handle,
    kind: a.kind === 'human' ? 'human' : 'agent',
    name: a.displayName || a.handle,
    description: a.description ?? '',
    online: !!a.online,
    runs: sessions[0]?.agent && sessions[0].agent !== 'lagrange-tunnel' ? sessions[0].agent : undefined,
    workers: sessions.length,
  }
}

/** A task as GET /api/tasks/{id} wraps it: Lagrange's row (`status` is the latest status line) around the A2A task. */
export type TaskRow = { state?: string; status?: string; task?: { artifacts?: { name?: string; parts?: { text?: string }[] }[] } }

/**
 * The text of an agent's answer: its artifacts, or else its last status line. `summary` is the request, not the answer.
 * A streaming agent sends its answer as many small parts of one artifact, so parts join without a separator.
 * Its thinking (the `thoughts` artifact) is left out.
 */
export function replyText(t: TaskRow): string {
  const text = (t.task?.artifacts ?? [])
    .filter((a) => a.name !== 'thoughts')
    .map((a) => (a.parts ?? []).map((p) => p.text ?? '').join(''))
    .filter(Boolean)
    .join('\n')
    .trim()
  return text || t.status || ''
}

export const taskState = (s?: string): TestResult['state'] => (/COMPLETED/.test(s ?? '') ? 'done' : /FAILED|CANCEL|REJECT/.test(s ?? '') ? 'failed' : 'working')

const ASSIGN_KEY = 'firefall.roster.assign'
const PEOPLE_KEY = 'firefall.roster.people'

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private window: the roster still works for this visit */
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(PROXY + path, init)
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) throw new Error(res.ok ? 'unexpected answer' : `error ${res.status}`)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `error ${res.status}`)
  return body
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

type State = {
  /** Where the team comes from. */
  net: 'demo' | 'lagrange'
  conn: Conn
  addresses: Address[]
  /** Role id → handle on the server. */
  assign: Record<string, string>
  people: LocalPerson[]
  tests: Record<string, TestResult>
  loadError?: string

  useDemo: () => void
  check: () => Promise<void>
  connect: (url: string, key: string) => Promise<boolean>
  refresh: () => Promise<void>
  /** Follow the server's event stream while the roster is open. Returns the stop function. */
  watch: () => () => void
  createAgent: (handle: string, name: string) => Promise<{ token: string; server: string }>
  setRole: (role: string, handle: string) => void
  addPerson: (name: string, role: string) => void
  removePerson: (handle: string) => void
  test: (handle: string) => Promise<void>
}

export const useRoster = create<State>((set, get) => ({
  net: 'demo',
  conn: { state: 'checking', proxy: true },
  addresses: [],
  assign: load(ASSIGN_KEY, {}),
  people: load(PEOPLE_KEY, []),
  tests: {},

  useDemo: () => set({ net: 'demo' }),

  check: async () => {
    try {
      const c = await call<Omit<Conn, 'state' | 'proxy'> & { configured: boolean }>('/_config')
      set({ conn: { ...c, proxy: true, state: c.configured ? 'ok' : 'none' } })
    } catch {
      // No dev server behind /api (the static deploy answers 404 with no JSON).
      set({ conn: { state: 'none', proxy: false } })
    }
  },

  connect: async (url, key) => {
    try {
      const c = await call<Omit<Conn, 'state' | 'proxy'>>('/_config', post({ url, key }))
      set({ conn: { ...c, proxy: true, state: 'ok' }, net: 'lagrange' })
      await get().refresh()
      return true
    } catch (e) {
      set((s) => ({ conn: { ...s.conn, state: 'none', error: (e as Error).message } }))
      return false
    }
  },

  refresh: async () => {
    try {
      const { addresses } = await call<{ addresses: RawAddress[] }>('/api/addresses')
      set({ addresses: addresses.map(toAddress).sort((a, b) => Number(b.online) - Number(a.online) || a.handle.localeCompare(b.handle)), loadError: undefined })
    } catch (e) {
      set({ loadError: (e as Error).message })
    }
  },

  watch: () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void get().refresh(), 150)
    }
    void get().refresh()
    const es = new EventSource(`${PROXY}/api/events`)
    es.addEventListener('activity', (ev) => {
      const kind = (JSON.parse((ev as MessageEvent<string>).data) as { kind?: string }).kind
      if (kind === 'presence' || kind === 'address') soon()
    })
    // The stream reconnects on its own; a slow poll covers the gap.
    const poll = setInterval(() => void get().refresh(), 10_000)
    return () => {
      es.close()
      clearInterval(poll)
      clearTimeout(timer)
    }
  },

  createAgent: async (handle, name) => {
    const r = await call<{ token: string }>('/api/addresses', post({ handle, displayName: name || undefined }))
    await get().refresh()
    return { token: r.token, server: get().conn.url ?? '' }
  },

  setRole: (role, handle) =>
    set((s) => {
      const assign = { ...s.assign }
      if (handle) assign[role] = handle
      else delete assign[role]
      save(ASSIGN_KEY, assign)
      return { assign }
    }),

  addPerson: (name, role) =>
    set((s) => {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person'
      let handle = base
      for (let n = 2; s.people.some((p) => p.handle === handle) || PEOPLE.some((p) => p.handle === handle); n++) handle = `${base}-${n}`
      const people = [...s.people, { handle, name, role }]
      save(PEOPLE_KEY, people)
      return { people }
    }),

  removePerson: (handle) =>
    set((s) => {
      const people = s.people.filter((p) => p.handle !== handle)
      save(PEOPLE_KEY, people)
      return { people }
    }),

  test: async (handle) => {
    const put = (r: TestResult) => set((s) => ({ tests: { ...s.tests, [handle]: r } }))
    put({ state: 'sending' })
    try {
      const sent = await call<{ result?: { task?: { id?: string }; id?: string } }>('/api/send', post({ to: handle, text: 'FIREFALL roster check. Reply with one short line saying what you are.' }))
      const id = sent.result?.task?.id ?? sent.result?.id
      if (!id) throw new Error('the server returned no task')
      put({ state: 'working' })
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const { task = {} } = await call<{ task?: TaskRow }>(`/api/tasks/${encodeURIComponent(id)}`)
        const state = taskState(task.state)
        if (/INPUT_REQUIRED/.test(task.state ?? '')) return put({ state: 'done', text: 'It asked a question back. Answer it in the Lagrange inbox.' })
        if (state !== 'working') return put({ state, text: replyText(task) || (state === 'done' ? '(empty answer)' : 'the task failed') })
      }
      put({ state: 'failed', text: 'No answer after 90 s.' })
    } catch (e) {
      put({ state: 'failed', text: (e as Error).message })
    }
  },
}))

/** The tunnel commands for a new address, one per kind of agent. */
export function tunnelCommands(server: string, token: string): { label: string; note: string; cmd: string }[] {
  const base = `lagrange tunnel --server ${server} --token ${token}`
  return [
    { label: 'echo', note: 'a built-in test agent that repeats what it is sent', cmd: `${base} --echo` },
    {
      label: 'Claude Code with FIREFALL tools',
      note: 'needs claude-agent-acp, and `pnpm tools` running; it can then search the data and run the models and FDS',
      cmd: `${base} --acp claude-agent-acp --dir . --mcp firefall=${TOOLS_URL} --allow read,search,fetch,think,other`,
    },
    { label: 'script', note: 'the message on stdin, the reply on stdout', cmd: `${base} --exec "python agent.py"` },
    { label: 'A2A agent', note: 'any A2A agent listening locally', cmd: `${base} --to http://localhost:9001` },
  ]
}
