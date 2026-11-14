// Left panel: the design package (what the review starts from) and the team (agents + people, as a network).
import { Box, Plus, Trash2, Upload, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Avatar, StateDot, STATE_LABEL } from '@/components/bits'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AGENT, CREW, HUB, PEOPLE, agentColor, agentName, type PersonDef } from '@/demo/crew'
import { PACKAGES } from '@/demo/packages'
import { useMission } from '@/live/store'
import { MATERIALS } from '@/sims/models'
import { cn } from '@/lib/utils'

export function LeftPanel() {
  const [tab, setTab] = useState<'package' | 'team'>('package')
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex shrink-0 gap-1 border-b border-line p-1.5">
        {(
          [
            ['package', 'Design package'],
            ['team', 'Team'],
          ] as const
        ).map(([id, l]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn('flex-1 rounded-md px-2 py-1 text-[12.5px]', tab === id ? 'bg-surface-3 font-medium text-ink' : 'text-muted-foreground hover:text-ink')}>
            {l}
          </button>
        ))}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{tab === 'package' ? <PackagePanel /> : <TeamPanel />}</div>
    </div>
  )
}

function PackagePanel() {
  const scenario = useMission((s) => s.scenario)
  const setTab = useMission((s) => s.setTab)
  const setSimTab = useMission((s) => s.setSimTab)
  const pkg = PACKAGES[scenario]
  return (
    <div className="space-y-4 p-3 text-[12.5px]">
      <div>
        <div className="label">Vehicle</div>
        <div className="mt-1 text-[14px] font-semibold leading-snug">{pkg.vehicle}</div>
        <div className="text-muted-foreground">{pkg.program}</div>
        <div className="mt-1 inline-block rounded bg-surface-3 px-1.5 py-px text-[11.5px]">{pkg.phase}</div>
      </div>

      <Group title="Cabin">
        <Row k="Atmosphere" v={pkg.atmosphere.label} />
        <Row k="Gravity" v={pkg.gravity.label} />
        <Row k="Volume" v={pkg.volume} />
        <Row k="Ventilation" v={`${pkg.ventFlow} cm/s`} />
        <Row k="Crew" v={String(pkg.crew)} />
      </Group>

      <Group title={`Materials · ${pkg.bom.length} items`}>
        <div className="divide-y divide-line rounded-md border border-line">
          {pkg.bom.map((b) => (
            <div key={b.id} className="px-2 py-1.5">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{b.item}</span>
                <span className="tnum shrink-0 text-muted-foreground">{b.qty}</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {MATERIALS[b.material].label.split(' (')[0]} · {b.location}
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Ignition sources">
        <ul className="space-y-0.5 text-muted-foreground">
          {pkg.ignition.map((i) => (
            <li key={i}>· {i}</li>
          ))}
        </ul>
      </Group>

      <Group title="Existing test data">
        <ul className="space-y-0.5 text-muted-foreground">
          {pkg.existingTests.map((i) => (
            <li key={i}>· {i}</li>
          ))}
        </ul>
      </Group>

      <Group title="Layout">
        <button
          type="button"
          onClick={() => {
            setSimTab('smoke')
            setTab('sim')
          }}
          className="flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left hover:bg-surface-2"
        >
          <Box size={14} className="text-muted-foreground" />
          <span>{pkg.layout}</span>
        </button>
      </Group>

      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-2 py-2 text-muted-foreground" aria-disabled>
            <Upload size={13} /> Upload your package
          </button>
        </TooltipTrigger>
        <TooltipContent>Live mode: BOM (CSV), cabin spec (JSON), cabin model (.glb). The demo uses a sample package.</TooltipContent>
      </Tooltip>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{title}</div>
      {children}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
}

function TeamPanel() {
  const agents = useMission((s) => s.model.agents)
  const extra = useMission((s) => s.people)
  const comms = useMission((s) => s.model.comms)
  const selectAgent = useMission((s) => s.selectAgent)
  const removePerson = useMission((s) => s.removePerson)
  const [adding, setAdding] = useState(false)
  const people = [...PEOPLE, ...extra]
  // A person has an open question if the last message to them is an ask with no later reply from them.
  const open = useMemo(() => {
    const o = new Set<string>()
    for (const c of comms) {
      if (c.kind === 'ask' && people.some((p) => p.handle === c.to)) o.add(c.to)
      if (o.has(c.from) && (c.kind === 'reply' || c.kind === 'human')) o.delete(c.from)
    }
    return o
  }, [comms, people])

  return (
    <div className="space-y-4 p-3">
      <Network people={people} />

      <div>
        <div className="label mb-1.5">Departments (agents)</div>
        <div className="space-y-0.5">
          {CREW.map((a) => {
            const rt = agents[a.handle]
            const st = rt?.state ?? 'idle'
            return (
              <button key={a.handle} type="button" onClick={() => selectAgent(a.handle, true)} className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-2">
                <Avatar handle={a.handle} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium">{a.name}</span>
                    {a.org === 'independent' && <span className="rounded bg-surface-3 px-1 text-[10px] text-muted-foreground">independent</span>}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{st === 'idle' ? a.role : rt?.doing || STATE_LABEL[st]}</span>
                </span>
                <StateDot state={st} />
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">People</span>
          <button type="button" onClick={() => setAdding(!adding)} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-primary hover:bg-primary/10">
            {adding ? <X size={12} /> : <Plus size={12} />} {adding ? 'Cancel' : 'Add'}
          </button>
        </div>
        {adding && <AddPerson onDone={() => setAdding(false)} />}
        <div className="space-y-0.5">
          {people.map((p) => (
            <div key={p.handle} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
              <Avatar handle={p.handle} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{p.name}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {p.role}
                  {p.with ? ` · works with ${agentName(p.with)}` : ''}
                </span>
              </span>
              {open.has(p.handle) && <span className="rounded-full bg-warn/10 px-1.5 text-[10.5px] font-medium text-warn">question</span>}
              {p.added && (
                <button type="button" onClick={() => removePerson(p.handle)} className="text-faint opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Remove">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-faint">In live mode every person gets an inbox on the Lagrange network, so agents can ask them directly.</p>
      </div>
    </div>
  )
}

function AddPerson({ onDone }: { onDone: () => void }) {
  const addPerson = useMission((s) => s.addPerson)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [withAgent, setWith] = useState('prevent')
  return (
    <form
      className="mb-2 space-y-1.5 rounded-md border border-line bg-surface-2 p-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        addPerson({ name: name.trim(), role: role.trim() || 'Reviewer', org: 'Vehicle team', color: agentColor(withAgent), with: withAgent })
        onDone()
      }}
    >
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or team (e.g. ECLSS team)" className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-primary" />
      <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. ventilation engineer)" className="w-full rounded border border-line bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-primary" />
      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
        Works with
        <select value={withAgent} onChange={(e) => setWith(e.target.value)} className="flex-1 rounded border border-line bg-surface px-1.5 py-1 text-[12.5px] text-ink">
          {CREW.map((a) => (
            <option key={a.handle} value={a.handle}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="w-full rounded bg-primary py-1 text-[12.5px] font-medium text-primary-foreground">
        Add to team
      </button>
    </form>
  )
}

/** A small 2D map of the network: agents around the Lagrange hub, people outside; messages travel via the hub. */
function Network({ people }: { people: PersonDef[] }) {
  const packets = useMission((s) => s.model.packets)
  const now = useMission((s) => s.model.now)
  const W = 280
  const H = 210
  const cx = W / 2
  const cy = H / 2
  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = { [HUB]: { x: cx, y: cy } }
    CREW.forEach((a, i) => {
      const t = -Math.PI / 2 + (i / CREW.length) * Math.PI * 2
      p[a.handle] = { x: cx + Math.cos(t) * 78, y: cy + Math.sin(t) * 58 }
    })
    people.forEach((h, i) => {
      const anchor = p[h.with ?? 'flight'] ?? p[HUB]
      const dx = anchor.x - cx
      const dy = anchor.y - cy
      const l = Math.hypot(dx, dy) || 1
      // Place each person just outside their agent, kept inside the frame.
      const x = anchor.x + (dx / l) * 34 + (dy === 0 ? 0 : (i % 2 ? 26 : -26))
      const y = anchor.y + (dy / l) * 18
      p[h.handle] = { x: Math.min(W - 24, Math.max(24, x)), y: Math.min(H - 14, Math.max(14, y)) }
    })
    return p
  }, [people, cx, cy])
  const recent = packets.filter((p) => now - p.at < 2500 && pos[p.from] && pos[p.to] && p.kind !== 'hub').slice(-8)

  return (
    <div className="rounded-md border border-line bg-surface-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {Object.entries(pos).map(([h, p]) =>
          h === HUB ? null : <line key={`l${h}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--line-2)" strokeWidth={0.8} strokeDasharray={AGENT[h] ? undefined : '2 2'} />,
        )}
        <circle cx={cx} cy={cy} r={9} fill="var(--surface)" stroke="var(--k-hub)" strokeWidth={1.2} />
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize={7} fill="var(--muted)">
          Lagrange
        </text>
        {recent.map((p) => {
          const a = pos[p.from]
          const b = pos[p.to]
          return (
            <motion.circle
              key={p.id}
              r={3}
              fill={`var(--k-${p.kind === 'human' ? 'reply' : p.kind})`}
              initial={{ cx: a.x, cy: a.y, opacity: 0 }}
              animate={{ cx: [a.x, cx, b.x], cy: [a.y, cy, b.y], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}
            />
          )
        })}
        {Object.entries(pos).map(([h, p]) =>
          h === HUB ? null : (
            <g key={h}>
              <circle cx={p.x} cy={p.y} r={AGENT[h] ? 7 : 6} fill="var(--surface)" stroke={agentColor(h)} strokeWidth={1.5} />
              <circle cx={p.x} cy={p.y} r={AGENT[h] ? 3 : 2.5} fill={agentColor(h)} />
              <text x={p.x} y={p.y + (p.y < cy - 20 ? -10 : 15)} textAnchor="middle" fontSize={7.5} fill={AGENT[h] ? 'var(--muted)' : 'var(--ink)'}>
                {agentName(h)}
              </text>
            </g>
          ),
        )}
      </svg>
    </div>
  )
}
