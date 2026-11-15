# FIREFALL

**Human-in-the-loop agent collaboration across departments and companies, built for spacecraft fire safety.**



https://github.com/user-attachments/assets/ed5a3f8d-63c1-42b4-a156-8dda3e5036ea





A crewed-vehicle fire safety review already spans several organizations: the vehicle builder, a NASA data archive,
a test lab and an independent safety office. Each one has its own data, tools, compute and sign-off. FIREFALL lets
each of them put **an agent** on a shared network ([Lagrange](https://github.com/Three-Agent-Problem/agent2agency),
A2A) and run the review together. Organizations expose an agent, not their data. People stay in charge of every call
that matters.

> Built for NASA Space Apps 2026: *Flame in Freefall*.

## The value

- **Cross-company, not just multi-agent.** Each organization runs its agents on its own hardware with its own model
  provider: on-prem Claude, self-hosted Llama, GPT through an agency cloud, Claude on Bedrock GovCloud. They meet on
  Lagrange as A2A addresses. This is not one orchestrator running many prompts on one machine.
- **Expose the agent, keep the black box.** An org publishes an agent card with its skills ("test history lookup",
  "schedule a test"). Raw camera frames, LIMS records, procedures, CAD and supplier data never leave the org. Other
  agents get answers, not access.
- **Each agent has its own tools.** Every agent brings its own MCP servers: `psi-archive` and `fit` at the archive,
  `lims` and `chamber-scheduler` at the lab, `fire-tools` and `hpc-01 (Slurm)` at the vehicle team. The network does
  not need to know how any of them work.
- **Ask the owner instead of re-reading the data.** When Materials needs the limiting O₂ for nylon, it asks the PSI
  Archivist, which already has 38 GB of Saffire-I processed into test points. It does not download and re-read the
  dataset. The answer is more accurate because it comes from whoever owns the data, and much cheaper: the demo counts
  the tokens each ask saved (≈730k across one review).
- **Knowledge bases that build as they talk.** Each agent keeps what it has learned and where every fact came from:
  an input file, a dataset, its own tool, another agent or a person. Later steps reuse those facts instead of the
  raw context.
- **People in the loop, with the lead as mediator.** Agents talk directly when they can settle something themselves.
  When they disagree (Materials endorses a change, Safety Assurance objects), the Review Lead puts both positions side
  by side and asks the engineer to decide. Agents can also hand physical work to people: the lab agent books a
  chamber test and a technician runs it.
- **Real data, really processed.** The PSI Archivist runs on the actual ACME files (CFI-G test 21256C2 camera
  series and frames, Flame Design sensor log 19175A4, 143 chamber test points). Ignition, steady flame, transient
  and glow are *found by code* from the brightness series, not typed in. The Test data tab scores 206 real burn
  tests (ACME, CFI-G, and points from the published BASS-II, Saffire and FLEX papers) against your cabin and shows
  plainly that nothing was tested above 40 % ambient O₂.
- **Simulations where they run in real life: on GPU farms.** The Lab panel is the review's compute floor. Every
  job an agent starts lands on its org's cluster (Slurm `hpc-01` 8×H100, the archive's 32×A100 Kubernetes pool,
  the WSTF chamber) and plays live: ACME frames being processed, flame-spread ducts, a limiting-O₂ sweep, flames in
  µg vs 1 g, droplet suppression, and a 2-D smoke CFD of the cabin at µg, Moon and 1 g.
- **Sensor placement from the spec, checked at every gravity.** Detectors come from `cabin.yaml`; the Detection
  agent runs smoke CFD for every ignition source × gravity case, finds the designed layout misses 3 of 9 cases
  (no buoyancy in µg; 0.18 µm PTFE smoke is invisible to a photoelectric head), and proposes a layout that alarms in
  all 9 (worst 25 s). You adopt it or keep the design.
- **A report you can question.** The report reads like a technical summary: the review in 30 seconds, numbered
  sections with the data behind each claim, who decided what. An AI chat sits beside it, grounded only in the
  report, and pulls up the chart, matrix row, test point or section that answers your question.
- **The conversation is the audit trail.** Every ask, answer, objection, decision and citation is a signed message on
  the network. That is what a safety review panel wants to see.

## Who it is for

| | |
|---|---|
| **Users** | Materials & processes (M&P) engineers and safety engineers who have to show that a crewed vehicle won't let a fire start, spread or go unnoticed |
| **Organizations** | Teams building crewed vehicles and habitats: NASA Artemis (lunar surface habitat, pressurized rover), commercial station builders (Axiom, Vast, Starlab), and payload developers flying hardware to a station |
| **Buyer** | The Safety & Mission Assurance office of a space agency, or the safety team of a commercial station company |

## The problem

Here is how spacecraft fire safety is handled today:

1. **Every non-metal material is tested.** Fabrics, foams, plastics and wire insulation go through NASA-STD-6001 **Test 1**.
   This is a pass/fail upward-burn test, run in Earth gravity at the worst atmosphere the material will see. Results go
   into NASA's MAPTIS database. **If the atmosphere changes, the material has to be tested again.**
2. **Materials that fail need a configuration analysis** (JSC 29353). The team has to show that the design stops fire
   from spreading: barriers, isolation, or removing the ignition source. If that is inconclusive, the actual hardware
   configuration gets tested.
3. **Hazard reports go to a safety review panel** in phases, before anything is certified to fly. The ISS payload panel
   alone handled 449 safety data packages in one year, which led to about 150 full panel reviews. Most of that work is
   manual documents.

**Why it is getting harder:**
- Artemis plans an *exploration atmosphere* of 34% O₂ at 8.2 psia, which shortens pre-breathe time before EVAs.
  Richer oxygen makes materials burn more easily, so much of today's qualified material list has to be re-checked.
- The standard test runs in Earth gravity. NASA Glenn reports evidence that some materials burn at *lower* oxygen
  levels in lunar gravity than on Earth.
- In microgravity, flames on some materials keep spreading at oxygen levels where they would go out on Earth.
- Nearly 20 years of microgravity fire experiments sit in NASA's Physical Sciences Informatics (PSI) system, for
  example Saffire, BASS, FLEX, SAME and CFI. **None of it is connected to the review workflow.** It is searchable by
  keyword, but nobody turns it into "is *my* cabin safe at 34% O₂ on the Moon?"

## What happens in a review

**Start.** Two ways in: *watch the demo* (the scripted Apollo CM-012 review, no setup) or *connect* to your own
Lagrange server (see [Connect to Lagrange](#connect-to-lagrange)).

**0 · Team.** The roles of a review on the left, the addresses that fill them on the right. In the demo the crew
is scripted and marked *simulated*; it stands for four organizations, each running its own agents:

| Org | Agent(s) | Runs on | Keeps private |
|---|---|---|---|
| **Vehicle team** (prime, you) | Review Lead, Materials, Simulation, Report | on-prem `hpc-01`, Claude via internal gateway | cabin CAD, supplier data, cost model |
| **NASA PSI archive** | PSI Archivist | GRC GPU cluster, self-hosted Llama 3.3 | raw camera frames, unpublished runs |
| **White Sands Test Facility** | WSTF Lab Agent + a technician | lab cluster, GPT-4.1 via agency cloud | LIMS records, procedures, other customers' results |
| **Independent S&MA** | Safety Assurance | FedRAMP agency cloud, Claude on Bedrock | review checklists, past findings |

**1 · Intake.** Real input files: `cabin.yaml` (atmosphere, gravity, volume, hatch, hull, ignition zones, smoke
detectors), `materials.csv` (part, material, rating, zone, amount) and `cabin.model.json` (the cabin geometry by
zone). FIREFALL parses and cross-checks them, for example a material or a detector in a zone the model doesn't have.

**Cabin intro.** Before anything runs, a camera tour of the model: every zone, what sits there and its rating, the
listed ignition source pulsing, the detectors, and finally the atmosphere it all sits in. Skippable (Esc).

**2 · Plan.** The Review Lead proposes subtasks, each with its owning agent, what it reads and what it produces. You
switch optional steps off and approve. Nothing runs until you do.

**3 · Run.** One screen of panels:
- **Network:** live traffic through Lagrange. Cross-org lines are dashed. When the review is waiting on you, the
  question appears on your node.
- **Stage:** the cabin built from the model, with the materials, spread, pressure and what-if layers. Each layer
  unlocks when an agent produces it.
- **Agent:** one agent's workspace: data jobs on its org's compute, tool calls, and its knowledge base with sources.
- **Lab:** the plan as chips, every org's machines with live GPU use, the job queue, and a tile per running job
  (real ACME frames, flame and smoke sims, sweeps, the technician's chamber test). `p` opens the full plan graph.
- **Findings** (materials matrix, proposals) and **Comms**: every agent-to-agent message, with the tokens saved by
  asking.

What happens in the Apollo CM-012 example:
1. The Archivist processes Saffire-I, BASS-II and ACME on the PSI cluster into fitted limits. Materials *asks* it
   instead of reading the data.
2. Materials asks the WSTF agent for Test 1 history on PTFE. There is none, so the lab offers a slot and the Lead asks
   you whether to book it. The lab agent hands the job to the technician, who runs it, and the matrix updates.
3. Simulation asks Materials for burn rates, runs spread and pressure, and finds hull rupture at T+15 s against a
   90 s hatch.
4. Materials **proposes PR-1** (Beta cloth for nylon, 60/40 O₂/N₂ on the pad). Simulation re-runs it and endorses it;
   Safety Assurance objects with sources. The Lead mediates, and you accept, accept with the caveat, or reject.
5. Detection asks the Archivist for SAME smoke sizes, runs 18 smoke CFD jobs on `hpc-01` and the placement sweep,
   and **proposes PR-2** (two ionization heads, moved). Simulation endorses; you adopt it or keep the design.
6. Suppression asks for FLEX limits and runs a droplet with a 25 % CO₂ flood: at 100 % O₂ it keeps burning.
7. Report writes the verdict and the hazard report.

**4 · Report.** A table of contents, "the review in 30 seconds", and twelve numbered sections: cabin and inputs,
materials, evidence and data processed (real ACME frames, brightness with detected events, sensor log, nearest test
points, best-fitting studies), fire spread and pressure, smoke detection and sensor placement (coverage maps and the
time-to-alarm table for every source × gravity), suppression, the lab test, decisions and who made them, what-ifs,
open items, how the review ran, and sources. Every section has an **Ask** button; the chat on the right answers
from the report and pulls up charts, rows, test points and sections. Exports: `hazard-report.md`, `matrix.csv`,
print to PDF.

**Inbox · Library · Test data · FDS · Compute** (tabs in the top bar, the run keeps going behind them):
- **Inbox:** everything that reached a person: decisions, lab jobs and FYIs, open and done. Switch between *You*
  (lead engineer) and the *WSTF technician*, who gets the Test 1 job with a result form (burn length per sample).
  The last gate is **Sign the hazard report**: the report says *Draft* until a person signs, then *Signed by You · T+…*.
- **Library:** the 20 PSI studies ranked by fit to this cabin; the ACME studies open their real data (frame
  scrubber against the brightness series, the 10 sensor channels, the test-point scatter with the cabin marked).
  BASS, Saffire and FLEX open **published data**: the rows read from the NTRS papers, with where and how each was
  read, and our model fitted to them (observed vs model vs fit, rms before and after).
- **Test data:** 206 real NASA burn tests (ACME chamber log, CFI-G days, and published BASS-II / Saffire / FLEX
  points) with filters, sort, match score and a scatter; pin rows into the report.
- **FDS:** a real NIST FDS 6.11.1 run of the Apollo cabin, generated from the same input files, at 1 g and in µg.
  Input view (the generated `.fds`, its surfaces and obstructions in 3-D) and output view (temperature and soot
  slices, Smoke3D soot and flame, playback, HRR / pressure / obscuration charts, and a cross-check against the quick
  model). The report's §4 and §5 carry an "FDS check".
- **Compute:** every org's servers, GPU pools and chamber, with live use; add a server or GPU farm, or connect an
  MCP server to an agent (handshake, discovered tools). Everything is marked in-house: data never leaves.

## Demo vs real

The demo is a **scripted replay** of the same Lagrange events a live run produces, and it goes through the same fold,
so the UI is the same in both modes. What is real and what is illustrative:

| Real | Illustrative |
|---|---|
| Input parsing and cross-checks | Token savings per ask |
| ACME 21256C2 event detection, 19175A4 sensor stats, evidence rows and match scores | Lab burn lengths in the demo (scripted) |
| NIST FDS 6.11.1 runs of the cabin (1 g and µg), generated from the input files and run locally | |
| Saffire / BASS-II / FLEX fits: least squares against numbers read from the NTRS papers, residuals shown | |
| Smoke CFD (2-D stable fluids on the cabin section, Web Worker) and sensor optimisation | Cluster names, GPU counts, job timings |
| Saffire-I F1C2 frames and BASS-II stills from PSI, the BASS-II Summary Report text | |
| Connected mode: agents on Lagrange, their tool calls (`web/tools`), FDS runs they start | The review itself, even in connected mode |
| Fire spread / pressure zone model, what-ifs | Agent message wording (scripted) |
| Report chat (OpenAI, grounded in the report JSON) | Demo-mode chat answers (built from the same report) |

FDS case: `web/src/fds/toFds.ts` voxelises the hull and parts at 10 cm (51,200 cells), sets pure O₂ at the cabin
pressure in a sealed volume, and puts a 75 kW, 20 s burner under the nearest listed burnable item. At 1 g the
debris net catches at ≈ 11 s and the background pressure passes the 29 psia burst line at ≈ 22 s; in µg the burner
puff never spreads. The surface data are air cone-calorimeter values, so in pure O₂ FDS under-predicts: read it
as a lower bound.

The spread and pressure model is a simple zone model (Dijkstra spread and lumped pressure) tuned to the Apollo 1
record; the smoke CFD is 2-D. Both are for triage only and do not replace Test 1, FDS or the review panel.

## Architecture

```
mates-end/
  web/      React 19 + Vite + TypeScript + Tailwind v4, React Flow (network, plan), Remotion + react-three-fiber (stage)
    public/examples/apollo-cm012/   cabin.yaml, materials.csv, cabin.model.json
    src/intake/   parse + cross-check the input files
    src/live/     Lagrange entry types, reducer, replay, store
    src/demo/     orgs, agents, people, the Apollo review script
    src/stage/    cabin, zone fire model, Remotion compositions (stage, intro)
    src/lab/      smoke CFD + sensor optimiser (worker), lab tiles and three.js sims
    src/data/     ACME loaders + event detection, PSI library and fit, evidence rows
    src/report/   the report as data, the chat's context and scripted answers
    src/fds/      FDS case generator, readers for .fds/.smv/.sf/.s3d/.csv (ported from fds-viewer, MIT), FDS tab parts
    src/data/published/   BASS-II, Saffire, FLEX numbers from the NTRS papers (ref, where, how per row)
    src/sims/fits.ts      least-squares fits of the models to the published rows
    public/data/fds/apollo-cm012/   the shipped FDS run (1 g + µg) and its manifest
    scripts/      gen-fds.ts, fds-manifest.ts (run with node + the alias loader)
    server/       dev-server route /api/ask (OpenAI streaming; key stays server-side)
    tools/        firefall-tools MCP server: core.ts (tools), fds.ts (FDS runs), mcp.ts (HTTP + stdio)
    public/data/acme/   real ACME data extracted from flame-in-freefall (scripts/extract-fif.mjs)
  scripts/fds/run.sh   generate the case, run FDS (1g, ug), write the manifest
  docs/mvp-roadmap.md  workflow, data path, architecture, deploy, milestones M1-M4
  data/psi/ public PSI metadata snapshot (+ downloaded datasets, not committed)
  server/   (next) Lagrange proxy, saved reviews
  agents/   (next) one agent per org/department with its own MCP servers, connected via `lagrange tunnel --acp`
```

Every task, message, tool call, knowledge fact, data job and proposal is a Lagrange activity entry. A pure
`reduce(model, entry)` folds them for both the replay and the live SSE stream.

## Run it

```bash
cd web
pnpm install
pnpm dev            # http://localhost:5180
```

For the report chat, put an OpenAI key in `web/.env.local` (gitignored; read only by the dev server, never bundled):

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini   # optional
```

Without a key the chat runs in **demo** mode with scripted answers; the `demo` toggle switches between the two.

To re-run FDS (NIST FDS 6.11.1; on macOS the installer's `fds_openmp`, on Linux the `openbcl/fds:6.11.1` image):

```bash
scripts/fds/run.sh            # both cases; FDS=/path/to/fds, OMP_NUM_THREADS=4, T_END=30
scripts/fds/run.sh 1g         # one case
```

Outputs land in `web/public/data/fds/apollo-cm012/` and the FDS tab picks them up.

Deep links: `?example=1` loads the Apollo case, `&start=1` starts the review straight away, `&speed=4` plays faster,
`&intro=0` skips the cabin intro, and `?view=fds|inbox|library|evidence|compute` opens a tab.
Keys on the run screen: `1`–`6` focus a panel, `+`/`-` resize it, `h`/`l` switch agent, `a` answers with the
default option, and `?` lists the rest.

## Run it for real

**→ [docs/get-started.md](docs/get-started.md)** goes from nothing to an agent that runs FDS, step by step.
The short version:

```sh
scripts/lagrange-local.sh up      # a local Lagrange + its own small Postgres; saves an API key in web/.env.local
cd web && pnpm dev                # choose Connect on the start screen
pnpm tools                        # firefall-tools: 12 MCP tools on http://localhost:8765/mcp
```

Then **+ agent** on the Team screen prints a tunnel command; with the *Claude Code with FIREFALL tools* one, the
agent can search the test data and the BASS-II report, run the spread, smoke and cabin fire models with its own
parameters, and start real FDS runs that open in the FDS tab (`?view=fds&run=<id>`).

- `docker-compose.yml` runs the same Lagrange server with Postgres on a named volume (`cp .env.example .env`).
- `web/tools/` is the MCP server. It wraps the app's own functions; nothing in it is scripted.
- `scripts/prep-psi.sh` turns raw PSI downloads (`data/PSI-98`, `data/PSI-25`, gitignored) into the WebP frames
  and the searchable report under `web/public/data/psi-*`, shown in the Library.

**What this does not do yet:** connected agents do not drive the review. The plan, run and report screens are
still the scripted replay. Sending each role its brief and reading a real plan back is M1 in `docs/mvp-roadmap.md`.

## Deploy the demo

The demo needs no backend: the scripted replay, the shipped FDS run and the report chat in scripted mode are all
static files. The root `Dockerfile` builds `web/` and serves it with nginx (`deploy/nginx.conf`, port 80).

- **Coolify:** New resource → your Git repo → Build Pack **Dockerfile** (base directory `/`), port **80**, add a domain.
- **By hand:** `docker build -t firefall-demo . && docker run -p 8080:80 firefall-demo`

Share `https://<domain>/?example=1&start=1` to drop people straight into the Apollo review.

## Status

- [x] Start screen (demo or connect) and Team roster: roles, simulated crew, or the addresses on your Lagrange server
- [x] Intake from real files with cross-checks; plan approval
- [x] Run: cross-org asks, knowledge bases with sources, data jobs, lab work by a person, proposals with reviews,
      mediated decisions, token savings
- [x] Cabin stage (materials, spread, pressure, smoke, what-if) and the cabin intro
- [x] Lab panel: per-org clusters, job queue, live sim tiles; compute and MCP setup
- [x] Real ACME data processing; library and evidence explorer; smoke CFD and sensor placement at µg / Moon / 1 g
- [x] Report with TOC, sections, exports and an AI chat (OpenAI) that pulls up report items
- [x] Real FDS run of the cabin (1 g + µg) with an in-app viewer, an FDS job in the run, and an FDS check in the report
- [x] Published BASS-II / Saffire / FLEX numbers with sources, model fits with residuals
- [x] Inbox for people (you and the WSTF technician) and a signed hazard report
- [x] Local Lagrange in one command, docker compose, get-started guide
- [x] `firefall-tools` MCP server: data search, models and real FDS runs for connected agents
- [x] Saffire-I frames, BASS-II stills and report in the Library
- [ ] Agents driving the review (role briefs, a real plan): M1 in `docs/mvp-roadmap.md`
- [ ] FDS worker on a server (today FDS runs on the machine that runs `pnpm tools`): M2
- [ ] PSI raw data + spread-rate extraction, surrogate models: M3, M4
- [ ] Deploy (public demo replay; live mode behind an access key)

## Sources

- NASA-STD-6001B, *Flammability, Offgassing, and Compatibility Requirements and Test Procedures*: https://standards.nasa.gov/standard/nasa/nasa-std-6001
- Upward Flame Propagation (NASA Test 1), White Sands Test Facility: https://www.nasa.gov/centers-and-facilities/white-sands/upward-flame-propagation-nasa-test-1
- Spacecraft flammability configuration analysis (JSC 29353) and system-level flammability: https://ntrs.nasa.gov/citations/20150020937
- Barrier testing for materials that fail Test 1 (NESC TB 26-03, 2026): https://ntrs.nasa.gov/api/citations/20260001542/downloads/TB_26-03Final.pdf
- ISS Payload Safety Review Panel workload: https://ntrs.nasa.gov/api/citations/20100020966/downloads/20100020966.pdf
- Exploration atmospheres (34% O₂ / 8.2 psia): https://ntrs.nasa.gov/api/citations/20220011152/downloads/Exploration%20Atmosphers%20OAF%2020220805.pdf
- Lunar-gravity flammability limits (NASA Glenn): https://ntrs.nasa.gov/api/citations/20240015307/downloads/Glenn_2024_ZayacPoster.pdf
- Flame-retardant textiles for elevated-O₂ habitats (ICES 2026): https://ntrs.nasa.gov/api/citations/20260003042/downloads/301-ICES_Paper_2026-FR-Textiles_Final_04-13-2026.pdf
- NASA Physical Sciences Informatics: https://psi.nasa.gov
- NIST Fire Dynamics Simulator (FDS 6.11.1): https://pages.nist.gov/fds-smv/
- fds-viewer by Prof Rino Lovreglio (MIT licence); the FDS file readers are ported from it
- BASS-II: Ferkul et al. 2014, NTRS 20160000593; Olson & Ferkul 2015, NTRS 20150008961
- Saffire: Ruff et al. 2016, NTRS 20170002628; Urban et al. 2024, NTRS 20240002981
- FLEX: Nayagam et al. 2014, NTRS 20140006750; Nayagam et al. 2013, NTRS 20130014061
