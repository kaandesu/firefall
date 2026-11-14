// PSI combustion investigations: the public metadata snapshot (scripts/fetch-psi.mjs) plus a small
// curated layer of test conditions and findings. Curated values cite their source; anything numeric
// that we could not source is left out rather than guessed. Team datasets (data/psi/<id>/) refine this.
import snapshot from '@data/psi/investigations.json'
import type { Pillar } from '@/live/types'

export type PsiRecord = (typeof snapshot.investigations)[number]

export type FuelType = 'solid' | 'gas' | 'droplet' | 'smoke' | 'aerosol' | 'model'

export type Curated = {
  short: string
  fuel: FuelType
  pillars: Pillar[]
  /** 0..1 base relevance to crewed-habitat fire safety before any scenario weighting. */
  base: number
  platform: string
  samples?: string
  o2?: string
  pressure?: string
  flow?: string
  sensors?: string
  finding?: string
  source?: { label: string; url: string }
}

export const CURATED: Record<string, Curated> = {
  'PSI-98': {
    short: 'Saffire-I',
    fuel: 'solid',
    pillars: ['prevention'],
    base: 0.97,
    platform: 'Cygnus (after ISS departure)',
    samples: 'Large SIBAL cotton-fiberglass fabric sheet',
    flow: 'Forced flow in a flow tunnel',
    sensors: 'Video, thermocouples, O₂/CO₂ sensors, radiometers',
    finding: 'First large-scale fire in µg: flame growth limited after ignition, unlike 1 g; full-scale tests matter.',
    source: { label: 'NTRS 20180005168', url: 'https://ntrs.nasa.gov/api/citations/20180005168/downloads/20180005168.pdf' },
  },
  'PSI-99': {
    short: 'Saffire-II',
    fuel: 'solid',
    pillars: ['prevention'],
    base: 0.93,
    platform: 'Cygnus',
    samples: 'Nine smaller samples of spacecraft materials',
    finding: 'Ignition and flame spread of several spacecraft materials vs NASA 1 g screening test.',
    source: { label: 'PSI-99', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-99' },
  },
  'PSI-100': {
    short: 'Saffire-III',
    fuel: 'solid',
    pillars: ['prevention', 'detection'],
    base: 0.95,
    platform: 'Cygnus',
    samples: 'Large fabric sample (repeat of Saffire-I at different flow)',
    finding: 'Large-sample spread was slower than small-tunnel tests predicted — scale and confinement change the answer.',
    source: { label: 'NTRS 20180005168', url: 'https://ntrs.nasa.gov/api/citations/20180005168/downloads/20180005168.pdf' },
  },
  'PSI-26': {
    short: 'BASS',
    fuel: 'solid',
    pillars: ['prevention', 'suppression'],
    base: 0.9,
    platform: 'ISS · Microgravity Science Glovebox',
    samples: 'Thin and thick flat samples, PMMA slabs, spheres, cylinders',
    flow: 'Fan-driven flow duct (SPICE duct)',
    sensors: 'Video, flow meter, O₂ dilution by N₂',
    finding: 'Solid-fuel flames burn and spread at very low forced flow in µg; extinction mapped vs flow.',
    source: { label: 'NTRS 20150019858', url: 'https://ntrs.nasa.gov/citations/20150019858' },
  },
  'PSI-25': {
    short: 'BASS-II',
    fuel: 'solid',
    pillars: ['prevention', 'suppression'],
    base: 0.94,
    platform: 'ISS · Microgravity Science Glovebox',
    samples: 'Thin/thick flat, PMMA slabs, spheres, cylinders; cotton-fiberglass fabric',
    o2: '≈16–21 % (N₂ dilution)',
    flow: 'up to 53 cm/s; flames sustained below 1 cm/s',
    sensors: 'Video, flow, O₂',
    finding: 'Flames survive at < 1 cm/s as dim blue stable flames; most heat-release rates < 100 W.',
    source: { label: 'NTRS 20150019858', url: 'https://ntrs.nasa.gov/citations/20150019858' },
  },
  'PSI-102': {
    short: 'SAME',
    fuel: 'smoke',
    pillars: ['detection'],
    base: 0.96,
    platform: 'ISS · Microgravity Science Glovebox',
    samples: 'Overheated cellulose, silicone rubber, Teflon, Kapton, Pyrell foam',
    sensors: 'ISS photoelectric + Shuttle ionization detectors, P-Trak, DustTrak, thermal precipitator',
    finding: 'ISS photoelectric detector often missed Teflon/Kapton smoke; much smoke < 500 nm; no single detector fits all.',
    source: { label: 'NIST / NASA', url: 'https://www.rdworldonline.com/nist-nasa-study-shows-one-detector-doesnt-fit-all-for-smoke-in-spacecraft' },
  },
  'PSI-101': {
    short: 'SAME-R',
    fuel: 'smoke',
    pillars: ['detection'],
    base: 0.92,
    platform: 'ISS · Microgravity Science Glovebox',
    samples: 'New materials and extended heating conditions vs SAME',
    sensors: 'Aerosol instruments, improved thermal precipitators',
    finding: 'Hypothesis: µg smoke particles grow larger without buoyant flow; detection lags longer as mixing dominates.',
    source: { label: 'PSI-101', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-101' },
  },
  'PSI-47': {
    short: 'DAFT',
    fuel: 'aerosol',
    pillars: ['detection'],
    base: 0.72,
    platform: 'ISS',
    sensors: 'Modified TSI P-Trak vs DustTrak',
    finding: 'Validated the particle counter used in SAME — and the dust-vs-smoke question behind nuisance alarms.',
    source: { label: 'PSI-47', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-47' },
  },
  'PSI-69': {
    short: 'FLEX',
    fuel: 'droplet',
    pillars: ['suppression'],
    base: 0.93,
    platform: 'ISS · Combustion Integrated Rack (MDCA)',
    samples: 'Free heptane and methanol droplets',
    o2: 'Varied, with CO₂ / He diluents',
    sensors: 'Backlit droplet video, radiometers, OH* imaging',
    finding: 'CO₂ dilution raises heptane LOI ≈ 0.15 → 0.17; discovered cool flames invisible to cameras.',
    source: { label: 'Springer 10.1007/s12217-014-9372-2', url: 'https://link.springer.com/doi/10.1007/s12217-014-9372-2' },
  },
  'PSI-68': {
    short: 'FLEX-2',
    fuel: 'droplet',
    pillars: ['suppression'],
    base: 0.82,
    platform: 'ISS · Combustion Integrated Rack (MDCA)',
    samples: 'Bi-component droplets, droplet arrays',
    finding: 'Extinction boundaries, soot shells and droplet-array interactions on flammability.',
    source: { label: 'PSI-68', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-68' },
  },
  'PSI-39': {
    short: 'CFI',
    fuel: 'droplet',
    pillars: ['suppression', 'prevention'],
    base: 0.7,
    platform: 'ISS · Combustion Integrated Rack (MDCA)',
    finding: 'Cool-flame droplet burning: low-temperature chemistry, a hidden fire hazard producing CO and formaldehyde.',
    source: { label: 'UCSD', url: 'https://jacobsschool.ucsd.edu/news/release/1548' },
  },
  'PSI-159': {
    short: 'CFI-G',
    fuel: 'gas',
    pillars: ['prevention'],
    base: 0.78,
    platform: 'ISS · CIR (ACME hardware)',
    samples: 'Spherical porous burner; propane, n-butane, n-pentane',
    o2: 'Oxidizer up to 85 % O₂ (inverse flames)',
    finding: 'Highest-O₂ µg combustion tests in PSI: steady cool diffusion flames for the first time.',
    source: { label: 'PSI-159', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-159' },
  },
  'PSI-20': {
    short: 'BRE',
    fuel: 'gas',
    pillars: ['prevention'],
    base: 0.9,
    platform: 'ISS · CIR (ACME hardware)',
    samples: 'Porous burners 25 and 50 mm; CH₄/N₂ and C₂H₄/N₂ emulating condensed fuels',
    o2: '21 % · 26.5 % · 34 %',
    pressure: '14.7 · 10.2 · 8.2 psia',
    flow: 'Quiescent (still air)',
    finding: 'Tested NASA exploration atmospheres directly: 14.7/21, 10.2/26.5, 8.2/34 — still-air burning vs material properties.',
    source: { label: 'PSI-20 objectives', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-20' },
  },
  'PSI-22': {
    short: 'E-FIELD',
    fuel: 'gas',
    pillars: ['cross'],
    base: 0.66,
    platform: 'ISS · CIR (ACME hardware)',
    finding: 'Electric field acts on flame ions — the only PSI proxy for partial-gravity buoyancy.',
    source: { label: 'PSI-22', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-22' },
  },
  'PSI-107': {
    short: 'SPICE',
    fuel: 'gas',
    pillars: ['detection', 'prevention'],
    base: 0.62,
    platform: 'ISS · Microgravity Science Glovebox',
    finding: 'Smoke points of co-flow jet flames — soot/smoke production of gaseous fires in µg.',
    source: { label: 'PSI-107', url: 'https://psi.nasa.gov/physci/repo/investigation/PSI-107' },
  },
  'PSI-106': { short: 'SLICE', fuel: 'gas', pillars: ['prevention'], base: 0.5, platform: 'ISS · Microgravity Science Glovebox', finding: 'Flame liftoff and structure in co-flow.' },
  'PSI-21': { short: 'CLD Flame', fuel: 'gas', pillars: ['prevention'], base: 0.45, platform: 'ISS · CIR (ACME hardware)', finding: 'Coflow laminar diffusion flames, soot and lift-off.' },
  'PSI-23': { short: 's-Flame', fuel: 'gas', pillars: ['prevention'], base: 0.45, platform: 'ISS · CIR (ACME hardware)', finding: 'Spherical flames: structure and response, extinction.' },
  'PSI-10': { short: 'Flame Design', fuel: 'gas', pillars: ['prevention'], base: 0.4, platform: 'ISS · CIR (ACME hardware)', finding: 'Designing soot-free flames: oxygen-enhanced and inverse configurations.' },
  'PSI-142': { short: 'Cool-flame transitions', fuel: 'model', pillars: ['suppression'], base: 0.45, platform: 'Ground / analysis', finding: 'Cool-flame transitions at radiation/stretch extinction.' },
  'PSI-62': { short: 'Concurrent spread model', fuel: 'model', pillars: ['prevention'], base: 0.6, platform: 'Analysis', finding: 'Flamelet-manifold modelling of concurrent flame spread in µg (Saffire-class).' },
  'PSI-60': { short: 'SPICE analysis', fuel: 'model', pillars: ['detection'], base: 0.4, platform: 'Analysis', finding: 'Computational/experimental analysis of SPICE data.' },
  'PSI-115': { short: 'SAME modelling', fuel: 'model', pillars: ['detection'], base: 0.68, platform: 'Analysis', finding: 'Smoke aerosol modelling from SAME data for detector design.' },
  'PSI-117': { short: 'Cool-flame perturbation', fuel: 'model', pillars: ['suppression'], base: 0.4, platform: 'Analysis', finding: 'External thermo-convective perturbation of cool flames.' },
}

export type Investigation = PsiRecord & { c: Curated }

export const INVESTIGATIONS: Investigation[] = snapshot.investigations.map((r) => ({
  ...r,
  c: CURATED[r.id] ?? { short: r.acronym ?? r.id, fuel: 'model', pillars: ['cross'], base: 0.3, platform: r.platform ?? '—' },
}))

export const BY_ID: Record<string, Investigation> = Object.fromEntries(INVESTIGATIONS.map((i) => [i.id, i]))

export const PSI_FETCHED_AT = snapshot.fetchedAt

export const PILLAR_COLOR: Record<Pillar, string> = {
  prevention: '#ff6b9a',
  detection: '#56d4ef',
  suppression: '#7ee787',
  cross: '#c9a2ff',
}

export const label = (id: string) => BY_ID[id]?.c.short ?? id
