// 0 SETUP: the review network before any work. Four organizations, each running its own agents on its own
// hardware with its own model provider and MCP tools. They share answers over Lagrange, never data or tools.
import { Cpu, Database, Eye, Lock, Plug, Server } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/bits'
import { CREW, MODEL_COLOR, ORGS, PEOPLE, type OrgDef } from '@/demo/crew'
import { NETWORK, useMission } from '@/live/store'

function OrgCard({ o }: { o: OrgDef }) {
  const agents = CREW.filter((a) => a.org === o.id && (NETWORK as readonly string[]).includes(a.handle))
  const people = PEOPLE.filter((p) => p.org === o.id)
  return (
    <div className="pane gap-2.5 p-3.5">
      <header className="pane-head text-body">
        <span className="font-medium" style={{ color: o.color }}>
          {o.id}
        </span>
        <span className="ml-auto text-faint">{o.kind}</span>
      </header>
      <div className="sans text-emph font-medium leading-tight text-ink">{o.name}</div>
      <div className="space-y-0.5 text-label text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Server size={10} className="text-faint" /> {o.hosting}
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-faint" /> {o.compute}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 text-center text-label text-faint">◆</span> {o.provider}
        </div>
      </div>
      <div className="space-y-1.5">
        {agents.map((a) => (
          <div key={a.handle} className="rounded-sm border border-line bg-surface-2 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-body">
              <Avatar handle={a.handle} size={18} />
              <span style={{ color: a.color }}>{a.name}</span>
              <span className="text-faint">@{a.handle}</span>
              <span className="ml-auto text-label lowercase" style={{ color: MODEL_COLOR[a.model] }}>
                {a.model}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {a.mcp.map((m) => (
                <span key={m} className="rounded-sm border border-line-2 px-1 text-label text-muted-foreground" title="MCP server only this agent can use">
                  mcp · {m}
                </span>
              ))}
            </div>
          </div>
        ))}
        {people.map((p) => (
          <div key={p.handle} className="flex items-center gap-1.5 rounded-sm border border-dashed border-line-2 px-2 py-1 text-body">
            <Avatar handle={p.handle} size={18} />
            <span className="text-ink">{p.name}</span>
            <span className="text-faint">· {p.role}</span>
            <span className="ml-auto text-label lowercase text-faint">person</span>
          </div>
        ))}
      </div>
      {o.datasets && (
        <div className="space-y-0.5">
          <div className="label flex items-center gap-1">
            <Database size={9} /> datasets held here
          </div>
          {o.datasets.map((d) => (
            <div key={d.name} className="flex gap-2 text-label">
              <span className="truncate text-ink">{d.name}</span>
              <span className="ml-auto shrink-0 text-faint">{d.size}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto space-y-1 border-t border-line pt-2 text-label">
        <div className="flex flex-wrap items-center gap-1">
          <Eye size={10} className="text-ok" />
          {o.exposes.map((x) => (
            <span key={x} className="rounded-sm bg-ok/10 px-1 text-ok">
              {x}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Lock size={10} className="text-faint" />
          {o.private.map((x) => (
            <span key={x} className="rounded-sm bg-surface-3 px-1 text-muted-foreground">
              {x}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SetupScreen() {
  const setPhase = useMission((s) => s.setPhase)
  const connected = useMission((s) => s.connected)
  const connect = useMission((s) => s.connect)
  const [url, setUrl] = useState('https://agents.detector-vendor.example/.well-known/agent-card.json')
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-6 py-7">
        <div className="flex items-end gap-4">
          <div>
            <div className="label">the review network</div>
            <h1 className="sans mt-1.5 text-display font-normal leading-[1.05] tracking-[-0.035em]">Four organizations. One review. Nobody hands over their data.</h1>
            <p className="sans mt-1 max-w-[820px] text-emph text-muted-foreground">
              Each organization runs its own agents on its own hardware, with its own model and tools. On Lagrange they expose an agent, not a database: other agents ask it questions and get answers back, and the raw data, procedures and models stay where they are. People sit on the same network and step in when a decision is theirs.
            </p>
          </div>
          <button type="button" onClick={() => setPhase('intake')} className="key key-you ml-auto h-10 shrink-0 px-5 text-emph font-medium">
            continue to intake ▸
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {Object.values(ORGS).map((o) => (
            <OrgCard key={o.id} o={o} />
          ))}
        </div>

        <div className="grid grid-cols-[1.3fr_1fr] gap-4">
          <div className="pane gap-2 p-3 pt-4">
            <header className="pane-head text-body">
              <span className=" text-gold">lagrange</span>
              <span className="text-faint">the network between them</span>
            </header>
            <div className="sans text-emph leading-snug text-muted-foreground">
              Every agent is an A2A address. Lagrange routes tasks and messages between organizations, holds tasks while an agent waits on a person, and keeps the whole exchange as the audit trail a safety panel asks for.
            </div>
            <div className="grid grid-cols-3 gap-2 text-label">
              {[
                ['routing', 'A2A tasks + messages, mTLS per org'],
                ['people', 'tasks wait for a person, answered in place'],
                ['audit', 'every ask, answer and decision, signed'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-sm border border-line bg-surface-2 p-2">
                  <div className="text-gold">{k}</div>
                  <div className="text-muted-foreground">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pane gap-2 p-3 pt-4">
            <header className="pane-head text-body">
              <span className=" text-ink">connect an agent</span>
              <span className="text-faint">another org joins by its agent card</span>
            </header>
            <div className="flex gap-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 rounded-sm border border-line-2 bg-bg px-2 py-1 text-body outline-none focus:border-ug" />
              <button type="button" onClick={() => connect(url)} className="key shrink-0 px-3 text-body">
                <Plug size={11} /> connect
              </button>
            </div>
            {connected.length === 0 ? (
              <div className="text-label text-faint">Paste an A2A agent card URL. The agent keeps running on its owner’s side; only its card and its answers cross the network.</div>
            ) : (
              connected.map((c) => (
                <div key={c} className="rounded-sm border border-line bg-surface-2 p-2 text-label">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-ok" />
                    <span className="text-ink">Detector vendor agent</span>
                    <span className="text-faint">· {new URL(c).host}</span>
                    <span className="ml-auto text-ok">card verified (demo)</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">skills: detector_coverage, smoke_response · provider not disclosed · not used in this review</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
