# FIREFALL: project summary

FIREFALL is a fire-safety design review for crewed spacecraft. Agents from several organisations work on the review together over **Lagrange**, an A2A agent network, and people make every decision that matters. It was built for **NASA Space Apps 2026: "Flame in Freefall"**. The worked example is the **Apollo Command Module CM-012**, the Apollo 1 cabin at 100 % O₂ and 16.7 psia.

Repo: github.com/kaandesu/firefall (branch `main`). The app is in `web/`.

---

## The idea in one paragraph

A real fire-safety review spans several organisations: the vehicle builder, the NASA data archive (PSI), a test lab (White Sands) and an independent safety office (S&MA). Each one has its own data, compute, tools and sign-off. In FIREFALL each organisation puts an **agent** on a shared network and keeps its data private. Agents ask the owner of the data instead of re-reading it, which is more accurate and saves tokens. They run simulations on their own organisation's hardware, propose design changes and review each other's work. When agents disagree, or when physical work is needed (a chamber test), they hand off to a **person**. The output is a hazard report you can question.

---

## Version history

| Commit | Version | What it added |
|---|---|---|
| `7c95799` | v1 | First scripted demo: Halo-style shell, PSI metadata snapshot, simple sims |
| `92f9c01` | v2 | Redesign around the product: a design-time fire-safety review instead of an incident viewer |
| `ba0d5c7` | v3 | One case built from real input files; Halo look |
| `7c20b5d` | v4 | Collaboration across organisations, with people in the loop |
| `3acfd8c` | v5 | Real data, a lab with live sims, smoke and sensor placement, a report with AI chat |
| `a7cf36d` | — | `FEATURE_PLAN.md`: the plan for v6 (not built yet) |

---

## What the app does today (v5)

### 0 · Network

There are four organisations, each with its own agents, LLM provider, compute, MCP tools and datasets. Each card shows what the organisation **exposes** and what stays **private**. You can connect another company's agent by pasting its agent card URL.

| Org | Agents | Runs on | Keeps private |
|---|---|---|---|
| Vehicle team (you) | Review Lead, Materials, Detection, Suppression, Simulation, Report | on-prem `hpc-01` (8×H100, Slurm), Claude | cabin CAD, supplier data, cost model |
| NASA PSI archive | PSI Archivist | `grc-gpu` (32×A100, Kubernetes), self-hosted Llama | raw camera frames, unpublished runs |
| White Sands Test Facility | WSTF Lab Agent + a technician | lab cluster + Test 1 chamber, GPT-4.1 | LIMS records, procedures |
| Independent S&MA | Safety Assurance | GovCloud, Claude on Bedrock | review checklists, past findings |

### 1 · Intake (real input files)

The app reads three input files and cross-checks them against each other, for example a material or detector placed in a zone the model doesn't have.
- **`cabin.yaml`:** atmosphere, gravity, volume, hatch, hull burst pressure, ignition zones and **smoke detectors**.
- **`materials.csv`:** part, material, MAPTIS-style rating, zone, quantity, distance to ignition.
- **`cabin.model.json`:** the cabin geometry by zone.

### Cabin intro

Before anything runs, the camera tours the 3-D cabin zone by zone. Each zone gets a card with its parts, materials and ratings. The listed ignition source pulses red and the detectors are shown. The tour ends on the atmosphere: 100 % O₂ · 16.7 psia · 1 g. Press Esc to skip it.

### 2 · Plan

The Review Lead proposes subtasks, each with its owning agent, its inputs and its outputs. You can switch optional steps off, then approve. Nothing runs until you do.

### 3 · Run (one screen of panels)

- **Network:** live message traffic between agents. Lines between organisations are dashed, and a question waiting for you shows on your node.
- **Stage:** the 3-D cabin as a Remotion composition, with these layers:
  - materials;
  - fire spread;
  - pressure against the hull limit;
  - **smoke**, from the smoke simulation, with the sensors turning red on alarm;
  - what-ifs.
- **Agent:** one agent's workspace: its jobs, tool calls, and knowledge base with sources.
- **Lab (replaced the Plan panel):**
  - the plan shown as chips;
  - every organisation's machines, with live GPU use;
  - a Slurm-like job queue;
  - **live tiles** for each job as agents start it:
    - real ACME camera frames being processed;
    - Saffire-style flame-spread duct;
    - a sweep of the oxygen level below which each material stops burning;
    - flames at microgravity vs 1 g;
    - smoke simulation at microgravity, Moon and 1 g;
    - sensor-placement search;
    - a droplet with CO₂;
    - the WSTF chamber test.
  - Press `p` for the full plan graph.
- **Findings:** the materials matrix and the proposals.
- **Comms:** every message between agents, with the tokens each ask saved.

### What happens in the Apollo CM-012 review

1. The **Archivist** processes Saffire-I, BASS-II and ACME into fitted burn limits. Other agents *ask* it rather than downloading the data, which saves about 730k tokens in one review.
2. **Materials** asks WSTF about Test 1 history for PTFE. There is none, so the lab offers a slot, you approve booking it, and the **technician** runs the test.
3. **Detection** asks for smoke particle sizes (SAME) and runs 18 smoke simulations. The designed detector layout misses 3 of 9 cases: there is no buoyancy in microgravity, and a photoelectric head can't see 0.18 µm PTFE smoke. Detection **proposes PR-2**, two ionization heads in new positions, which alarm in 9 of 9 cases (worst 25 s). Simulation endorses it and **you** decide.
4. **Simulation** runs fire spread and cabin pressure. The hull ruptures at **T+15 s**, but the hatch needs **90 s** to open.
5. **Suppression** checks FLEX data and runs a droplet with a 25 % CO₂ flood. At 100 % O₂ the flame keeps burning.
6. **Materials proposes PR-1**: Beta cloth instead of nylon, and 60/40 O₂/N₂ on the pad. Simulation endorses it and **Safety Assurance objects**, with sources. The **Review Lead** lays out both positions and **you decide**.
7. **Report** writes the verdict.

### 4 · Report (replaced the old verdict card)

- **Layout:** a table of contents on the left, the article in the middle and the **AI chat** on the right.
- **Summary:** "The review in 30 seconds" plus four headline numbers.
- **Twelve numbered sections:**
  1. Cabin and inputs, with a 3-D still.
  2. Materials, with the margin between each material's limiting O₂ and the cabin's O₂.
  3. Evidence and data processed:
     - real ACME frames and the brightness chart with detected events;
     - sensor log statistics;
     - the nearest test points;
     - the best-fitting studies.
  4. Fire spread and the pressure chart.
  5. Smoke detection and sensor placement: coverage maps for the designed and proposed layouts, and a time-to-alarm table for every source × gravity case.
  6. Suppression.
  7. The lab test.
  8. Decisions and who made them.
  9. What-ifs.
  10. Open items.
  11. How the review ran.
  12. Sources.
- **AI chat:** uses **OpenAI** through a dev-server route, `/api/ask`. The key stays server-side in `web/.env.local`. Answers come only from the report, and they **pull up** charts, matrix rows, test points and sections as clickable cards. Every section has an **Ask** button. A **demo** toggle switches to scripted answers built from the same data.
- **Exports:** `hazard-report.md`, `matrix.csv` and print to PDF.

### Tabs: Library · Evidence · Compute

The run keeps going in the background while you use these tabs.
- **Library:**
  - The 20 PSI studies (about 277 GB), ranked by how well they fit this cabin.
  - The ACME studies open their **real data**:
    - a frame scrubber against the brightness series;
    - 10 sensor channels;
    - a scatter of test points with the cabin marked.
- **Evidence:** 182 real test points with filters, sorting, a match score and a scatter. **Pinned** rows land in the report. It shows plainly that nothing in the archive was tested above 40 % ambient O₂.
- **Compute:** every organisation's servers, GPU pools and chamber, with live use.
  - **Add server / GPU farm** puts the new machine in the Lab panel.
  - **Connect an MCP server** to an agent runs a demo handshake and lists the discovered tools.

---

## What is real and what is illustrative

| Real (computed in the browser from files) | Illustrative |
|---|---|
| Input parsing and cross-checks | Saffire, BASS-II and FLEX fits (catalogue values; their raw data isn't public) |
| ACME **21256C2** camera events (ignition 41.2 s, steady 42.9 s, transient 48.1 s, glow 50.3 s), **19175A4** sensor stats, 182 evidence rows | Token savings per ask |
| **Smoke simulation** (2-D stable fluids on the cabin cross-section, in a Web Worker) and the **sensor optimiser** | Cluster names, GPU counts, job timings |
| Fire spread and pressure zone model, what-ifs | The agents' message wording (scripted replay) |
| Report chat via OpenAI, grounded in the report | Demo-mode chat answers |

The spread, pressure and smoke models are for triage only. They are not a substitute for Test 1, FDS or the review panel.

---

## Tech

- **App:** React 19, Vite 8, TypeScript 6, Tailwind v4 and zustand.
- **Graphics and charts:** React Flow, Remotion with react-three-fiber (stage, intro and lab sims), and react-markdown.
- **Architecture:**
  - Every task, message, tool call, knowledge fact, job and proposal is a **Lagrange activity entry**.
  - A pure `reduce(model, entry)` folds them, for both the scripted replay and the live SSE stream.
- **Tests:** vitest, 29 tests covering parsing, the ACME events, the fluid solver, the smoke study, physics and the report builder. Lint is oxlint. A headless Playwright walk runs the full flow with 0 console errors.
- **Data:** `scripts/extract-fif.mjs` pulls the real ACME data out of the flame-in-freefall app into `web/public/data/acme/` (1.2 MB).

### Key folders

```
web/src/
  intake/   input parsing + cross-checks
  live/     entry types, reducer, replay, store
  demo/     orgs, agents, people, compute nodes, the Apollo review script
  stage/    cabin, fire zone model, Remotion stage + intro
  lab/      smoke CFD, sensor optimiser (worker), lab tiles, three.js sims
  data/     ACME loaders + event detection, PSI library + fit, evidence
  report/   report as data, chat context, scripted answers
  screens/  Setup, Intake, Plan, Intro, Run, Report, Library, Evidence, Compute
web/server/ask.ts   OpenAI streaming route (dev server)
```

### Run it

```bash
cd web && pnpm install && pnpm dev      # http://localhost:5180
# optional: web/.env.local → OPENAI_API_KEY=...  (gitignored)
```

Deep links:
- `?example=1&start=1` loads the Apollo case and starts the review straight away.
- `&speed=4` plays faster.
- `&intro=0` skips the cabin intro.

---

## Next: v6 plan (in `FEATURE_PLAN.md`, not built yet)

1. **Real FDS run of Apollo CM-012.** Generate a valid `.fds` file from the cabin files, install NIST FDS locally, run it at 1 g and in microgravity, and ship the outputs.
2. **A simple FDS viewer**, ported from fds-viewer (MIT): geometry, playback of temperature and soot slices, and charts of heat release, pressure and detector alarms. A cross-check card compares FDS with FIREFALL's quick models.
3. **Real Saffire, BASS and FLEX numbers** taken from published NASA papers into cited tables. The flame-spread, oxygen-limit and droplet models get fitted to them.
4. **Inbox** for people:
   - every question, with answer and history;
   - a switch between you and the WSTF technician;
   - a final "Sign the hazard report" step.
5. **"Evidence" becomes "Test data"**, with a plain explanation of what the rows are and why they matter.
6. **MVP roadmap document:**
   - the engineer's real workflow;
   - how the data goes from paper tables to PSI downloads to video measurements to simple prediction models;
   - the architecture: data API, FDS worker, agents on Lagrange;
   - docker-compose deploy, and how your own agents join through `lagrange tunnel`.
