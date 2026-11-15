// 0 TEAM: who fills which role in the review. Left: the roles. Right: the addresses that can fill them.
// Demo: the scripted crew, marked simulated. Connected: the addresses on your Lagrange server, which show up here
// as their tunnels connect.
import { Check, Copy, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/bits'
import { AGENT, MODEL_COLOR, ORGS, PEOPLE } from '@/demo/crew'
import { cn } from '@/lib/utils'
import { ROLES, tunnelCommands, useRoster, type Address } from '@/live/roster'
import { useMission } from '@/live/store'

const field = 'min-w-0 rounded-sm border border-line-2 bg-bg px-2 py-1 text-[11.5px] text-ink outline-none placeholder:text-faint focus:border-ug'
const ghost = 'flex shrink-0 items-center gap-1 rounded-sm border border-line-2 px-2 py-1 text-[11px] text-muted-foreground hover:border-ug/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50'

const Dot = ({ on }: { on: boolean }) => <span className={cn('size-1.5 shrink-0 rounded-full', on ? 'bg-ok' : 'bg-faint')} title={on ? 'online' : 'offline'} />

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="shrink-0 text-muted-foreground hover:text-ink"
      title="copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
    >
      {done ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
    </button>
  )
}

function RoleRow({ id, name, does, children }: { id: string; name: string; does: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0">
      <Avatar handle={id} size={22} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-ink">{name}</div>
        <div className="sans truncate text-[11px] text-muted-foreground">{does}</div>
      </div>
      {children}
    </div>
  )
}

function Roles() {
  const net = useRoster((s) => s.net)
  const addresses = useRoster((s) => s.addresses)
  const assign = useRoster((s) => s.assign)
  const setRole = useRoster((s) => s.setRole)
  const people = useRoster((s) => s.people)
  const addPerson = useRoster((s) => s.addPerson)
  const removePerson = useRoster((s) => s.removePerson)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [role, setRoleText] = useState('')
  const live = net === 'lagrange'
  const byHandle = new Map(addresses.map((a) => [a.handle, a]))
  const agentRoles = ROLES.filter((r) => !r.person)
  const personRoles = ROLES.filter((r) => r.person)
  const filled = live ? ROLES.filter((r) => byHandle.has(assign[r.id])).length : ROLES.length

  const seat = (r: (typeof ROLES)[number]) => {
    if (!live)
      return (
        <span className="shrink-0 text-right text-[11px]">
          <span className="text-muted-foreground">@{r.id}</span>
          {!r.person && (
            <span className="ml-2 uppercase tracking-wider" style={{ color: MODEL_COLOR[AGENT[r.id]?.model ?? 'human'], fontSize: 9.5 }}>
              {AGENT[r.id]?.model}
            </span>
          )}
        </span>
      )
    const options = addresses.filter((a) => (a.kind === 'human') === !!r.person)
    const cur = byHandle.get(assign[r.id])
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        {cur && <Dot on={cur.online} />}
        <select value={cur ? cur.handle : ''} onChange={(e) => setRole(r.id, e.target.value)} className={cn(field, 'max-w-[150px]', !cur && 'text-faint')} aria-label={`who is ${r.name}`}>
          <option value="">empty</option>
          {options.map((a) => (
            <option key={a.handle} value={a.handle}>
              @{a.handle}
            </option>
          ))}
        </select>
      </span>
    )
  }

  return (
    <div className="pane pt-2.5">
      <header className="pane-head text-[11px]">
        <span className="tracking-[0.14em] text-ink">1 ROLES</span>
        <span className="text-faint">
          {filled} of {ROLES.length} filled
        </span>
      </header>
      {agentRoles.map((r) => (
        <RoleRow key={r.id} {...r}>
          {seat(r)}
        </RoleRow>
      ))}
      <div className="label border-y border-line bg-surface-2 px-3 py-1">people</div>
      {personRoles.map((r) => (
        <RoleRow key={r.id} {...r}>
          {seat(r)}
        </RoleRow>
      ))}
      {people.map((p) => (
        <div key={p.handle} className="flex items-center gap-2.5 border-b border-line px-3 py-2">
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-line-2 text-[9px] text-ink">
            {p.name
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-ink">{p.name}</div>
            <div className="sans truncate text-[11px] text-muted-foreground">{p.role}</div>
          </div>
          <span className="shrink-0 text-[10px] text-faint" title="A card in this browser. It has no inbox until the person has an account on the Lagrange server.">
            card only
          </span>
          <button type="button" onClick={() => removePerson(p.handle)} className="shrink-0 text-faint hover:text-bad" title={`remove ${p.name}`}>
            <X size={12} />
          </button>
        </div>
      ))}
      {adding ? (
        <form
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            addPerson(name.trim(), role.trim() || 'Reviewer')
            setName('')
            setRoleText('')
            setAdding(false)
          }}
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className={cn(field, 'flex-1')} />
          <input value={role} onChange={(e) => setRoleText(e.target.value)} placeholder="role, e.g. Safety panel chair" className={cn(field, 'flex-[1.4]')} />
          <button type="submit" disabled={!name.trim()} className={ghost}>
            add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-faint hover:text-ink">
            cancel
          </button>
        </form>
      ) : (
        <div className="px-3 py-2">
          <button type="button" onClick={() => setAdding(true)} className={ghost}>
            <Plus size={11} /> person
          </button>
        </div>
      )}
    </div>
  )
}

function SimulatedCrew() {
  return (
    <div className="pane pt-2.5">
      <header className="pane-head text-[11px]">
        <span className="tracking-[0.14em] text-ink">2 CREW</span>
        <span className="text-warn">simulated</span>
      </header>
      <p className="sans border-b border-line px-3 py-2 text-[11.5px] leading-snug text-muted-foreground">
        In the demo these agents are scripted. Each one stands for an agent that a different organization would run on its own machines, with its own model and tools.
      </p>
      {ROLES.filter((r) => !r.person).map((r) => {
        const a = AGENT[r.id]
        return (
          <div key={r.id} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11.5px] last:border-b-0">
            <Dot on />
            <span className="text-ink">@{r.id}</span>
            <span className="sans min-w-0 flex-1 truncate text-muted-foreground">{ORGS[a.org].name}</span>
            <span className="shrink-0 text-[10px] text-faint" title={a.mcp.join(', ')}>
              {a.mcp.length} MCP
            </span>
          </div>
        )
      })}
      {PEOPLE.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11.5px] last:border-b-0">
          <Dot on />
          <span className="text-ink">@{p.handle}</span>
          <span className="sans min-w-0 flex-1 truncate text-muted-foreground">{ORGS[p.org].name}</span>
          <span className="shrink-0 text-[10px] text-faint">person</span>
        </div>
      ))}
    </div>
  )
}

function AddressRow({ a }: { a: Address }) {
  const result = useRoster((s) => s.tests[a.handle])
  const test = useRoster((s) => s.test)
  const busy = result?.state === 'sending' || result?.state === 'working'
  return (
    <div className="border-b border-line px-3 py-1.5 text-[11.5px]">
      <div className="flex items-center gap-2">
        <Dot on={a.online} />
        <span className="shrink-0 text-ink">@{a.handle}</span>
        <span className="sans min-w-0 flex-1 truncate text-muted-foreground">{a.name !== a.handle ? a.name : a.description}</span>
        <span className="shrink-0 text-[10px] text-faint">{a.kind === 'human' ? 'person' : a.online ? [a.runs, a.workers > 1 && `×${a.workers}`].filter(Boolean).join(' ') || 'online' : 'offline'}</span>
        {a.kind === 'agent' && (
          <button type="button" disabled={!a.online || busy} onClick={() => void test(a.handle)} className={ghost} title={a.online ? 'send it a short message and show the answer' : 'offline: start its tunnel first'}>
            {busy && <Loader2 size={10} className="animate-spin" />} test
          </button>
        )}
      </div>
      {result?.text && <div className={cn('sans mt-1 line-clamp-6 whitespace-pre-wrap pl-3.5 text-[11px]', result.state === 'failed' ? 'text-bad' : 'text-muted-foreground')}>{result.text}</div>}
    </div>
  )
}

function Server() {
  const conn = useRoster((s) => s.conn)
  const addresses = useRoster((s) => s.addresses)
  const loadError = useRoster((s) => s.loadError)
  const watch = useRoster((s) => s.watch)
  const createAgent = useRoster((s) => s.createAgent)
  const [adding, setAdding] = useState(false)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [made, setMade] = useState<{ handle: string; token: string; server: string }>()

  useEffect(() => watch(), [watch])

  const online = addresses.filter((a) => a.kind === 'agent' && a.online).length
  const agents = addresses.filter((a) => a.kind === 'agent').length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const h = handle.trim().toLowerCase().replace(/^@/, '')
    if (!h) return
    setBusy(true)
    setError('')
    try {
      setMade({ handle: h, ...(await createAgent(h, '')) })
      setHandle('')
      setAdding(false)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="pane pt-2.5">
      <header className="pane-head text-[11px]">
        <span className="tracking-[0.14em] text-gold">2 ON THE SERVER</span>
        <span className="truncate text-faint">
          {online} of {agents} agents online
        </span>
      </header>
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="truncate">{conn.url}</span>
        {conn.workspace && <span className="shrink-0 text-faint">· {conn.workspace}</span>}
      </div>
      {loadError && <div className="sans border-b border-line px-3 py-2 text-[11.5px] text-bad">Could not read the server: {loadError}</div>}
      {!loadError && addresses.length === 0 && <div className="sans border-b border-line px-3 py-3 text-[11.5px] text-muted-foreground">No addresses yet. Add an agent below, then run its tunnel command.</div>}
      {addresses.map((a) => (
        <AddressRow key={a.handle} a={a} />
      ))}

      {made && (
        <div className="border-b border-line bg-surface-2 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11.5px]">
            <span className="text-ink">@{made.handle} created.</span>
            <span className="sans text-muted-foreground">Run one of these where the agent lives. The token is shown once.</span>
            <button type="button" onClick={() => setMade(undefined)} className="ml-auto shrink-0 text-faint hover:text-ink" title="hide">
              <X size={12} />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {tunnelCommands(made.server, made.token).map((c) => (
              <div key={c.label}>
                <div className="sans text-[11px] text-muted-foreground">
                  <span className="text-ink">{c.label}</span> · {c.note}
                </div>
                <div className="mt-0.5 flex items-center gap-2 rounded-sm border border-line bg-bg px-2 py-1">
                  <code className="scroll-thin min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] text-ink">{c.cmd}</code>
                  <CopyButton text={c.cmd} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding ? (
        <form onSubmit={submit} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-faint">@</span>
            <input autoFocus value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="handle, e.g. materials" className={cn(field, 'flex-1')} spellCheck={false} />
            <button type="submit" disabled={busy || !handle.trim()} className={ghost}>
              {busy && <Loader2 size={10} className="animate-spin" />} create
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-faint hover:text-ink">
              cancel
            </button>
          </div>
          {error && <div className="sans mt-1.5 text-[11.5px] text-bad">{error}</div>}
        </form>
      ) : (
        <div className="px-3 py-2">
          <button type="button" onClick={() => setAdding(true)} className={ghost}>
            <Plus size={11} /> agent
          </button>
        </div>
      )}
    </div>
  )
}

export function SetupScreen() {
  const setPhase = useMission((s) => s.setPhase)
  const net = useRoster((s) => s.net)
  const live = net === 'lagrange'
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-7 sm:px-6">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1 basis-[300px]">
            <div className="label">the team</div>
            <h1 className="sans mt-1 text-[22px] font-semibold leading-tight">{live ? 'Put your agents in the review’s roles' : 'Who works on this review'}</h1>
            <p className="sans mt-1 max-w-[760px] text-[13px] text-muted-foreground">
              {live
                ? 'An agent appears on the right when its tunnel connects. Pick who fills each role on the left. People are addresses too: questions wait in their inbox.'
                : 'Nine agents and two people, each with one job. Every message between them goes through Lagrange, so the whole review can be read back afterwards.'}
            </p>
          </div>
          <button type="button" onClick={() => setPhase('start')} className="shrink-0 text-[11px] text-muted-foreground hover:text-ink">
            ◂ back
          </button>
          <button type="button" onClick={() => setPhase('intake')} className="shrink-0 rounded-sm bg-flame px-4 py-2 text-[12px] font-medium text-bg hover:brightness-110">
            {live ? 'run the scripted review ▸' : 'continue to intake ▸'}
          </button>
        </div>

        {live && (
          <div className="sans rounded-sm border border-warn/40 bg-warn/5 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
            <span className="text-warn">Not wired up yet.</span> Your agents are on the network and answer the test message, but the review that follows is still the scripted replay. They do not drive it.
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Roles />
          {live ? <Server /> : <SimulatedCrew />}
        </div>
      </div>
    </div>
  )
}
