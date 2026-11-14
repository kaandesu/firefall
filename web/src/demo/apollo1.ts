// Apollo CM-012 (AS-204), reviewed from the files the team handed over: cabin.yaml, materials.csv, cabin.model.json.
// The lead reads the inputs, publishes a plan and waits for your approval. Nothing runs before that.
// Everything the agents report (matrix, spread, pressure, what-ifs) is computed from the parsed inputs.
// Sources for the narrative: Apollo 204 Review Board (NASA), JSC Roundup 1967.
import type { CabinModel } from '@/intake/parse'
import { Script } from '@/live/script'
import type { Cite, Subtask } from '@/live/types'
import { simulateFire, variantsFor, type FireRun } from '@/stage/physics'
import { MATERIALS, limitingO2, pct } from '@/sims/models'
import { HUMAN } from './crew'
import { computeMatrix, type DesignPackage } from './packages'

export type ReviewInput = {
  pkg: DesignPackage
  model: CabinModel
  request: string
  /** Subtasks the human switched off before approving. */
  skip?: string[]
  /** The answer to the what-if question; false skips the what-if runs. */
  whatIf?: boolean
}

export const PLAN_GATE = 'ask-plan'
export const WHATIF_GATE = 'ask-whatif'

export function reviewPlan(): Subtask[] {
  return [
    { id: 'P1', title: 'Find PSI evidence for this cabin', agent: 'archivist', model: 'haiku', status: 'pending', reads: ['cabin.yaml'], produces: 'citations' },
    { id: 'P2', title: 'Judge every material at the cabin atmosphere', agent: 'prevent', model: 'sonnet', deps: ['P1'], status: 'pending', reads: ['materials.csv', 'cabin.yaml'], produces: 'materials matrix' },
    { id: 'P3', title: 'Fire spread and cabin pressure', agent: 'sim', model: 'haiku', deps: ['P2'], status: 'pending', reads: ['cabin.model.json', 'materials.csv', 'cabin.yaml'], produces: 'spread + pressure layers' },
    { id: 'P4', title: 'Scope check: what the data can and cannot say', agent: 'skeptic', model: 'opus', deps: ['P2', 'P3'], status: 'pending', reads: ['all findings'], produces: 'flags' },
    { id: 'P5', title: 'Verdict and hazard report', agent: 'scribe', model: 'sonnet', deps: ['P4'], status: 'pending', reads: ['all findings'], produces: 'verdict + report', required: true },
  ]
}

const secs = (n?: number) => (n === undefined ? 'none in 30 s' : `T+${n.toFixed(0)} s`)

export function fireRuns(pkg: DesignPackage, model: CabinModel): FireRun[] {
  return variantsFor(pkg).map((v) => simulateFire(model, pkg, v))
}

export function apollo1({ pkg, model, request, skip = [], whatIf = true }: ReviewInput) {
  const s = new Script('run-a1')
  const on = (id: string) => !skip.includes(id)
  const [asBuilt, ...whatIfs] = fireRuns(pkg, model)
  const cites: Cite[] = on('P1') ? [{ id: 'PSI-25', note: 'BASS-II: thin fuels spread at very low flow' }, { id: 'PSI-98', note: 'Saffire-I: large-sample spread' }] : []
  const matrix = computeMatrix(pkg, cites)
  const count = (st: string) => matrix.filter((r) => r.status === st).length
  const fails = count('fail')
  const atm = pkg.atmosphere.label
  const hatch = pkg.hatch?.openTime ?? 0
  const burning = asBuilt.zones.filter((z) => z.burns).length

  s.start(
    pkg.vehicle,
    'apollo-cm012',
    { vehicle: pkg.vehicle, atmosphere: atm, gravity: pkg.gravity.label, volume: pkg.volume, crew: pkg.crew, materials: pkg.bom.length },
    request,
  )
  s.wait(0.3).tool('flight', 'read_inputs', { files: ['cabin.yaml', 'materials.csv', 'cabin.model.json'] }, { atmosphere: atm, materials: pkg.bom.length, zones: asBuilt.zones.length }, 0.9)
  s.wait(1.1).note('flight', `${pkg.bom.length} materials in ${new Set(pkg.bom.map((b) => b.zone)).size} zones, ${atm}, ignition at ${pkg.ignitionZones?.join(', ') || 'unknown'}.`)
  s.wait(0.4).tool('flight', 'publish_plan', { subtasks: 5 }, { ok: true }, 0.4)
  s.wait(0.5).publishPlan({ goal: request, approved: false, subtasks: reviewPlan() })
  s.wait(0.3).askHuman(PLAN_GATE, 'Approve the plan? Nothing runs until you do.', ['Approve plan'], Infinity)

  // ── after approval ──
  s.wait(0.2).approve(skip)

  if (on('P1')) {
    s.wait(0.5).sub('P1', { status: 'running' }).task('t-p1', 'flight', 'archivist', 'P1 · Find PSI evidence for this cabin')
    s.wait(0.6).tool('archivist', 'psi_search', { atmosphere: atm, fuels: ['nylon', 'cotton', 'polyurethane foam'], g: pkg.gravity.g }, { hits: 14 }, 1.0)
    s.wait(1.1).tool('archivist', 'rank_investigations', { against: 'cabin.yaml' }, { top: ['PSI-25 BASS-II', 'PSI-98 Saffire-I', 'PSI-20 BRE'] }, 0.9)
    s.usage('archivist', 0.02, 0.24)
    s.wait(1.0).say('archivist', 'flight', 'reply', 'Closest evidence: BASS-II and Saffire-I for thin fabrics. Ground LOI data covers 1 g on the pad.', cites, 't-p1')
    s.wait(0.2).state('t-p1', 'completed').sub('P1', { status: 'done' })
  }

  if (on('P2')) {
    s.wait(0.5).sub('P2', { status: 'running' }).task('t-p2', 'flight', 'prevent', 'P2 · Judge every material at the cabin atmosphere')
    s.wait(0.6).tool('prevent', 'flammability_map', { atmosphere: atm, g: pkg.gravity.g, flow: pkg.ventFlow, materials: pkg.bom.map((b) => b.material) }, { burn: `${fails + count('retest')}/${matrix.length}` }, 1.6)
    s.wait(0.8).say('prevent', 'archivist', 'ask', 'Any data for nylon netting above 40 % O₂?')
    s.wait(1.0).say('archivist', 'prevent', 'reply', 'Only 1 g LOI (≈ 24 %). Nothing at 100 %; treat it as burning.', [{ id: 'PSI-25' }])
    s.usage('prevent', 0.04, 0.31)
    s.wait(0.6).matrix(matrix)
    s.wait(1.2).note('prevent', `${fails} of ${matrix.length} fail at ${atm}, ${count('retest')} need a retest, ${count('pass')} pass. Margins are in the matrix.`)
    s.wait(0.5).say('prevent', 'flight', 'reply', `${fails} of ${matrix.length} materials burn at ${atm}. The check fails before any test.`, cites, 't-p2')
    s.wait(0.2).state('t-p2', 'completed').sub('P2', { status: 'done' })
  }

  if (on('P3')) {
    s.wait(0.5).sub('P3', { status: 'running' }).task('t-p3', 'flight', 'sim', 'P3 · Fire spread and cabin pressure')
    s.wait(0.5).tool('sim', 'build_cabin', { model: 'cabin.model.json' }, { primitives: model.primitives.length, zones: asBuilt.zones.length }, 0.6)
    s.wait(0.8).tool('sim', 'sim_run', { sim: 'spread', ignition: pkg.ignitionZones, variant: 'as-built' }, { zonesBurning: burning, fullCabin: secs(asBuilt.fullAt) }, 1.2)
    s.wait(0.3).sim({ id: 'cabin-spread', sim: 'spread', by: 'sim', label: 'Spread through the cabin · as built', params: { o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow } })
    s.wait(4.0).sim({
      id: 'cabin-spread',
      sim: 'spread',
      by: 'sim',
      label: 'Spread through the cabin · as built',
      params: { o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow },
      metrics: { zones: `${burning}/${asBuilt.zones.length}`, rupture: secs(asBuilt.rupture) },
    })
    s.wait(0.4).tool('sim', 'pressure_estimate', { volume: pkg.volume, burst: `${pkg.hull?.burstPsia} psia` }, { rupture: secs(asBuilt.rupture), hatch: `${hatch} s` }, 1.0)
    s.wait(1.2).sim({ id: 'cabin-pressure', sim: 'spread', by: 'sim', label: 'Cabin pressure vs hull', params: {}, metrics: { rupture: secs(asBuilt.rupture), hatch: `${hatch} s` } })
    s.wait(0.4).say('sim', 'flight', 'reply', `Front leaves the wiring at T+0 and reaches ${burning} zones; hull ruptures at ${secs(asBuilt.rupture)}. The hatch needs ${hatch} s.`, undefined, 't-p3')
    s.wait(0.2).state('t-p3', 'completed').sub('P3', { status: 'done' })
  }

  if (on('P4')) {
    s.wait(0.5).sub('P4', { status: 'running' }).task('t-p4', 'flight', 'skeptic', 'P4 · Scope check')
    s.wait(0.7).tool('skeptic', 'check_citations', { claims: 7 }, { verified: 6, flagged: 1 }, 1.2)
    s.wait(1.4).say('skeptic', 'flight', 'review', 'This fire was at 1 g on the pad. PSI µg data is not the evidence; ground LOI data is. Say so in the report.', [{ id: 'PSI-98' }])
    s.wait(0.4).say('skeptic', 'flight', 'review', `The hatch (${pkg.hatch?.type ?? 'unknown'}, ${hatch} s) killed the crew as surely as the fuel. Combustion data would not have fixed it.`)
    s.wait(0.3).state('t-p4', 'completed').sub('P4', { status: 'done' })
  }

  s.wait(0.6).askHuman(WHATIF_GATE, 'Re-run this cabin at 60/40 O₂/N₂, in orbit and at base camp?', ['Run the what-ifs', 'Skip'], 10)
  if (whatIf) {
    s.wait(0.3).task('t-whatif', 'flight', 'sim', 'What-if · same cabin, three atmospheres')
    s.wait(0.5).tool('sim', 'sim_run', { sim: 'spread', variants: whatIfs.map((r) => r.variant.id) }, Object.fromEntries(whatIfs.map((r) => [r.variant.id, secs(r.rupture)])), 1.6)
    s.wait(1.8).sim({
      id: 'cabin-whatif',
      sim: 'spread',
      by: 'sim',
      label: 'What-if · 60/40, µg, base camp',
      params: {},
      metrics: Object.fromEntries(whatIfs.map((r) => [r.variant.short, r.rupture === undefined ? 'no rupture' : secs(r.rupture)])),
    })
    const base = whatIfs.find((r) => r.variant.id === 'base')!
    s.wait(0.4).say('sim', 'prevent', 'ask', `Base camp: ${base.zones.filter((z) => z.burns).length} zones still burn at 34 % O₂ / Moon g. Is that in your matrix?`)
    s.wait(0.9).say('prevent', 'sim', 'reply', `Yes: cotton's limit there is ≈ ${pct(limitingO2(base.variant.flow, base.variant.g, base.variant.psi, MATERIALS.cotton))}, below 34 %. Retest at 34 % before flight.`, [{ id: 'PSI-20' }])
    s.wait(0.3).state('t-whatif', 'completed')
  }

  s.wait(0.5).sub('P5', { status: 'running' }).task('t-p5', 'flight', 'scribe', 'P5 · Verdict and hazard report')
  s.wait(0.8).tool('scribe', 'report_write', { sections: ['verdict', 'matrix', 'spread', 'limits'] }, { ok: true }, 1.2)
  s.wait(1.4).verdict({
    outcome: 'prevented',
    headline: 'A materials-vs-atmosphere review fails this cabin before the test.',
    would: [
      `${fails} of ${matrix.length} listed materials burn at ${atm}.`,
      `The fire reaches ${burning} zones and ruptures the hull at ${secs(asBuilt.rupture)}.`,
      `It would not have fixed the hatch: ${hatch} s to open, from the inside, against cabin pressure.`,
    ],
    bridge: whatIf ? whatIfs.map((r) => `${r.variant.short}: ${r.rupture === undefined ? 'no rupture' : `rupture ${secs(r.rupture)}`}`).join(' · ') : undefined,
  })
  s.wait(0.4).dossier({
    id: 'summary',
    title: 'Verdict',
    pillar: 'summary',
    author: 'scribe',
    risk: 'critical',
    body: [
      `${pkg.vehicle} at ${atm}, ${pkg.gravity.label}: ${fails} of ${matrix.length} listed materials sustain flame. The prevention check fails outright.`,
      `Modelled spread from the ignition zone reaches ${burning} zones; the lumped pressure estimate ruptures the hull at ${secs(asBuilt.rupture)}, against a ${hatch} s hatch opening.`,
      'Out of scope: egress. The hatch design sits outside combustion data.',
    ],
    cites,
  })
  s.wait(0.4).state('t-p5', 'completed').sub('P5', { status: 'done' })
  s.wait(0.4).say('flight', HUMAN, 'reply', 'Review done: the cabin fails on materials. The hatch is outside what this tool checks.')
  s.wait(0.3).done('Review complete')
  return s.build()
}
