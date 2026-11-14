// The FIREFALL review network. Every agent is one Lagrange address (an A2A agent card at /a/{handle}).
// Agents belong to organizations: each org runs its own agents on its own hardware, with its own model provider
// and MCP tools, and exposes only the agent, never the data or the tools behind it.
// Handles are stable ids used by the event log; names are what people see.

export type OrgId = 'prime' | 'psi' | 'wstf' | 'sma'

export type OrgDef = {
  id: OrgId
  name: string
  kind: string
  color: string
  /** Where its agents run. */
  hosting: string
  compute: string
  /** The LLM behind its agents. */
  provider: string
  /** What other orgs can see: the agent's skills. */
  exposes: string[]
  /** What never leaves the org. */
  private: string[]
  /** Datasets it holds (sizes are what sits on its storage). */
  datasets?: { name: string; size: string; kind: string }[]
}

export const ORGS: Record<OrgId, OrgDef> = {
  prime: {
    id: 'prime',
    name: 'Vehicle team',
    kind: 'prime contractor · you',
    color: 'var(--org-prime)',
    hosting: 'on-prem',
    compute: 'hpc-01 · Slurm · 8× H100',
    provider: 'Claude via internal gateway',
    exposes: ['review lead', 'materials matrix', 'cabin sims'],
    private: ['cabin CAD', 'supplier data', 'cost model'],
  },
  psi: {
    id: 'psi',
    name: 'NASA PSI archive',
    kind: 'data provider',
    color: 'var(--org-psi)',
    hosting: 'NASA GRC data centre',
    compute: 'grc-gpu · Kubernetes · 32× A100',
    provider: 'self-hosted Llama 3.3 70B',
    exposes: ['search', 'dataset features', 'test-point queries'],
    private: ['raw camera frames', 'unpublished runs'],
    datasets: [
      { name: 'Saffire-I (PSI-98)', size: '38 GB', kind: 'video · O₂/CO₂ · heat flux' },
      { name: 'BASS-II (PSI-25)', size: '12 GB', kind: 'video · flow · O₂' },
      { name: 'ACME Flame Design (PSI-10)', size: '61 GB', kind: 'INTNS frames · radiometers' },
      { name: 'ACME CFI-G (PSI-159)', size: '27 GB', kind: 'frames · thermocouples' },
      { name: 'BRE (PSI-20)', size: '4 GB', kind: 'burner · O₂ · pressure' },
    ],
  },
  wstf: {
    id: 'wstf',
    name: 'NASA White Sands Test Facility',
    kind: 'test lab',
    color: 'var(--org-wstf)',
    hosting: 'WSTF network',
    compute: 'lab workstation cluster',
    provider: 'GPT-4.1 via agency cloud',
    exposes: ['test history lookup', 'schedule a test', 'test results'],
    private: ['LIMS records', 'procedures', 'other customers’ results'],
  },
  sma: {
    id: 'sma',
    name: 'Independent S&MA',
    kind: 'safety & mission assurance',
    color: 'var(--org-sma)',
    hosting: 'agency cloud (FedRAMP High)',
    compute: 'managed',
    provider: 'Claude via Bedrock (GovCloud)',
    exposes: ['independent review', 'citation check'],
    private: ['review checklists', 'past findings'],
  },
}

/** A machine an org runs jobs on. Jobs stay on the owner's hardware; only results cross the network. */
export type ComputeNode = {
  id: string
  org: OrgId
  host: string
  scheduler: 'Slurm' | 'Kubernetes' | 'Lab' | 'Ray'
  gpus: number
  gpu: string
  cpus: number
  /** A physical test chamber rather than a computer. */
  chamber?: boolean
  added?: boolean
}

export const NODES: ComputeNode[] = [
  { id: 'hpc-01', org: 'prime', host: 'hpc-01.vehicle.internal', scheduler: 'Slurm', gpus: 8, gpu: 'H100', cpus: 128 },
  { id: 'grc-gpu', org: 'psi', host: 'grc-gpu.archive.nasa', scheduler: 'Kubernetes', gpus: 32, gpu: 'A100', cpus: 512 },
  { id: 'wstf-ws', org: 'wstf', host: 'ws-cluster.wstf.nasa', scheduler: 'Lab', gpus: 2, gpu: 'L40S', cpus: 64 },
  { id: 'chamber-3', org: 'wstf', host: 'Test 1 chamber 3', scheduler: 'Lab', gpus: 0, gpu: '', cpus: 0, chamber: true },
  { id: 'sma-cloud', org: 'sma', host: 'govcloud managed', scheduler: 'Kubernetes', gpus: 4, gpu: 'L4', cpus: 32 },
]

export type AgentDef = {
  handle: string
  name: string
  dept: string
  role: string
  blurb: string
  color: string
  icon: 'lead' | 'research' | 'materials' | 'detection' | 'suppression' | 'sim' | 'safety' | 'report' | 'lab'
  model: 'opus' | 'sonnet' | 'haiku' | 'llama' | 'gpt'
  org: OrgId
  /** Its own MCP servers. */
  mcp: string[]
  tools: { name: string; desc: string }[]
}

export type PersonDef = {
  handle: string
  name: string
  role: string
  org: OrgId
  color: string
  /** Agent this person works with (their department's agent), if any. */
  with?: string
  added?: boolean
}

export const HUMAN = 'you'
export const LAB = 'lab'
export const HUB = 'lagrange'

export const CREW: AgentDef[] = [
  {
    handle: 'flight',
    name: 'Review Lead',
    dept: 'Fire safety review',
    role: 'Coordinates the review',
    blurb: 'Turns your request into a plan, hands work to departments, mediates when they disagree and asks you when a decision is yours.',
    color: 'var(--orange)',
    icon: 'lead',
    model: 'opus',
    org: 'prime',
    mcp: ['lagrange', 'review-board'],
    tools: [
      { name: 'publish_plan', desc: 'Publish the review plan' },
      { name: 'delegate', desc: 'Send a subtask to a department over A2A' },
      { name: 'ask_human', desc: 'Pause for a decision from a person' },
      { name: 'mediate', desc: 'Put two positions side by side for a person to decide' },
    ],
  },
  {
    handle: 'archivist',
    name: 'PSI Archivist',
    dept: 'NASA PSI archive',
    role: 'Owns the combustion datasets',
    blurb: 'Holds the raw PSI data next to it, turns frames and channels into test points, and answers questions about them so nobody else has to download 38 GB.',
    color: 'var(--navy)',
    icon: 'research',
    model: 'llama',
    org: 'psi',
    mcp: ['psi-archive', 'frame-features', 'fit'],
    tools: [
      { name: 'psi_search', desc: 'Search the PSI repository' },
      { name: 'ingest', desc: 'Pull a raw dataset onto the archive cluster' },
      { name: 'extract_features', desc: 'Frames and channels to per-frame features' },
      { name: 'fit_model', desc: 'Fit a flammability or spread model to test points' },
    ],
  },
  {
    handle: 'prevent',
    name: 'Materials',
    dept: 'Materials & flammability',
    role: 'Will it burn here?',
    blurb: 'Checks every material on the list against the target atmosphere and gravity, and proposes substitutions.',
    color: 'var(--plum)',
    icon: 'materials',
    model: 'sonnet',
    org: 'prime',
    mcp: ['fire-tools', 'maptis-mirror'],
    tools: [
      { name: 'flammability_map', desc: 'Limiting O₂ vs flow and gravity for a material' },
      { name: 'maptis_lookup', desc: 'Look up a material in the internal MAPTIS mirror' },
      { name: 'propose_change', desc: 'Propose a design change for review' },
    ],
  },
  {
    handle: 'detect',
    name: 'Detection',
    dept: 'Fire detection',
    role: 'Will we see it?',
    blurb: 'Smoke particle sizes, how smoke moves in low gravity, detector type and placement. SAME, SAME-R, DAFT.',
    color: 'var(--steel)',
    icon: 'detection',
    model: 'sonnet',
    org: 'prime',
    mcp: ['fire-tools', 'hpc-01 (Slurm)'],
    tools: [
      { name: 'smoke_cfd', desc: 'Smoke transport in the cabin section, per gravity case' },
      { name: 'place_sensors', desc: 'Search sensor positions for the worst-case first alarm' },
      { name: 'detector_coverage', desc: 'Time-to-alarm per detector for a smoke source' },
    ],
  },
  {
    handle: 'suppress',
    name: 'Suppression',
    dept: 'Fire suppression',
    role: 'Can we put it out?',
    blurb: 'Extinguishing limits and agents (CO₂, water mist), hidden cool flames. FLEX, FLEX-2, CFI.',
    color: 'var(--green)',
    icon: 'suppression',
    model: 'sonnet',
    org: 'prime',
    mcp: ['fire-tools', 'hpc-01 (Slurm)'],
    tools: [
      { name: 'extinction_limit', desc: 'Limiting oxygen index under a diluent' },
      { name: 'droplet_run', desc: 'FLEX-style droplet burn with a suppressant' },
    ],
  },
  {
    handle: 'sim',
    name: 'Simulation',
    dept: 'Analysis & simulation',
    role: 'Shows what happens',
    blurb: 'Builds the cabin from the model, runs spread and pressure on the in-house cluster and returns metrics.',
    color: 'var(--yellow)',
    icon: 'sim',
    model: 'haiku',
    org: 'prime',
    mcp: ['fire-tools', 'hpc-01 (Slurm)'],
    tools: [
      { name: 'build_cabin', desc: 'Mesh the cabin model into zones' },
      { name: 'sim_run', desc: 'Submit a spread run to the cluster' },
      { name: 'pressure_estimate', desc: 'Cabin pressure against the hull limit' },
    ],
  },
  {
    handle: 'wstf',
    name: 'WSTF Lab Agent',
    dept: 'White Sands Test Facility',
    role: 'Test history and scheduling',
    blurb: 'Answers from the lab’s own records and books chamber time. Raw records and procedures stay at the lab.',
    color: 'var(--graphite)',
    icon: 'lab',
    model: 'gpt',
    org: 'wstf',
    mcp: ['lims', 'chamber-scheduler'],
    tools: [
      { name: 'lims_query', desc: 'Search the lab’s test records (private)' },
      { name: 'schedule_test', desc: 'Book a chamber slot' },
      { name: 'publish_result', desc: 'Share a test result summary' },
    ],
  },
  {
    handle: 'skeptic',
    name: 'Safety Assurance',
    dept: 'Independent S&MA',
    role: 'Independent check',
    blurb: 'Checks every claim against its source and flags anything outside the tested range. Can object to a proposal.',
    color: 'var(--tan)',
    icon: 'safety',
    model: 'opus',
    org: 'sma',
    mcp: ['citation-check', 'review-checklists'],
    tools: [
      { name: 'check_citations', desc: 'Verify each claim maps to a source' },
      { name: 'review_proposal', desc: 'Endorse or object to a proposed change' },
    ],
  },
  {
    handle: 'scribe',
    name: 'Report',
    dept: 'Documentation',
    role: 'Writes the hazard report',
    blurb: 'Assembles the materials matrix, the accepted changes and the hazard report with citations.',
    color: 'var(--muted)',
    icon: 'report',
    model: 'sonnet',
    org: 'prime',
    mcp: ['docs'],
    tools: [{ name: 'report_write', desc: 'Write a hazard report section' }],
  },
]

export const AGENT: Record<string, AgentDef> = Object.fromEntries(CREW.map((a) => [a.handle, a]))

export const PEOPLE: PersonDef[] = [
  { handle: HUMAN, name: 'You', role: 'Lead engineer', org: 'prime', color: 'var(--ink)', with: 'flight' },
  { handle: LAB, name: 'WSTF technician', role: 'Runs the chamber tests', org: 'wstf', color: 'var(--org-wstf)', with: 'wstf' },
]

const PERSON: Record<string, PersonDef> = Object.fromEntries(PEOPLE.map((p) => [p.handle, p]))

export const isPerson = (h?: string) => !!h && !!PERSON[h]
export const personOf = (h?: string) => (h ? PERSON[h] : undefined)
export const orgOf = (h?: string): OrgDef | undefined => {
  const o = AGENT[h ?? '']?.org ?? PERSON[h ?? '']?.org
  return o ? ORGS[o] : undefined
}

export const agentColor = (h?: string) => (h === HUB ? 'var(--yellow)' : (AGENT[h ?? '']?.color ?? PERSON[h ?? '']?.color ?? 'var(--faint)'))
export const agentName = (h?: string) => (h === HUB ? 'Lagrange' : (AGENT[h ?? '']?.name ?? PERSON[h ?? '']?.name ?? h ?? '?'))

export const MODEL_COLOR: Record<string, string> = { haiku: 'var(--k-reply)', sonnet: 'var(--k-task)', opus: 'var(--k-review)', llama: 'var(--ug)', gpt: 'var(--graphite)', human: 'var(--muted)' }
