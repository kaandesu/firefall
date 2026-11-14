// The FIREFALL crew. Each agent is one Lagrange address (an A2A agent card at /a/{handle}).
// In live mode each runs as Claude Code over ACP (`lagrange tunnel --acp`) with the fire-tools MCP server.

export type AgentDef = {
  handle: string
  name: string
  role: string
  blurb: string
  color: string
  model: 'opus' | 'sonnet' | 'haiku' | 'human'
  tools: { name: string; desc: string }[]
}

export const HUMAN = 'you'
export const HUB = 'lagrange'

export const CREW: AgentDef[] = [
  {
    handle: 'flight',
    name: 'FLIGHT',
    role: 'Flight director · lead',
    blurb: 'Breaks the question into a plan, delegates, reviews, and asks you when a call is yours.',
    color: '#ff8a4c',
    model: 'opus',
    tools: [
      { name: 'publish_plan', desc: 'Publish the run plan as the fc.plan artifact' },
      { name: 'delegate', desc: 'Send a subtask to a crew address over A2A' },
      { name: 'ask_human', desc: 'Pause the run for a decision (INPUT_REQUIRED)' },
      { name: 'request_review', desc: 'Route work to SKEPTIC' },
      { name: 'accept', desc: 'Mark a subtask done' },
      { name: 'escalate', desc: 'Move a failed subtask up the model ladder' },
    ],
  },
  {
    handle: 'archivist',
    name: 'ARCHIVIST',
    role: 'PSI librarian',
    blurb: 'Searches NASA PSI, ranks investigations for the scenario, builds comparisons.',
    color: '#c9a2ff',
    model: 'haiku',
    tools: [
      { name: 'psi_search', desc: 'Query the PSI repository (geode-py/ws/repo/search)' },
      { name: 'psi_get', desc: 'Fetch one investigation: objectives, hardware, test matrix' },
      { name: 'rank_investigations', desc: 'Score relevance against the scenario spec' },
      { name: 'compare', desc: 'Side-by-side of fuels, O₂, flow, sensors, hardware' },
    ],
  },
  {
    handle: 'prevent',
    name: 'PREVENT',
    role: 'Flammability · prevention',
    blurb: 'Material flammability vs O₂, pressure and airflow. Saffire, BASS, BRE, CFI-G.',
    color: '#ff6b9a',
    model: 'sonnet',
    tools: [
      { name: 'psi_get', desc: 'Read an investigation' },
      { name: 'dataset_query', desc: 'Query a downloaded PSI dataset (CSV / test matrix)' },
      { name: 'flammability_map', desc: "Limiting O₂ vs flow (T'ien-style map)" },
      { name: 'ask_peer', desc: 'Ask another crew member' },
    ],
  },
  {
    handle: 'detect',
    name: 'DETECT',
    role: 'Smoke detection',
    blurb: 'Smoke particle sizes, transport and detector placement. SAME, SAME-R, DAFT.',
    color: '#56d4ef',
    model: 'sonnet',
    tools: [
      { name: 'psi_get', desc: 'Read an investigation' },
      { name: 'dataset_query', desc: 'Query a downloaded PSI dataset' },
      { name: 'detector_coverage', desc: 'Time-to-alarm per detector for a smoke source' },
      { name: 'ask_peer', desc: 'Ask another crew member' },
    ],
  },
  {
    handle: 'suppress',
    name: 'SUPPRESS',
    role: 'Suppression',
    blurb: 'Extinction limits and suppressants (CO₂, He, water mist). FLEX, FLEX-2, CFI.',
    color: '#7ee787',
    model: 'sonnet',
    tools: [
      { name: 'psi_get', desc: 'Read an investigation' },
      { name: 'dataset_query', desc: 'Query a downloaded PSI dataset' },
      { name: 'extinction_limit', desc: 'Limiting oxygen index under a diluent' },
      { name: 'ask_peer', desc: 'Ask another crew member' },
    ],
  },
  {
    handle: 'sim',
    name: 'SIM',
    role: 'Simulation',
    blurb: 'Drives the 3D sims on the dashboard and returns metrics and snapshots.',
    color: '#5aa9ff',
    model: 'haiku',
    tools: [
      { name: 'sim_run', desc: 'Run flame / smoke / spread / droplet sim with params' },
      { name: 'sim_snapshot', desc: 'Capture the current sim frame + metrics' },
    ],
  },
  {
    handle: 'skeptic',
    name: 'SKEPTIC',
    role: 'Reviewer',
    blurb: 'Checks every claim against its citation and flags anything outside the tested range.',
    color: '#ffd84d',
    model: 'opus',
    tools: [
      { name: 'check_citations', desc: 'Verify each claim maps to a PSI record' },
      { name: 'bound_partial_g', desc: 'Bound Moon/Mars behaviour between µg and 1 g data' },
      { name: 'ask_peer', desc: 'Challenge a crew member' },
    ],
  },
  {
    handle: 'scribe',
    name: 'SCRIBE',
    role: 'Report',
    blurb: 'Assembles the Fire Safety Dossier with citations, charts and sim snapshots.',
    color: '#a7b4c2',
    model: 'sonnet',
    tools: [
      { name: 'dossier_write', desc: 'Write a dossier section (fc.dossier artifact)' },
      { name: 'chart_make', desc: 'Render a chart from a dataset query' },
    ],
  },
]

export const AGENT: Record<string, AgentDef> = Object.fromEntries(CREW.map((a) => [a.handle, a]))

export const HUMAN_DEF: AgentDef = {
  handle: HUMAN,
  name: 'YOU',
  role: 'Mission engineer',
  blurb: 'You set the scenario and make the calls.',
  color: '#e6edf3',
  model: 'human',
  tools: [],
}

export const agentColor = (h?: string) => (h === HUMAN ? HUMAN_DEF.color : h === HUB ? '#ffcf6b' : (AGENT[h ?? '']?.color ?? '#7d8a99'))
export const agentName = (h?: string) => (h === HUMAN ? 'YOU' : h === HUB ? 'LAGRANGE' : (AGENT[h ?? '']?.name ?? (h ?? '?').toUpperCase()))

export const MODEL_COLOR: Record<string, string> = { haiku: '#7ee787', sonnet: '#56d4ef', opus: '#c9a2ff', human: '#e6edf3' }
