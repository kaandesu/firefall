# FIREFALL

**A fire-safety review team for crewed spacecraft and habitats.** Specialist AI agents, one per engineering
department, work together over an A2A network ([Lagrange](https://github.com/Three-Agent-Problem/agent2agency)).
They take a vehicle's design package and turn NASA's microgravity combustion research into the deliverables a
safety review panel asks for.

> Built for NASA Space Apps 2026: *Flame in Freefall*.

---

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

## What FIREFALL does

### Input: the design package

What the engineering team already has:

- **Cabin spec:** atmosphere (O₂ %, pressure), gravity (µg / Moon / Mars), free volume, ventilation flow.
- **Materials list:** each non-metal material, where it is used and how much.
- **Ignition sources:** batteries, avionics, heaters, O₂ generators.
- **Existing test data:** Test 1 results, if the team has them.
- **Layout (optional):** a 3D model of the cabin. The demo uses a simple box model.

### Output: what the safety review needs

- **Materials matrix.** Every material marked *passes*, *fails* or *needs retest* at the target atmosphere and
  gravity, with the PSI evidence behind each call and the oxygen margin.
- **Draft fire hazard report.** Hazard causes, controls (prevention, detection, suppression), verification methods and
  open items, with every claim cited.
- **Test requests.** Which materials to send to the test lab, and at which atmosphere.
- **Crew response card.** Short, evidence-backed actions for an alarm in this specific cabin.
- **Simulations.** Quick visual checks of how a flame, a smoke plume or flame spread behaves under the cabin's
  conditions, bounded between microgravity and 1 g data. They are labeled as triage, not certification.

### How it works

You give the package and a request to the **Review Lead** in chat, for example *"Review the PR-2 rover for the
Phase II safety review."* The lead publishes a plan and hands parts of it to specialist agents. Each agent stands for
a real engineering department:

| Agent | Department | Works from |
|---|---|---|
| Review Lead | Coordinates the review, asks you for decisions | — |
| Research | Finds and ranks relevant PSI investigations | all PSI combustion studies |
| Materials & Flammability | Material pass/fail at the target atmosphere and gravity | Saffire, BASS, BRE, CFI-G |
| Detection | Smoke types, particle sizes, detector placement | SAME, SAME-R, DAFT |
| Suppression | Extinguishing limits, CO₂ vs water mist, hidden "cool flames" | FLEX, FLEX-2, CFI |
| Simulation | Runs the visual models with the cabin's parameters | — |
| Safety Assurance | Independent reviewer: checks citations, flags claims outside the tested range | — |
| Report | Assembles the hazard report and the materials matrix | — |

**People stay in the loop:**
- **You (lead engineer)** approve the plan and make the trade-off calls, for example "keep 34% O₂, or lower it and
  lose pre-breathe time?". The review pauses until you answer.
- **The test lab** (for example White Sands Test Facility) is asked directly by the Materials agent when evidence is
  missing, such as "do you have Test 1 data for Nomex at 34%?". The lab answers or schedules a test.
- You can add more people and departments to the team.

### Why multi-agent (A2A) and not one chatbot

The real review is already split across departments and organizations. Each holds different data, and each has to
sign off on its own part. FIREFALL keeps that structure:

- **One agent per department.** Each has its own tools, data and context. On the Lagrange network they can sit in
  different organizations: the test lab's agent can answer from lab data the vehicle builder never sees.
- **Agents ask each other and ask people.** The Materials agent asks Detection a question, Safety Assurance challenges
  a claim, and the Lead escalates to you. That is how a review board works, and a single chat answer can't do it.
- **The conversation is the audit trail.** Every request, answer, approval and citation is a message on the network.
  The record shows who decided what and on which evidence, which is what a safety panel wants to see.
- **Scales with the program.** Adding a department or an organization means adding an agent to the network, not
  rewriting a prompt.

## Demo scenarios

| Scenario | Story |
|---|---|
| **PR-2 rover design review** (main) | Lunar pressurized rover at 34% O₂ / 8.2 psia. Materials matrix, a question to the test lab, a trade-off decision for you, and a draft hazard report |
| **Rover smoke alarm** | Operations case: an alarm in the aft avionics bay. Smoke or dust? What is burning? Then a crew response card |
| **Apollo 1 case file** | Would this review have flagged the 1967 cabin (100% O₂ at 16.7 psia) before the test? Yes: 7 of 7 cabin materials burn |

The demo is a scripted replay of the same events a live run produces, so it looks the same as live mode.

## Data and honesty

- **PSI metadata** for 24 combustion investigations is snapshotted from the public PSI API into
  `data/psi/investigations.json` (`node scripts/fetch-psi.mjs`). The raw datasets need a PSI login; downloaded ones go
  in `data/psi/<PSI-id>/`.
- **The physics models** are simplified engineering models (limiting O₂ vs flow, spread rate, d² droplet law, detector
  response by particle size), tuned to the trends reported by PSI investigations. They are for **triage**: they show
  what to test first. They do not replace Test 1, FDS fire modelling or the review panel.
- No partial-gravity fire data exists in PSI. Moon and Mars results are always shown as **bounded between µg and 1 g**.

## Architecture

```
mates-end/
  web/      React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui, three.js (react-three-fiber) for the sims
  data/psi/ public PSI metadata snapshot (+ downloaded datasets, not committed)
  scripts/  PSI snapshot script
  server/   (next) PocketBase + Gin: datasets, saved reviews, Lagrange proxy
  agents/   (next) fire-tools MCP server + one Claude Code agent per department, connected via `lagrange tunnel --acp`
```

Demo and live use one event model: every task, message, tool call and artifact is a Lagrange activity entry, and both
the replay and the live SSE stream go through the same fold.

## Run it

```bash
cd web
pnpm install
pnpm dev            # http://127.0.0.1:5180
```

Deep links: `?run=habitat|incident|apollo1&autoplay=1&speed=4`.

## Status

- [x] Scripted demo, three scenarios, PSI snapshot, four simulations
- [x] Product-focused UI: design package, team & network, materials matrix, test requests, hazard report, chat, light/dark
- [ ] Live agents on Lagrange (Claude Code over ACP + fire-tools MCP)
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
