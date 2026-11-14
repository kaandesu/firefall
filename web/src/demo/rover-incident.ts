// Scenario B: a smoke alarm in the PR-2 rover's aft avionics bay, the day after an EVA.
// Halo-speed: FLIGHT plans in seconds, the crew classifies the alarm, forecasts the smoke, and hands
// the crew a step-by-step action card traced to PSI evidence.
import { Script } from '@/live/script'
import { MATERIALS, detectorEfficiency, pct } from '@/sims/models'
import { HUMAN } from './crew'

const O2 = 0.34
const MOON = 0.165

export function roverIncident() {
  const s = new Script('run-inc')
  const photo = detectorEfficiency('photoelectric', MATERIALS.kapton.smokeD)
  const ion = detectorEfficiency('ionization', MATERIALS.kapton.smokeD)
  const photoDust = detectorEfficiency('photoelectric', 3)
  const co2Needed = 1 - 0.17 / O2

  s.alarm({ id: 'al-1', module: 'Aft avionics bay', detector: 'D3 · ionization', level: 'warning', text: 'SMOKE — aft avionics bay. D3 ionization high, D1 photoelectric low.' })
  s.wait(0.3).start(
    'PR-2 · smoke alarm, aft avionics bay',
    'incident',
    { vehicle: 'Pressurized rover PR-2', atmosphere: '8.2 psia · 34 % O₂', gravity: 'Moon 0.165 g', event: 'Smoke alarm D3 (ionization), aft avionics bay', context: 'Day after EVA — regolith in cabin' },
    'Smoke alarm aft avionics bay. D3 ionization high, D1 photoelectric quiet. Crew of 2 at the forward station. What do we do?',
  )
  s.wait(0.8).note('flight', 'Ventilation and bus power auto-shut on alarm (like Artemis II). First question: real smoke, or post-EVA dust?')
  s.wait(0.6).tool('flight', 'publish_plan', { subtasks: 5 }, { ok: true }, 0.5)
  s.wait(0.3).publishPlan({
    goal: 'Classify the alarm, forecast smoke, give the crew an action card',
    approved: true,
    subtasks: [
      { id: 'I1', title: 'Smoke or dust? Classify from detector signatures', agent: 'detect', model: 'sonnet', status: 'pending', pillar: 'detection' },
      { id: 'I2', title: 'Forecast smoke to the crew station', agent: 'sim', model: 'haiku', status: 'pending', pillar: 'detection' },
      { id: 'I3', title: 'Suppression options at 34 % O₂', agent: 'suppress', model: 'sonnet', status: 'pending', pillar: 'suppression' },
      { id: 'I4', title: 'Sanity-check the call', agent: 'skeptic', model: 'opus', deps: ['I1', 'I2', 'I3'], status: 'pending', pillar: 'cross' },
      { id: 'I5', title: 'Crew action card', agent: 'scribe', model: 'sonnet', deps: ['I4'], status: 'pending', pillar: 'cross' },
    ],
  })
  s.wait(0.4).tool('flight', 'delegate', { subtasks: ['I1', 'I2', 'I3'] }, { delivered: 3 }, 0.4)
  s.wait(0.2).sub('I1', { status: 'running' }).task('t-i1', 'flight', 'detect', 'I1 · Smoke or dust? Classify from detector signatures')
  s.wait(0.2).sub('I2', { status: 'running' }).task('t-i2', 'flight', 'sim', 'I2 · Forecast smoke to the crew station')
  s.wait(0.2).sub('I3', { status: 'running' }).task('t-i3', 'flight', 'suppress', 'I3 · Suppression options at 34 % O₂')

  s.wait(0.6).tool('detect', 'psi_get', { id: 'PSI-47', fields: ['objectives'] }, { finding: 'dust vs smoke particle counting validated in µg' }, 0.9)
  s.wait(0.3).tool('detect', 'psi_get', { id: 'PSI-102', fields: ['finding'] }, { finding: 'photoelectric misses small Teflon/Kapton smoke' }, 0.9)
  s.wait(0.3).tool('sim', 'sim_run', { sim: 'smoke', source: 'aft bay', vent: 'off (auto-shutdown)', g: MOON }, { ok: true }, 0.5)
  s.wait(0.2).sim({ id: 'inc-smoke', sim: 'smoke', by: 'sim', label: 'Forecast · aft bay · vent OFF · Moon g', params: { o2: O2, psi: 8.2, g: MOON, flow: 0, material: 'kapton' } })
  s.wait(1.2).tool('detect', 'detector_coverage', { readings: { D3_ionization: 'high', D1_photoelectric: 'low' } }, { smokeSignature: { photoelectric: pct(photo), ionization: pct(ion) }, dustSignature: { photoelectric: pct(photoDust) }, match: 'small-particle smoke (overheated insulation)' }, 1.4)
  s.wait(0.2).tool('suppress', 'extinction_limit', { cabinO2: O2, diluent: 'CO₂' }, { co2FractionToExtinguish: pct(co2Needed) }, 1.2)
  s.usage('detect', 0.03, 0.22).usage('suppress', 0.03, 0.2)

  s.wait(1.6).say('detect', 'flight', 'reply', `Not dust. Regolith (~µm) would light the photoelectric D1 first (≈ ${pct(photoDust)} response). Ionization-high / photo-low is the small-particle signature SAME measured for overheated Kapton/Teflon.`, [{ id: 'PSI-102' }, { id: 'PSI-47' }], 't-i1')
  s.wait(0.2).state('t-i1', 'completed').sub('I1', { status: 'done' })
  s.wait(0.6).say('suppress', 'detect', 'ask', 'Any flame signature, or pure smoke?')
  s.wait(1.2).say('detect', 'suppress', 'reply', 'No IR flame signal on the bay camera. Smouldering/overheat so far.')
  s.wait(0.5).say('suppress', 'flight', 'reply', `Keep bus de-powered — removing the ignition source is the extinguisher. CO₂ would need ≈ ${pct(co2Needed)} dilution here. Water mist on standby; CO monitor on (FLEX cool flames are invisible).`, [{ id: 'PSI-69' }, { id: 'PSI-39' }], 't-i3')
  s.wait(0.2).state('t-i3', 'completed').sub('I3', { status: 'done' })

  s.wait(3.0).sim({ id: 'inc-smoke', sim: 'smoke', by: 'sim', label: 'Forecast · aft bay · vent OFF · Moon g', params: { o2: O2, psi: 8.2, g: MOON, flow: 0, material: 'kapton' }, metrics: { 'vent OFF': 'smoke stays in aft third', 'vent ON': 'reaches crew in ~40 s', buoyancy: 'weak at 0.165 g' } })
  s.wait(0.3).say('sim', 'flight', 'reply', 'Vent OFF keeps smoke in the aft third for minutes at Moon g; vent ON carries it to the crew station in ~40 s (illustrative).', [{ id: 'PSI-101' }], 't-i2')
  s.wait(0.2).state('t-i2', 'completed').sub('I2', { status: 'done' })

  s.wait(0.4).sub('I4', { status: 'running' }).task('t-i4', 'flight', 'skeptic', 'I4 · Sanity-check the call')
  s.wait(0.6).tool('skeptic', 'check_citations', { claims: 6 }, { verified: 5, flagged: 1 }, 1.2)
  s.wait(1.4).say('skeptic', 'flight', 'review', 'Detector-ratio classification is a heuristic, not a certified method. Fine for triage — confirm with a CO / particle-count reading before clearing the bay.', [{ id: 'PSI-47' }])
  s.wait(0.3).state('t-i4', 'completed').sub('I4', { status: 'done' })

  s.wait(0.6).askHuman('ask-exec', 'Recommend: keep aft bus de-powered, ventilation OFF, crew masks on, water mist staged, CO monitor. Execute?', ['Execute', 'Hold — get a CO reading first'], 8)

  s.wait(0.4).sub('I5', { status: 'running' }).task('t-i5', 'flight', 'scribe', 'I5 · Crew action card')
  s.wait(1.0).dossier({
    id: 'actions',
    title: 'Crew action card',
    pillar: 'actions',
    author: 'scribe',
    risk: 'high',
    body: [
      '1 · Masks on. Stay at the forward station.',
      '2 · Confirm aft avionics bus de-powered (ignition source removed).',
      '3 · Ventilation OFF — starves the flame and keeps smoke aft (low-g smoke spreads by mixing).',
      '4 · Water mist staged at the aft hatch; CO₂ only as backup (needs ≈ 50 % dilution at 34 % O₂).',
      '5 · Monitor CO for 30 min after the smoke clears — cool flames are invisible to cameras.',
      '6 · Clear the bay only after particle count + CO return to baseline.',
    ],
    cites: [{ id: 'PSI-102' }, { id: 'PSI-47' }, { id: 'PSI-69' }, { id: 'PSI-39' }],
    metrics: [
      { label: 'Classification', value: 'Smoke (not dust)' },
      { label: 'Likely source', value: 'Overheated insulation' },
      { label: 'CO₂ to extinguish', value: pct(co2Needed) },
    ],
  })
  s.wait(1.0).dossier({
    id: 'limits',
    title: 'Why this works — and its limits',
    pillar: 'limits',
    author: 'skeptic',
    body: [
      'Every step traces to a PSI investigation: SAME for the detector signature, DAFT for dust vs smoke, FLEX for suppressant limits and cool flames.',
      'Moon-g smoke transport is bounded between µg and 1 g — no partial-g data in PSI yet.',
    ],
    cites: [{ id: 'PSI-102' }, { id: 'PSI-47' }, { id: 'PSI-69' }],
  })
  s.wait(0.5).state('t-i5', 'completed').sub('I5', { status: 'done' })
  s.wait(0.4).say('flight', HUMAN, 'reply', 'Action card is up. Bay contained; monitoring CO.')
  s.wait(0.3).done('Incident contained — action card delivered')
  return s.build()
}
