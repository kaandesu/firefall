# FIREFALL: from demo to a working MVP

This page explains what FIREFALL does today, what is real and what is still staged, and the steps to a version a
real fire-safety engineer could use. It is written for someone new to machine learning and data pipelines.

---

## 1. The engineer's real workflow, and where FIREFALL fits

A NASA materials and fire-safety engineer who gets a new cabin design works through roughly these steps. The table
shows the FIREFALL feature for each one and how real it is today.

| # | What the engineer does | FIREFALL feature | Real today? |
|---|---|---|---|
| 1 | **MAPTIS lookup:** check every material on the bill of materials against NASA's materials database (MAPTIS) for a Test 1 result at the cabin's atmosphere. | Intake (`materials.csv`) → Materials agent → materials matrix | Partly. The matrix is computed from the files. The Test 1 column is MAPTIS-*style*, not a live MAPTIS query (MAPTIS needs NASA access). |
| 2 | **Test 1 at the worst atmosphere:** any material without a result is burned in NASA-STD-6001 Test 1 (upward flame propagation) at the worst-case O₂ and pressure. | Lab job → WSTF technician's inbox → result form → matrix update | The flow is real: a person gets the job, fills in burn lengths, and the matrix updates. The burn lengths in the demo are scripted. |
| 3 | **Configuration analysis (JSC 29353):** a material that fails can still fly if the *configuration* stops a fire spreading: small amounts, barriers, distance from ignition sources. | Fire spread + pressure zone model, what-ifs, proposals (PR-1) | Real, simple model: it runs in the browser from `cabin.model.json`. It is triage, not a certified analysis. |
| 4 | **FDS or zone modelling of the configuration:** for a serious case, run a CFD fire model (NIST FDS) of the cabin. | FDS tab, `j-fds` job, report §4 "FDS check" | **Real FDS 6.11.1 output.** The case is generated from the same files (`toFds.ts`), run with `scripts/fds/run.sh`, and shipped in `web/public/data/fds`. The viewer reads the real `.sf`, `.s3d` and `.csv` files. |
| 5 | **Detection and suppression:** will smoke detectors see the fire in time, in µg where smoke does not rise? Will the extinguisher put it out? | Smoke CFD + sensor placement (PR-2), droplet/CO₂ model, FDS detector check | Smoke CFD and sensor search are real (2-D, in a Web Worker). FDS adds a 3-D check with real detector models. Suppression is a simple model fitted to FLEX. |
| 6 | **The hazard report, then the safety review panel:** a signed report goes to the panel (for ISS payloads, the Payload Safety Review Panel). | Report (13 sections, exports, AI chat) → "Sign the hazard report" in your inbox → *Signed by You* | Real: the report is built from the run, shows *Draft* until a person signs, and the chat only answers from it. There is no real panel hand-off yet. |

**What FIREFALL does not do:** it does not replace Test 1, a certified FDS analysis, or the review panel. It gets an
engineer to the right questions faster, with every number traced to its source.

---

## 2. The data path

Where the numbers come from, from what we have now to what an MVP needs.

### Stage 1, now: tables from published papers

NASA publishes the main results of its flight experiments in papers on the NASA Technical Reports Server (NTRS). We
read the numbers out of those papers by hand and keep them in small JSON tables:

- `web/src/data/published/bass.json`: BASS-II, solid fuels in slow air flow (PMMA rods, a cotton-fiberglass strip);
- `web/src/data/published/saffire.json`: Saffire IV–VI, large fabric and PMMA fires inside cargo ships;
- `web/src/data/published/flex.json`: FLEX, fuel droplets in different O₂ and diluent mixes.

Every row records **which paper** (`ref`, with its NTRS number), **where in the paper** (`where`: a table, a page, a
figure) and **how it was read** (`how`: table, text, or derived). Nothing is invented. The weakness is that there are
only a few dozen points, and some are read from figures.

We then **fit** our simple models to those rows (`web/src/sims/fits.ts`) using ordinary least squares, the same maths
as drawing the best straight line through points. We always report the error before and after. Example: our
limiting-O₂ model said a PMMA rod in 1.4 cm/s flow at 0 g needs 20 % O₂, but BASS-II saw it burn at 13.6 %. So the
model was *non-conservative* (it said "safe" where it was not), and the fit corrects that.

### Stage 2: PSI downloads (needs an account)

NASA's Physical Sciences Informatics system (PSI, psi.nasa.gov) holds the raw data of these experiments: videos,
sensor logs, test matrices. Downloads need a free account. With an account:

- download each study into object storage (S3-compatible, e.g. MinIO on the same server);
- keep a manifest per study: files, sizes, checksums, and which test each file belongs to.

### Stage 3: feature extraction jobs

Raw video is not a number. A **feature extraction job** turns it into one. For BASS and Saffire, the key quantity
is the **flame spread rate**: how fast the flame front moves along the sample.

This is classic **computer vision**, not deep learning:

1. read the video frames;
2. find the bright flame region in each frame (threshold on brightness, as FIREFALL already does for the ACME frames);
3. track the leading edge of the flame from frame to frame;
4. the slope of edge position against time is the spread rate, in mm/s.

Each job writes one row per test: material, O₂, pressure, flow speed, gravity, spread rate, plus a confidence. The
Archivist agent runs these jobs on its own org's compute. Other agents ask it for the result instead of
downloading 38 GB of video.

### Stage 4: surrogate models

A **surrogate model** is a fast stand-in for experiments you cannot run for every case. You give it the conditions
and it predicts the outcome *with an error bar*.

- **Inputs:** material, O₂ fraction, pressure, flow speed, gravity.
- **Outputs:** spread rate, or the limiting O₂ (below it the flame dies).
- **Method:** start with plain regression on physically sensible features, as `fits.ts` does today. Then move to a
  **Gaussian process**, which interpolates between measured points and gives an uncertainty that grows as you move
  away from the data.

That uncertainty is the point. FIREFALL's Apollo cabin is at 100 % O₂, and no PSI test reaches that. A Gaussian
process says so with a large error bar, instead of quietly extrapolating.

---

## 3. Architecture for a working MVP

```
            ┌──────────── browser ────────────┐
            │  FIREFALL web (React, this repo)│
            └──────┬───────────────┬──────────┘
                   │ SSE + REST    │ REST
            ┌──────▼──────┐  ┌─────▼──────────────┐      ┌───────────────┐
            │  Lagrange   │  │  firefall-data     │◄────►│ object store  │
            │ (agent hub) │  │  FastAPI (Python)  │      │ PSI files,    │
            └──┬───────┬──┘  └─────┬──────────────┘      │ FDS outputs   │
               │       │           │ job queue           └───────────────┘
        ┌──────▼─┐  ┌──▼─────┐  ┌──▼──────────┐
        │Postgres│  │ agents │  │ fds-worker  │
        └────────┘  │ A2A+MCP│  │ FDS 6.11.1  │
                    └────────┘  └─────────────┘
```

- **FIREFALL web:** this repo. In live mode (`?live=<lagrange url>`) the same screens read Lagrange's real activity
  stream instead of the scripted replay. The same reducer (`live/model.ts`) handles both, so nothing changes in the UI.
- **firefall-data** (new, Python FastAPI). It serves:
  - the published tables and the fits;
  - the PSI manifests and feature-extraction results;
  - run requests for FDS.

  Python, because the science tooling (numpy, scipy, scikit-learn, OpenCV) lives there.
- **fds-worker** (new). A container from `openbcl/fds:6.11.1`, already tested on a 4 GB Ubuntu VM, plus a tiny job
  runner:
  - `POST /runs` with a `.fds` file returns a run id; FDS runs one job at a time, with caps on cells and simulated time.
  - Outputs go to a shared volume or the object store; `GET /runs/:id` returns its status and file list.
  - The FDS tab then loads them exactly as it loads the shipped run today.
  - Expect the Apollo case (51,200 cells, 30 s) to take about 5–10 minutes on 2 vCPU.
- **Agents.** Each org's agent is a small **A2A** service (the Agent2Agent protocol) with its own **MCP** tools: the
  Archivist has the PSI and fit tools, Simulation has `write_fds` and `run_fds`, WSTF has the lab records. An agent
  can also be **Claude Code on someone's laptop**: `lagrange tunnel --acp` connects it to the hub without opening any
  ports.
- **Lagrange + Postgres.** Lagrange routes tasks and messages between agents and people, and records every one as an
  activity entry. Postgres stores them. That record is the audit trail behind the hazard report.

---

## 4. Deploy

One `docker-compose.yml` on a single server, managed with Coolify:

```yaml
services:
  postgres:   { image: postgres:16, volumes: [pg:/var/lib/postgresql/data] }
  lagrange:   { image: <lagrange image>, depends_on: [postgres], environment: [DATABASE_URL=...] }
  web:        { build: ./web }                      # static build + /api/ask and /api/lagrange proxy
  data-api:   { build: ./server/data, volumes: [runs:/runs, psi:/psi] }
  fds-worker: { image: openbcl/fds:6.11.1, entrypoint: ["/runner"], volumes: [runs:/runs], deploy: { resources: { limits: { cpus: "2", memory: 3g } } } }
volumes: { pg: {}, runs: {}, psi: {} }
```

- Coolify handles TLS, domains and restarts. Secrets (the OpenAI key, the Lagrange key) go in Coolify's
  environment, never in the image.
- The public demo keeps working with no backend: the scripted replay and the shipped FDS run are static files.

**How your own agent joins:**

1. In Lagrange, go to **Agents → New agent** and give it a name and the org it belongs to.
2. Run the tunnel command it shows (`lagrange tunnel --acp ...`) on the machine where your agent (or Claude Code) runs.
3. Open FIREFALL with `?live=<your lagrange url>`. The agent appears in the network panel. Tasks sent to it, its
   tool calls and its answers show up live, and people's decisions land in the Inbox.

---

## 5. Milestones

| Milestone | What it delivers | What it needs |
|---|---|---|
| **M1 · Live loop** | One real agent (Simulation, Claude Code via `lagrange tunnel --acp`) takes the P3 task in live mode, calls a real `write_fds` tool, and its result lands in the report. Inbox decisions go back through Lagrange. | A server with Docker; Lagrange + Postgres in compose; an Anthropic or OpenAI key |
| **M2 · FDS on the server** | `fds-worker` in compose. "Re-run in FDS" from the FDS tab or from an agent; results stream into the viewer. Runs are capped (cells, time, one at a time). | The same server (4 GB is enough for the Apollo case; 8 GB for finer meshes) |
| **M3 · Real data pipeline** | PSI downloads into the object store; the spread-rate extraction job on BASS-II and Saffire video; `firefall-data` serves the results; the fits use hundreds of points instead of a dozen. | A PSI account; about 100 GB of storage; a few CPU-hours per study |
| **M4 · Surrogates + review hand-off** | A Gaussian-process surrogate per material class, with error bars shown in the matrix and report; a signed-report export in the review panel's format; saved reviews. | M3's data; review by a materials engineer (WSTF or JSC) of the matrix logic and wording |

**Asks right now:**

- a PSI account (free) for M3;
- the Saffire I–III spread-rate paper (Urban et al. 2019, *Combustion and Flame*, paywalled), for more spread points;
- `brew install poppler`, so figures in the NTRS PDFs can be rendered and digitised, not only their text.
