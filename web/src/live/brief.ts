// The briefs a real review sends. Each department's subtask goes to the agent that fills that role, with its
// role, what it needs to know, the cabin, what the other departments found so far, its steps and the reply format.
// The briefs are scripted; the work is not.
import type { DesignPackage } from '@/demo/packages'

export type RoleId = 'archivist' | 'prevent' | 'sim' | 'detect' | 'suppress' | 'skeptic' | 'scribe'

const K = {
  apollo:
    'Apollo 1 (AS-204, CM-012), 27 January 1967, plugs-out test on the pad: 100 % O₂ at 16.7 psia. An electrical arc low on the left side started a fire; nylon netting and Velcro carried it; the hull ruptured about 15 s after the first report; the inward-opening hatch needed about 90 s. Afterwards NASA used 60 % O₂ / 40 % N₂ on the pad, replaced flammable materials (Beta cloth, Nomex) and fitted a quick-opening hatch.',
  test1:
    'NASA-STD-6001 Test 1 (upward flame propagation) screens materials at the worst atmosphere they will see, in Earth gravity. A sample passes if it self-extinguishes within 15 cm. A material that fails can still fly after a configuration analysis (JSC 29353): small amounts, barriers, distance from ignition sources.',
  o2: 'Oxygen matters most: raising O₂ makes nearly everything burn faster and makes "self-extinguishing" materials burn. Artemis plans 34 % O₂ at 8.2 psia.',
  ug: 'In microgravity there is no buoyancy, so a flame lives on the ventilation flow. Some materials burn at lower O₂ in slow flow in microgravity than on Earth (BASS-II, Saffire).',
  smoke: 'Without buoyancy smoke does not rise, so a ceiling detector can miss it. Very small smoke particles (PTFE, about 0.2 µm) are hard for photoelectric detectors to see; ionization detectors see them (SAME).',
  limit: 'No flight test in NASA’s PSI archive ran above about 40 % ambient O₂. Anything said about a richer cabin is extrapolation from models: say so.',
  flex: 'FLEX burned fuel droplets on the ISS with CO₂ and helium as suppressants. A flood only works if it brings the effective O₂ below the limiting O₂.',
  fds: 'FDS here uses air cone-calorimeter data, so in an oxygen-rich cabin it under-predicts: read its result as a lower bound. A 5-second run only shows the start of the fire.',
  triage: 'The tools are triage models, not certification.',
}

type RoleBrief = { name: string; does: string; knows: string[]; steps: string[]; reply: string }

export const ROLE_BRIEFS: Record<RoleId, RoleBrief> = {
  archivist: {
    name: 'PSI Archivist',
    does: 'You own the microgravity combustion test data and say how far it reaches.',
    knows: [K.limit, K.ug, K.triage],
    steps: [
      'search_studies at the cabin O₂ and pressure.',
      'nearest_tests at the cabin O₂ and pressure.',
      'nearest_tests again at 0.34 O₂ and 8.2 psia (the exploration atmosphere), to see what evidence a leaner cabin would have.',
      'search_report once, for a BASS-II passage about burning at low flow or low O₂.',
    ],
    reply: 'At most 6 short lines: the closest real tests, how far the cabin is from anything tested, and one BASS-II finding with its page number.',
  },
  prevent: {
    name: 'Materials agent',
    does: 'You judge whether each material in the cabin burns at the cabin atmosphere.',
    knows: [K.test1, K.o2, K.triage],
    steps: ['For each distinct material in the cabin: limiting_o2 at the cabin pressure, gravity and vent flow.', 'For each distinct material: spread_rate at the cabin O₂, pressure, gravity and vent flow.'],
    reply: 'One line per material: limiting O₂, burns or not, spread in mm/s. Then one line naming the worst material and why.',
  },
  sim: {
    name: 'Simulation agent',
    does: 'You show what a fire does in this cabin and find a change that stops it.',
    knows: [K.apollo, K.o2, K.fds, K.triage],
    steps: [
      'fire_spread with no arguments: the cabin as built.',
      'Choose one fix from the Materials findings (another atmosphere, materials replaced with nomex or teflon, or both) and run fire_spread with it. If the hull still ruptures, try one stronger fix.',
      'run_fds with t_end 5 at the cabin gravity, then fds_status with wait_s 120. If FDS is busy or missing, say so and go on.',
    ],
    reply: 'At most 6 short lines: as built (zones, rupture time, against the hatch time), your fix and its numbers, and what the FDS run showed with its run id.',
  },
  detect: {
    name: 'Detection agent',
    does: 'You check whether the designed smoke detectors would see a fire in time.',
    knows: [K.smoke, K.triage],
    steps: ['smoke_alarm at the cabin gravity with seconds 40.', 'smoke_alarm at g 0 with seconds 40, to see the same cabin in orbit.'],
    reply: 'At most 5 short lines: time to first alarm with the designed layout at each gravity, which sources are missed, and what the proposed layout gains.',
  },
  suppress: {
    name: 'Suppression agent',
    does: 'You check whether a CO₂ flood would put a fire out in this atmosphere.',
    knows: [K.flex, K.o2, K.triage],
    steps: ['droplet_burn at the cabin O₂ with co2 0.25.', 'droplet_burn at the cabin O₂ with co2 0.5.', 'droplet_burn at 0.34 O₂ with co2 0.5, to see whether a leaner cabin could be suppressed.'],
    reply: 'At most 4 short lines: does the flame go out in each case, and what that means for this cabin.',
  },
  skeptic: {
    name: 'Safety Assurance reviewer (independent)',
    does: 'You check the other departments’ findings and proposals. You are not on their team.',
    knows: [K.limit, K.fds, K.test1, K.apollo],
    steps: ['Read the findings and proposals below.', 'If a claim rests on evidence you doubt, call nearest_tests at the conditions the proposal would create.'],
    reply:
      'For each proposal listed in the findings, one line starting exactly "PR-1: ENDORSE" or "PR-1: OBJECT" (same for PR-2), followed by one sentence why. Then at most 3 lines of open items the report must carry.',
  },
  scribe: {
    name: 'Report writer',
    does: 'You write the verdict and the hazard report from the departments’ findings and the decisions people made.',
    knows: [K.apollo, K.limit, K.triage],
    steps: ['Use only the findings and decisions below. Do not call tools unless a number you need is missing.'],
    reply: `First line: "VERDICT: " and one sentence of at most 18 words that answers the request.
Then exactly three lines starting with "- ": the three facts that decide it, each with its number.
Then the report in Markdown with these sections, short sentences, a table where it helps:
## Materials
## Evidence and its limits
## Fire spread and pressure
## Detection
## Suppression
## FDS check
## Decisions
## Recommended changes
## Open items`,
  },
}

function cabinLines(pkg: DesignPackage): string {
  const mats = [...new Set(pkg.bom.map((b) => b.material))]
  return [
    `${pkg.vehicle}: ${pkg.atmosphere.label} (O₂ fraction ${pkg.atmosphere.o2}, ${pkg.atmosphere.psi} psia), gravity ${pkg.gravity.g} g, vent flow ${pkg.ventFlow} cm/s, volume ${pkg.volume}, crew ${pkg.crew}.`,
    `Hatch opens in ${pkg.hatch?.openTime ?? '?'} s (${pkg.hatch?.type ?? '?'}); the hull bursts at ${pkg.hull?.burstPsia ?? '?'} psia. Ignition: ${pkg.ignition.join('; ') || 'not listed'}.`,
    `Materials (tool ids): ${mats.join(', ')}. Parts: ${pkg.bom.map((b) => `${b.item} = ${b.material} in ${b.zone ?? b.location}`).join('; ')}.`,
    `Detectors: ${(pkg.sensors ?? []).map((s) => `${s.id} ${s.type} at ${s.zone}`).join(', ') || 'none'}.`,
  ].join('\n')
}

export function briefFor(role: RoleId, x: { request: string; pkg: DesignPackage; files: { cabin: string; materials: string }; findings: string }): string {
  const b = ROLE_BRIEFS[role]
  return `You are the ${b.name} on a fire-safety review of a crewed spacecraft cabin. ${b.does}
You have the firefall tools (MCP). They already have this cabin loaded.

THE REQUEST
${x.request}

THE CABIN
${cabinLines(x.pkg)}

WHAT YOU KNOW
${b.knows.map((k) => `- ${k}`).join('\n')}

FINDINGS SO FAR FROM THE OTHER DEPARTMENTS
${x.findings}

YOUR JOB, IN ORDER
${b.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

RULES
- Every number you report must come from a tool result in this conversation or from the findings above. Do not recall or invent numbers.
- Do not ask questions, edit files or run shell commands. If a tool fails, say so in one line and go on.
- Plain words. No preamble, no closing remarks.

REPLY WITH
${b.reply}`
}
