// firefall-tools: FIREFALL's data and models as an MCP server, so an agent can look things up and run simulations
// with its own parameters.
//   pnpm tools            HTTP on http://localhost:8765/mcp (PORT=… to change)
//   pnpm tools --stdio    stdio, for `claude mcp add firefall -- pnpm -C web tools --stdio`
// Give it to a Lagrange coding agent with:  lagrange tunnel … --acp claude-agent-acp --mcp firefall=http://localhost:8765/mcp
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { ToolError, dropletTool, fireSpread, getCabin, limitingO2Tool, nearestTests, searchReport, searchStudies, smokeAlarm, spreadRateTool } from './core'
import { MAX_T_END, fdsStatus, listRuns, runFds } from './fds'

const o2 = z.number().min(0.05).max(1).describe('O₂ mole fraction, 0..1 (0.21 is air, 0.34 the Artemis exploration atmosphere, 1 is pure oxygen)')
const psia = z.number().min(1).max(60).describe('Total pressure in psia (14.7 is sea level, 8.2 the exploration atmosphere)')
const g = z.number().min(0).max(2).describe('Gravity in Earth g (0 microgravity, 0.165 Moon, 0.38 Mars, 1 Earth)')
const mat = z.string().describe('Material id: cotton, pmma, nylon, nomex, kapton, teflon or silicone')
const flow = z.number().min(0).max(200).describe('Forced air flow in cm/s (spacecraft ventilation is about 10 to 20)')

type Shape = Record<string, z.ZodType>
type Def = { name: string; title: string; description: string; input: Shape; run: (args: never) => unknown }

export const TOOLS: Def[] = [
  { name: 'get_cabin', title: 'The cabin under review', description: 'The example cabin (Apollo CM-012): atmosphere, gravity, volume, hatch, hull limit, ignition sources, detectors and the materials list. Call this first to know what the other tools work on.', input: {}, run: getCabin },
  { name: 'search_studies', title: 'Rank NASA combustion studies', description: 'Rank the PSI microgravity combustion investigations (Saffire, BASS, FLEX, ACME, SAME…) by how well the conditions they tested cover a given atmosphere.', input: { o2, psia, top: z.number().int().min(1).max(20).optional().describe('How many to return (default 5)') }, run: searchStudies },
  { name: 'nearest_tests', title: 'Closest real test points', description: 'The real NASA burn tests closest to an atmosphere: ACME chamber log and CFI-G, plus points read from the BASS-II, Saffire and FLEX papers. Says when the atmosphere is outside anything tested.', input: { o2, psia, n: z.number().int().min(1).max(25).optional(), material: z.string().optional().describe('Only tests that mention this material or fuel, e.g. "pmma", "cotton", "decane"') }, run: nearestTests },
  { name: 'limiting_o2', title: 'Limiting oxygen for a material', description: 'The O₂ mole fraction below which a flame on a material goes out, for a flow speed, gravity and pressure. Includes how the model compares with BASS-II.', input: { material: mat, flow_cm_s: flow.optional(), g: g.optional(), psia: psia.optional() }, run: limitingO2Tool },
  { name: 'spread_rate', title: 'Flame spread rate', description: 'Flame spread rate (mm/s) on a material at a given O₂, flow, gravity and pressure, and how that compares with the same material in Earth air.', input: { material: mat, o2, flow_cm_s: flow.optional(), g: g.optional(), psia: psia.optional() }, run: spreadRateTool },
  { name: 'droplet_burn', title: 'Fuel droplet with a suppressant', description: 'Does a fuel droplet keep burning at this O₂ with CO₂ added (a suppression flood)? Burning rate, lifetime and cool-flame risk, after FLEX.', input: { o2, co2: z.number().min(0).max(0.9).optional().describe('CO₂ mole fraction added, 0..0.9'), diameter_mm: z.number().min(0.5).max(6).optional() }, run: dropletTool },
  {
    name: 'fire_spread',
    title: 'Fire spread and cabin pressure (quick model)',
    description: 'Run the zone fire model on the example cabin: when each zone catches, the pressure rise, whether and when the hull ruptures, against the hatch opening time. Takes what-ifs: another atmosphere, gravity, or materials swapped. Runs in milliseconds.',
    input: { o2: o2.optional(), psia: psia.optional(), g: g.optional(), replace: z.array(z.object({ from: mat, to: mat })).optional().describe('Swap one material for another everywhere in the cabin, e.g. [{"from":"nylon","to":"nomex"}]') },
    run: fireSpread,
  },
  { name: 'smoke_alarm', title: 'Smoke detection time (2-D CFD)', description: 'Smoke transport in the cabin cross-section at a gravity level: time to first alarm for every ignition source with the designed detectors, and a better detector layout. Takes about 5 to 20 seconds.', input: { g, seconds: z.number().min(10).max(120).optional().describe('Simulated time (default 60)') }, run: smokeAlarm },
  {
    name: 'run_fds',
    title: 'Start a NIST FDS run',
    description: `Start a real NIST FDS 6.11 CFD run of the example cabin with your parameters. Returns a run id at once; the run takes 1 to 5 minutes (one at a time, at most ${MAX_T_END} simulated seconds). Poll fds_status for the result. The run opens in the FIREFALL app at the "view" link.`,
    input: {
      g: g.optional(),
      o2: o2.optional(),
      psia: psia.optional(),
      burner_kw: z.number().min(5).max(500).optional().describe('Heat release of the igniting burner in kW (default 75)'),
      burner_off_s: z.number().min(1).max(MAX_T_END).optional().describe('When the burner switches off, s (default 20)'),
      t_end: z.number().min(1).max(MAX_T_END).optional().describe(`Simulated time, s (default and maximum ${MAX_T_END}; 5 is a quick check)`),
      label: z.string().max(60).optional().describe('A short name for the run'),
    },
    run: runFds,
  },
  { name: 'fds_status', title: 'State and result of an FDS run', description: 'State of an FDS run (default: the latest). When done: peak heat release, when the fire spreads beyond the burner, peak pressure, hull burst time, detector alarm times, ceiling temperature and minimum O₂.', input: { id: z.string().optional(), wait_s: z.number().min(0).max(120).optional().describe('Wait up to this many seconds for the run to finish before answering') }, run: fdsStatus },
  { name: 'list_fds_runs', title: 'FDS runs so far', description: 'Every FDS run started through this server, with its parameters and state.', input: {}, run: () => ({ runs: listRuns().map(({ id, state, label, params, started }) => ({ id, state, label, params, started })) }) },
  { name: 'search_report', title: 'Search the BASS-II Summary Report', description: 'Passages, with page numbers, from NASA’s 144-page BASS-II Summary Report (solid fuels burning in low-speed flow on the ISS) that match a question.', input: { query: z.string().min(3), n: z.number().int().min(1).max(8).optional() }, run: searchReport },
]

export function buildServer() {
  const server = new McpServer({ name: 'firefall-tools', version: '0.1.0' })
  for (const t of TOOLS)
    server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.input }, async (args: unknown) => {
      try {
        const out = await (t.run as (a: unknown) => unknown)(args)
        return { content: [{ type: 'text' as const, text: JSON.stringify(out, null, 1) }] }
      } catch (e) {
        if (!(e instanceof ToolError)) console.error(`[${t.name}]`, e)
        return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true }
      }
    })
  return server
}

async function main() {
  if (process.argv.includes('--stdio')) {
    await buildServer().connect(new StdioServerTransport())
    return
  }
  const port = Number(process.env.PORT ?? 8765)
  const http = createServer(async (req, res) => {
    // Local only: refuse requests that reached us under another host name (DNS rebinding).
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')) return void res.writeHead(403).end()
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
      return void res.end(JSON.stringify({ name: 'firefall-tools', mcp: `http://localhost:${port}/mcp`, tools: TOOLS.map((t) => t.name) }))
    }
    if (path !== '/mcp') return void res.writeHead(404).end()
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json', allow: 'POST' })
      return void res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }))
    }
    try {
      // Stateless: a fresh server and transport for each request.
      const server = buildServer()
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (e) {
      console.error(e)
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }))
    }
  })
  http.listen(port, '127.0.0.1', () => console.error(`firefall-tools: ${TOOLS.length} tools on http://localhost:${port}/mcp`))
}

if (process.argv[1]?.endsWith('mcp.ts')) void main()
