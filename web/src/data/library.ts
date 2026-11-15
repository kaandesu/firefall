// The dataset library: 20 PSI combustion studies (ported from flame-in-freefall's catalogue).
// `ingested` = raw data is on the archive cluster and processed; `indexed` = values typed from public summaries.
// Only ACME Flame Design and CFI-G have real data in this repo (web/public/data/acme); the rest are nominal.

export type Pillar = 'prevention' | 'detection' | 'suppression' | 'supporting'
export type Fuel = 'solid' | 'gas' | 'gas_solid_emulator' | 'liquid' | 'aerosol'
export type Flow = 'quiescent' | 'low' | 'ventilation' | 'high'

export type Study = {
  id: string
  name: string
  psi?: string
  hw: string
  fuel: Fuel
  pillars: Pillar[]
  o2: [number, number]
  kpa: [number, number]
  flow: Flow
  status: 'ingested' | 'indexed'
  years?: string
  plain: string
  obj: string
  key: string
  varied: string
  fixed: string
  sensors: string
  /** What sits on the archive's storage. */
  size: string
  files?: number
  /** Real data we can open in the app. */
  data?: 'acme-flame-design' | 'acme-cfi-g' | 'saffire-f1c2' | 'bass-stills'
}

export const STUDIES: Study[] = [
  { id: 'flame-design', name: 'ACME Flame Design', psi: 'PSI-10', hw: 'ACME / CIR', fuel: 'gas', pillars: ['prevention'], o2: [0.2, 0.85], kpa: [43, 305], flow: 'quiescent', status: 'ingested', years: '2019 · 2021–22', size: '61 GB', files: 9, data: 'acme-flame-design',
    plain: 'Spherical flames burned for minutes to find when they make soot and when they go out.',
    obj: 'Soot-inception and extinction limits of normal and inverse spherical ethylene diffusion flames vs flow rate, Zst, dilution and pressure.',
    key: 'All flames went out at a critical 1130 K; steady flames held up to 870 s; flames grow until radiation loss ≈ heat release.',
    varied: 'O₂ and fuel fractions, flow 0.6–12.2 mg/s, pressure 6.2–44.2 psia, normal vs inverse', fixed: 'Porous steel sphere burner, ethylene (propane on day 21301), N₂ inert',
    sensors: 'DataCam color, intensified camera, PMT ×3, radiometers ×5, thermocouples, ion current, pressure' },
  { id: 'cfi-g', name: 'ACME CFI-G', psi: 'PSI-159', hw: 'ACME / CIR', fuel: 'gas', pillars: ['prevention', 'suppression'], o2: [0.18, 0.85], kpa: [50.7, 304], flow: 'quiescent', status: 'ingested', years: '2021', size: '27 GB', files: 4, data: 'acme-cfi-g',
    plain: 'Hunted for nearly invisible "cool flames" made by gas fuels, the kind that can linger after a fire looks out.',
    obj: 'Find conditions for cool diffusion flames of ethane, propane and n-butane; normal and inverse; range of Zst, Tad, pressure and flow.',
    key: 'First spherical gas cool flames, only for normal n-butane at 2 bar and X_O₂ = 0.39; hot flames were 2.6× larger; Pt thermocouple re-ignited hot flames.',
    varied: 'Fuel (C₂H₆, C₃H₈, n-C₄H₁₀), O₂ ~18–40% (normal) or 85% burner (inverse), pressure 7.35–44.1 psia', fixed: 'Spherical porous burner Ø 6.35 mm, N₂ diluent',
    sensors: 'Intensified camera (formaldehyde filter), radiometers, thermocouple rakes' },
  { id: 'saffire-1', name: 'Saffire-I', psi: 'PSI-98', hw: 'Cygnus', fuel: 'solid', pillars: ['prevention'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', years: '2016', size: '38 GB',
    plain: 'A large fabric fire lit inside an empty cargo spacecraft after it left the station, to see how fast a realistic fire grows.',
    obj: '(1) How rapidly a large-scale fire grows in low gravity; (2) low-g flammability limits vs NASA’s normal-gravity material screening test.',
    key: 'Large-scale fabric fire, 0.94 × 0.4 m, at 20 cm/s airflow; validates NASA’s material selection criteria.',
    varied: 'Single large-scale test', fixed: 'SIBAL fabric (75% cotton / 25% fiberglass), 0.94 × 0.4 m, flow 20 cm/s, cabin air',
    sensors: '2 video cameras, thermocouples (flow, flame, plume), 2 radiometers, pressure, O₂ and CO₂ sensors, 2 anemometers', data: 'saffire-f1c2' },
  { id: 'saffire-2', name: 'Saffire-II', psi: 'PSI-99', hw: 'Cygnus', fuel: 'solid', pillars: ['prevention'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', years: '2016', size: '22 GB',
    plain: 'Nine different spacecraft materials ignited one after another.', obj: 'Ignition and flammability of several materials.', key: 'Material-to-material comparison at scale.', varied: 'Material', fixed: 'Cabin air', sensors: 'Video, gas sensors' },
  { id: 'saffire-3', name: 'Saffire-III', psi: 'PSI-100', hw: 'Cygnus', fuel: 'solid', pillars: ['prevention'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', years: '2017', size: '31 GB',
    plain: 'A repeat of the large fabric fire with different flow and ignition.', obj: 'Large-scale flame spread, second campaign.', key: 'Pressure and temperature rise in a closed volume.', varied: 'Flow', fixed: 'Fabric, cabin air', sensors: 'Video, gas, pressure' },
  { id: 'bass', name: 'BASS', psi: 'PSI-26', hw: 'MSG duct', fuel: 'solid', pillars: ['prevention', 'suppression'], o2: [0.17, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', size: '9 GB',
    plain: 'Burned fabric and plastic samples in moving air to see how fast flames spread and whether airflow alone puts them out.', obj: 'Burning and suppression of solid materials in a flow duct.', key: 'Material flammability vs airflow in microgravity.', varied: 'Material, airflow, O₂ (nominal)', fixed: 'SPICE flow duct', sensors: 'Video, thermocouples, radiometer' },
  { id: 'bass-ii', name: 'BASS-II', psi: 'PSI-25', hw: 'MSG duct', fuel: 'solid', pillars: ['prevention', 'suppression'], o2: [0.15, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', size: '12 GB',
    plain: 'Follow-up to BASS with more materials and lower oxygen levels.', obj: 'Extended solid-fuel burning and suppression tests.', key: 'Flammability boundaries of solids vs flow and O₂.', varied: 'Material, flow, O₂ (nominal)', fixed: 'SPICE flow duct', sensors: 'Video, thermocouples', data: 'bass-stills' },
  { id: 'brei', name: 'ACME BRE', psi: 'PSI-20', hw: 'ACME / CIR', fuel: 'gas_solid_emulator', pillars: ['prevention'], o2: [0.21, 0.4], kpa: [101, 101], flow: 'quiescent', status: 'indexed', size: '4 GB',
    plain: 'Used gas burners to imitate burning solids, so material properties can be tested without real samples.', obj: 'Emulate condensed-fuel burning to study flammability vs material properties.', key: 'Bridges gas-flame physics to solid materials.', varied: 'Fuel mix, flow (nominal)', fixed: 'Porous flat burners', sensors: 'Heat flux, thermocouples, cameras' },
  { id: 'e-field', name: 'ACME E-FIELD Flames', psi: 'PSI-22', hw: 'ACME / CIR', fuel: 'gas', pillars: ['supporting'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'low', status: 'indexed', size: '6 GB',
    plain: 'Used an electric field to push on flames, partly mimicking gravity.', obj: 'Electric-field effects on laminar diffusion flames.', key: 'A stand-in for partial gravity.', varied: 'Voltage', fixed: 'Coflow burner', sensors: 'Ion current, cameras' },
  { id: 'cld', name: 'ACME CLD Flame', psi: 'PSI-21', hw: 'ACME / CIR', fuel: 'gas', pillars: ['supporting'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'low', status: 'indexed', size: '5 GB',
    plain: 'Coflow flames for soot and lift-off studies.', obj: 'Coflow laminar diffusion flames.', key: 'Soot and stability.', varied: 'Flow, dilution', fixed: 'Coflow burner', sensors: 'Cameras' },
  { id: 's-flame', name: 'ACME s-Flame', psi: 'PSI-23', hw: 'ACME / CIR', fuel: 'gas', pillars: ['supporting'], o2: [0.21, 0.3], kpa: [101, 101], flow: 'quiescent', status: 'indexed', size: '7 GB',
    plain: 'Very weak spherical flames near their limits.', obj: 'Spherical flames near limits for model validation.', key: 'Low-temperature limits.', varied: 'Mixture', fixed: 'Spherical burner', sensors: 'Cameras, radiometers' },
  { id: 'flex', name: 'FLEX', psi: 'PSI-69', hw: 'MDCA / CIR', fuel: 'liquid', pillars: ['suppression'], o2: [0.15, 0.4], kpa: [50, 300], flow: 'quiescent', status: 'indexed', size: '18 GB',
    plain: 'Burned floating fuel droplets and added CO₂ or helium to see what puts them out.', obj: 'Droplet extinction by gaseous suppressants.', key: 'Suppressant dilution levels; discovery of droplet cool flames.', varied: 'Fuel, diluent, O₂ (nominal)', fixed: 'Free-floating droplets', sensors: 'Cameras, radiometer' },
  { id: 'flex-2', name: 'FLEX-2', psi: 'PSI-68', hw: 'MDCA / CIR', fuel: 'liquid', pillars: ['suppression'], o2: [0.15, 0.4], kpa: [50, 300], flow: 'quiescent', status: 'indexed', size: '14 GB',
    plain: 'Droplet fires of fuel mixtures, closer to real fuels.', obj: 'Multicomponent droplet combustion.', key: 'Mixture effects on burning and extinction.', varied: 'Fuel mix', fixed: 'MDCA', sensors: 'Cameras' },
  { id: 'cfi', name: 'CFI', psi: 'PSI-39', hw: 'MDCA / CIR', fuel: 'liquid', pillars: ['suppression'], o2: [0.15, 0.4], kpa: [50, 300], flow: 'quiescent', status: 'indexed', size: '11 GB',
    plain: 'Cool flames of liquid droplets, the predecessor of CFI-G.', obj: 'Cool-flame droplet combustion.', key: 'Flames that continue after visible extinction.', varied: 'Fuel, O₂', fixed: 'MDCA', sensors: 'Intensified camera' },
  { id: 'spice', name: 'SPICE', psi: 'PSI-107', hw: 'MSG duct', fuel: 'gas', pillars: ['prevention'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'low', status: 'indexed', size: '3 GB',
    plain: 'Measured when gas flames start to make smoke.', obj: 'Smoke point in coflow.', key: 'Smoke production in microgravity.', varied: 'Fuel, flow', fixed: 'Coflow nozzle', sensors: 'Cameras' },
  { id: 'slice', name: 'SLICE', psi: 'PSI-106', hw: 'MSG duct', fuel: 'gas', pillars: ['supporting'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'low', status: 'indexed', size: '2 GB',
    plain: 'Studied how gas flames lift off the nozzle.', obj: 'Structure and liftoff of coflow flames.', key: 'Flame stability.', varied: 'Flow', fixed: 'Coflow nozzle', sensors: 'Cameras' },
  { id: 'same', name: 'SAME', psi: 'PSI-102', hw: 'MSG', fuel: 'aerosol', pillars: ['detection'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'low', status: 'indexed', size: '2 GB',
    plain: 'Measured the smoke particles from overheated spacecraft materials to design better smoke detectors.', obj: 'Smoke particle size from pyrolysed materials.', key: 'Space smoke differs from Earth smoke: particles are larger, which ionization detectors miss.', varied: 'Material, temperature', fixed: 'Smoke sampling train', sensors: 'Particle counters' },
  { id: 'same-r', name: 'SAME-R', psi: 'PSI-101', hw: 'MSG', fuel: 'aerosol', pillars: ['detection'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'low', status: 'indexed', size: '3 GB',
    plain: 'Repeat of SAME with improved instruments.', obj: 'Smoke aerosol re-flight.', key: 'Detector design data.', varied: 'Material', fixed: '—', sensors: 'Particle instruments' },
  { id: 'daft', name: 'DAFT', psi: 'PSI-47', hw: 'ISS cabin', fuel: 'aerosol', pillars: ['detection'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', size: '1 GB',
    plain: 'Used a smoke instrument to measure dust, important where lunar dust could trigger false alarms.', obj: 'Dust measurement feasibility.', key: 'Smoke vs dust discrimination.', varied: '—', fixed: 'Cabin', sensors: 'Particle counter' },
  { id: 'daft-2', name: 'DAFT-2', psi: 'PSI-47', hw: 'ISS cabin', fuel: 'aerosol', pillars: ['detection'], o2: [0.21, 0.21], kpa: [101, 101], flow: 'ventilation', status: 'indexed', size: '1 GB',
    plain: 'Second dust measurement campaign.', obj: 'Dust measurement follow-up.', key: 'Detector false-alarm data.', varied: '—', fixed: 'Cabin', sensors: 'Particle counter' },
]

export const STUDY: Record<string, Study> = Object.fromEntries(STUDIES.map((s) => [s.id, s]))
export const studyByPsi = (psi: string) => STUDIES.find((s) => s.psi === psi)

export const PSI_KPA = 6.894757

/** A target cabin, in the units the library uses. */
export type Target = { o2: number; kpa: number; vent?: Flow }
export const targetOf = (o2: number, psia: number): Target => ({ o2, kpa: psia * PSI_KPA, vent: 'ventilation' })

const W = { o2: 0.3, pressure: 0.15, flow: 0.15, fuel: 0.15, pillar: 0.15, completeness: 0.1 }
const FUEL: Record<Fuel, number> = { solid: 1, gas_solid_emulator: 0.8, liquid: 0.6, gas: 0.5, aerosol: 0.35 }
const FLOWS: Flow[] = ['quiescent', 'low', 'ventilation', 'high']
const rangeDist = (v: number, [a, b]: [number, number]) => (v < a ? a - v : v > b ? v - b : 0)
const pct = (v: number) => `${Math.round(v * 100)}%`

export type Fit = { study: Study; total: number; parts: Record<keyof typeof W, number>; why: string }

/** How well a study's tested conditions cover this cabin (0..1), with the reasons. */
export function fit(study: Study, h: Target): Fit {
  const dO2 = rangeDist(h.o2, study.o2)
  const lp = Math.log(h.kpa)
  const [l0, l1] = [Math.log(study.kpa[0]), Math.log(study.kpa[1])]
  const dP = lp < l0 ? l0 - lp : lp > l1 ? lp - l1 : 0
  const fd = Math.abs(FLOWS.indexOf(study.flow) - FLOWS.indexOf(h.vent ?? 'ventilation'))
  const parts = {
    o2: Math.exp(-((dO2 / 0.1) ** 2)),
    pressure: Math.exp(-((dP / 0.35) ** 2)),
    flow: fd === 0 ? 1 : fd === 1 ? 0.5 : 0,
    fuel: FUEL[study.fuel],
    pillar: study.pillars.includes('supporting') ? 0.3 : 1,
    completeness: study.status === 'ingested' ? 1 : 0.4,
  }
  let total = 0
  for (const k of Object.keys(W) as (keyof typeof W)[]) total += W[k] * parts[k]
  if (study.status !== 'ingested') total *= 0.8
  const why = [
    study.status !== 'ingested' ? 'nominal values ×0.8' : 'real data',
    dO2 === 0 ? `O₂ ${pct(h.o2)} inside tested ${pct(study.o2[0])}–${pct(study.o2[1])}` : `O₂ tested ${pct(study.o2[0])}–${pct(study.o2[1])} only`,
    dP === 0 ? 'pressure covered' : `tested at ${Math.round(study.kpa[0])}${study.kpa[1] !== study.kpa[0] ? `–${Math.round(study.kpa[1])}` : ''} kPa`,
  ]
  return { study, total, parts, why: why.join(' · ') }
}

export const ranked = (h: Target) => STUDIES.map((s) => fit(s, h)).sort((a, b) => b.total - a.total)
export const FIT_WEIGHTS = W
