# FIREFALL

**Human-in-the-loop agent collaboration across departments and companies, built for spacecraft fire safety.**

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
  the tokens each ask saved (≈544k across one review).
- **Knowledge bases that build as they talk.** Each agent keeps what it has learned and where every fact came from:
  an input file, a dataset, its own tool, another agent or a person. Later steps reuse those facts instead of the
  raw context.
- **People in the loop, with the lead as mediator.** Agents talk directly when they can settle something themselves.
  When they disagree (Materials endorses a change, Safety Assurance objects), the Review Lead puts both positions side
  by side and asks the engineer to decide. Agents can also hand physical work to people: the lab agent books a
  chamber test and a technician runs it.
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

**0 · Network.** Four organizations are on the network, each with its agents, models, compute, MCP tools and
datasets. Each card shows what the org exposes and what stays private. Another company can join by its agent card
URL; the demo connects a detector vendor.

| Org | Agent(s) | Runs on | Keeps private |
|---|---|---|---|
| **Vehicle team** (prime, you) | Review Lead, Materials, Simulation, Report | on-prem `hpc-01`, Claude via internal gateway | cabin CAD, supplier data, cost model |
| **NASA PSI archive** | PSI Archivist | GRC GPU cluster, self-hosted Llama 3.3 | raw camera frames, unpublished runs |
| **White Sands Test Facility** | WSTF Lab Agent + a technician | lab cluster, GPT-4.1 via agency cloud | LIMS records, procedures, other customers' results |
| **Independent S&MA** | Safety Assurance | FedRAMP agency cloud, Claude on Bedrock | review checklists, past findings |

**1 · Intake.** Real input files: `cabin.yaml` (atmosphere, gravity, volume, hatch, hull), `materials.csv` (part,
material, zone, amount) and `cabin.model.json` (the cabin geometry by zone). FIREFALL parses and cross-checks them,
for example a material with no zone in the model or an unknown material.

**2 · Plan.** The Review Lead proposes subtasks, each with its owning agent, what it reads and what it produces. You
switch optional steps off and approve. Nothing runs until you do.

**3 · Run.** One screen of panels:
- **Network:** live traffic through Lagrange. Cross-org lines are dashed. When the review is waiting on you, the
  question appears on your node.
- **Stage:** the cabin built from the model, with the materials, spread, pressure and what-if layers. Each layer
  unlocks when an agent produces it.
- **Agent:** one agent's workspace: data jobs on its org's compute, tool calls, and its knowledge base with sources.
- **Plan, Findings** (materials matrix, proposals) and **Comms**: every agent-to-agent message, with the tokens
  saved by asking.

What happens in the Apollo CM-012 example:
1. The Archivist processes Saffire-I, BASS-II and ACME on the PSI cluster into fitted limits. Materials *asks* it
   instead of reading the data.
2. Materials asks the WSTF agent for Test 1 history on PTFE. There is none, so the lab offers a slot and the Lead asks
   you whether to book it. The lab agent hands the job to the technician, who runs it, and the matrix updates.
3. Simulation asks Materials for burn rates, runs spread and pressure, and finds hull rupture at T+15 s against a
   90 s hatch.
4. Materials **proposes PR-1** (Beta cloth for nylon, 60/40 O₂/N₂ on the pad). Simulation re-runs it and endorses it;
   Safety Assurance objects with sources. The Lead mediates, and you accept, accept with the caveat, or reject.
5. Report writes the verdict and the hazard report.

**4 · Verdict.** Findings, the changes decided and by whom, collaboration stats (messages, cross-org lines, asks
answered by the owner, tokens saved, steps that needed a person), and `matrix.csv` and `hazard-report.md` exports.

## Demo vs real

The demo is a **scripted replay** of the same Lagrange events a live run produces, and it goes through the same fold,
so the UI is the same in both modes. **The data science is illustrative for now:** dataset jobs, fitted limits and
token savings are scripted to show *how* agents would use the PSI library. The spread and pressure model is a simple
zone model (Dijkstra spread and lumped pressure) tuned to the Apollo 1 record. It is for triage only and does not
replace Test 1, FDS or the review panel. Input parsing and cross-checks are real.

## Architecture

```
mates-end/
  web/      React 19 + Vite + TypeScript + Tailwind v4, React Flow (network, plan), Remotion + react-three-fiber (stage)
    public/examples/apollo-cm012/   cabin.yaml, materials.csv, cabin.model.json
    src/intake/   parse + cross-check the input files
    src/live/     Lagrange entry types, reducer, replay, store
    src/demo/     orgs, agents, people, the Apollo review script
    src/stage/    cabin, zone fire model, Remotion composition
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

Deep links: `?example=1` loads the Apollo case, `&start=1` starts the review straight away, and `&speed=4` plays faster.
Keys on the run screen: `1`–`6` focus a panel, `+`/`-` resize it, `h`/`l` switch agent, `a` answers with the
default option, and `?` lists the rest.

## Status

- [x] Network setup: four orgs with providers, compute, MCP servers, exposed and private lists; connect an agent by card
- [x] Intake from real files with cross-checks; plan approval
- [x] Run: cross-org asks, knowledge bases with sources, data jobs, lab work by a person, proposals with reviews,
      mediated decisions, token savings
- [x] Cabin stage (materials, spread, pressure, what-if) and verdict with exports
- [ ] Live agents on Lagrange (one per org, each with its own MCP servers and provider)
- [ ] Real dataset processing on the PSI library
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
