// The FIREFALL review team. Each agent stands for one engineering department and is one Lagrange address
// (an A2A agent card at /a/{handle}). In live mode each runs as Claude Code over ACP (`lagrange tunnel --acp`)
// with the fire-tools MCP server. Handles are stable ids used by the event log; names are what people see.

export type AgentDef = {
  handle: string
  name: string
  dept: string
  role: string
  blurb: string
  color: string
  icon: 'lead' | 'research' | 'materials' | 'detection' | 'suppression' | 'sim' | 'safety' | 'report'
  model: 'opus' | 'sonnet' | 'haiku'
  org: 'builder' | 'independent'
  tools: { name: string; desc: string }[]
}

export type PersonDef = {
  handle: string
  name: string
  role: string
  org: string
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
    blurb: 'Turns your request into a plan, hands work to departments, reviews results and asks you when a decision is yours.',
    color: '#d4541f',
    icon: 'lead',
    model: 'opus',
    org: 'builder',
    tools: [
      { name: 'publish_plan', desc: 'Publish the review plan' },
      { name: 'delegate', desc: 'Send a subtask to a department over A2A' },
      { name: 'ask_human', desc: 'Pause for a decision from the lead engineer' },
      { name: 'request_review', desc: 'Send work to Safety Assurance' },
      { name: 'accept', desc: 'Accept a subtask as done' },
      { name: 'escalate', desc: 'Retry a failed subtask on a stronger model' },
    ],
  },
  {
    handle: 'archivist',
    name: 'Research',
    dept: 'Research · NASA PSI',
    role: 'Finds the evidence',
    blurb: 'Searches NASA Physical Sciences Informatics, ranks investigations against the design and compares them.',
    color: '#7c5cc4',
    icon: 'research',
    model: 'haiku',
    org: 'builder',
    tools: [
      { name: 'psi_search', desc: 'Search the PSI repository' },
      { name: 'psi_get', desc: 'Read one investigation: objectives, hardware, test matrix' },
      { name: 'rank_investigations', desc: 'Score relevance against the design package' },
      { name: 'compare', desc: 'Side-by-side of fuels, O₂, flow, sensors' },
    ],
  },
  {
    handle: 'prevent',
    name: 'Materials',
    dept: 'Materials & flammability',
    role: 'Will it burn here?',
    blurb: 'Checks every material on the list against the target atmosphere and gravity. Saffire, BASS, BRE, CFI-G.',
    color: '#c2416c',
    icon: 'materials',
    model: 'sonnet',
    org: 'builder',
    tools: [
      { name: 'psi_get', desc: 'Read an investigation' },
      { name: 'dataset_query', desc: 'Query a downloaded PSI dataset' },
      { name: 'flammability_map', desc: 'Limiting O₂ vs flow and gravity for a material' },
      { name: 'request_test', desc: 'Ask the test lab for data or a retest' },
    ],
  },
  {
    handle: 'detect',
    name: 'Detection',
    dept: 'Fire detection',
    role: 'Will we see it?',
    blurb: 'Smoke particle sizes, how smoke moves in low gravity, detector type and placement. SAME, SAME-R, DAFT.',
    color: '#1b84a8',
    icon: 'detection',
    model: 'sonnet',
    org: 'builder',
    tools: [
      { name: 'psi_get', desc: 'Read an investigation' },
      { name: 'dataset_query', desc: 'Query a downloaded PSI dataset' },
      { name: 'detector_coverage', desc: 'Time-to-alarm per detector for a smoke source' },
    ],
  },
  {
    handle: 'suppress',
    name: 'Suppression',
    dept: 'Fire suppression',
    role: 'Can we put it out?',
    blurb: 'Extinguishing limits and agents (CO₂, water mist), hidden cool flames. FLEX, FLEX-2, CFI.',
    color: '#2f8f57',
    icon: 'suppression',
    model: 'sonnet',
    org: 'builder',
    tools: [
      { name: 'psi_get', desc: 'Read an investigation' },
      { name: 'dataset_query', desc: 'Query a downloaded PSI dataset' },
      { name: 'extinction_limit', desc: 'Limiting oxygen index under a diluent' },
    ],
  },
  {
    handle: 'sim',
    name: 'Simulation',
    dept: 'Analysis & simulation',
    role: 'Shows what happens',
    blurb: 'Runs the flame, smoke, spread and droplet models with the cabin’s parameters and returns metrics.',
    color: '#3566c9',
    icon: 'sim',
    model: 'haiku',
    org: 'builder',
    tools: [
      { name: 'sim_run', desc: 'Run a simulation with given parameters' },
      { name: 'sim_snapshot', desc: 'Capture the current frame and metrics' },
    ],
  },
  {
    handle: 'skeptic',
    name: 'Safety Assurance',
    dept: 'Safety & mission assurance',
    role: 'Independent check',
    blurb: 'Checks every claim against its citation and flags anything outside the tested range (e.g. Moon gravity).',
    color: '#a16207',
    icon: 'safety',
    model: 'opus',
    org: 'independent',
    tools: [
      { name: 'check_citations', desc: 'Verify each claim maps to a PSI record' },
      { name: 'bound_partial_g', desc: 'Bound Moon/Mars behaviour between µg and 1 g data' },
    ],
  },
  {
    handle: 'scribe',
    name: 'Report',
    dept: 'Documentation',
    role: 'Writes the hazard report',
    blurb: 'Assembles the materials matrix and the draft fire hazard report with citations.',
    color: '#5b6573',
    icon: 'report',
    model: 'sonnet',
    org: 'builder',
    tools: [
      { name: 'report_write', desc: 'Write a hazard report section' },
      { name: 'chart_make', desc: 'Render a chart from a dataset query' },
    ],
  },
]

export const AGENT: Record<string, AgentDef> = Object.fromEntries(CREW.map((a) => [a.handle, a]))

export const PEOPLE: PersonDef[] = [
  { handle: HUMAN, name: 'You', role: 'Lead engineer', org: 'Vehicle team', color: 'var(--ink)', with: 'flight' },
  { handle: LAB, name: 'Test lab', role: 'Materials testing · White Sands (WSTF)', org: 'NASA WSTF', color: '#0f766e', with: 'prevent' },
]

const PERSON: Record<string, PersonDef> = Object.fromEntries(PEOPLE.map((p) => [p.handle, p]))

export const isPerson = (h?: string) => !!h && !!PERSON[h]
export const personOf = (h?: string) => (h ? PERSON[h] : undefined)

export const agentColor = (h?: string) => (h === HUB ? '#a16207' : (AGENT[h ?? '']?.color ?? PERSON[h ?? '']?.color ?? '#6b7280'))
export const agentName = (h?: string) => (h === HUB ? 'Lagrange' : (AGENT[h ?? '']?.name ?? PERSON[h ?? '']?.name ?? h ?? '?'))

export const MODEL_COLOR: Record<string, string> = { haiku: 'var(--k-reply)', sonnet: 'var(--k-task)', opus: 'var(--k-review)', human: 'var(--muted)' }
