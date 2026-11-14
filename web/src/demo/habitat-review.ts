// Scenario A: pre-mission fire-safety review of a pressurized rover cabin at the NASA exploration atmosphere.
// Numbers come from the same models the sims run (src/sims/models.ts), so the story and the visuals agree.
import { Script } from '@/live/script'
import { MATERIALS, detectorEfficiency, droplet, flameShape, limitingO2, pct, spreadRate, spreadVsEarth } from '@/sims/models'
import { HUMAN } from './crew'

const O2 = 0.34
const PSI = 8.2
const FLOW = 8
const MOON = 0.165

const r1 = (x: number) => x.toFixed(1)
const r2 = (x: number) => x.toFixed(2)

export function habitatReview() {
  const s = new Script('run-hab')
  const nomexLim = limitingO2(FLOW, MOON, PSI, MATERIALS.nomex)
  const nomexV = { ug: spreadRate(O2, FLOW, 0, PSI, MATERIALS.nomex), moon: spreadRate(O2, FLOW, MOON, PSI, MATERIALS.nomex), earth: spreadRate(O2, FLOW, 1, PSI, MATERIALS.nomex) }
  const cottonX = spreadVsEarth(O2, FLOW, MOON, PSI, MATERIALS.cotton)
  const photo = detectorEfficiency('photoelectric', MATERIALS.kapton.smokeD)
  const ion = detectorEfficiency('ionization', MATERIALS.kapton.smokeD)
  const co2Needed = 1 - 0.17 / O2
  const co2Earth = 1 - 0.17 / 0.21
  const flameMoon = flameShape(MOON, O2, FLOW)
  const drop = droplet(O2, 0, 2.5)

  s.start(
    'PR-2 rover cabin · fire safety review',
    'habitat',
    { vehicle: 'Pressurized rover PR-2', atmosphere: '8.2 psia · 34 % O₂', gravity: 'Moon 0.165 g', cabinFlow: `${FLOW} cm/s`, materials: 'Nomex stowage, cotton garments, Kapton/PTFE wiring, PMMA covers' },
    'Certify the PR-2 rover cabin for fire safety: 8.2 psia / 34 % O₂, Nomex stowage bags, cotton crew garments, Kapton/PTFE wiring, 8 cm/s cabin flow, lunar surface ops. What breaks, and what do we change?',
  )
  s.usage('flight', 0.04, 0.08)
  s.wait(1.2).note('flight', 'Split by the three NASA pillars — prevention, detection, suppression. PSI has no partial-g data: bound Moon between µg (PSI) and 1 g.')
  s.wait(1.4).tool('flight', 'publish_plan', { subtasks: 7, agents: 6 }, { ok: true }, 0.8)
  s.wait(0.4).publishPlan({
    goal: 'Fire-safety certification of PR-2 cabin at 8.2 psia / 34 % O₂',
    approved: false,
    subtasks: [
      { id: 'S1', title: 'Rank PSI investigations for an 8.2 psia / 34 % O₂ cabin', agent: 'archivist', model: 'haiku', status: 'pending', pillar: 'cross' },
      { id: 'S2', title: 'Cabin material flammability at 34 % O₂', agent: 'prevent', model: 'sonnet', deps: ['S1'], status: 'pending', pillar: 'prevention' },
      { id: 'S3', title: 'Will our detectors see the smoke?', agent: 'detect', model: 'sonnet', deps: ['S1'], status: 'pending', pillar: 'detection' },
      { id: 'S4', title: 'Suppression at 8.2 psia: CO₂ vs water mist', agent: 'suppress', model: 'sonnet', deps: ['S1'], status: 'pending', pillar: 'suppression' },
      { id: 'S5', title: 'Run flame, spread, smoke and droplet sims', agent: 'sim', model: 'haiku', deps: ['S2', 'S3', 'S4'], status: 'pending', pillar: 'cross' },
      { id: 'S6', title: 'Review every claim; bound partial-g', agent: 'skeptic', model: 'opus', deps: ['S2', 'S3', 'S4', 'S5'], status: 'pending', pillar: 'cross' },
      { id: 'S7', title: 'Assemble the Fire Safety Dossier', agent: 'scribe', model: 'sonnet', deps: ['S6'], status: 'pending', pillar: 'cross' },
    ],
  })
  s.wait(1.6).askHuman('ask-plan', 'Plan ready: 7 subtasks across 6 agents, bounded by µg + 1 g data. Approve?', ['Approve plan', 'Approve, but skip the droplet sim'], 9)
  s.wait(0.2).approve()

  // S1: ARCHIVIST, with a failure and an escalation, Halo-style.
  s.wait(0.6).sub('S1', { status: 'running' }).task('t-s1', 'flight', 'archivist', 'S1 · Rank PSI investigations for an 8.2 psia / 34 % O₂ cabin')
  s.wait(0.8).tool('archivist', 'psi_search', { q: 'combustion', data_type: 'investigation' }, { total: 133, combustion: 24 }, 1.1)
  s.wait(1.4).tool('archivist', 'compare', { ids: ['PSI-98', 'PSI-25', 'PSI-69'], fields: ['hardware', 'o2', 'flow'] }, { error: 'hardware field packs several racks into one string ("CIR  MDCA"); could not split' }, 1.2, 'error')
  s.usage('archivist', 0.01, 0.31)
  s.wait(1.5).state('t-s1', 'failed', 'compare: could not parse packed PSI hardware field').sub('S1', { status: 'failed' })
  s.say('archivist', 'flight', 'fail', 'compare() choked on PSI’s packed hardware field. Need a stronger parse.')
  s.wait(1.0).tool('flight', 'escalate', { subtask: 'S1', from: 'haiku', to: 'sonnet' }, { ok: true }, 0.6)
  s.wait(0.8).sub('S1', { status: 'running', model: 'sonnet', escalated: true, round: 2 }).task('t-s1b', 'flight', 'archivist', 'S1 (retry on sonnet) · Rank PSI investigations')
  s.wait(0.7).tool('archivist', 'psi_get', { id: 'PSI-20' }, { acronym: 'ACME BRE', atmospheres: ['14.7 psia / 21 %', '10.2 psia / 26.5 %', '8.2 psia / 34 %'] }, 1.0)
  s.wait(0.5).tool('archivist', 'psi_get', { id: 'PSI-98' }, { acronym: 'SAFFIRE-I', objective: 'how rapidly a large-scale fire grows in low gravity' }, 1.0)
  s.wait(0.5).tool('archivist', 'psi_get', { id: 'PSI-102' }, { acronym: 'SAME', objective: 'smoke particle sizes in low gravity' }, 1.0)
  s.wait(0.6).tool('archivist', 'rank_investigations', { atmosphere: '8.2 psia / 34 %', g: 'Moon', pillars: 3 }, { ranked: 24, top: ['PSI-20', 'PSI-98', 'PSI-102', 'PSI-25', 'PSI-69'] }, 1.6)
  s.usage('archivist', 0.03, 0.44)
  s.wait(1.8).evidence(
    [
      { id: 'PSI-20', score: 0.97, pillar: 'prevention', why: 'Only PSI test run at our exact atmosphere: 8.2 psia / 34 % O₂ (and 10.2 / 26.5).' },
      { id: 'PSI-98', score: 0.95, pillar: 'prevention', why: 'Large-scale fabric fire growth in low g — the closest thing to a real cabin fire.' },
      { id: 'PSI-102', score: 0.94, pillar: 'detection', why: 'Smoke particle sizes from overheated wiring materials vs the ISS detector.' },
      { id: 'PSI-25', score: 0.92, pillar: 'prevention', why: 'Flame spread and extinction vs low forced flow — our cabin is 8 cm/s.' },
      { id: 'PSI-69', score: 0.9, pillar: 'suppression', why: 'CO₂ / He suppressant effectiveness, LOI shift, cool flames.' },
      { id: 'PSI-100', score: 0.88, pillar: 'prevention', why: 'Repeat large-scale burn; scale effects on spread rate.' },
      { id: 'PSI-101', score: 0.86, pillar: 'detection', why: 'Smoke reflight with new materials and conditions.' },
      { id: 'PSI-99', score: 0.84, pillar: 'prevention', why: 'Nine spacecraft material samples — check for Nomex in the dataset.' },
      { id: 'PSI-26', score: 0.8, pillar: 'suppression', why: 'Solid-fuel extinction by flow reduction and N₂ dilution.' },
      { id: 'PSI-47', score: 0.7, pillar: 'detection', why: 'Dust vs smoke counting — lunar regolith nuisance alarms.' },
      { id: 'PSI-22', score: 0.66, pillar: 'cross', why: 'E-field as a partial-gravity proxy.' },
      { id: 'PSI-159', score: 0.62, pillar: 'prevention', why: 'Highest-O₂ µg flames in PSI (up to 85 % O₂ oxidizer).' },
    ],
    ['PSI-20', 'PSI-98', 'PSI-102', 'PSI-25', 'PSI-69'],
  )
  s.wait(0.4).say('archivist', 'flight', 'reply', 'Ranked 24. Headline: BRE (PSI-20) already burned at 8.2 psia / 34 % O₂. Top five: BRE, Saffire-I, SAME, BASS-II, FLEX.', [{ id: 'PSI-20' }, { id: 'PSI-98' }, { id: 'PSI-102' }, { id: 'PSI-25' }, { id: 'PSI-69' }], 't-s1b')
  s.wait(0.3).state('t-s1b', 'completed', 'ranked 24 investigations').sub('S1', { status: 'done' })
  s.wait(0.2).tool('flight', 'accept', { subtask: 'S1' }, { ok: true }, 0.4)

  // Fan out the three pillars.
  s.wait(1.0).tool('flight', 'delegate', { subtasks: ['S2', 'S3', 'S4'] }, { delivered: 3 }, 0.6)
  s.wait(0.3).sub('S2', { status: 'running' }).task('t-s2', 'flight', 'prevent', 'S2 · Cabin material flammability at 34 % O₂')
  s.wait(0.25).sub('S3', { status: 'running' }).task('t-s3', 'flight', 'detect', 'S3 · Will our detectors see the smoke?')
  s.wait(0.25).sub('S4', { status: 'running' }).task('t-s4', 'flight', 'suppress', 'S4 · Suppression at 8.2 psia: CO₂ vs water mist')
  s.usage('flight', 0.06, 0.21)

  // PREVENT
  s.wait(0.8).tool('prevent', 'psi_get', { id: 'PSI-25', fields: ['o2', 'flow', 'finding'] }, { o2: '≈16–21 % (N₂ dilution)', flow: '≤ 53 cm/s; flames sustained < 1 cm/s', finding: 'dim blue stable flames at very low flow' }, 1.0)
  // DETECT
  s.wait(0.3).tool('detect', 'psi_get', { id: 'PSI-102', fields: ['samples', 'sensors', 'finding'] }, { samples: 'cellulose, silicone, Teflon, Kapton, Pyrell', finding: 'ISS photoelectric often missed Teflon/Kapton smoke; much smoke < 500 nm' }, 1.2)
  // SUPPRESS
  s.wait(0.3).tool('suppress', 'psi_get', { id: 'PSI-69', fields: ['diluents', 'loi'] }, { diluents: ['CO₂', 'He'], heptaneLOI: { 'O₂/N₂': 0.15, 'with CO₂': 0.17 } }, 1.1)
  s.wait(1.2).tool('prevent', 'flammability_map', { material: 'nomex', psi: PSI, flow: FLOW, g: [0, MOON, 1] }, { limitingO2: r2(nomexLim), cabinO2: O2, verdict: O2 > nomexLim ? 'FLAMMABLE' : 'self-extinguishing', spread_mm_s: { ug: r2(nomexV.ug), moon: r2(nomexV.moon), earth_g: r2(nomexV.earth) } }, 1.8)
  s.wait(0.4).tool('detect', 'detector_coverage', { source: 'Kapton wire bundle, overheating', smokeMedian_um: MATERIALS.kapton.smokeD }, { photoelectric: pct(photo), ionization: pct(ion), note: 'size-weighted response' }, 1.6)
  s.wait(0.4).tool('suppress', 'extinction_limit', { fuel: 'heptane (proxy)', diluent: 'CO₂', cabinO2: O2 }, { loi: 0.17, co2FractionToExtinguish: pct(co2Needed), atEarthCabin: pct(co2Earth) }, 1.5)
  s.usage('prevent', 0.05, 0.37).usage('detect', 0.04, 0.33).usage('suppress', 0.04, 0.29)

  s.wait(2.0).note('prevent', `Nomex limiting O₂ ≈ ${pct(nomexLim, 1)} at ${FLOW} cm/s. Cabin is ${pct(O2)}. Self-extinguishing on ISS (21 %), burning in PR-2.`)
  s.wait(0.6).say('prevent', 'archivist', 'ask', 'Did any PSI flight actually burn Nomex in µg? I only have the 1 g LOI (~28–30 %).')
  s.wait(1.6).say('archivist', 'prevent', 'reply', 'Saffire-II (PSI-99) flew nine spacecraft material samples — the sample list is in its dataset, not the public metadata. Flagging for the team download.', [{ id: 'PSI-99' }])
  s.wait(0.8).say('detect', 'prevent', 'ask', 'What overheats first in a wiring fault — and does it burn at 34 %?')
  s.wait(1.6).say('prevent', 'detect', 'reply', 'Kapton (LOI ≈ 37 %) and PTFE (≈ 95 %) won’t sustain flame even at 34 % — but they smoke. That smoke is your early warning, before any Nomex ignites.')
  s.wait(0.8).note('detect', `Kapton smoke median ≈ ${MATERIALS.kapton.smokeD} µm. Photoelectric response ≈ ${pct(photo)}, ionization ≈ ${pct(ion)}. Same blind spot SAME found on ISS.`)
  s.wait(0.6).note('suppress', `To drop 34 % O₂ below LOI 0.17 you must dilute ≈ ${pct(co2Needed)} of the local atmosphere with CO₂ — vs ≈ ${pct(co2Earth)} in an Earth cabin.`)

  // SIM runs requested by each pillar.
  s.wait(1.0).say('prevent', 'sim', 'ask', `Run spread: Nomex, ${pct(O2)} O₂, ${PSI} psia, ${FLOW} cm/s, Moon g.`)
  s.wait(0.3).sub('S5', { status: 'running' }).task('t-s5', 'flight', 'sim', 'S5 · Run flame, spread, smoke and droplet sims')
  s.wait(0.6).tool('sim', 'sim_run', { sim: 'flame', o2: O2, psi: PSI, g: MOON }, { ok: true }, 0.6)
  s.wait(0.2).sim({ id: 'sim-flame', sim: 'flame', by: 'sim', label: 'Gravity flame · Moon · 34 % O₂', params: { o2: O2, psi: PSI, g: MOON, flow: 0 } })
  s.wait(5.0).sim({ id: 'sim-flame', sim: 'flame', by: 'sim', label: 'Gravity flame · Moon · 34 % O₂', params: { o2: O2, psi: PSI, g: MOON, flow: 0 }, metrics: { 'aspect ratio': r1(flameMoon.stretch), 'flicker Hz': r1(flameMoon.flickerHz), 'T ad (K, est.)': Math.round(flameMoon.tempK) } })
  s.wait(0.4).tool('sim', 'sim_run', { sim: 'spread', material: 'nomex', o2: O2, psi: PSI, flow: FLOW, g: MOON }, { ok: true }, 0.6)
  s.wait(0.2).sim({ id: 'sim-spread', sim: 'spread', by: 'sim', label: 'Nomex sheet · 34 % O₂ · 8 cm/s · Moon', params: { o2: O2, psi: PSI, g: MOON, flow: FLOW, material: 'nomex' } })
  s.wait(6.0).sim({ id: 'sim-spread', sim: 'spread', by: 'sim', label: 'Nomex sheet · 34 % O₂ · 8 cm/s · Moon', params: { o2: O2, psi: PSI, g: MOON, flow: FLOW, material: 'nomex' }, metrics: { 'spread mm/s (illustr.)': r2(nomexV.moon), 'limiting O₂': pct(nomexLim, 1), 'at 21 % O₂': 'self-extinguishes' } })
  s.wait(0.3).say('sim', 'prevent', 'reply', `Nomex sustains a creeping front at Moon g (${r2(nomexV.moon)} mm/s, illustrative). At 21 % it goes out.`)
  s.wait(0.3).say('detect', 'sim', 'ask', 'Smoke run: Kapton bundle behind the aft panel, return vent on, two detectors.')
  s.wait(0.4).tool('sim', 'sim_run', { sim: 'smoke', material: 'kapton', flow: FLOW, g: MOON }, { ok: true }, 0.6)
  s.wait(0.2).sim({ id: 'sim-smoke', sim: 'smoke', by: 'sim', label: 'Kapton smoke · aft panel · vent on', params: { o2: O2, psi: PSI, g: MOON, flow: FLOW, material: 'kapton' } })
  s.wait(7.0).sim({ id: 'sim-smoke', sim: 'smoke', by: 'sim', label: 'Kapton smoke · aft panel · vent on', params: { o2: O2, psi: PSI, g: MOON, flow: FLOW, material: 'kapton' }, metrics: { 'photoelectric @ vent': 'late / weak', 'ionization @ vent': 'alarms first', 'transport': 'vent-driven (weak buoyancy)' } })
  s.wait(0.3).say('suppress', 'sim', 'ask', 'Droplet run: 2.5 mm heptane proxy at 34 % O₂, then add CO₂.')
  s.wait(0.4).tool('sim', 'sim_run', { sim: 'droplet', o2: O2, co2: 0, diameter: 2.5 }, { ok: true }, 0.6)
  s.wait(0.2).sim({ id: 'sim-drop', sim: 'droplet', by: 'sim', label: 'Heptane droplet · 34 % O₂', params: { o2: O2, psi: PSI, g: 0, co2: 0, diameter: 2.5 } })
  s.wait(5.5).sim({ id: 'sim-drop', sim: 'droplet', by: 'sim', label: 'Heptane droplet · 34 % O₂', params: { o2: O2, psi: PSI, g: 0, co2: 0, diameter: 2.5 }, metrics: { 'K mm²/s (est.)': r2(drop.K), 'burn time s': r1(drop.life), 'CO₂ to extinguish': pct(co2Needed) } })
  s.usage('sim', 0.02, 0.26)
  s.wait(0.4).state('t-s5', 'completed', 'four sims done').sub('S5', { status: 'done' })

  // Pillars report back.
  s.wait(0.6).say('prevent', 'flight', 'reply', `Nomex crosses its limiting O₂ (~${pct(nomexLim)}) in this cabin. Cotton spreads ≈ ${r1(cottonX)}× faster than in an Earth cabin.`, [{ id: 'PSI-20' }, { id: 'PSI-25' }, { id: 'PSI-98' }], 't-s2')
  s.wait(0.2).state('t-s2', 'completed').sub('S2', { status: 'review' })
  s.wait(0.6).say('detect', 'flight', 'reply', 'Photoelectric-only detection is blind to wiring smoke (SAME). Add ionization or multi-sensor at return vents.', [{ id: 'PSI-102' }, { id: 'PSI-101' }], 't-s3')
  s.wait(0.2).state('t-s3', 'completed').sub('S3', { status: 'review' })
  s.wait(0.6).say('suppress', 'flight', 'reply', `CO₂ needs ≈ ${pct(co2Needed)} local dilution at 34 % O₂ — impractical. Primary: de-power + water mist. Watch for invisible cool flames (FLEX).`, [{ id: 'PSI-69' }, { id: 'PSI-39' }], 't-s4')
  s.wait(0.2).state('t-s4', 'completed').sub('S4', { status: 'review' })

  // SKEPTIC review round.
  s.wait(0.8).tool('flight', 'request_review', { subtasks: ['S2', 'S3', 'S4', 'S5'] }, { ok: true }, 0.5)
  s.wait(0.3).sub('S6', { status: 'running' }).task('t-s6', 'flight', 'skeptic', 'S6 · Review every claim; bound partial-g')
  s.wait(0.8).tool('skeptic', 'check_citations', { claims: 14 }, { verified: 12, flagged: 2 }, 2.0)
  s.wait(0.5).tool('skeptic', 'bound_partial_g', { g: MOON, lower: 'µg (PSI flight data)', upper: '1 g (NASA-STD-6001)' }, { bounded: true, proxy: 'PSI-22 E-FIELD', caveat: 'no Moon-g combustion data until LUCI / FM2' }, 1.6)
  s.usage('skeptic', 0.07, 0.41)
  s.wait(2.4).say('skeptic', 'prevent', 'review', 'Nomex spread rate is model-derived, not measured. Label it illustrative and cite the 1 g LOI source, or pull Saffire-II data.', [{ id: 'PSI-99' }])
  s.wait(0.2).sub('S2', { status: 'changes', round: 2 })
  s.wait(0.6).say('skeptic', 'flight', 'review', 'Moon g is untested in PSI. Every claim is bounded µg ↔ 1 g; E-FIELD (PSI-22) is the only proxy. Flag for LUCI / FM2.', [{ id: 'PSI-22' }])
  s.wait(1.4).say('prevent', 'skeptic', 'reply', 'Revised: spread marked “illustrative, calibrate with Saffire-II”; verdict rests on the LOI crossing, which is measured.')
  s.wait(0.4).sub('S2', { status: 'done', round: 2 }).sub('S3', { status: 'done' }).sub('S4', { status: 'done' })
  s.wait(0.4).state('t-s6', 'completed', '12/14 verified, 2 revised').sub('S6', { status: 'done' })

  // A call only the human can make.
  s.wait(0.8).askHuman(
    'ask-atmos',
    'Trade-off: keep 8.2 psia / 34 % and swap Nomex for a higher-LOI fabric, or move PR-2 to 10.2 psia / 26.5 % (Nomex self-extinguishes, longer prebreathe)?',
    ['Keep 34 % + swap materials', 'Move to 10.2 psia / 26.5 %'],
    10,
  )

  // SCRIBE assembles the dossier.
  s.wait(0.6).sub('S7', { status: 'running' }).task('t-s7', 'flight', 'scribe', 'S7 · Assemble the Fire Safety Dossier')
  s.wait(0.6).tool('scribe', 'chart_make', { kind: 'limiting-O₂ vs material', atmospheres: ['21 %', '26.5 %', '30 %', '34 %'] }, { ok: true }, 1.2)
  s.wait(1.0).dossier({
    id: 'summary',
    title: 'Verdict',
    pillar: 'summary',
    author: 'scribe',
    risk: 'high',
    body: [
      `PR-2 at 8.2 psia / 34 % O₂ is NOT certifiable with the current material list. Nomex stowage — self-extinguishing in ISS air — sustains flame above ≈ ${pct(nomexLim)} O₂.`,
      'Two of three pillars need changes: detection (photoelectric blind spot) and suppression (CO₂ ineffective at this O₂ fraction).',
    ],
    metrics: [
      { label: 'Nomex limiting O₂', value: pct(nomexLim, 1) },
      { label: 'Cabin O₂', value: pct(O2) },
      { label: 'Cotton spread vs Earth', value: `${r1(cottonX)}×` },
      { label: 'CO₂ to extinguish', value: pct(co2Needed) },
    ],
  })
  s.wait(1.4).dossier({
    id: 'prevention',
    title: 'Prevention — materials',
    pillar: 'prevention',
    author: 'prevent',
    risk: 'high',
    body: [
      'BRE burned gaseous fuel emulating condensed materials at exactly 8.2 psia / 34 % O₂ — the atmosphere is in the PSI envelope, which grounds this review.',
      'Flammability tracks O₂ mole fraction more than partial pressure: 34 % at 8.2 psia is ≈ 2.8 psia O₂ (sea level ≈ 3.1) yet far more flammable.',
      'Low cabin flow (8 cm/s) does not save us: BASS-II flames survived below 1 cm/s as dim blue flames.',
      'Spread rates here are illustrative until calibrated with Saffire-II/III datasets; the LOI crossing is the measured basis for the verdict.',
    ],
    cites: [{ id: 'PSI-20' }, { id: 'PSI-25' }, { id: 'PSI-98' }, { id: 'PSI-99' }],
  })
  s.wait(1.4).dossier({
    id: 'detection',
    title: 'Detection — smoke',
    pillar: 'detection',
    author: 'detect',
    risk: 'moderate',
    body: [
      'SAME showed the ISS photoelectric detector frequently missed smoke from Teflon and Kapton — the insulation on most of PR-2’s wiring.',
      'Smoke in low g spreads by mixing, not rising; detection lags are longer than in 1 g. Place detectors at return vents.',
      'Post-EVA regolith dust is a nuisance-alarm risk; DAFT’s dust/smoke counting work informs a two-signal (ionization + photoelectric) logic.',
    ],
    cites: [{ id: 'PSI-102' }, { id: 'PSI-101' }, { id: 'PSI-47' }],
  })
  s.wait(1.4).dossier({
    id: 'suppression',
    title: 'Suppression',
    pillar: 'suppression',
    author: 'suppress',
    risk: 'high',
    body: [
      `FLEX: CO₂ raises heptane’s LOI from 0.15 to ≈ 0.17. At 34 % O₂ that means diluting ≈ ${pct(co2Needed)} of the local atmosphere — versus ≈ ${pct(co2Earth)} in an Earth cabin.`,
      'Primary response: remove power (most fires start electrical), then fine water mist. Keep ventilation off to starve the flame.',
      'FLEX found cool flames that cameras cannot see but that emit CO and formaldehyde — monitor CO after "extinguishment".',
    ],
    cites: [{ id: 'PSI-69' }, { id: 'PSI-68' }, { id: 'PSI-39' }],
  })
  s.wait(1.2).dossier({
    id: 'limits',
    title: 'Limits of the evidence',
    pillar: 'limits',
    author: 'skeptic',
    body: [
      'No partial-gravity combustion data exists in PSI. Moon-g behaviour is bounded between µg flight data and 1 g ground tests; E-FIELD is the only proxy.',
      'Spread rates and smoke transport shown here are engineering visualisations for triage — confirm with FDS and the LUCI / FM2 lunar experiments.',
    ],
    cites: [{ id: 'PSI-22' }],
  })
  s.wait(1.2).dossier({
    id: 'actions',
    title: 'Recommended changes',
    pillar: 'actions',
    author: 'flight',
    body: [
      '1 · Replace Nomex stowage and crew garments with fabrics whose LOI is well above 34 % — or adopt the 10.2 psia / 26.5 % option.',
      '2 · Add ionization (or multi-criteria) detectors at return vents; keep photoelectric for dust discrimination.',
      '3 · Make de-power + water mist the primary suppression; CO₂ portable as backup only.',
      '4 · Request Saffire-II material data and LUCI / FM2 lunar-g results before final certification.',
    ],
  })
  s.wait(1.0).dossier({
    id: 'earth',
    title: 'Back on Earth',
    pillar: 'earth',
    author: 'scribe',
    body: [
      'The same physics drives oxygen-enriched hospital rooms, submarines and hyperbaric chambers. NASA fire work already gave Earth fine water-mist extinguishers, smoke detectors that tell smoke from dust, firefighter air tanks and protective clothing.',
    ],
  })
  s.wait(0.6).state('t-s7', 'completed', 'dossier assembled').sub('S7', { status: 'done' })
  s.wait(0.6).say('flight', HUMAN, 'reply', 'Dossier ready: NOT certifiable as specified; four changes listed, each traced to PSI evidence.')
  s.wait(0.3).done('Fire Safety Dossier delivered')
  return s.build()
}
