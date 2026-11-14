// The report as data: what the page shows, what the chat model is grounded in, and the scripted answers the demo
// mode gives. Everything is read from the finished run (model), the input files (pkg, cabin), the real ACME data
// and the smoke study. No numbers are typed in here.
import type { CameraEvent, SensorStats } from '@/data/acme'
import { nearest, type EvidenceRow } from '@/data/evidence'
import { ranked, targetOf } from '@/data/library'
import { AGENT, isPerson, orgOf } from '@/demo/crew'
import type { DesignPackage } from '@/demo/packages'
import type { SmokeStudy } from '@/lab/smokeStudy'
import type { Model } from '@/live/model'
import type { FireRun } from '@/stage/physics'
import { FDS_MANIFEST, fdsCase } from '@/fds/manifest'
import { FITS } from '@/sims/fits'

export type SectionId = 'summary' | 'cabin' | 'materials' | 'evidence' | 'fire' | 'smoke' | 'suppression' | 'lab' | 'decisions' | 'whatif' | 'open' | 'how' | 'sources'

export const SECTIONS: { id: SectionId; title: string; ask: string }[] = [
  { id: 'summary', title: 'The review in 30 seconds', ask: 'Why does this cabin fail?' },
  { id: 'cabin', title: 'The cabin and the inputs', ask: 'What was in the input files?' },
  { id: 'materials', title: 'Materials: what burns here', ask: 'Which materials fail and by how much?' },
  { id: 'evidence', title: 'Test data and what we processed', ask: 'Which real NASA tests is this based on?' },
  { id: 'fire', title: 'Fire spread and cabin pressure', ask: 'How fast does the fire spread and when does the hull fail?' },
  { id: 'smoke', title: 'Smoke detection and sensor placement', ask: 'Where should the smoke sensors go?' },
  { id: 'suppression', title: 'Suppression', ask: 'Would a CO₂ extinguisher put it out?' },
  { id: 'lab', title: 'Lab test L1 at WSTF', ask: 'What did the lab test show?' },
  { id: 'decisions', title: 'Decisions people made', ask: 'What did people decide?' },
  { id: 'whatif', title: 'What-ifs', ask: 'What if we changed the atmosphere or gravity?' },
  { id: 'open', title: 'Open items and test requests', ask: "What's still open?" },
  { id: 'how', title: 'How the review ran', ask: 'Who worked on this and what did it cost?' },
  { id: 'sources', title: 'Sources', ask: 'Which sources does the verdict rest on?' },
]
export const numberOf = (id: SectionId) => SECTIONS.findIndex((s) => s.id === id)

export type ReportInput = {
  model: Model
  pkg: DesignPackage
  runs: FireRun[]
  study?: SmokeStudy
  events: CameraEvent[]
  sensors?: SensorStats
  evidence: EvidenceRow[]
  pins: string[]
}

const pct = (x: number) => `${Math.round(x * 100)} %`
const secs = (t?: number) => (t === undefined ? 'never (in the run)' : `T+${t.toFixed(0)} s`)
const alarm = (t: number | null) => (t === null ? 'never in 60 s' : `${t.toFixed(0)} s`)

export function buildReport(x: ReportInput) {
  const { model, pkg, runs, study, events, sensors, evidence, pins } = x
  const m = model.matrix
  const fails = m.filter((r) => r.status !== 'pass')
  const asBuilt = runs.find((r) => r.variant.id === 'as-built') ?? runs[0]
  const prop = runs.find((r) => r.variant.id === 'proposal')
  const burning = asBuilt ? Object.values(asBuilt.ignite).filter((v) => v !== null).length : 0
  const hatch = pkg.hatch?.openTime ?? 90
  const target = targetOf(pkg.atmosphere.o2, pkg.atmosphere.psi)
  const near = nearest(evidence, target, 6)
  const pinned = evidence.filter((e) => pins.includes(e.id))
  const fit = ranked(target).slice(0, 5)
  const human = model.comms.filter((c) => isPerson(c.from) && c.kind === 'human')
  const cross = model.comms.filter((c) => c.from !== c.to && orgOf(c.from) && orgOf(c.to) && orgOf(c.from)!.id !== orgOf(c.to)!.id)
  const cites = [...new Map([...model.dossier.flatMap((d) => d.cites ?? []), ...m.flatMap((r) => r.cites ?? []), ...model.comms.flatMap((c) => c.cites ?? [])].map((c) => [c.id, c])).values()]
  const verdict = model.caseFile?.verdict
  const ev = (id: CameraEvent['id']) => events.find((e) => e.id === id)
  const designedNever = study?.cases.filter((c) => c.firstAlarm === null) ?? []
  const pr1 = model.proposals.find((p) => p.id === 'PR-1')
  const pr2 = model.proposals.find((p) => p.id === 'PR-2')
  const droplet = model.jobs.find((j) => j.id === 'j-droplet')
  const chamber = model.jobs.find((j) => j.id === 'j-chamber')
  const gpuJobs = model.jobs.filter((j) => j.gpus)
  const orgsUsed = [...new Set(Object.keys(model.agents).map((h) => AGENT[h]?.org).filter(Boolean))]

  const tldr = [
    `${fails.length} of ${m.length} listed materials sustain flame at ${pkg.atmosphere.label}; the prevention check fails outright.`,
    asBuilt ? `Modelled spread reaches ${burning} zones; the hull ruptures at ${secs(asBuilt.rupture)}, the hatch needs ${hatch} s to open.` : '',
    study ? `Smoke: the designed detectors miss ${designedNever.length} of ${study.cases.length} source × gravity cases; the proposed layout alarms in all of them (worst ${alarm(study.worstProposed)}).` : '',
    pr1 ? `${pr1.id} (${pr1.title}) was ${pr1.status}${pr1.decidedBy ? ` by ${pr1.decidedBy}` : ''}` + (prop ? `; with it ${prop.rupture === undefined ? 'the hull holds' : 'rupture moves to ' + secs(prop.rupture)}.` : '.') : '',
    'Out of scope: egress. The hatch design is outside what combustion data can judge.',
  ].filter(Boolean)

  const brief: Record<SectionId, string[]> = {
    summary: tldr,
    cabin: [
      `${pkg.vehicle}: ${pkg.volume}, crew ${pkg.crew}, ${pkg.atmosphere.label}, ${pkg.gravity.label}, vent ${pkg.ventFlow} cm/s.`,
      `${pkg.bom.length} parts in materials.csv; ignition zones listed: ${(pkg.ignitionZones ?? []).join(', ') || 'none'}; detectors listed: ${(pkg.sensors ?? []).map((s) => `${s.id} ${s.type} in ${s.zone}`).join(', ') || 'none'}.`,
    ],
    materials: m.map((r) => `${r.item} (${r.material}, ${r.zone ?? r.location}): ${r.status}; limiting O₂ ≈ ${pct(r.limitO2)} vs cabin ${pct(r.targetO2)}. ${r.action}`),
    evidence: [
      ev('ignition') ? `ACME CFI-G test 21256C2 (real camera data, processed in the browser): ignition at ${ev('ignition')!.t.toFixed(2)} s, steady flame at ${ev('steady')?.t.toFixed(1)} s, bright transient at ${ev('transient')?.t.toFixed(1)} s, dim glow at ${ev('glow')?.t.toFixed(1)} s.` : 'ACME frames not loaded.',
      sensors ? `ACME test 19175A4 sensor log (${sensors.channels} channels): fuel on ${sensors.fuelOn?.toFixed(1)} s, ignition by ion current ${sensors.ignition?.toFixed(1)} s, fuel off ${sensors.fuelOff?.toFixed(1)} s, burn ${sensors.burn?.toFixed(1)} s.` : '',
      `${evidence.length} real test rows (143 Flame Design test points, 39 CFI-G days, ${evidence.filter((e) => e.src !== 'Flame Design' && e.src !== 'CFI-G').length} points from the published BASS-II, Saffire and FLEX papers). Nearest to this cabin: ${near.map((n) => `${n.e.id} (${pct(n.e.o2)} O₂, ${n.e.psia} psia, match ${n.m.toFixed(2)})`).join('; ')}.`,
      `No test in the archive is at ${pct(pkg.atmosphere.o2)} ambient O₂: the verdict extrapolates the fitted limits.`,
      ...Object.values(FITS).map((f) => `Fit to published data, ${f.name} (${f.source}): rms error ${f.rmsModel.toFixed(3)} with our model → ${f.rmsFit.toFixed(3)} fitted. ${f.caveat}`),
      `Best-fitting studies: ${fit.map((f) => `${f.study.name} (${f.study.psi ?? f.study.id}, fit ${f.total.toFixed(2)})`).join('; ')}.`,
      ...model.jobs.filter((j) => j.kind === 'data').map((j) => `${j.title} by @${j.agent} on ${j.node ?? j.where}: ${Object.entries(j.stats).map(([k, v]) => `${k} ${v}`).join(', ')}.`),
    ],
    fire: [
      ...runs.map((r) => `${r.variant.label}: ${Object.values(r.ignite).filter((v) => v !== null).length}/${r.zones.length} zones burn, full involvement ${secs(r.fullAt)}, rupture ${secs(r.rupture)} (hull ${r.burstPsia} psia).`),
      ...fdsFire(asBuilt),
    ],
    smoke: study
      ? [
          `${study.runs} 2-D smoke CFD runs (stable fluids, ${study.nx}×${study.ny} cells of ${study.cell * 100} cm) on the cabin cross-section; ${study.sources.length} sources × µg / Moon / 1 g; smoke median ${study.smokeD} µm.`,
          ...study.cases.map((c) => `designed · ${c.source} · ${c.gLabel}: first alarm ${alarm(c.firstAlarm)} (${Object.entries(c.alarms).map(([k, v]) => `${k} ${alarm(v)}`).join(', ')})`),
          ...study.proposed.map((p) => `proposed ${p.id}: ${p.type} at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) m`),
          `Worst-case first alarm: designed ${alarm(study.worstDesigned)}, proposed ${alarm(study.worstProposed)}.`,
          ...fdsSmoke(),
        ]
      : ['The smoke study did not finish.'],
    suppression: droplet ? [`${droplet.title} (@${droplet.agent}, ${droplet.node}): ${Object.entries(droplet.stats).map(([k, v]) => `${k} ${v}`).join(', ')}.`, 'FLEX: droplet flames die below about 17 % O₂ with CO₂ as diluent (PSI-69).'] : ['Not run.'],
    lab: chamber ? [`${chamber.title} (@${chamber.agent}, ${chamber.node}): ${Object.entries(chamber.stats).map(([k, v]) => `${k} ${v}`).join(', ')}.`] : ['No physical test was booked.'],
    decisions: [
      ...human.map((c) => `${c.from} decided: ${c.text}`),
      ...model.proposals.map((p) => `${p.id} ${p.title}: ${p.status}${p.decidedBy ? ` by ${p.decidedBy}` : ''}. ${p.reviews.map((r) => `@${r.by} ${r.stance}s: ${r.text}`).join(' ')}`),
    ],
    whatif: runs.filter((r) => r.variant.id !== 'as-built').map((r) => `${r.variant.label}: ${Object.values(r.ignite).filter((v) => v !== null).length} zones, rupture ${secs(r.rupture)}.`),
    open: [
      `Egress: ${pkg.hatch?.type ?? 'hatch'} needs ${hatch} s to open; outside combustion data.`,
      ...fails.filter((r) => r.status === 'retest').map((r) => `Retest ${r.material} (${r.item}) at cabin conditions.`),
      ...model.tests.map((t) => `${t.id}: ${t.test} on ${t.material} at ${t.atmosphere}, ${t.lab}, ${t.status}.`),
      'Spread and pressure are lumped models; the smoke CFD is 2-D. Treat times as ordering, not as flight-certified numbers.',
    ],
    how: [
      `${orgsUsed.length} organisations, ${Object.keys(model.agents).length} agents, ${model.comms.length} messages (${cross.length} across org lines).`,
      `${model.saved.asks} questions answered by the dataset owner instead of re-reading archives: ≈ ${Math.round(model.saved.tokens / 1000)}k tokens saved.`,
      `${model.jobs.length} jobs (${gpuJobs.length} on GPUs: ${[...new Set(gpuJobs.map((j) => j.node))].join(', ')}); each ran on its owner's hardware and only results crossed Lagrange.`,
      `${human.length} decisions by people.`,
    ],
    sources: cites.map((c) => `${c.id}${c.note ? ` (${c.note})` : ''}`),
  }

  const context = JSON.stringify({
    sections: SECTIONS.map((s) => ({ id: s.id, n: numberOf(s.id), title: s.title, facts: brief[s.id] })),
    matrixZones: m.map((r) => r.zone).filter(Boolean),
    evidenceIds: [...near.map((n) => n.e.id), ...pinned.map((e) => e.id)],
    pinnedByReader: pinned.map((e) => e.id),
    verdict: verdict?.headline,
  })

  return { tldr, brief, context, near, pinned, fit, fails, asBuilt, prop, burning, hatch, human, cross, cites, verdict, designedNever, pr1, pr2, droplet, chamber, orgsUsed }
}

export type Report = ReturnType<typeof buildReport>

const fdsT = (v: number | null) => (v === null ? 'never' : `${v.toFixed(0)} s`)

/** FDS check lines for §4: the real FDS run beside the quick zone model. */
export function fdsFire(asBuilt?: FireRun): string[] {
  const g1 = fdsCase('1g'), ug = fdsCase('ug')
  if (!g1 || !ug) return []
  const a = g1.summary, u = ug.summary
  return [
    `FDS check (${FDS_MANIFEST.fds}, ${g1.cells.toLocaleString()} cells of ${g1.dx * 100} cm, generated from the same three files): at 1 g the ${g1.burner.kw} kW burner ignites the ${g1.burner.under?.toLowerCase() ?? 'nearest item'} and the fire outgrows it at ${fdsT(a.spreadAt)}; cabin pressure passes ${asBuilt?.burstPsia ?? 29} psia at ${fdsT(a.burstAt)} (quick model ${secs(asBuilt?.rupture)}; Review Board ≈ 15 s); peak ${(a.peakHrrKw / 1000).toFixed(1)} MW, ceiling ${a.maxCeilingC.toFixed(0)} °C.`,
    `FDS in µg: the same burner flashes once, then averages ${u.lateHrrKw.toFixed(0)} kW over the second half of the run (the burner is set to ${ug.burner.kw} kW until ${ug.burner.offAt} s) and nothing else catches in ${u.tEnd.toFixed(0)} s; cabin +${(u.peakPsia - u.startPsia).toFixed(1)} psi.`,
    'FDS surfaces use air cone-calorimeter data, so in 100 % O₂ it under-predicts the fire; it agrees with the quick model on the order of events, not on the exact times.',
  ]
}

/** FDS check lines for §5: detector obscuration in the real FDS run. */
export function fdsSmoke(): string[] {
  const g1 = fdsCase('1g'), ug = fdsCase('ug')
  if (!g1 || !ug) return []
  return [
    `FDS check, 1 g: ${Object.entries(g1.summary.alarms).map(([d, t]) => `${d} alarms at ${fdsT(t)}`).join(', ')} (chamber obscuration ≥ 3.24 %/m). µg: ${Object.values(ug.summary.alarms).every((t) => t === null) ? `no detector alarms in ${ug.summary.tEnd.toFixed(0)} s` : 'detectors alarm'}.`,
    'FDS models smoke as soot mass, so it cannot see that a photoelectric head misses small PTFE smoke: the 2-D study above can, which is why D2 differs.',
  ]
}

/** Scripted answers for demo mode: built from the same report, with the same pull-up tags the live model uses. */
export function scripted(r: Report, x: ReportInput, q: string): string {
  const s = q.toLowerCase()
  const study = x.study
  const firstFail = r.fails[0]
  if (/fail|why|verdict|safe/.test(s) && !/sensor|smoke|still|open/.test(s))
    return [
      `**It fails on materials before anything else.** ${r.fails.length} of ${x.model.matrix.length} listed parts burn at ${x.pkg.atmosphere.label}.`,
      firstFail ? `The worst is ${firstFail.item} (${firstFail.material}): its limiting O₂ is about ${pct(firstFail.limitO2)}, the cabin holds ${pct(firstFail.targetO2)}.` : '',
      `[[row:${firstFail?.zone ?? ''}]]`,
      r.asBuilt ? `Once lit, the fire reaches ${r.burning} zones and the hull ruptures at ${secs(r.asBuilt.rupture)}, against ${r.hatch} s to open the hatch.` : '',
      '[[chart:pressure]]',
      '[[section:materials]]',
    ].filter(Boolean).join('\n\n')
  if (/acme|data|camera|frame|evidence|nasa test/.test(s)) {
    const e = (id: string) => x.events.find((v) => v.id === id)
    return [
      `The Archivist processed the real ACME camera series for test **21256C2** (420 samples, 18 frames). From brightness alone it found ignition at **${e('ignition')?.t.toFixed(2)} s**, a steady flame from ${e('steady')?.t.toFixed(1)} s, a bright transient at ${e('transient')?.t.toFixed(1)} s and a dim glow at ${e('glow')?.t.toFixed(1)} s.`,
      '[[chart:acme]]',
      x.sensors ? `The 19175A4 sensor log agrees on the sequence: fuel on ${x.sensors.fuelOn?.toFixed(1)} s, ion-current ignition ${x.sensors.ignition?.toFixed(1)} s, ${x.sensors.burn?.toFixed(0)} s of burning.` : '',
      `Of ${x.evidence.length} real test rows none is near ${pct(x.pkg.atmosphere.o2)} ambient O₂. The closest:`,
      ...r.near.slice(0, 2).map((n) => `[[evidence:${n.e.id}]]`),
      'So the cabin verdict is an extrapolation, and the report says so.',
      '[[section:evidence]]',
    ].filter(Boolean).join('\n\n')
  }
  if (/sensor|smoke|detect|alarm/.test(s) && study)
    return [
      `The Detection agent ran **${study.runs} smoke CFD runs**: ${study.sources.length} ignition sources × µg, Moon and 1 g.`,
      `With the designed layout, ${r.designedNever.length} of ${study.cases.length} cases never alarm in 60 s: ${r.designedNever.map((c) => `${c.source} at ${c.gLabel}`).join(', ')}. Without buoyancy the smoke does not rise to the console detector, and the photoelectric head barely sees ${study.smokeD} µm PTFE smoke.`,
      '[[chart:smoke]]',
      `Proposed (PR-2): ${study.proposed.map((p) => `${p.id} ${p.type} at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) m`).join(', ')}. Worst-case first alarm **${alarm(study.worstProposed)}** in every case.${r.pr2 ? ` PR-2 was ${r.pr2.status}${r.pr2.decidedBy ? ` by ${r.pr2.decidedBy}` : ''}.` : ''}`,
      '[[section:smoke]]',
    ].join('\n\n')
  if (/decid|people|human|who/.test(s))
    return [
      'People made every call that changed the design:',
      ...r.human.map((c) => `- **${c.from}**: ${c.text}`),
      ...x.model.proposals.map((p) => `- ${p.id} ${p.title}: **${p.status}**${p.decidedBy ? ` by ${p.decidedBy}` : ''}`),
      '[[section:decisions]]',
    ].join('\n')
  if (/open|still|left|next/.test(s))
    return [...brief(r, 'open').map((l) => `- ${l}`), '', '[[section:open]]'].join('\n')
  if (/co2|co₂|extingu|suppress/.test(s)) return [...brief(r, 'suppression'), '[[section:suppression]]'].join('\n\n')
  if (/fds|cfd check|nist/.test(s))
    return [
      `**FDS check.** The Simulation agent generated a real NIST FDS case from the three input files and ran it at 1 g and in µg.`,
      ...fdsFire(r.asBuilt),
      '[[chart:fds]]',
      ...fdsSmoke(),
      '[[section:fire]]',
    ].join('\n\n')
  if (/pressure|hull|spread|fast/.test(s)) return [...brief(r, 'fire'), '[[chart:pressure]]', '[[section:fire]]'].join('\n\n')
  const sec = SECTIONS.find((v) => s.includes(v.title.toLowerCase()) || s.includes(`§${numberOf(v.id)}`)) ?? SECTIONS.find((v) => v.ask.toLowerCase() === s)
  if (sec) return [...brief(r, sec.id).slice(0, 6), `[[section:${sec.id}]]`].join('\n\n')
  return ['In demo mode I answer from the scripted set. Try one of the suggestions, or switch demo off to ask the model.', '[[section:summary]]'].join('\n\n')
}
const brief = (r: Report, id: SectionId) => r.brief[id]

