# FIREFALL v6: real FDS run of the Apollo cabin, a simple FDS viewer, the inbox, real BASS / Saffire / FLEX numbers, MVP roadmap

## Context

The user wants FIREFALL to reflect what a working fire-safety engineer actually does, and to *mean* something.

What they asked for:
- **FDS.** Engineers use NIST FDS (firemodels/fds). `fds-viewer` (ProfRino, MIT) is a pure-browser three.js app that parses `.fds` input and reads FDS binary output: slices `.sf`, smoke `.s3d`, boundary `.bf`.
  - Build a simple version inside FIREFALL, showing the real Apollo CM-012 geometry, and make it actually work.
- **Human in the loop.** It isn't visible enough: add an **inbox**.
- **"Evidence".** It's unclear what it means: rename it and explain it.
- **Real data.** Use real numbers from **Saffire, BASS and FLEX**.
- **A path to a real MVP.** The user doesn't know ML or big data. They need to know what a real engineer would do, how deploying with Lagrange works, and how their own agents plug in.

Decisions (from the user):
- **FDS:** install real FDS locally and run the Apollo case for real.
- **Saffire / BASS / FLEX:** take the numbers from the published NASA/NTRS papers into cited tables.
- **Scope:** build the features this round, plus a written MVP roadmap. No backend or Docker yet.

Facts found:
- **fds-viewer** (`/Users/kaanyilmaz/Desktop/Programming/gits/fds-viewer`):
  - `js/fds-parser.js`: namelist records `&NAME … /`, quotes aware, MULT expansion.
  - `js/slice-reader.js`: Fortran records — 4-byte length, payload, length — with an endian check; header has quantity, short name, units and i1..k2; then a time record and data per frame.
  - `js/smoke3d-reader.js`: RLE frames.
  - `output-page.js`: groups `.sf` files via the `.smv` file.
  - `tests/make-test-sim.mjs`: writes valid `.sf` and `.smv` (a format reference).
- **Machine:** M1, 8 cores, 16 GB. No FDS, no Docker.
- **Lagrange** (`agent2agency/org/lagrange`):
  - A Go binary plus Postgres (`docker-compose.yml`).
  - It already has a **people inbox**.
  - Agents connect with `lagrange tunnel` (or `--acp claude-agent-acp`).

## A. Real FDS case for Apollo CM-012

1. **Generator `web/src/fds/toFds.ts`** (pure, with vitest). Inputs: `cabin.model.json`, `cabin.yaml` and `materials.csv` (reuse `parseCabin`, `parseMaterials`, `parseModel`, `toPackage` in `src/intake/parse.ts`). It writes a valid `.fds`:
   - **Header and mesh.**
     - `&HEAD CHID='apollo_cm012'`, `&TIME T_END=30`.
     - `&MESH` about 8 cm cells over the cone's bounding box; about 25k cells, so a few minutes to run.
   - **Atmosphere** from cabin.yaml:
     - `&MISC P_INF` = 16.7 psia in Pa.
     - Ambient O₂ about 100 % via `&SPEC` mass fractions.
     - `GVEC` from the gravity.
     - A second case with `GVEC=0` (µg) for the comparison.
   - **Geometry:**
     - The hull (cone) voxelised into stepped `&OBST`, closed so the cabin is a sealed volume. FDS then computes the pressure rise itself.
     - Every box and cylinder primitive becomes `&OBST`, with `SURF_ID` taken from its zone's material.
   - **Materials.** One `&SURF` per material: `HRRPUA` and `IGNITION_TEMPERATURE` (cited cone-calorimeter values), so flame spread between items *emerges* in FDS. Non-burnables are inert.
   - **Ignition.** A small burner `&VENT` in the listed ignition zone (wiring), on for a few seconds.
   - **Devices:**
     - Each `cabin.yaml` detector becomes a `&DEVC` with `QUANTITY='CHAMBER OBSCURATION'` and a smoke-detector `&PROP` (ionization or photoelectric).
     - Pressure and a thermocouple tree.
     - `&SLCF` temperature and soot at mid-plane `PBY=0`; smoke3d on.
2. **Install FDS** from github.com/firemodels/fds releases: the macOS arm64 installer, into `~/FDS`, no sudo. Then run both cases (1 g and µg) with `scripts/fds/run.sh` (OMP 4 threads). Keep `DT_SLCF` coarse so the outputs stay under ~15 MB.
3. **Ship the outputs** in `web/public/data/fds/apollo-cm012/`:
   - the `.fds`, `.smv`, `*.sf` and `*.s3d` files;
   - `_devc.csv`, `_hrr.csv`, `.out`;
   - a `manifest.json` with the FDS version, run time and cells.

   If the generated `.fds` fails, iterate until it runs cleanly (FDS `.out` errors are explicit).

## B. Simple FDS viewer (port from fds-viewer, MIT, attributed)

- **`web/src/fds/`:**
  - `namelist.ts`: parser for a subset (HEAD, TIME, MISC, MESH, OBST, VENT, SURF, MATL, REAC, SPEC, DEVC, PROP, SLCF), ported from `js/fds-parser.js`.
  - `slice.ts`: Fortran-record `.sf` reader, from `js/slice-reader.js`.
  - `smoke3d.ts`: RLE, from `js/smoke3d-reader.js`.
  - `smv.ts`: maps files to quantities and meshes (minimal).
  - `csv.ts`: devc and hrr.
  - Vitest coverage: round-trip a synthetic `.sf` (writer adapted from `tests/make-test-sim.mjs`), and parse the generated Apollo `.fds`.
- **New top-bar tab `FDS`** (`screens/FdsScreen.tsx`):
  - **Input:**
    - 3-D geometry from the parsed `.fds` (OBST boxes coloured by SURF, burner, detectors, mesh outline);
    - a mesh card (cells, resolution);
    - the `.fds` source with highlighting;
    - "download .fds — rerun it yourself".
  - **Output:**
    - a time scrubber and play;
    - the temperature or soot slice as a colormapped plane in 3-D, done like the `SmokeSlice` DataTexture in `stage/StageComp.tsx`;
    - smoke3d as stacked alpha planes;
    - charts: HRR, cabin pressure vs hull burst, and detector obscuration vs alarm threshold with alarm times;
    - a 1 g / µg switch.
  - **Cross-check card:** FDS vs FIREFALL's quick models (`stage/physics.ts` rupture time, `lab/smokeStudy.ts` alarm times). Where they agree and where they don't is the insight.
- **Wiring into the review:**
  - The Simulation agent submits the job "FDS · apollo_cm012 · hpc-01" (a new `SceneId` `'fds'`; the Lab tile plays the real output).
  - The report gets an "FDS check" sub-section in §4 and §5, with chat tag `[[chart:fds]]`.

## C. Real BASS / Saffire / FLEX numbers (published, cited)

- **`web/src/data/published/{bass,saffire,flex}.json`:** values from NTRS papers, found with WebSearch / web-fetch. Every row has `ref` (NTRS id, figure or table, page) and `how` (table, or digitised figure).
  - **BASS / BASS-II:** spread rate vs flow speed and O₂ for thin fuels (cotton-fibreglass, PMMA, Nomex), and the limiting O₂ vs flow.
  - **Saffire I–III:** large-sample spread rates, burn times and mass loss at about 20 cm/s and 21 % O₂ (cotton-fibreglass SIBAL, Nomex, PMMA), and the vehicle pressure and O₂ rise.
  - **FLEX / FLEX-2:** droplet extinction diameter and limiting O₂ with N₂, CO₂ and He dilution (heptane, decane, methanol).
- **Use, not decoration.** Extend `sims/models.ts`:
  - fit `spreadRate` and `limitingO2(flow)` to the BASS points, and the droplet limit to FLEX, with simple least-squares fits and reported residuals;
  - the Archivist's jobs report those fits;
  - the FDS `SURF` choices and the FDS spread speed are compared against BASS/Saffire spread at similar flow.
- **Library:** studies with published data get a "published data" view: the points, our fit, and the source refs.

## D. Inbox (human in the loop)

- **Store / model.** Keep a log of every ask to a person: who asked, the question, the context cards, the options, the answer, who answered and when. Today only `model.waiting` exists.
  - Add `humanAsks` in the reducer in `src/live/model.ts`, filled from the existing ask and answer entries.
- **Inbox tab with a badge count** (`screens/InboxScreen.tsx`):
  - **Open items:** answer here with options and a comment, calling `store.answer` (same path as the run screen).
  - **Done items:** the answer and the time.
  - **FYI items:** alarms and proposals.
  - **Persona switch, You ↔ WSTF technician.** The technician sees "Run Test 1 on PTFE at 100 % O₂" with a result form. In the demo it is pre-filled and auto-submitted unless the person enters values.
- **New final gate "Sign the hazard report"** (`apollo1.ts`): the report shows Draft until you sign, then "Signed by You · T+…".
- This mirrors Lagrange's own inbox, so the same UI maps 1:1 to live mode.

## E. "Evidence" → "Test data", explained

- **Rename** the tab and the report §3 wording.
- **Plain header:** "Each row is one real NASA burn test: the air it was in and whether it lit. We use them to see how close any real test is to your cabin. The closest had 40 % O₂; yours has 100 %, so every material verdict here is an extrapolation."
- **Add the published BASS / Saffire / FLEX points as rows** (a source column and the material), so it isn't just ACME gas flames.

## F. MVP roadmap doc: `mates-end/docs/mvp-roadmap.md`

Plain language, for someone new to ML and data. Contents:
1. **The engineer's real workflow:**
   - MAPTIS lookup;
   - Test 1 at the worst atmosphere;
   - on a fail, configuration analysis (JSC 29353);
   - FDS or zone modelling of the configuration;
   - detection and suppression;
   - the hazard report, then the safety review panel.

   Map each step to a FIREFALL feature, and say what is real today and what isn't.
2. **Data path:**
   - paper tables (now);
   - PSI downloads (with an account);
   - feature extraction jobs: flame-front tracking on BASS/Saffire video gives spread rate — computer vision, not deep learning;
   - surrogate models, explained simply: a Gaussian process or regression over (material, O₂, pressure, flow, g) → spread rate or limit, with uncertainty.
3. **Architecture for a working MVP:**
   - a `firefall-data` API (Python FastAPI: tables, fits, PSI files in object storage);
   - an `fds-worker` container (FDS plus a job queue);
   - agents as small A2A services with MCP tools, or Claude Code via `lagrange tunnel --acp`;
   - Lagrange plus Postgres.
4. **Deploy:**
   - one `docker-compose` (lagrange, postgres, web, data-api, fds-worker) on Coolify;
   - how the user's own agents join: Agents → New agent in Lagrange, run the tunnel command, and the agent appears in FIREFALL live mode (`?live=`).
5. **Milestones M1–M4,** with what is needed (PSI account, a server, Docker).

## Order

A (generator, install, run) → B (viewer + Lab/report hooks) → C (data tables + fits) → E → D → F → README update.
- After each part: `pnpm typecheck`, `rtk proxy pnpm lint`, `pnpm test`, a headless walk with screenshots, and **look at the screenshots**.
- Commit at the end, without a co-author line.

## Critical files

- **New:**
  - `web/src/fds/{toFds,namelist,slice,smoke3d,smv,csv}.ts` + tests
  - `scripts/fds/run.sh`
  - `web/public/data/fds/apollo-cm012/*`
  - `web/src/screens/{FdsScreen,InboxScreen}.tsx`
  - `web/src/data/published/*.json` + loaders
  - `docs/mvp-roadmap.md`
- **Changed:**
  - `live/{model,store,types}.ts`, `demo/apollo1.ts` (FDS job, sign-off gate)
  - `sims/models.ts` (fits)
  - `lab/tiles.tsx` (fds tile)
  - `screens/{TopBar,EvidenceScreen,LibraryScreen,ReportScreen}.tsx`, `report/build.ts`, `App.tsx`
  - `README.md`

## Verification

- **FDS:** both cases finish ("STOP: FDS completed successfully" in `.out`). Pressure, HRR and detector CSVs are non-empty.
- **Tests:**
  - the parser reads the generated `.fds`;
  - the slice reader reads a real `.sf` frame count and dims that match the `.smv`;
  - the published fits have residuals reported.
- **Headless walk:**
  - the FDS tab shows geometry, playback and charts;
  - the inbox answers a gate and the run proceeds;
  - the sign-off appears in the report.
- **Full-flow walk3:** no console errors.
