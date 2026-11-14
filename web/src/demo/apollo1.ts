// Case file: Apollo 1 (AS-204), 27 January 1967. Replays the fire, runs the materials-vs-atmosphere
// analysis the crew would have run at design review, then applies the same check to Artemis base camp.
// Sources: Apollo 204 Review Board (NASA), JSC Roundup 1967, Space.com retrospective.
import { Script } from '@/live/script'
import { MATERIALS, limitingO2, pct, spreadRate, spreadVsEarth } from '@/sims/models'
import { HUMAN } from './crew'
import { PACKAGES, computeMatrix } from './packages'

const BOARD = { label: 'Apollo 204 Review Board', url: 'https://www.nasa.gov/missions/apollo/apollo-1/apollo-204-review-board-summary/' }
const ROUNDUP = { label: 'JSC Roundup, 3 Mar 1967', url: 'https://historycollection.jsc.nasa.gov/JSCHistoryPortal/history/roundups/issues/67-03-03.pdf' }
const SPACECOM = { label: 'Space.com retrospective', url: 'https://www.space.com/nasa-apollo-1-fire-55-years-orion-moon-return' }

const CABIN = ['cotton', 'nylon', 'pmma', 'nomex', 'silicone', 'kapton', 'teflon'] as const
const ATMS = [
  { id: 'apollo', label: 'Apollo 1 pad', o2: 1, psi: 16.7, g: 1 },
  { id: 'iss', label: 'ISS / Orion', o2: 0.21, psi: 14.7, g: 0 },
  { id: 'base', label: 'Base camp', o2: 0.34, psi: 8.2, g: 0.165 },
]

export function apollo1() {
  const s = new Script('run-a1')
  const burns = Object.fromEntries(ATMS.map((a) => [a.id, CABIN.filter((m) => spreadRate(a.o2, 10, a.g, a.psi, MATERIALS[m]) > 0)])) as Record<string, string[]>
  const cottonX = spreadVsEarth(1, 10, 1, 16.7, MATERIALS.cotton)
  const nomexLimBase = limitingO2(10, 0.165, 8.2, MATERIALS.nomex)

  s.start(
    'Case file · Apollo 1 (AS-204)',
    'case',
    { mission: 'Apollo 1 · AS-204', date: '27 Jan 1967', atmosphere: '100 % O₂ · 16.7 psia', gravity: '1 g (launch pad)' },
    'Open case file: Apollo 1. Reconstruct what happened, show whether a materials-vs-atmosphere review would have caught it, and apply the lesson to Artemis base camp.',
  )
  s.wait(0.4).caseFile({
    title: 'Apollo 1 (AS-204) cabin fire',
    when: '27 January 1967',
    where: 'Launch Complex 34 · plugs-out countdown test',
    atmosphere: '100 % O₂ at 16.7 psia — about 5× the O₂ partial pressure of sea-level air',
    summary: 'A fire broke out during a ground test and killed Gus Grissom, Ed White and Roger Chaffee. It led NASA to rethink cabin atmospheres, materials and hatches.',
  })
  s.wait(1.0).tool('flight', 'publish_plan', { subtasks: 5 }, { ok: true }, 0.5)
  s.wait(0.3).publishPlan({
    goal: 'Apollo 1: reconstruct, test the materials-vs-atmosphere check, bridge to base camp',
    approved: true,
    subtasks: [
      { id: 'C1', title: 'Reconstruct the timeline from the Review Board', agent: 'archivist', model: 'haiku', status: 'pending', pillar: 'cross' },
      { id: 'C2', title: 'Which cabin materials burn at 100 % O₂?', agent: 'prevent', model: 'sonnet', deps: ['C1'], status: 'pending', pillar: 'prevention' },
      { id: 'C3', title: 'Show the flame: 100 % O₂ vs air', agent: 'sim', model: 'haiku', deps: ['C2'], status: 'pending', pillar: 'cross' },
      { id: 'C4', title: 'Scope check: what PSI can and cannot say', agent: 'skeptic', model: 'opus', deps: ['C2', 'C3'], status: 'pending', pillar: 'cross' },
      { id: 'C5', title: 'Verdict + base-camp bridge', agent: 'scribe', model: 'sonnet', deps: ['C4'], status: 'pending', pillar: 'cross' },
    ],
  })

  // C1: timeline
  s.wait(0.5).sub('C1', { status: 'running' }).task('t-c1', 'flight', 'archivist', 'C1 · Reconstruct the timeline from the Review Board')
  s.wait(0.6).tool('archivist', 'psi_search', { q: 'Apollo 204 review board findings', scope: 'NASA history' }, { hits: 3, primary: 'Apollo 204 Review Board report' }, 1.0)
  s.wait(1.2).caseItem({ id: 'e1', when: 'Test setup', kind: 'event', text: 'Plugs-out countdown test on the pad. Cabin filled with 100 % O₂ at 16.7 psia — slightly above ambient, to keep air out.', source: BOARD })
  s.wait(1.2).caseItem({ id: 'e2', when: 'Ignition', kind: 'cause', text: 'Most probable ignition source: an electrical arc near cabin wiring.', source: BOARD })
  s.wait(1.2).caseItem({ id: 'e3', when: 'Fuel', kind: 'cause', text: 'Many combustibles sat next to ignition sources — nylon netting, Velcro patches, foam pads.', source: ROUNDUP })
  s.wait(1.2).caseItem({ id: 'e4', when: 'Seconds', kind: 'event', text: 'In pure O₂ the fire spread through the cabin within seconds; internal pressure rose until the hull ruptured.', source: BOARD })
  s.wait(1.2).caseItem({ id: 'e5', when: 'Egress', kind: 'event', text: 'The inward-opening inner hatch could not be opened against cabin pressure before rupture. Emergency egress was impossible.', source: BOARD })
  s.wait(1.2).caseItem({ id: 'e6', when: 'Aftermath', kind: 'response', text: 'Board: severely restrict and control combustibles. NASA redesigned the hatch to open outward quickly, swapped in self-extinguishing materials and ended pure-O₂ cabins on the pad.', source: SPACECOM })
  s.usage('archivist', 0.02, 0.28)
  s.wait(0.6).say('archivist', 'flight', 'reply', 'Timeline rebuilt: 6 entries from the Review Board and NASA history. Root combination = pure O₂ + combustibles + ignition + no egress.', undefined, 't-c1')
  s.wait(0.2).state('t-c1', 'completed').sub('C1', { status: 'done' })

  // C2: materials vs atmosphere
  s.wait(0.6).sub('C2', { status: 'running' }).task('t-c2', 'flight', 'prevent', 'C2 · Which cabin materials burn at 100 % O₂?')
  s.wait(0.6).tool('prevent', 'flammability_map', { atmosphere: '100 % O₂ · 16.7 psia', g: 1, materials: CABIN }, { sustainFlame: `${burns.apollo.length}/${CABIN.length}`, list: burns.apollo }, 1.8)
  s.wait(0.3).tool('prevent', 'flammability_map', { atmosphere: '21 % O₂ · 14.7 psia', g: 1, materials: CABIN }, { sustainFlame: `${burns.iss.length}/${CABIN.length}`, list: burns.iss }, 1.6)
  s.usage('prevent', 0.04, 0.3)
  s.wait(0.2).matrix(computeMatrix(PACKAGES.apollo1, [{ id: 'PSI-159' }, { id: 'PSI-20' }]))
  s.wait(2.2).note('prevent', `At 100 % O₂ every material on the list exceeds its limiting O₂ — even Teflon (≈ 95 %) is marginal. Cotton spreads ≈ ${cottonX.toFixed(0)}× faster than in air.`)
  s.wait(0.6).say('prevent', 'sim', 'ask', 'Show it: flame at 100 % O₂ / 16.7 psia / 1 g next to normal air. Then cotton spread.')
  s.wait(0.4).say('prevent', 'flight', 'reply', `${burns.apollo.length} of ${CABIN.length} cabin materials sustain flame at 100 % O₂, vs ${burns.iss.length} of ${CABIN.length} in air. A design-review check flags this before the first test.`, undefined, 't-c2')
  s.wait(0.2).state('t-c2', 'completed').sub('C2', { status: 'done' })

  // C3: sims
  s.wait(0.4).sub('C3', { status: 'running' }).task('t-c3', 'flight', 'sim', 'C3 · Show the flame: 100 % O₂ vs air')
  s.wait(0.5).tool('sim', 'sim_run', { sim: 'flame', o2: 1, psi: 16.7, g: 1 }, { ok: true }, 0.5)
  s.wait(0.2).sim({ id: 'a1-flame', sim: 'flame', by: 'sim', label: 'Pure O₂ · 16.7 psia · 1 g', params: { o2: 1, psi: 16.7, g: 1, flow: 0 } })
  s.wait(5.0).sim({ id: 'a1-flame', sim: 'flame', by: 'sim', label: 'Pure O₂ · 16.7 psia · 1 g', params: { o2: 1, psi: 16.7, g: 1, flow: 0 }, metrics: { 'flame size vs air': '≈ 2.3×', 'T ad (K, est.)': '≈ 3000 (capped)', note: 'violent, sooty' } })
  s.wait(0.4).tool('sim', 'sim_run', { sim: 'spread', material: 'cotton', o2: 1, psi: 16.7, g: 1, flow: 10 }, { ok: true }, 0.5)
  s.wait(0.2).sim({ id: 'a1-spread', sim: 'spread', by: 'sim', label: 'Cotton · pure O₂ · 1 g', params: { o2: 1, psi: 16.7, g: 1, flow: 10, material: 'cotton' } })
  s.wait(5.0).sim({ id: 'a1-spread', sim: 'spread', by: 'sim', label: 'Cotton · pure O₂ · 1 g', params: { o2: 1, psi: 16.7, g: 1, flow: 10, material: 'cotton' }, metrics: { 'spread vs air': `${cottonX.toFixed(0)}×`, 'verdict': 'whole cabin in seconds' } })
  s.wait(0.3).state('t-c3', 'completed').sub('C3', { status: 'done' })

  // C4: SKEPTIC scope check
  s.wait(0.4).sub('C4', { status: 'running' }).task('t-c4', 'flight', 'skeptic', 'C4 · Scope check')
  s.wait(0.8).tool('skeptic', 'check_citations', { claims: 9 }, { verified: 8, flagged: 1 }, 1.4)
  s.wait(1.6).say('skeptic', 'flight', 'review', 'Apollo 1 burned at 1 g on the pad — PSI’s µg data is not the evidence here; ground LOI data and the Board are. What PSI adds is the warning that 1 g screening alone is NOT conservative for spacecraft.', [{ id: 'PSI-98' }, { id: 'PSI-25' }])
  s.wait(0.3).say('skeptic', 'flight', 'review', 'Hatch and egress were as deadly as the fuel. Our tool would flag the atmosphere and materials; it would not have redesigned the hatch.')
  s.wait(0.3).state('t-c4', 'completed').sub('C4', { status: 'done' })

  // The human decides whether to run the bridge.
  s.wait(0.6).askHuman('ask-bridge', 'Apply the same check to Artemis base camp (8.2 psia / 34 % O₂, Moon g)?', ['Run the bridge check', 'Skip'], 8)
  s.wait(0.3).task('t-bridge', 'flight', 'prevent', 'Bridge · same check at base camp (8.2 psia / 34 % O₂, Moon g)')
  s.wait(0.5).tool('prevent', 'flammability_map', { atmosphere: '34 % O₂ · 8.2 psia', g: 0.165, materials: CABIN }, { sustainFlame: `${burns.base.length}/${CABIN.length}`, list: burns.base, nomexLimitingO2: pct(nomexLimBase, 1) }, 1.8)
  s.wait(2.0).say('prevent', 'flight', 'reply', `Base camp: ${burns.base.length} of ${CABIN.length} materials sustain flame (vs ${burns.iss.length} on ISS). Nomex — Apollo’s fix — burns again above ≈ ${pct(nomexLimBase)} O₂.`, [{ id: 'PSI-20' }, { id: 'PSI-98' }], 't-bridge')
  s.wait(0.2).state('t-bridge', 'completed')

  // C5: verdict
  s.wait(0.4).sub('C5', { status: 'running' }).task('t-c5', 'flight', 'scribe', 'C5 · Verdict + base-camp bridge')
  s.wait(1.2).verdict({
    outcome: 'prevented',
    headline: 'A materials-vs-atmosphere review would have flagged the cabin before the test.',
    would: [
      `${burns.apollo.length}/${CABIN.length} listed cabin materials exceed their limiting O₂ at 100 % O₂ / 16.7 psia — the check fails outright.`,
      'It points to the two levers the Board pulled: change the atmosphere, and restrict combustibles near ignition sources.',
      'It would not have fixed the hatch. Egress design sits outside combustion data, and Safety Assurance says so.',
    ],
    bridge: `The same check on base camp: ${burns.base.length}/${CABIN.length} materials burn at 34 % O₂, vs ${burns.iss.length}/${CABIN.length} on ISS. Nomex, Apollo's fix, burns again. Apollo 1's lesson, measured against Artemis.`,
  })
  s.wait(0.6).dossier({
    id: 'summary',
    title: 'Verdict · Apollo 1',
    pillar: 'summary',
    author: 'scribe',
    risk: 'critical',
    body: [
      'Pure O₂ at above-ambient pressure turned every combustible into fuel. The Board found combustibles next to ignition sources and a hatch that could not open in time.',
      'FIREFALL’s prevention check (material limiting O₂ vs cabin atmosphere) fails this cabin outright. That is the analysis the redesign later encoded in materials screening.',
    ],
    metrics: [
      { label: 'Burn at 100 % O₂', value: `${burns.apollo.length}/${CABIN.length}` },
      { label: 'Burn in ISS air', value: `${burns.iss.length}/${CABIN.length}` },
      { label: 'Burn at base camp', value: `${burns.base.length}/${CABIN.length}` },
      { label: 'Cotton spread vs air', value: `${cottonX.toFixed(0)}×` },
    ],
  })
  s.wait(0.6).dossier({
    id: 'bridge',
    title: 'Bridge to Artemis base camp',
    pillar: 'prevention',
    author: 'prevent',
    risk: 'high',
    body: [
      'Base camp moves back toward oxygen enrichment to cut prebreathe time. It is nowhere near Apollo 1, but far enough that Nomex, a post-Apollo standard, crosses its limit again.',
      'BRE (PSI-20) already burned at 8.2 psia / 34 % O₂ in µg. Saffire showed that 1 g screening is not conservative in space. Partial g is bounded until LUCI / FM2 fly.',
    ],
    cites: [{ id: 'PSI-20' }, { id: 'PSI-98' }, { id: 'PSI-25' }, { id: 'PSI-22' }],
  })
  s.wait(0.4).state('t-c5', 'completed').sub('C5', { status: 'done' })
  s.wait(0.4).say('flight', HUMAN, 'reply', 'Case closed: prevented at design review; the hatch was outside our scope. Bridge result is in the report.')
  s.wait(0.3).done('Case file closed')
  return s.build()
}
