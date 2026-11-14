// Apollo CM-012 (AS-204), reviewed from the files the team handed over: cabin.yaml, materials.csv, cabin.model.json.
//
// What the run shows is the collaboration, not a replayed story:
//  - four organizations, each with its own agents, models, MCP tools and data; they share answers, not data
//  - every agent builds a knowledge base from the inputs, its own tools and what other agents tell it
//  - agents ask the agent that owns the knowledge instead of re-reading it (the saving is shown)
//  - people step in where a person must: approve the plan, book a lab test (a WSTF technician runs it),
//    and decide between two agents that disagree, with the lead as mediator
// The data processing is shown, not performed: job sizes and features are illustrative.
// Sources for the narrative: Apollo 204 Review Board (NASA), JSC Roundup 1967.
import type { CabinModel } from '@/intake/parse'
import { Script } from '@/live/script'
import type { Cite, MatrixRow, Proposal, Subtask } from '@/live/types'
import { simulateFire, variantsFor, type FireRun } from '@/stage/physics'
import { MATERIALS, limitingO2, pct } from '@/sims/models'
import { HUMAN, LAB } from './crew'
import { computeMatrix, type DesignPackage } from './packages'

export type Decision = 'caveat' | 'as-proposed' | 'reject'

export type ReviewInput = {
  pkg: DesignPackage
  model: CabinModel
  request: string
  /** Subtasks the human switched off before approving. */
  skip?: string[]
  /** Book the WSTF retest when the lead asks. */
  labTest?: boolean
  /** How the person settled the disagreement over the proposal. */
  decision?: Decision
}

export const PLAN_GATE = 'ask-plan'
export const LAB_GATE = 'ask-lab'
export const MEDIATE_GATE = 'ask-mediate'

export const DECISIONS: { id: Decision; label: string }[] = [
  { id: 'caveat', label: 'Accept with the S&MA caveat' },
  { id: 'as-proposed', label: 'Accept as proposed' },
  { id: 'reject', label: 'Reject' },
]

export function reviewPlan(): Subtask[] {
  return [
    { id: 'P1', title: 'Turn Saffire-I, BASS-II and ACME into test points', agent: 'archivist', model: 'llama', status: 'pending', reads: ['PSI-98', 'PSI-25', 'PSI-10'], produces: 'fitted limits' },
    { id: 'P2', title: 'Judge every material at the cabin atmosphere', agent: 'prevent', model: 'sonnet', deps: ['P1'], status: 'pending', reads: ['materials.csv', 'cabin.yaml'], produces: 'materials matrix' },
    { id: 'P3', title: 'Fire spread and cabin pressure', agent: 'sim', model: 'haiku', deps: ['P2'], status: 'pending', reads: ['cabin.model.json', 'cabin.yaml'], produces: 'spread + pressure' },
    { id: 'P4', title: 'Independent review of findings and proposals', agent: 'skeptic', model: 'opus', deps: ['P2', 'P3'], status: 'pending', reads: ['all findings'], produces: 'endorse / object' },
    { id: 'P5', title: 'Verdict and hazard report', agent: 'scribe', model: 'sonnet', deps: ['P4'], status: 'pending', reads: ['all findings'], produces: 'verdict + report', required: true },
  ]
}

const secs = (n?: number) => (n === undefined ? 'none in 30 s' : `T+${n.toFixed(0)} s`)

export function fireRuns(pkg: DesignPackage, model: CabinModel): FireRun[] {
  return variantsFor(pkg).map((v) => simulateFire(model, pkg, v))
}

/** What the stage can show: the cabin as built, the proposal (PR-1), and the three atmosphere what-ifs. */
export function stageRuns(pkg: DesignPackage, model: CabinModel): FireRun[] {
  const [asBuilt, ...rest] = fireRuns(pkg, model)
  const prop = proposedPackage(pkg)
  const v = variantsFor(prop)[0]
  const propRun = simulateFire(model, prop, { ...v, id: 'proposal', short: 'PR-1', label: 'PR-1 · Beta cloth for nylon, 60/40 on the pad' })
  return [asBuilt, propRun, ...rest]
}

/** The proposed cabin: nylon swapped for Beta cloth (modelled as PTFE-coated glass), pad atmosphere 60/40. */
export function proposedPackage(pkg: DesignPackage): DesignPackage {
  return {
    ...pkg,
    atmosphere: { ...pkg.atmosphere, o2: 0.6, label: `60 % O₂ · ${pkg.atmosphere.psi} psia` },
    bom: pkg.bom.map((b) => (b.material === 'nylon' ? { ...b, item: `${b.item} → Beta cloth`, material: 'teflon' } : b)),
  }
}

/** Smooth-ish deterministic series for sparklines. */
const series = (n: number, seed: number, shape: 'rise' | 'decay' | 'peak') =>
  Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1)
    const base = shape === 'rise' ? 1 - Math.exp(-3 * x) : shape === 'decay' ? Math.exp(-2.5 * x) : Math.sin(Math.PI * x) ** 1.5
    return Math.max(0, Math.min(1, base + 0.06 * Math.sin(i * 1.7 + seed)))
  })

export function apollo1({ pkg, model, request, skip = [], labTest = true, decision = 'caveat' }: ReviewInput) {
  const s = new Script('run-a1')
  const on = (id: string) => !skip.includes(id)
  const [asBuilt] = fireRuns(pkg, model)
  const cites: Cite[] = on('P1') ? [{ id: 'PSI-25', note: 'BASS-II: thin fuels spread at very low flow' }, { id: 'PSI-98', note: 'Saffire-I: large-sample spread' }] : []
  let matrix = computeMatrix(pkg, cites)
  const count = (rows: MatrixRow[], st: string) => rows.filter((r) => r.status === st).length
  const atm = pkg.atmosphere.label
  const hatch = pkg.hatch?.openTime ?? 0
  const burning = asBuilt.zones.filter((z) => z.burns).length
  const nylonLim = limitingO2(pkg.ventFlow, pkg.gravity.g, pkg.atmosphere.psi, MATERIALS.nylon)
  const teflon = matrix.find((r) => r.material === MATERIALS.teflon.label)

  // The proposal, evaluated on the same cabin.
  const prop = proposedPackage(pkg)
  const propMatrix = computeMatrix(prop, cites)
  const [propRun] = variantsFor(prop).map((v) => simulateFire(model, prop, v))
  const propBurning = propRun.zones.filter((z) => z.burns).length

  // ── setup: the lead reads the inputs, every agent learns its part ──
  s.start(pkg.vehicle, 'apollo-cm012', { vehicle: pkg.vehicle, atmosphere: atm, gravity: pkg.gravity.label, volume: pkg.volume, crew: pkg.crew, materials: pkg.bom.length }, request)
  s.wait(0.3).tool('flight', 'read_inputs', { files: ['cabin.yaml', 'materials.csv', 'cabin.model.json'] }, { atmosphere: atm, materials: pkg.bom.length, zones: asBuilt.zones.length }, 0.9)
  s.wait(0.9).learn('flight', `Cabin: ${atm}, ${pkg.gravity.label}, ${pkg.volume}, crew ${pkg.crew}`, { kind: 'input', ref: 'cabin.yaml' }, 420)
  s.wait(0.2).learn('flight', `Ignition at ${pkg.ignitionZones?.join(', ') || '?'}; hatch ${pkg.hatch?.type} (${hatch} s); hull bursts at ${pkg.hull?.burstPsia} psia`, { kind: 'input', ref: 'cabin.yaml' }, 310)
  s.wait(0.4).tool('flight', 'publish_plan', { subtasks: 5, orgs: 4 }, { ok: true }, 0.4)
  s.wait(0.5).publishPlan({ goal: request, approved: false, subtasks: reviewPlan() })
  s.wait(0.3).askHuman(PLAN_GATE, 'Approve the plan? Nothing runs until you do.', ['Approve plan'], Infinity)

  // ── after approval ──
  s.wait(0.2).approve(skip)
  s.learn('prevent', `${pkg.bom.length} materials in ${new Set(pkg.bom.map((b) => b.zone)).size} zones; ${pkg.bom.filter((b) => b.rating === 'X').length} never tested in the use atmosphere`, { kind: 'input', ref: 'materials.csv' }, 900)
  s.learn('sim', `${model.primitives.length} primitives in ${asBuilt.zones.length} zones; ignition zone ${pkg.ignitionZones?.[0]}`, { kind: 'input', ref: 'cabin.model.json' }, 1400)

  if (on('P1')) {
    s.wait(0.4).sub('P1', { status: 'running' }).task('t-p1', 'flight', 'archivist', 'P1 · Turn Saffire-I, BASS-II and ACME into test points for this cabin')
    s.wait(0.4).tool('archivist', 'psi_search', { atmosphere: atm, fuels: ['nylon', 'cotton', 'foam'], g: pkg.gravity.g }, { hits: 14, ingest: 3 }, 0.8)
    s.wait(0.6).tool('archivist', 'ingest', { datasets: ['PSI-98', 'PSI-25', 'PSI-10'], to: 'grc-gpu' }, { queued: 3 }, 0.6)
    s.wait(0.3).job(
      { id: 'j-saffire', agent: 'archivist', title: 'Saffire-I · flame-front tracking', dataset: 'PSI-98', size: '38 GB', where: 'grc-gpu · 8× A100', steps: ['ingest', 'decode frames', 'track front', 'fit spread'], stats: { frames: '41,200', channels: '14' }, series: series(24, 1, 'rise') },
      6.5,
      8,
      { 'spread fit': 'R² 0.94', rows: '6 test points' },
    )
    s.wait(0.4).job(
      { id: 'j-bass', agent: 'archivist', title: 'BASS-II · extinction vs flow', dataset: 'PSI-25', size: '12 GB', where: 'grc-gpu · 4× A100', steps: ['ingest', 'decode frames', 'flame length', 'fit limit'], stats: { tests: '87', samples: '5 fuels' }, series: series(24, 2, 'decay') },
      5.5,
      7,
      { 'limit fit': 'R² 0.91', rows: '87 test points' },
    )
    s.wait(0.4).job(
      { id: 'j-acme', agent: 'archivist', title: 'ACME 21256C2 · radiometer peaks', dataset: 'PSI-10', size: '61 GB', where: 'grc-gpu · 8× A100', steps: ['ingest', 'decode TIFF', 'radiometers', 'normalise'], stats: { frames: '1,250', radiometers: '5' }, series: series(24, 3, 'peak') },
      5,
      7,
      { rows: '182 test points' },
    )
    s.wait(5.6).learn('archivist', 'Saffire-I: large cotton-fiberglass sheet spread steadily in µg at 21 % O₂ with forced flow; growth was limited, unlike 1 g', { kind: 'dataset', ref: 'PSI-98' }, 0)
    s.wait(0.3).learn('archivist', 'BASS-II: thin fuels keep burning below 1 cm/s flow; extinction limit rises steeply as O₂ falls', { kind: 'dataset', ref: 'PSI-25' }, 0)
    s.wait(0.3).learn('archivist', 'Nothing in PSI tests nylon or cotton above 40 % O₂: 100 % O₂ is an extrapolation of the fitted limits', { kind: 'tool', ref: 'fit_model' }, 0)
    s.usage('archivist', 0.03, 0.22)
    s.wait(0.6).say('archivist', 'flight', 'reply', '275 test points from 3 datasets, fitted limits ready. Raw frames stay on the archive cluster; ask me for any value.', cites, 't-p1')
    s.wait(0.2).state('t-p1', 'completed').sub('P1', { status: 'done' })
  }

  if (on('P2')) {
    s.wait(0.4).sub('P2', { status: 'running' }).task('t-p2', 'flight', 'prevent', 'P2 · Judge every material at the cabin atmosphere')
    s.wait(0.5).tool('prevent', 'maptis_lookup', { materials: pkg.bom.map((b) => b.material) }, { found: pkg.bom.length, '1g LOI': 'nylon 24 %, cotton 18 %, PTFE 95 %' }, 0.9)
    s.wait(1.0).ask('prevent', 'archivist', `What is the fitted limiting O₂ for nylon fabric at ${pkg.ventFlow} cm/s and ${pkg.gravity.g} g?`, { tokens: 182_000, instead: 'reading Saffire-I and BASS-II (50 GB) itself' })
    s.wait(1.1).say('archivist', 'prevent', 'reply', `≈ ${pct(nylonLim)} (fit on 87 BASS-II points, extrapolated past 40 % O₂). At ${pct(pkg.atmosphere.o2)} it burns.`, [{ id: 'PSI-25' }])
    s.learn('prevent', `Nylon limiting O₂ ≈ ${pct(nylonLim)} at cabin flow`, { kind: 'agent', ref: '@archivist' }, 0)
    s.wait(0.5).tool('prevent', 'flammability_map', { atmosphere: atm, g: pkg.gravity.g, flow: pkg.ventFlow, materials: pkg.bom.length }, { burn: `${count(matrix, 'fail') + count(matrix, 'retest')}/${matrix.length}` }, 1.4)
    s.usage('prevent', 0.04, 0.18)
    s.wait(1.5).matrix(matrix)
    s.learn('prevent', `${count(matrix, 'fail')} fail, ${count(matrix, 'retest')} retest: ${teflon ? `${teflon.item} is the only borderline call` : 'no borderline calls'}`, { kind: 'tool', ref: 'flammability_map' }, 0)

    if (teflon) {
      // Cross-org: only the lab can answer this; its records never leave WSTF.
      s.wait(0.8).ask('prevent', 'wstf', `Any Test 1 record for PTFE wire insulation at ${atm}?`)
      s.wait(0.5).tool('wstf', 'lims_query', { material: 'PTFE wire insulation', atmosphere: atm, scope: 'private' }, { records: 0, nearest: '30 % O₂ · 14.7 psia' }, 1.0)
      s.wait(1.2).say('wstf', 'prevent', 'reply', 'No record at that atmosphere. Nearest is 30 % O₂. I can book 5 samples; next chamber slot is open.')
      s.learn('prevent', 'WSTF has no PTFE data above 30 % O₂', { kind: 'agent', ref: '@wstf' }, 0)
      s.wait(0.5).say('prevent', 'flight', 'ask', 'PTFE is borderline and untested here. A WSTF retest decides it. Book it?')
      s.wait(0.4).askHuman(LAB_GATE, `Book a WSTF retest: PTFE wire insulation at ${atm}, 5 samples?`, ['Book the test', 'Skip, keep it as retest'], 10)
      if (labTest) {
        s.wait(0.3).addSub({ id: 'L1', title: 'WSTF retest: PTFE at 100 % O₂', agent: 'wstf', model: 'gpt', status: 'running', deps: ['P2'], reads: ['test request'], produces: 'test result' })
        s.task('t-l1', 'prevent', 'wstf', 'L1 · NASA-STD-6001 Test 1: PTFE wire insulation, 5 samples')
        s.wait(0.6).tool('wstf', 'schedule_test', { chamber: 'WSTF-3', samples: 5, atmosphere: atm }, { slot: 'now (demo)', technician: '@lab' }, 0.6)
        s.wait(0.8).task('t-lab', 'wstf', LAB, `Run Test 1 on 5 PTFE samples at ${atm}, upload burn lengths`)
        s.state('t-lab', 'input_required', 'Technician running the chamber')
        s.wait(6.0).state('t-lab', 'completed', '3 of 5 burned past 15 cm; 2 self-extinguished')
        s.wait(0.5).tool('wstf', 'publish_result', { share: 'summary only', keep: 'raw logs, procedure' }, { burned: '3/5' }, 0.5)
        s.wait(0.8).say('wstf', 'prevent', 'reply', 'Result: 3 of 5 PTFE samples burned past 15 cm at 100 % O₂. Summary only; logs stay at WSTF.', undefined, 't-l1')
        s.wait(0.2).state('t-l1', 'completed').sub('L1', { status: 'done' })
        s.learn('prevent', 'WSTF Test 1: PTFE at 100 % O₂, 3/5 burned past 15 cm', { kind: 'human', ref: '@lab via @wstf' }, 0)
        matrix = matrix.map((r) => (r === teflon ? { ...r, status: 'fail', action: 'WSTF Test 1 at 100 % O₂: 3 of 5 burned. Replace, or isolate behind a barrier (JSC 29353).' } : r))
        s.wait(0.4).matrix(matrix)
      }
    }
    const fails = count(matrix, 'fail')
    s.wait(0.6).say('prevent', 'flight', 'reply', `${fails} of ${matrix.length} materials burn at ${atm}. The check fails before any test.`, cites, 't-p2')
    s.wait(0.2).state('t-p2', 'completed').sub('P2', { status: 'done' })
  }

  if (on('P3')) {
    s.wait(0.4).sub('P3', { status: 'running' }).task('t-p3', 'flight', 'sim', 'P3 · Fire spread and cabin pressure')
    s.wait(0.5).ask('sim', 'prevent', 'Which zones fail, and what is the fastest material in each?', { tokens: 26_000, instead: 'reading materials.csv and the matrix again' })
    s.wait(0.8).say('prevent', 'sim', 'reply', `All burnable zones fail. Fastest: cotton in couches and the LEB, nylon in netting and walls.`)
    s.learn('sim', 'Zone fuels from @prevent: cotton (couches, LEB), nylon (netting, walls), foam (floor)', { kind: 'agent', ref: '@prevent' }, 0)
    s.wait(0.4).tool('sim', 'build_cabin', { model: 'cabin.model.json' }, { primitives: model.primitives.length, zones: asBuilt.zones.length }, 0.6)
    s.wait(0.7).job(
      { id: 'j-spread', agent: 'sim', title: 'Spread + pressure · as built', dataset: 'cabin.model.json', size: `${model.primitives.length} primitives`, where: 'hpc-01 · 64 cores', steps: ['mesh', 'spread', 'pressure', 'post'], stats: { zones: String(asBuilt.zones.length), dt: '0.1 s' }, series: asBuilt.pressure.filter((_, i) => i % 6 === 0).map((p) => (p.psia - asBuilt.variant.psi) / Math.max(1, asBuilt.burstPsia - asBuilt.variant.psi)) },
      3.5,
      6,
      { rupture: secs(asBuilt.rupture) },
    )
    s.wait(0.6).sim({ id: 'cabin-spread', sim: 'spread', by: 'sim', label: 'Spread through the cabin · as built', params: { o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow } })
    s.wait(3.4).sim({ id: 'cabin-spread', sim: 'spread', by: 'sim', label: 'Spread through the cabin · as built', params: {}, metrics: { zones: `${burning}/${asBuilt.zones.length}`, rupture: secs(asBuilt.rupture) } })
    s.wait(0.3).tool('sim', 'pressure_estimate', { volume: pkg.volume, burst: `${pkg.hull?.burstPsia} psia` }, { rupture: secs(asBuilt.rupture), hatch: `${hatch} s` }, 0.8)
    s.wait(1.0).sim({ id: 'cabin-pressure', sim: 'spread', by: 'sim', label: 'Cabin pressure vs hull', params: {}, metrics: { rupture: secs(asBuilt.rupture), hatch: `${hatch} s` } })
    s.learn('sim', `As built: ${burning} zones burn, hull ruptures at ${secs(asBuilt.rupture)}, hatch needs ${hatch} s`, { kind: 'tool', ref: 'sim_run' }, 0)
    s.wait(0.4).say('sim', 'flight', 'reply', `Front leaves the wiring at T+0, reaches ${burning} zones; hull ruptures at ${secs(asBuilt.rupture)}. Hatch needs ${hatch} s.`, undefined, 't-p3')
    s.wait(0.2).state('t-p3', 'completed').sub('P3', { status: 'done' })
  }

  // ── a proposal, reviewed across orgs, mediated by the lead, decided by a person ──
  const proposal: Proposal = {
    id: 'PR-1',
    by: 'prevent',
    title: 'Beta cloth for nylon, 60/40 O₂/N₂ on the pad',
    change: 'Replace the nylon debris nets and Velcro with Beta cloth; fill the cabin with 60 % O₂ / 40 % N₂ for ground tests.',
    why: 'Nylon gives the fire its path across the cabin; at 60 % O₂ the remaining fuels spread far slower.',
    impact: [
      { label: 'materials that burn', before: `${count(matrix, 'fail') + count(matrix, 'retest')}/${matrix.length}`, after: `${count(propMatrix, 'fail') + count(propMatrix, 'retest')}/${propMatrix.length}` },
      { label: 'zones the fire reaches', before: String(burning), after: String(propBurning) },
      { label: 'hull rupture', before: secs(asBuilt.rupture), after: propRun.rupture === undefined ? 'none in 30 s' : secs(propRun.rupture) },
    ],
    reviews: [],
    status: 'open',
  }
  s.wait(0.6).tool('prevent', 'propose_change', { id: proposal.id }, { reviewers: ['@sim', '@skeptic'] }, 0.4)
  s.wait(0.5).proposal(proposal)
  s.wait(0.3).ask('prevent', 'sim', 'PR-1: re-run the cabin with Beta cloth and 60/40. Does the hull hold?')
  s.wait(0.5).job(
    { id: 'j-whatif', agent: 'sim', title: 'What-if · PR-1, µg, Moon g', dataset: 'cabin.model.json', size: '4 variants', where: 'hpc-01 · 64 cores', steps: ['mesh', 'spread ×4', 'pressure ×4', 'post'], stats: { variants: '4' }, series: series(24, 5, 'rise') },
    3,
    6,
  )
  s.wait(3.2).sim({ id: 'cabin-whatif', sim: 'spread', by: 'sim', label: 'What-if · 60/40, µg, Moon g', params: {}, metrics: { 'PR-1 zones': String(propBurning), 'PR-1 rupture': propRun.rupture === undefined ? 'none' : secs(propRun.rupture) } })
  proposal.reviews.push({ by: 'sim', stance: 'endorse', text: `With PR-1 the fire reaches ${propBurning} zones instead of ${burning}; ${propRun.rupture === undefined ? 'the hull holds for 30 s' : `rupture moves to ${secs(propRun.rupture)}`}.` })
  s.wait(0.3).proposal(proposal)
  s.say('sim', 'prevent', 'reply', proposal.reviews[0].text)

  if (on('P4')) {
    s.wait(0.5).sub('P4', { status: 'running' }).task('t-p4', 'flight', 'skeptic', 'P4 · Independent review of findings and PR-1')
    s.wait(0.5).ask('skeptic', 'archivist', 'Is there any µg or 1 g data for Beta cloth above 40 % O₂?', { tokens: 240_000, instead: 'searching all 24 PSI investigations itself' })
    s.wait(1.0).say('archivist', 'skeptic', 'reply', 'No PSI data for Beta cloth. Only 1 g ground tests exist, outside this archive.')
    s.learn('skeptic', 'No PSI evidence for Beta cloth at elevated O₂', { kind: 'agent', ref: '@archivist' }, 0)
    s.wait(0.5).tool('skeptic', 'check_citations', { claims: 9 }, { verified: 8, flagged: 1 }, 1.0)
    proposal.reviews.push({
      by: 'skeptic',
      stance: 'object',
      text: `60/40 alone still burns nylon (limit ≈ ${pct(nylonLim)}); Beta cloth is backed by 1 g data only; and PR-1 does nothing for the ${hatch} s inward hatch. Approve only with those as open items.`,
      cites: [{ id: 'PSI-98' }],
    })
    s.wait(1.2).proposal(proposal)
    s.say('skeptic', 'prevent', 'review', proposal.reviews[1].text, [{ id: 'PSI-98' }])
    s.wait(1.0).say('prevent', 'skeptic', 'reply', 'Agree the hatch is out of scope. The 1 g Beta cloth data is the flight standard; I would not block on it.')
    s.wait(0.3).state('t-p4', 'completed').sub('P4', { status: 'done' })
  }

  // The lead does not pick a side: it puts both positions in front of the lead engineer.
  proposal.status = 'escalated'
  s.wait(0.5).tool('flight', 'mediate', { proposal: 'PR-1', between: ['@prevent', '@skeptic'] }, { to: '@you' }, 0.5)
  s.wait(0.4).proposal(proposal)
  s.askHuman(MEDIATE_GATE, 'Materials and Safety Assurance disagree on PR-1. Your call.', DECISIONS.map((d) => d.label), 14, {
    positions: [
      { by: 'prevent', text: 'Accept: the fire reaches far fewer zones and the hull holds. Beta cloth is the flight standard.' },
      { by: 'skeptic', text: 'Accept only with open items: 1 g-only evidence for Beta cloth, and the hatch is unchanged.' },
    ],
  })
  proposal.status = decision === 'reject' ? 'rejected' : 'accepted'
  proposal.decidedBy = HUMAN
  s.wait(0.4).proposal(proposal)
  s.learn('flight', `PR-1 ${proposal.status}${decision === 'caveat' ? ' with S&MA open items' : ''} by the lead engineer`, { kind: 'human', ref: '@you' }, 0)
  s.wait(0.3).say('flight', 'prevent', 'reply', decision === 'reject' ? 'PR-1 rejected. Report the cabin as built.' : `PR-1 accepted${decision === 'caveat' ? ' with S&MA’s open items attached' : ''}. Carry it into the report.`)

  // ── report ──
  const fails = count(matrix, 'fail')
  s.wait(0.5).sub('P5', { status: 'running' }).task('t-p5', 'flight', 'scribe', 'P5 · Verdict and hazard report')
  s.wait(0.4).ask('scribe', 'flight', 'Send me the decisions and open items; I will take the numbers from each agent.', { tokens: 96_000, instead: 'replaying the whole run transcript' })
  s.wait(0.6).tool('scribe', 'report_write', { sections: ['verdict', 'matrix', 'spread', 'proposals', 'test requests', 'open items'] }, { ok: true }, 1.2)
  s.wait(1.4).verdict({
    outcome: 'prevented',
    headline: 'A materials-vs-atmosphere review fails this cabin before the test.',
    would: [
      `${fails} of ${matrix.length} listed materials burn at ${atm}.`,
      `The fire reaches ${burning} zones and ruptures the hull at ${secs(asBuilt.rupture)}.`,
      `It would not have fixed the hatch: ${hatch} s to open, from the inside, against cabin pressure.`,
    ],
    bridge: decision === 'reject' ? undefined : `PR-1 (${proposal.title}): ${propBurning} zones, ${propRun.rupture === undefined ? 'no rupture in 30 s' : `rupture ${secs(propRun.rupture)}`}.`,
  })
  s.wait(0.4).dossier({
    id: 'summary',
    title: 'Verdict',
    pillar: 'summary',
    author: 'scribe',
    risk: 'critical',
    body: [
      `${pkg.vehicle} at ${atm}, ${pkg.gravity.label}: ${fails} of ${matrix.length} listed materials sustain flame. The prevention check fails outright.`,
      `Modelled spread from the ignition zone reaches ${burning} zones; the pressure estimate ruptures the hull at ${secs(asBuilt.rupture)}, against a ${hatch} s hatch opening.`,
      'Out of scope: egress. The hatch design sits outside combustion data.',
    ],
    cites,
  })
  s.wait(0.4).state('t-p5', 'completed').sub('P5', { status: 'done' })
  s.wait(0.4).say('flight', HUMAN, 'reply', `Review done. The cabin fails on materials; ${decision === 'reject' ? 'PR-1 was rejected' : 'PR-1 is in the report'}; the hatch stays an open item.`)
  s.wait(0.3).done('Review complete')
  return s.build()
}
