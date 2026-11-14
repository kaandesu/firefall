// Apollo CM-012 (AS-204), reviewed from the files the team handed over: cabin.yaml, materials.csv, cabin.model.json.
//
// What the run shows is the collaboration, not a replayed story:
//  - four organizations, each with its own agents, models, MCP tools and data; they share answers, not data
//  - every agent builds a knowledge base from the inputs, its own tools and what other agents tell it
//  - agents ask the agent that owns the knowledge instead of re-reading it (the saving is shown)
//  - people step in where a person must: approve the plan, book a lab test (a WSTF technician runs it),
//    and decide between two agents that disagree, with the lead as mediator
// Real: the ACME camera job (events detected from the 21256C2 frames), the smoke CFD + sensor search (lab/fluid.ts),
// the spread/pressure model. Illustrative: Saffire/BASS job sizes and fitted numbers (no raw data in this repo).
// Sources for the narrative: Apollo 204 Review Board (NASA), JSC Roundup 1967.
import type { CameraEvent, SensorStats } from '@/data/acme'
import type { CabinModel } from '@/intake/parse'
import type { SmokeStudy } from '@/lab/smokeStudy'
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
  /** Real ACME results, computed before the run from public/data/acme. */
  acme?: { events: CameraEvent[]; sensors: SensorStats; evidence: number }
  /** The detection study (smoke CFD), computed in a worker before the plan is approved. */
  smoke?: SmokeStudy
  /** Adopt the Detection agent's sensor layout (PR-2)? */
  pr2?: boolean
}

export const PLAN_GATE = 'ask-plan'
export const LAB_GATE = 'ask-lab'
export const MEDIATE_GATE = 'ask-mediate'
export const SENSOR_GATE = 'ask-sensors'

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
    { id: 'PD', title: 'Smoke detection: would the sensors see it?', agent: 'detect', model: 'sonnet', deps: ['P1'], status: 'pending', reads: ['cabin.model.json', 'cabin.yaml sensors', 'PSI-102'], produces: 'time to alarm + layout' },
    { id: 'PS', title: 'Suppression: would CO₂ put it out?', agent: 'suppress', model: 'sonnet', deps: ['P1'], status: 'pending', reads: ['cabin.yaml', 'PSI-69'], produces: 'extinguisher check' },
    { id: 'P4', title: 'Independent review of findings and proposals', agent: 'skeptic', model: 'opus', deps: ['P2', 'P3', 'PD'], status: 'pending', reads: ['all findings'], produces: 'endorse / object' },
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

export function apollo1({ pkg, model, request, skip = [], labTest = true, decision = 'caveat', acme, smoke, pr2: pr2Adopt = true }: ReviewInput) {
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
    const ev = acme?.events ?? []
    const ign = ev.find((e) => e.id === 'ignition')
    const steady = ev.find((e) => e.id === 'steady')
    const tr = ev.find((e) => e.id === 'transient')
    s.wait(0.3).job(
      { id: 'j-saffire', agent: 'archivist', kind: 'data', scene: 'spread-duct', params: { material: 'cotton', o2: 0.21, psi: 14.7, g: 0, flow: 20 }, node: 'grc-gpu', gpus: 8, title: 'Saffire-I · flame-front fit (replica at test conditions)', dataset: 'PSI-98', size: '38 GB', where: 'grc-gpu · 8× A100', steps: ['ingest', 'decode frames', 'track front', 'fit spread'], stats: { frames: '41,200', channels: '14' }, series: series(24, 1, 'rise') },
      6.5,
      8,
      { 'spread fit': 'R² 0.94 (illustrative)' },
    )
    s.wait(0.4).job(
      { id: 'j-bass', agent: 'archivist', kind: 'data', scene: 'lim-sweep', params: { material: 'nylon', o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow }, node: 'grc-gpu', gpus: 4, title: 'BASS-II · extinction limit sweep, flow × O₂', dataset: 'PSI-25', size: '12 GB', where: 'grc-gpu · 4× A100', steps: ['ingest', 'flame length', 'sweep', 'fit limit'], stats: { tests: '87', grid: '30 × 24' }, series: series(24, 2, 'decay') },
      5.5,
      7,
      { 'limit fit': 'R² 0.91 (illustrative)' },
    )
    s.wait(0.4).job(
      { id: 'j-acme', agent: 'archivist', kind: 'data', scene: 'acme-frames', node: 'grc-gpu', gpus: 2, title: 'ACME CFI-G 21256C2 · camera event detection (real frames)', dataset: 'PSI-159', size: '1,677 frames', where: 'grc-gpu · 2× A100', steps: ['decode TIFF', 'background σ', 'brightness series', 'detect events'], stats: { frames: '1,677', 'noise σ': '13.69' }, series: series(24, 3, 'peak') },
      5,
      7,
      { events: `${ev.length} detected`, ...(ign ? { ignition: `T+${ign.t.toFixed(1)} s` } : {}), ...(steady && tr ? { 'steady burn': `${(tr.t - steady.t).toFixed(1)} s` } : {}) },
    )
    s.wait(5.6).learn('archivist', 'Saffire-I: large cotton-fiberglass sheet spread steadily in µg at 21 % O₂ with forced flow; growth was limited, unlike 1 g', { kind: 'dataset', ref: 'PSI-98' }, 0)
    s.wait(0.3).learn('archivist', 'BASS-II: thin fuels keep burning below 1 cm/s flow; extinction limit rises steeply as O₂ falls', { kind: 'dataset', ref: 'PSI-25' }, 0)
    if (ign) s.wait(0.3).learn('archivist', `ACME 21256C2 (real frames): ignition at T+${ign.t.toFixed(1)} s, ${ev.length} phases detected from brightness alone; ${acme?.evidence ?? 182} evidence rows indexed`, { kind: 'dataset', ref: 'PSI-159' }, 0)
    s.wait(0.3).learn('archivist', 'Nothing in PSI tests nylon or cotton above 40 % O₂: 100 % O₂ is an extrapolation of the fitted limits', { kind: 'tool', ref: 'fit_model' }, 0)
    s.usage('archivist', 0.03, 0.22)
    s.wait(0.6).say('archivist', 'flight', 'reply', `Fitted limits ready from Saffire-I, BASS-II and ACME${ign ? `; ACME camera events detected (ignition T+${ign.t.toFixed(1)} s)` : ''}. Raw frames stay on the archive cluster; ask me for any value.`, [...cites, { id: 'PSI-159', note: 'ACME CFI-G 21256C2 camera' }], 't-p1')
    s.wait(0.2).state('t-p1', 'completed').sub('P1', { status: 'done' })
  }

  if (on('P2')) {
    s.wait(0.4).sub('P2', { status: 'running' }).task('t-p2', 'flight', 'prevent', 'P2 · Judge every material at the cabin atmosphere')
    s.wait(0.5).tool('prevent', 'maptis_lookup', { materials: pkg.bom.map((b) => b.material) }, { found: pkg.bom.length, '1g LOI': 'nylon 24 %, cotton 18 %, PTFE 95 %' }, 0.9)
    s.wait(1.0).ask('prevent', 'archivist', `What is the fitted limiting O₂ for nylon fabric at ${pkg.ventFlow} cm/s and ${pkg.gravity.g} g?`, { tokens: 182_000, instead: 'reading Saffire-I and BASS-II (50 GB) itself' })
    s.wait(1.1).say('archivist', 'prevent', 'reply', `≈ ${pct(nylonLim)} (fit on 87 BASS-II points, extrapolated past 40 % O₂). At ${pct(pkg.atmosphere.o2)} it burns.`, [{ id: 'PSI-25' }])
    s.learn('prevent', `Nylon limiting O₂ ≈ ${pct(nylonLim)} at cabin flow`, { kind: 'agent', ref: '@archivist' }, 0)
    s.wait(0.5).tool('prevent', 'flammability_map', { atmosphere: atm, g: pkg.gravity.g, flow: pkg.ventFlow, materials: pkg.bom.length }, { burn: `${count(matrix, 'fail') + count(matrix, 'retest')}/${matrix.length}` }, 1.4)
    s.wait(0.2).job(
      { id: 'j-flame', agent: 'prevent', kind: 'sim', scene: 'gravity-flame', params: { o2: pkg.atmosphere.o2, g: pkg.gravity.g, flow: pkg.ventFlow }, node: 'hpc-01', gpus: 1, title: `Flame shape at ${pct(pkg.atmosphere.o2)} O₂ · ${pkg.gravity.label}`, dataset: 'cabin.yaml', size: '1 case', where: 'hpc-01 · 1× H100', steps: ['setup', 'solve', 'render'], stats: { o2: pct(pkg.atmosphere.o2) } },
      4,
      5,
      { soot: 'heavy at 1 g' },
    )
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
        s.job({ id: 'j-chamber', agent: 'wstf', kind: 'test', scene: 'chamber-test', node: 'chamber-3', title: 'Test 1 · PTFE wire insulation × 5 (technician)', dataset: 'test request L1', size: '5 samples', where: 'WSTF chamber 3', steps: ['mount', 'ignite', 'burn', 'measure'], stats: { atmosphere: atm } }, 5.8, 10, { burned: '3 of 5 past 15 cm' })
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

  // ── detection: smoke CFD in the cabin, µg / Moon / 1 g, and a better sensor layout ──
  if (on('PD')) {
    const fmtT = (t: number | null) => (t === null ? 'no alarm in 60 s' : `${t.toFixed(0)} s`)
    const caught = (cs: SmokeStudy['cases']) => cs.filter((c) => c.firstAlarm !== null).length
    s.wait(0.4).sub('PD', { status: 'running' }).task('t-pd', 'flight', 'detect', 'P-D · Smoke detection: would the designed sensors see it?')
    s.wait(0.4).learn('detect', `${pkg.sensors?.length ?? 0} sensors in cabin.yaml: ${(pkg.sensors ?? []).map((d) => `${d.id} ${d.type} at ${d.zone}`).join(', ') || 'none'}`, { kind: 'input', ref: 'cabin.yaml' }, 260)
    s.wait(0.5).ask('detect', 'archivist', 'SAME / SAME-R: what particle size does overheated PTFE wire insulation make, and which detector sees it?', { tokens: 120_000, instead: 'pulling SAME and SAME-R particle data (5 GB) itself' })
    s.wait(1.0).say('archivist', 'detect', 'reply', `Median ≈ ${smoke?.smokeD ?? 0.18} µm for PTFE. Photoelectric heads respond poorly below ~0.3 µm; ionization heads see it.`, [{ id: 'PSI-102', note: 'SAME smoke particle sizes' }])
    s.learn('detect', `PTFE smoke ≈ ${smoke?.smokeD ?? 0.18} µm: a photoelectric head barely sees it`, { kind: 'agent', ref: '@archivist' }, 0)
    s.wait(0.4).tool('detect', 'smoke_cfd', { section: 'cabin.model.json z=0', sources: smoke?.sources.map((x) => x.zone) ?? ['wiring'], g: ['µg', 'Moon', '1 g'] }, { runs: smoke ? smoke.sources.length * 3 : 9 }, 0.6)
    s.wait(0.3).job(
      { id: 'j-smoke', agent: 'detect', kind: 'sim', scene: 'smoke-cfd', node: 'hpc-01', gpus: 4, title: 'Smoke CFD · cabin section · µg / Moon / 1 g', dataset: 'cabin.model.json', size: `${smoke ? `${smoke.nx}×${smoke.ny}` : '70×55'} cells × ${smoke ? smoke.sources.length * 3 : 9} runs`, where: 'hpc-01 · 4× H100', steps: ['mesh section', 'solve µg', 'solve Moon', 'solve 1 g', 'alarms'], stats: { solver: 'stable fluids', dt: '0.2 s' } },
      6,
      12,
      { 'designed layout': smoke ? `${caught(smoke.cases)}/${smoke.cases.length} cases alarm` : 'see lab' },
    )
    s.wait(0.6).sim({ id: 'cabin-smoke', sim: 'smoke', by: 'detect', label: 'Smoke in the cabin · designed sensors', params: { g: pkg.gravity.g } })
    s.wait(5.6).tool('detect', 'place_sensors', { candidates: 'wall cells', n: Math.max(2, pkg.sensors?.length ?? 0), objective: 'worst-case first alarm' }, smoke ? { proposed: smoke.proposed.map((p) => `${p.id} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`) } : {}, 0.5)
    s.wait(0.2).job(
      { id: 'j-place', agent: 'detect', kind: 'sim', scene: 'sensor-opt', node: 'hpc-01', gpus: 4, title: 'Sensor placement · worst-case arrival map', dataset: 'CFD runs', size: smoke ? `${smoke.runs} runs` : '18 runs', where: 'hpc-01 · 4× H100', steps: ['arrival maps', 'greedy search', 'verify'], stats: { objective: 'worst first alarm' } },
      4,
      8,
      { proposed: smoke ? fmtT(smoke.worstProposed) : '—', designed: smoke ? fmtT(smoke.worstDesigned) : '—' },
    )
    if (smoke) {
      const ug = smoke.cases.find((c) => c.g === 0 && smoke.sources.find((x) => x.id === c.source)?.listed)
      const one = smoke.cases.find((c) => c.g === 1 && smoke.sources.find((x) => x.id === c.source)?.listed)
      s.wait(4.2).learn('detect', `Designed layout: ${caught(smoke.cases)}/${smoke.cases.length} cases alarm; listed source at 1 g: ${fmtT(one?.firstAlarm ?? null)}, in µg: ${fmtT(ug?.firstAlarm ?? null)}`, { kind: 'tool', ref: 'smoke_cfd' }, 0)
      s.wait(0.3).learn('detect', `Proposed layout: ${caught(smoke.proposedCases)}/${smoke.proposedCases.length} cases alarm, worst ${fmtT(smoke.worstProposed)}`, { kind: 'tool', ref: 'place_sensors' }, 0)
      const pr2: Proposal = {
        id: 'PR-2',
        by: 'detect',
        title: `Move the detectors: ${smoke.proposed.length}× ${smoke.proposed[0]?.type ?? 'ionization'}`,
        change: `Replace ${smoke.designed.map((d) => `${d.id} (${d.type})`).join(' and ')} with ${smoke.proposed.map((p) => `${p.id} ${p.type} at x ${p.x.toFixed(2)} m, y ${p.y.toFixed(2)} m`).join('; ')}.`,
        why: `Without buoyancy smoke stays near the source; the low photoelectric head never sees ${smoke.smokeD} µm PTFE smoke. The search picks positions that alarm first in the worst source × gravity case.`,
        impact: [
          { label: 'cases that alarm', before: `${caught(smoke.cases)}/${smoke.cases.length}`, after: `${caught(smoke.proposedCases)}/${smoke.proposedCases.length}` },
          { label: 'worst first alarm', before: fmtT(smoke.worstDesigned), after: fmtT(smoke.worstProposed) },
          { label: 'listed source, µg', before: fmtT(ug?.firstAlarm ?? null), after: fmtT(smoke.proposedCases.find((c) => c.g === 0 && c.source === ug?.source)?.firstAlarm ?? null) },
        ],
        reviews: [],
        status: 'open',
      }
      s.wait(0.4).tool('detect', 'propose_change', { id: 'PR-2' }, { reviewers: ['@sim'] }, 0.3)
      s.wait(0.3).proposal(pr2)
      s.wait(0.6).ask('detect', 'sim', 'PR-2: does the proposed layout hold up on your spread run? Any sensor inside the fire zone?')
      s.wait(0.9).say('sim', 'detect', 'reply', 'Both positions sit outside the first-burning zones until well after their alarm time. Endorse.')
      pr2.reviews.push({ by: 'sim', stance: 'endorse', text: 'Both positions alarm before their zones burn; no conflict with the spread run.' })
      pr2.status = 'escalated'
      s.wait(0.3).proposal(pr2)
      s.wait(0.3).say('detect', 'flight', 'ask', 'PR-2 changes the sensor layout in the spec. That is the vehicle team’s call.')
      s.wait(0.3).askHuman(SENSOR_GATE, `Adopt PR-2? The designed layout alarms in ${caught(smoke.cases)} of ${smoke.cases.length} cases; PR-2 in ${caught(smoke.proposedCases)} of ${smoke.proposedCases.length}.`, ['Adopt PR-2', 'Keep the designed layout'], 9)
      pr2.status = pr2Adopt ? 'accepted' : 'rejected'
      pr2.decidedBy = HUMAN
      s.wait(0.3).proposal(pr2)
      s.learn('flight', `PR-2 ${pr2.status} by the lead engineer`, { kind: 'human', ref: '@you' }, 0)
      s.wait(0.3).say('detect', 'flight', 'reply', `${pr2.status === 'accepted' ? 'PR-2 adopted' : 'Designed layout kept'}. Worst-case first alarm: ${fmtT(pr2.status === 'accepted' ? smoke.worstProposed : smoke.worstDesigned)}.`, [{ id: 'PSI-102' }], 't-pd')
    } else {
      s.wait(4.2).say('detect', 'flight', 'reply', 'Smoke runs submitted; results in the lab panel.', undefined, 't-pd')
    }
    s.wait(0.2).state('t-pd', 'completed').sub('PD', { status: 'done' })
  }

  if (on('P3')) {
    s.wait(0.4).sub('P3', { status: 'running' }).task('t-p3', 'flight', 'sim', 'P3 · Fire spread and cabin pressure')
    s.wait(0.5).ask('sim', 'prevent', 'Which zones fail, and what is the fastest material in each?', { tokens: 26_000, instead: 'reading materials.csv and the matrix again' })
    s.wait(0.8).say('prevent', 'sim', 'reply', `All burnable zones fail. Fastest: cotton in couches and the LEB, nylon in netting and walls.`)
    s.learn('sim', 'Zone fuels from @prevent: cotton (couches, LEB), nylon (netting, walls), foam (floor)', { kind: 'agent', ref: '@prevent' }, 0)
    s.wait(0.4).tool('sim', 'build_cabin', { model: 'cabin.model.json' }, { primitives: model.primitives.length, zones: asBuilt.zones.length }, 0.6)
    s.wait(0.7).job(
      { id: 'j-spread', agent: 'sim', kind: 'sim', scene: 'spread-duct', params: { material: 'nylon', o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow }, node: 'hpc-01', gpus: 4, title: 'Spread + pressure · as built (nylon front shown)', dataset: 'cabin.model.json', size: `${model.primitives.length} primitives`, where: 'hpc-01 · 64 cores', steps: ['mesh', 'spread', 'pressure', 'post'], stats: { zones: String(asBuilt.zones.length), dt: '0.1 s' }, series: asBuilt.pressure.filter((_, i) => i % 6 === 0).map((p) => (p.psia - asBuilt.variant.psi) / Math.max(1, asBuilt.burstPsia - asBuilt.variant.psi)) },
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

  // ── suppression: would a portable CO₂ extinguisher work in this atmosphere? (FLEX) ──
  if (on('PS')) {
    const co2 = 0.25
    const xo2 = pkg.atmosphere.o2 * (1 - co2)
    s.wait(0.4).sub('PS', { status: 'running' }).task('t-ps', 'flight', 'suppress', 'P-S · Would a CO₂ extinguisher put it out?')
    s.wait(0.4).ask('suppress', 'archivist', 'FLEX: limiting O₂ for a fuel droplet with CO₂ as the diluent?', { tokens: 64_000, instead: 'reading the FLEX droplet archive (18 GB) itself' })
    s.wait(0.9).say('archivist', 'suppress', 'reply', 'LOI ≈ 15 % in O₂/N₂, ≈ 17 % with CO₂ (FLEX heptane). Large droplets leave a cool flame after the hot flame dies.', [{ id: 'PSI-69', note: 'FLEX' }])
    s.learn('suppress', 'FLEX: droplet flames die below ~17 % O₂ with CO₂ diluent', { kind: 'agent', ref: '@archivist' }, 0)
    s.wait(0.3).job(
      { id: 'j-droplet', agent: 'suppress', kind: 'sim', scene: 'droplet', params: { o2: pkg.atmosphere.o2, co2, d0: 2.5 }, node: 'hpc-01', gpus: 1, title: `Droplet with ${Math.round(co2 * 100)} % CO₂ at ${pct(pkg.atmosphere.o2)} O₂`, dataset: 'FLEX model', size: '1 case', where: 'hpc-01 · 1× H100', steps: ['ignite', 'flood CO₂', 'burn'], stats: { co2: `${Math.round(co2 * 100)} %` } },
      4,
      6,
      { 'effective O₂': pct(xo2), result: xo2 > 0.17 ? 'keeps burning' : 'goes out' },
    )
    s.wait(4.2).learn('suppress', `A ${Math.round(co2 * 100)} % CO₂ flood leaves ${pct(xo2)} O₂ here: far above the ~17 % limit`, { kind: 'tool', ref: 'droplet_run' }, 0)
    s.wait(0.3).say('suppress', 'flight', 'reply', `At ${pct(pkg.atmosphere.o2)} O₂ a ${Math.round(co2 * 100)} % CO₂ flood still leaves ${pct(xo2)} O₂; the flame keeps burning. Portable CO₂ cannot make this cabin safe: cut the oxygen or the fuel.`, [{ id: 'PSI-69' }], 't-ps')
    s.wait(0.2).state('t-ps', 'completed').sub('PS', { status: 'done' })
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
    { id: 'j-whatif', agent: 'sim', kind: 'sim', scene: 'spread-duct', params: { material: 'teflon', o2: 0.6, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow }, node: 'hpc-01', gpus: 4, title: 'What-if · PR-1 (Beta cloth at 60 % O₂ shown), µg, Moon g', dataset: 'cabin.model.json', size: '4 variants', where: 'hpc-01 · 64 cores', steps: ['mesh', 'spread ×4', 'pressure ×4', 'post'], stats: { variants: '4' }, series: series(24, 5, 'rise') },
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
