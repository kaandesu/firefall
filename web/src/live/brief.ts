// The brief a connected agent gets for a real review: its role, a short knowledge base, the input files,
// the steps to take with the firefall tools, and the report to hand back. The brief is scripted; the work is not.

export const KNOWLEDGE = `
- Apollo 1 (AS-204, command module CM-012), 27 January 1967, plugs-out test on the pad. The cabin held 100 % O₂ at
  16.7 psia. An electrical arc near the environmental control unit, low on the left side, started a fire. Nylon
  netting and Velcro carried it. The hull ruptured about 15 s after the crew's first report. The inward-opening
  hatch needed about 90 s. Three astronauts died.
- What NASA changed afterwards: 60 % O₂ / 40 % N₂ in the cabin on the pad, flammable materials removed or replaced
  (Beta cloth, Nomex), wiring protected, and a hatch that opens outward in seconds.
- NASA-STD-6001 Test 1 (upward flame propagation) is the screening test: a sample is lit from below at the worst
  atmosphere it will see, in Earth gravity. It passes if it self-extinguishes within 15 cm (6 in) and drops no
  burning debris. A material that fails can still fly after a configuration analysis (JSC 29353): small amounts,
  barriers, distance from ignition sources.
- Oxygen matters most. Raising O₂ makes nearly everything burn faster and makes "self-extinguishing" materials burn.
  Artemis plans an exploration atmosphere of 34 % O₂ at 8.2 psia.
- In microgravity there is no buoyancy. A flame lives on the ventilation flow. Some materials burn at lower O₂ in
  slow flow in microgravity than they do on Earth (BASS-II, Saffire). Smoke does not rise, so a ceiling detector
  can miss it, and very small smoke particles (PTFE, about 0.2 µm) are hard for photoelectric detectors to see (SAME).
- The limit of the evidence: no flight test in NASA's PSI archive ran above about 40 % ambient O₂. Anything said
  about a 100 % O₂ cabin is extrapolation from models. Say so wherever it applies.
- The tools are triage models, not certification. FDS here uses air cone-calorimeter data, so in pure O₂ it
  under-predicts: read its result as a lower bound.
`.trim()

const STEPS = `
1. get_cabin, to see what you are reviewing.
2. For each distinct material in the cabin: limiting_o2 and spread_rate at the cabin's O₂, pressure, gravity and vent flow.
3. nearest_tests at the cabin atmosphere. Note its warning if there is one.
4. fire_spread for the cabin as built.
5. fire_spread again with a fix you choose from what you found (another atmosphere, a material replaced, or both).
6. smoke_alarm at the cabin's gravity, with seconds 40.
7. droplet_burn at the cabin's O₂ with co2 0.25, to see whether a CO₂ flood would put a fire out.
8. run_fds with t_end 5 at the cabin's gravity, then fds_status with wait_s 120. If FDS is busy or missing, say so and go on.
9. search_report once, for a BASS-II passage that supports one of your findings.
`.trim()

const FORMAT = `
# Hazard report: <vehicle>

**Verdict:** one sentence. Would this cabin pass a fire-safety review, and why.

## 1. Materials
A table: material | where | limiting O₂ | burns here? | spread (mm/s).

## 2. Evidence
The closest real tests, and how far the cabin is from anything tested.

## 3. Fire spread and pressure
When the hull ruptures against how long the hatch takes. As built, then with your fix.

## 4. Detection
Time to first alarm, which sources are missed, and the better layout.

## 5. Suppression

## 6. FDS check
The run id, peak heat release, peak pressure, and what it means given the lower-bound caveat.

## 7. Recommended changes
Numbered, each with the number that supports it.

## 8. Limits of this review
`.trim()

export function reviewBrief(input: { request: string; cabinYaml: string; materialsCsv: string }): string {
  return `You are the fire-safety reviewer for a crewed spacecraft cabin. You work alone on this review and you have the
firefall tools (MCP). Do the work with the tools, then hand back a hazard report.

THE REQUEST
${input.request}

WHAT YOU KNOW
${KNOWLEDGE}

THE INPUT FILES (the tools already have this cabin loaded; these are for you to read)
--- cabin.yaml
${input.cabinYaml.trim()}
--- materials.csv
${input.materialsCsv.trim()}

WHAT TO DO, IN ORDER
${STEPS}

RULES
- Every number in the report must come from a tool result in this conversation. Do not invent or recall numbers.
- Do not ask me questions, edit files or run shell commands. If a tool fails, write that down and continue.
- Plain words, short sentences. The reader is an engineer in a hurry.

HAND BACK exactly this report in Markdown, and nothing before or after it:

${FORMAT}`
}
