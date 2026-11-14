# FIREFALL v3: one case, Halo look, real inputs

## Context

The second redesign answered "who is this for" but lost the look and still hides what goes in. This plan reverses
four earlier decisions (recorded in project memory, to be updated after approval): **dark Halo terminal style**
instead of light/professional, **numbered panels with `+`/`-`** instead of tabs, **Apollo 1 only** instead of three
scenarios, and a **node graph** instead of the team orbit.

## Honest critique of what exists

| Problem | Where | Why it hurts |
|---|---|---|
| Inputs are invisible | `demo/packages.ts` is a hard-coded object; the UI starts from a chat prompt | An engineer can't see what they would hand over, so the product reads as a chatbot |
| No gate before work | `demo/apollo1.ts` publishes the plan with `approved: true` | The one moment the human matters is skipped |
| 8 tabs, one visible at a time | `components/shell/CenterPanel.tsx` | You never see team, sim and result together; "Follow the run" yanks you around |
| Evidence tab has no job | `views/EvidenceView.tsx` | It is a PSI browser with ranked/compare/coverage sub-tabs, unattached to any finding. Citations belong on the claim they support |
| Sims float in a void | `sims/*.tsx`, four abstract scenes | A flame on a black background says nothing about *this* cabin |
| Text-first | `GuideView`, `OverviewView`, `ReportView` | Paragraphs by default; nothing reads in one glance |
| Team view shows no traffic | `LeftPanel.tsx` roster + 2D network | A2A is the differentiator and it is the least visible thing |

Two things I'd push back on:

- **Apollo 1 burned at 1 g on the pad.** The challenge is *Flame in Freefall* and PSI is microgravity data. An
  Apollo-only demo invites "where is the microgravity?". Fix: the last beat of the run re-runs the same cabin in µg
  and at 34 % O₂ / Moon g (the existing "bridge" step), shown on the same 3D stage with a gravity switch.
- **Remotion is timeline-driven, so it fits sim playback, not live state.** Use it for the centre stage (scrubbable,
  deterministic, and the same composition renders the submission video). The live A2A graph stays React Flow.

## The flow: four screens, one case

```
 1 INTAKE ──▶ 2 PLAN ──▶ 3 RUN ──▶ 4 VERDICT
 drop files    approve     watch      one card + exports
```

### 1. Intake
Three file slots plus one request line. "Load example: Apollo CM-012" fills them.

| Slot | Example file (`web/public/examples/apollo-cm012/`) | Contents |
|---|---|---|
| Cabin spec | `cabin.yaml` | O₂ %, pressure, gravity, volume, vent flow, crew, ignition sources, hatch type and open time |
| Materials list | `materials.csv` | part, material, MAPTIS-style rating, zone, quantity, distance to nearest ignition source |
| Cabin model | `cabin.model.json` | primitives (cone shell, 3 couches, lower equipment bay, ECU, hatch, wire runs), each a named zone |

Each slot shows a parsed summary, not the file: `100 % O₂ · 16.7 psia · 1 g`, `7 materials · 7 mapped to zones`,
a small 3D thumbnail. A validation line flags unmapped rows. Click a slot to see the raw rows.

### 2. Plan
The lead's plan as a node graph: one node per subtask (agent, model, which input it reads, what it produces), edges
are dependencies. Approve, or switch a subtask off first. Nothing runs before approval.

### 3. Run (Halo layout)

```
 ● FIREFALL  apollo-cm012  running  2/5                                    6 online  0:41
┌ 1 NETWORK ───────────┐┌ 2 STAGE · CM-012 ───────────────────┐┌ 3 AGENT @sim ────────┐
│ nodes + live edges   ││ 3D cabin, sim layers, time scrubber ││ tool calls, one line │
│ Lagrange as hub      ││ T+0 ──●──────────── T+15 s          ││ each, enter expands  │
└──────────────────────┘└─────────────────────────────────────┘└──────────────────────┘
─ 4 PLAN 2/5 ▸ ──────────── 5 FINDINGS 7/7 burn ▸ ───────────────────────────────────────
┌ 6 COMMS  agent ⇄ agent ────────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────────────────────┘
 › ask the lead…                              1-6 panel  +/- size  enter open  a answer
```

- Three panels open, two as one-line bars, comms as a strip. `1`–`6` focus, `+`/`-` step a panel through
  bar → normal → column → full, exactly like Halo. Mouse works too.
- **Network**: React Flow, ported from Lagrange's own graph (packets on edges while a task is in flight, amber pulse
  when someone waits on a human, question callout above the node with the answer buttons in it).
- **Agent**: workspace of the selected agent, defaults to Simulation; `h`/`l` switch agents.
- **Findings**: the materials matrix. Each row is one line (part, status, O₂ margin); expanding it shows the action
  and its citation chips. This replaces the Evidence tab.

### The stage: sims inside the cabin

One 3D scene built from `cabin.model.json`. Layers, each answering one engineer question:

| Layer | Question | Shown as |
|---|---|---|
| Materials | What in here burns? | Zones tinted pass / retest / fail (default view) |
| Spread | How fast does it take the cabin? | Flame front from the ECU wiring across netting and Velcro, zones light up in order |
| Pressure | Could the crew get out? | Cabin pressure against hull burst and the hatch-open time |
| What-if | What would have changed it? | Same run at 60/40 O₂/N₂ (the real fix), then µg and 34 % / Moon g |

A scrubber runs T+0 to rupture. Readout stays to three numbers; details on click.

### 4. Verdict
One card, like Halo's run summary: headline, three numbers, what the tool would *not* have caught (the hatch),
exports (matrix CSV, hazard report).

## Build

**Slice 1 (the demo):** intake, plan approval, run screen with network + stage (materials and spread layers) +
agent + comms, verdict card.
**Slice 2:** pressure and what-if layers, Remotion-rendered submission video, a scripted A2A explainer on the intake
page (the OpenStack `LaunchFlow` idea), keyboard help.
Rover scenarios are hidden from the UI, not deleted.

| Area | Change | Reuse |
|---|---|---|
| Theme | Dark tokens, mono type, box-frame panels, message-kind colours | `git show 7c95799:web/src/index.css` |
| Phases | `phase: intake \| plan \| run \| done` in `live/store.ts`; drop `tab`/`follow`/`seen` | existing replay + fold in `live/` unchanged |
| Inputs | `web/src/intake/` parsers → existing `DesignPackage`; add `zone` to `BomItem` | `demo/packages.ts` `computeMatrix` |
| Plan gate | `demo/apollo1.ts`: publish unapproved, then `askHuman`, then approve | `Script.askHuman`, `components/AskHuman.tsx` |
| Panels | `components/shell/Panels.tsx`: size steps + key handling | sizing rules from Halo `internal/tui/panes.go` |
| Network | `views/NetworkView.tsx`, node + edge | `lagrange/web/src/features/graph/{AddressNode,FlowEdge,layout}.tsx` |
| Plan graph | `views/PlanGraph.tsx` | same node styling, dagre layout |
| Stage | `stage/Cabin.tsx` (primitives from JSON), `stage/layers/*`, `stage/Stage.tsx` (`@remotion/player` + `ThreeCanvas`) | physics from `sims/models.ts` (`spreadRate`, `limitingO2`); player wiring from `studyextravaganza/web/src/features/study/companions/Video.tsx` |
| Removed from UI | `GuideView`, `OverviewView`, `EvidenceView`, `CenterPanel` tabs, `LeftPanel`, light theme | PSI data in `data/psi.ts` stays, feeds citation chips |

New deps: `@xyflow/react`, `@dagrejs/dagre`, `remotion`, `@remotion/player`, `@remotion/three` (pinned to one exact
version; confirmed compatible with fiber 9 / React 19), `yaml`.

**Risks**
- Stage sims must be a pure function of the frame (no `useFrame`), so the existing clock-driven scenes are rewritten,
  not wrapped. Free-orbit camera inside the Remotion player is unproven: spike it first; fallback is preset camera
  angles while playing and orbit only when paused.
- The pressure model is a new lumped estimate. It is labelled illustrative and checked against the Review Board
  timeline (rupture about 15 s after the first fire call).
- Remotion's licence is free for teams of up to three; fine for the hackathon.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test` in `web/`; new unit tests for the three parsers and the zone mapping.
- `pnpm dev`, then in the browser: load the example, check each slot summary, approve the plan, confirm nothing ran
  before approval, watch packets move on the network during delegation, scrub the stage, grow/shrink every panel
  with `+`/`-`, open a matrix row and follow a citation chip, reach the verdict card.
- Glance test: a screenshot of the run screen at 1440×900 must show who is working, what is burning and how far the
  run is without scrolling or clicking.

## After approval
Update project memory `project-fire-control.md` with the reversed UI direction and the Apollo-only scope.
