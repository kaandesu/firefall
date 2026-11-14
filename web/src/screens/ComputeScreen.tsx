// COMPUTE: the machines and tools behind each org's agents. Every org runs its agents on its own hardware (an HPC
// cluster, a Kubernetes GPU pool, a lab workstation, the test chamber) with its own MCP servers. Add a server or an
// MCP endpoint here and the Lab panel can schedule on it. Only messages and results cross Lagrange; data stays home.
import { Cpu, FlaskConical, Lock, Plug, Plus, Server } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/bits'
import { CREW, NODES, ORGS, type ComputeNode, type OrgId } from '@/demo/crew'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

const SCHEDULERS: ComputeNode['scheduler'][] = ['Slurm', 'Kubernetes', 'Ray', 'Lab']

/** What a demo MCP handshake "discovers", by the kind of server its name suggests. */
function discover(name: string): string[] {
  const n = name.toLowerCase()
  if (/slurm|hpc|cluster/.test(n)) return ['submit_job', 'job_status', 'cancel_job', 'list_partitions']
  if (/k8s|kube|ray/.test(n)) return ['run_pod', 'pod_logs', 'scale_pool']
  if (/lims|lab|chamber/.test(n)) return ['book_test', 'test_results', 'sample_status']
  if (/cad|plm|model/.test(n)) return ['get_assembly', 'list_parts', 'export_mesh']
  if (/maptis|material/.test(n)) return ['material_lookup', 'test_history']
  if (/s3|minio|store|data/.test(n)) return ['list_objects', 'read_object', 'query_parquet']
  return ['list_resources', 'read_resource', 'query']
}

export function ComputeScreen() {
  const extra = useMission((s) => s.nodes)
  const mcp = useMission((s) => s.mcp)
  const jobs = useMission((s) => s.model.jobs)
  const addNode = useMission((s) => s.addNode)
  const addMcp = useMission((s) => s.addMcp)
  const nodes = [...NODES, ...extra]
  const busy = new Map<string, number>()
  for (const j of jobs) if (j.node && !j.done) busy.set(j.node, (busy.get(j.node) ?? 0) + (j.gpus ?? 0))
  const ran = (id: string) => jobs.filter((j) => j.node === id).length

  const [form, setForm] = useState({ org: 'prime' as OrgId, host: 'gpu-farm-02.vehicle.internal', scheduler: 'Slurm' as ComputeNode['scheduler'], gpus: 16, gpu: 'H200' })
  const [mform, setMform] = useState({ agent: 'detect', name: 'cad-plm', url: 'https://plm.vehicle.internal/mcp' })
  const [shake, setShake] = useState<string>()

  const submitNode = () => {
    const id = form.host.split('.')[0] || `node-${extra.length + 1}`
    if (nodes.some((x) => x.id === id)) return
    addNode({ id, org: form.org, host: form.host, scheduler: form.scheduler, gpus: form.gpus, gpu: form.gpu, cpus: form.gpus * 16, added: true })
  }
  const submitMcp = () => {
    if (!mform.name) return
    setShake(`connecting to ${mform.url} …`)
    setTimeout(() => setShake(`initialize ✓ · tools/list ✓`), 500)
    setTimeout(() => {
      addMcp(mform.agent, { name: mform.name, url: mform.url, tools: discover(mform.name) })
      setShake(undefined)
    }, 1100)
  }

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
      <div className="label text-ug">compute & tools · on-prem</div>
      <h1 className="sans mt-1 text-headline font-medium text-ink">Each org brings its own machines and tools</h1>
      <div className="mt-1 max-w-[900px] text-body text-muted-foreground">
        Agents run where their org's data lives. Jobs go to that org's scheduler; only messages and results cross Lagrange. Add a GPU farm or an MCP server and it is available to the agents on the next job.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {(Object.keys(ORGS) as OrgId[]).map((o) => {
          const org = ORGS[o]
          const mine = nodes.filter((x) => x.org === o)
          return (
            <div key={o} className="flex flex-col gap-2 rounded-sm border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-[3px] rounded" style={{ background: org.color }} />
                <span className="sans text-emph font-medium text-ink">{org.name}</span>
              </div>
              <div className="text-label text-faint">
                {org.hosting} · {org.provider}
              </div>
              <div className="space-y-1.5">
                {mine.map((n) => {
                  const used = busy.get(n.id) ?? 0
                  return (
                    <div key={n.id} className={cn('rounded-sm border bg-surface px-2 py-1.5 text-label', n.added ? 'border-ok/50' : 'border-line')}>
                      <div className="flex items-center gap-1.5">
                        {n.chamber ? <FlaskConical size={11} className="text-faint" /> : <Server size={11} className="text-faint" />}
                        <span className="text-ink">{n.id}</span>
                        {n.added && <span className="text-ok">new</span>}
                        <span className="ml-auto flex items-center gap-1 text-ok">
                          <span className="size-1.5 rounded-full bg-ok" /> online
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-faint">{n.host}</div>
                      {!n.chamber && (
                        <>
                          <div className="mt-1 flex gap-[2px]">
                            {Array.from({ length: Math.min(32, n.gpus) }, (_, i) => (
                              <span key={i} className={cn('h-1.5 flex-1 rounded-[1px]', i < Math.round((used / n.gpus) * Math.min(32, n.gpus)) ? 'bg-k-task' : 'bg-surface-3')} />
                            ))}
                          </div>
                          <div className="mt-0.5 flex text-faint">
                            <span>
                              {n.gpus}× {n.gpu} · {n.cpus} CPU · {n.scheduler}
                            </span>
                            <span className="ml-auto">{ran(n.id)} jobs</span>
                          </div>
                        </>
                      )}
                      {n.chamber && <div className="mt-0.5 text-faint">NASA-STD-6001 Test 1 · run by the technician · {ran(n.id)} tests</div>}
                    </div>
                  )
                })}
              </div>
              <div className="mt-auto flex items-start gap-1.5 border-t border-line pt-2 text-label text-muted-foreground">
                <Lock size={10} className="mt-px shrink-0 text-ok" />
                <span>
                  in-house · never leaves: <span className="text-ink">{org.private.join(', ')}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-4">
        <div className="rounded-sm border border-line-2 p-3">
          <div className="flex items-center gap-2 text-body text-ink">
            <Cpu size={12} className="text-ug" /> Add a server or GPU farm
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-body">
            <Field label="organisation">
              <select value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value as OrgId })} className="input">
                {(Object.keys(ORGS) as OrgId[]).map((o) => (
                  <option key={o} value={o}>
                    {ORGS[o].name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="scheduler">
              <select value={form.scheduler} onChange={(e) => setForm({ ...form, scheduler: e.target.value as ComputeNode['scheduler'] })} className="input">
                {SCHEDULERS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="host" wide>
              <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className="input" />
            </Field>
            <Field label="GPUs">
              <input type="number" min={0} max={512} value={form.gpus} onChange={(e) => setForm({ ...form, gpus: +e.target.value })} className="input" />
            </Field>
            <Field label="GPU model">
              <input value={form.gpu} onChange={(e) => setForm({ ...form, gpu: e.target.value })} className="input" />
            </Field>
          </div>
          <button type="button" onClick={submitNode} className="key mt-3 h-8 px-3 text-body">
            <Plus size={11} /> add server
          </button>
          <div className="mt-2 text-label text-faint">The org's agents see it as a new target for `submit_job`; it shows up in the Lab panel's cluster strip.</div>
        </div>

        <div className="rounded-sm border border-line-2 p-3">
          <div className="flex items-center gap-2 text-body text-ink">
            <Plug size={12} className="text-ug" /> MCP servers per agent
          </div>
          <div className="scroll-thin mt-2 max-h-[260px] space-y-1 overflow-y-auto">
            {CREW.map((a) => (
              <div key={a.handle} className="flex items-start gap-2 text-body">
                <Avatar handle={a.handle} size={18} />
                <span className="w-24 shrink-0 pt-0.5 text-ink">{a.name}</span>
                <span className="w-12 shrink-0 pt-0.5 text-faint">{ORGS[a.org].id}</span>
                <span className="flex flex-wrap gap-1">
                  {a.mcp.map((m) => (
                    <span key={m} className="rounded-sm border border-line-2 px-1 text-muted-foreground">
                      {m}
                    </span>
                  ))}
                  {(mcp[a.handle] ?? []).map((m) => (
                    <span key={m.name} className="rounded-sm border border-ok/50 px-1 text-ok" title={`${m.url}\ntools: ${m.tools.join(', ')}`}>
                      {m.name} · {m.tools.length} tools
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-2 border-t border-line pt-3 text-body">
            <Field label="agent">
              <select value={mform.agent} onChange={(e) => setMform({ ...mform, agent: e.target.value })} className="input">
                {CREW.map((a) => (
                  <option key={a.handle} value={a.handle}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="name">
              <input value={mform.name} onChange={(e) => setMform({ ...mform, name: e.target.value })} className="input" />
            </Field>
            <Field label="URL (inside the org network)">
              <input value={mform.url} onChange={(e) => setMform({ ...mform, url: e.target.value })} className="input" />
            </Field>
            <button type="button" disabled={!!shake} onClick={submitMcp} className="key h-7 px-3 text-body">
              <Plus size={11} /> connect
            </button>
          </div>
          <div className="mt-1.5 h-4 text-label text-k-task">{shake}</div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1', wide && 'col-span-2')}>
      <span className="text-faint">{label}</span>
      {children}
    </label>
  )
}
