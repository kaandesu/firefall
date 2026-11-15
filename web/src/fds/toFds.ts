// Generate a real NIST FDS input file (.fds) from the three intake files.
//   cabin.model.json → mesh, the hull voxelised into stepped &OBST, every primitive as an &OBST
//   cabin.yaml       → &MISC P_INF / GVEC, 100 % O₂ background, burner in the ignition zone, detectors as &DEVC
//   materials.csv    → one &SURF + &MATL per material, from cited cone-calorimeter data
// The output runs unchanged in FDS 6.11 (scripts/fds/run.sh). Coordinates: the model is y-up, FDS is z-up,
// so model (x, y, z) → FDS (x, z, y). Every rotated part becomes its axis-aligned bounding box (FDS OBSTs are boxes).
import type { CabinModel, CabinSpec, MaterialKey, MaterialRow, Primitive, Vec3 } from '@/intake/parse'

/** Representative material data for the FDS surfaces. Air, 35–50 kW/m² cone calorimeter; see `ref`. */
export type FdsMaterial = {
  label: string
  /** Peak-ish heat release rate per unit area once burning, kW/m². */
  hrrpua: number
  /** Surface temperature at which the item ignites, °C. */
  ignitionC: number
  density: number // kg/m³
  conductivity: number // W/m/K
  specificHeat: number // kJ/kg/K
  thickness: number // m
  color: string
  ref: string
}

const CONE = 'Babrauskas, Ignition Handbook (2003) tables 14–15; SFPE Handbook 5th ed. ch. 26 (cone calorimeter, air)'

export const FDS_MATERIALS: Partial<Record<MaterialKey, FdsMaterial>> = {
  nylon: { label: 'Nylon 6,6 fabric', hrrpua: 800, ignitionC: 430, density: 1140, conductivity: 0.24, specificHeat: 1.7, thickness: 0.0005, color: 'ORANGE', ref: CONE },
  cotton: { label: 'Cotton fabric', hrrpua: 200, ignitionC: 260, density: 300, conductivity: 0.06, specificHeat: 1.3, thickness: 0.001, color: 'KHAKI', ref: CONE },
  pmma: { label: 'PMMA / PU foam pad', hrrpua: 650, ignitionC: 300, density: 1190, conductivity: 0.19, specificHeat: 1.42, thickness: 0.006, color: 'LIGHT BLUE', ref: CONE },
  nomex: { label: 'Nomex fabric', hrrpua: 100, ignitionC: 500, density: 380, conductivity: 0.05, specificHeat: 1.2, thickness: 0.002, color: 'GOLD', ref: CONE },
  kapton: { label: 'Kapton film', hrrpua: 60, ignitionC: 580, density: 1420, conductivity: 0.12, specificHeat: 1.09, thickness: 0.0005, color: 'DARK ORANGE', ref: CONE },
  teflon: { label: 'PTFE wire insulation', hrrpua: 20, ignitionC: 560, density: 2200, conductivity: 0.25, specificHeat: 1.0, thickness: 0.001, color: 'WHITE', ref: CONE },
  silicone: { label: 'Silicone rubber seal', hrrpua: 150, ignitionC: 450, density: 1200, conductivity: 0.22, specificHeat: 1.3, thickness: 0.005, color: 'PINK', ref: CONE },
}

export type FdsCaseOptions = {
  chid: string
  /** Gravity in g (1 on the pad, 0 in orbit). Overrides cabin.yaml. */
  g?: number
  tEnd?: number
  /** Cell size, m. */
  dx?: number
  title?: string
  /** The igniting burner: heat release in kW (default 75) and when it switches off, s (default 20). */
  burnerKw?: number
  burnerOffS?: number
}

export type FdsCase = {
  text: string
  chid: string
  cells: number
  ijk: [number, number, number]
  xb: [number, number, number, number, number, number]
  dx: number
  obstCount: number
  surfs: { id: string; zone: string; material: string; hrrpua: number; ignitionC: number }[]
  burner: { xb: number[]; kw: number; offAt: number; under?: string }
  devices: string[]
}

const SOOT_YIELD = 0.05 // kg soot / kg fuel, typical of the polymers in the cabin
const HOC = 25000 // kJ/kg, a polymer-average heat of combustion for the surrogate fuel
const PSI_TO_PA = 6894.757

const f = (n: number, d = 3) => {
  const t = n.toFixed(d)
  const s = t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t
  return s === '-0' ? '0' : s
}
const ascii = (s: string) => s.replace(/→/g, '->').replace(/[·–—]/g, '-').replace(/₂/g, '2').replace(/≈/g, '~').replace(/[^\t\n\x20-\x7e]/g, '')
const q = (s: string) => `'${s.replace(/'/g, '')}'`

/** Rotation matrix of a three.js XYZ Euler. */
function rotMatrix(r: Vec3 = [0, 0, 0]) {
  const [a, b, c] = r
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c)
  return [
    [cb * cc, -cb * sc, sb],
    [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
    [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
  ]
}

/** Axis-aligned half extents (model frame) of a box or cylinder primitive after rotation. */
export function halfExtents(p: Primitive): Vec3 {
  const R = rotMatrix(p.rot)
  if (p.kind === 'box') {
    const s = (p.size ?? [0, 0, 0]).map((v) => v / 2)
    return [0, 1, 2].map((i) => Math.abs(R[i][0]) * s[0] + Math.abs(R[i][1]) * s[1] + Math.abs(R[i][2]) * s[2]) as Vec3
  }
  // Cylinder: axis along local y.
  const r = p.radius ?? Math.max(p.radiusTop ?? 0, p.radiusBottom ?? 0)
  const h = (p.height ?? 0) / 2
  return [0, 1, 2].map((i) => {
    const a = R[i][1]
    return Math.abs(a) * h + r * Math.sqrt(Math.max(0, 1 - a * a))
  }) as Vec3
}

/** Model (x, y-up, z) → FDS (x, y, z-up). */
const toFdsXYZ = (v: Vec3): Vec3 => [v[0], v[2], v[1]]

export function toFds(spec: CabinSpec, rows: MaterialRow[], model: CabinModel, opts: FdsCaseOptions): FdsCase {
  const dx = opts.dx ?? 0.1
  const g = opts.g ?? spec.g
  const tEnd = opts.tEnd ?? 30
  const hull = model.primitives.find((p) => p.shell && p.kind === 'cone')
  if (!hull) throw new Error('cabin.model.json: no shell cone to voxelise as the hull')
  const rb = hull.radiusBottom ?? hull.radius ?? 1
  const rt = hull.radiusTop ?? hull.radius ?? 1
  const hh = hull.height ?? 1
  const z0 = hull.pos[1] - hh / 2

  // Mesh: the hull's bounding box, rounded out to whole cells.
  const half = Math.ceil(Math.max(rb, rt) / dx) * dx
  const nz = Math.round(hh / dx)
  const n = Math.round((2 * half) / dx)
  const xb: FdsCase['xb'] = [-half, half, -half, half, z0, z0 + nz * dx]
  const snap = (v: number) => Math.round(v / dx) * dx

  const lines: string[] = []
  const L = (s: string) => lines.push(s)
  const devices: string[] = []

  L(`&HEAD CHID=${q(opts.chid)}, TITLE=${q(opts.title ?? `${spec.vehicle} · ${f(spec.o2 * 100, 0)} % O2 · ${f(spec.psi, 1)} psia · ${f(g, 2)} g`)} /`)
  L('')
  L(`Generated by FIREFALL (web/src/fds/toFds.ts) from cabin.yaml, materials.csv and cabin.model.json.`)
  L(`Model y-up is FDS z-up. Rotated parts are their axis-aligned bounding boxes. The hull cone is voxelised`)
  L(`into stepped solid blocks so the cabin is a sealed volume and FDS computes the pressure rise itself.`)
  L(`Surface data are air cone-calorimeter values: in ${f(spec.o2 * 100, 0)} % O2 real burning is faster, so this is a lower bound.`)
  L('')
  L(`&MESH IJK=${n},${n},${nz}, XB=${xb.map((v) => f(v)).join(',')} /`)
  L(`&TIME T_END=${f(tEnd)} /`)
  L(`&MISC P_INF=${f(spec.psi * PSI_TO_PA, 0)}., TMPA=22., GVEC=0.,0.,${f(-9.81 * g, 4)} /`)
  L(`&DUMP DT_DEVC=0.25, DT_HRR=0.25, DT_SLCF=0.5, DT_SMOKE3D=0.5, DT_RESTART=1000000. /`)
  L('')
  // Atmosphere: pure O₂ background (no nitrogen: the cabin was purged to ~100 % O₂). Surrogate polymer fuel.
  const fuelMw = 28.054
  const s = (SOOT_YIELD * fuelMw) / 12.011
  const nuCO2 = 2 - s
  const nuO2 = nuCO2 + 1
  L(`Cabin atmosphere ${f(spec.o2 * 100, 0)} % O2 at ${f(spec.psi, 1)} psia. Fuel: ethylene surrogate, soot yield ${SOOT_YIELD}.`)
  L(`&SPEC ID='OXYGEN', BACKGROUND=.TRUE. /`)
  if (spec.o2 < 0.999) L(`&SPEC ID='NITROGEN', MASS_FRACTION_0=${f(1 - spec.o2, 4)} /`)
  L(`&SPEC ID='ETHYLENE' /`)
  L(`&SPEC ID='CARBON DIOXIDE' /`)
  L(`&SPEC ID='WATER VAPOR' /`)
  L(`&SPEC ID='SOOT' /`)
  L(`&REAC FUEL='ETHYLENE', HEAT_OF_COMBUSTION=${HOC}.,`)
  L(`      SPEC_ID_NU='ETHYLENE','OXYGEN','CARBON DIOXIDE','WATER VAPOR','SOOT',`)
  L(`      NU=-1.,${f(-nuO2, 5)},${f(nuCO2, 5)},2.,${f(s, 5)} /`)
  L('')

  // Surfaces: one per material that appears in the materials list.
  const zoneMat = new Map<string, MaterialRow>()
  for (const r of rows) if (r.key && r.zone && !zoneMat.has(r.zone)) zoneMat.set(r.zone, r)
  const surfs: FdsCase['surfs'] = []
  const surfOf = new Map<MaterialKey, string>()
  for (const r of zoneMat.values()) {
    const key = r.key!
    if (surfOf.has(key)) continue
    const m = FDS_MATERIALS[key]
    if (!m) continue
    const id = key.toUpperCase()
    surfOf.set(key, id)
    L(`${m.label}: ${m.ref}`)
    L(`&MATL ID=${q(id)}, DENSITY=${m.density}., CONDUCTIVITY=${m.conductivity}, SPECIFIC_HEAT=${m.specificHeat} /`)
    L(`&SURF ID=${q(id)}, COLOR=${q(m.color)}, MATL_ID=${q(id)}, THICKNESS=${m.thickness}, HRRPUA=${m.hrrpua}., IGNITION_TEMPERATURE=${m.ignitionC}. /`)
  }
  for (const [zone, r] of zoneMat) {
    const m = FDS_MATERIALS[r.key!]
    if (m) surfs.push({ id: surfOf.get(r.key!)!, zone, material: r.material, hrrpua: m.hrrpua, ignitionC: m.ignitionC })
  }
  L(`&SURF ID='HULL', COLOR='GRAY 60' /`)
  L(`&SURF ID='STRUCTURE', COLOR='GRAY 40' /`)
  L('')

  // Hull: every cell whose centre is outside the cone is solid. One OBST per contiguous run, merged along y.
  L(`Pressure hull: ${hull.id} (cone r ${rb} → ${rt} m over ${hh} m), voxelised at ${dx} m.`)
  let obstCount = 0
  const cell = (i: number) => -half + (i + 0.5) * dx
  for (let k = 0; k < nz; k++) {
    const zc = (k + 0.5) * dx
    const r = rb + (rt - rb) * (zc / hh)
    const za = f(z0 + k * dx), zb = f(z0 + (k + 1) * dx)
    // Per row j: number of solid cells on each side (n = full row).
    const solidCount = (j: number) => {
      const yc = cell(j)
      if (Math.abs(yc) >= r) return n / 2
      const w = Math.sqrt(r * r - yc * yc)
      let c = 0
      while (c < n / 2 && cell(c) < -w) c++
      return c
    }
    let j = 0
    while (j < n) {
      const c = solidCount(j)
      let j2 = j + 1
      while (j2 < n && solidCount(j2) === c) j2++
      const ya = f(-half + j * dx), yb = f(-half + j2 * dx)
      if (c >= n / 2) {
        L(`&OBST XB=${f(-half)},${f(half)},${ya},${yb},${za},${zb}, SURF_ID='HULL' /`)
        obstCount++
      } else if (c > 0) {
        L(`&OBST XB=${f(-half)},${f(-half + c * dx)},${ya},${yb},${za},${zb}, SURF_ID='HULL' /`)
        L(`&OBST XB=${f(half - c * dx)},${f(half)},${ya},${yb},${za},${zb}, SURF_ID='HULL' /`)
        obstCount += 2
      }
      j = j2
    }
  }
  L('')

  // Interior parts.
  L(`Cabin parts from ${model.name}.`)
  for (const p of model.primitives) {
    if (p.shell) continue
    const he = toFdsXYZ(halfExtents(p))
    const c = toFdsXYZ(p.pos)
    const r = zoneMat.get(p.zone)
    const surf = (r?.key && surfOf.get(r.key)) || 'STRUCTURE'
    const bb = [c[0] - he[0], c[0] + he[0], c[1] - he[1], c[1] + he[1], c[2] - he[2], c[2] + he[2]]
    L(`&OBST ID=${q(p.id)}, XB=${bb.map((v) => f(v)).join(',')}, SURF_ID=${q(surf)} / zone ${p.zone}${r ? ` · ${r.part}` : ''}`)
    obstCount++
  }
  L('')

  // Ignition: a small burner on the first part of the first ignition zone, on for the first seconds.
  const ign = spec.ignition[0]
  const ignPart = model.primitives.find((p) => !p.shell && p.zone === ign?.zone) ?? model.primitives.find((p) => !p.shell)!
  const ic = toFdsXYZ(ignPart.pos)
  // The fault ignites the nearest listed burnable item (smallest distance_to_ignition_m in materials.csv):
  // the burner sits at the fault's height, moved under that item's footprint so its flame touches it.
  const nearest = rows
    .filter((r) => r.key && r.zone !== ign?.zone && (FDS_MATERIALS[r.key]?.hrrpua ?? 0) >= 100)
    .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))[0]
  const target = nearest && model.primitives.find((p) => !p.shell && p.zone === nearest.zone)
  let tx = ic[0], ty = ic[1]
  if (target) {
    const he = toFdsXYZ(halfExtents(target))
    const tc = toFdsXYZ(target.pos)
    const clamp = (v: number, c: number, h: number) => Math.min(c + h - 0.15, Math.max(c - h + 0.15, v))
    tx = clamp(ic[0], tc[0], he[0])
    ty = clamp(ic[1], tc[1], he[1])
  }
  // At 10 cm cells a 30 kW flame is ~2 cells wide and FDS under-resolves it (gas at the net ~250 °C, below
  // nylon's ignition point). The burner stands for the first burning item: 75 kW over 0.3 × 0.3 m, ~3.6 cells.
  const bw = 0.3
  const area = bw * bw
  // Odd cell count across: centre on a half cell so every face lands on a grid line.
  const hc = (v: number) => snap(v - dx / 2) + dx / 2
  const bx = hc(tx), by = hc(ty), bz = Math.max(z0 + dx, snap(ic[2]))
  const kw = opts.burnerKw ?? 75
  const offAt = opts.burnerOffS ?? 20
  const burner = [bx - bw / 2, bx + bw / 2, by - bw / 2, by + bw / 2, bz - dx, bz]
  L(`Ignition: ${ign ? `${ign.id} (${ign.note})` : 'first part'} - a ${kw} kW burner, off at ${offAt} s,`)
  if (target) L(`placed under the nearest listed burnable item: ${nearest.part} (${nearest.distance ?? '?'} m from the fault).`)
  L(`&SURF ID='IGNITER', COLOR='RED', HRRPUA=${f(kw / area, 1)}, RAMP_Q='IGN' /`)
  L(`&RAMP ID='IGN', T=0., F=0. /`)
  L(`&RAMP ID='IGN', T=1., F=1. /`)
  L(`&RAMP ID='IGN', T=${offAt}., F=1. /`)
  L(`&RAMP ID='IGN', T=${offAt + 1}., F=0. /`)
  L(`&OBST ID='BURNER', XB=${burner.map((v) => f(v)).join(',')}, SURF_ID='STRUCTURE' /`)
  L(`&VENT ID='IGNITER', XB=${[burner[0], burner[1], burner[2], burner[3], bz, bz].map((v) => f(v)).join(',')}, SURF_ID='IGNITER' /`)
  L('')

  // Devices.
  L(`Smoke detectors from cabin.yaml. FDS uses the Cleary two-parameter lag model on chamber obscuration;`)
  L(`it sees soot mass, not particle size, so it cannot tell ionization from photoelectric sensitivity to small smoke.`)
  L(`&PROP ID='ionization', QUANTITY='CHAMBER OBSCURATION', ALPHA_E=2.5, BETA_E=-0.7, ALPHA_C=0.8, BETA_C=-0.9, ACTIVATION_OBSCURATION=3.24 /`)
  L(`&PROP ID='photoelectric', QUANTITY='CHAMBER OBSCURATION', ALPHA_E=1.8, BETA_E=-1.1, ALPHA_C=1.0, BETA_C=-0.8, ACTIVATION_OBSCURATION=3.24 /`)
  for (const d of spec.sensors) {
    const p = toFdsXYZ(d.pos)
    L(`&DEVC ID=${q(d.id)}, PROP_ID=${q(d.type)}, XYZ=${p.map((v) => f(v)).join(',')} / ${d.type} · ${d.zone}`)
    devices.push(d.id)
  }
  const mid = z0 + (nz * dx) / 2
  L(`&DEVC ID='P_cabin', QUANTITY='BACKGROUND PRESSURE', XYZ=0.,0.,${f(mid)} /`)
  L(`&DEVC ID='O2_cabin', QUANTITY='VOLUME FRACTION', SPEC_ID='OXYGEN', XYZ=0.,0.,${f(mid)} /`)
  devices.push('P_cabin', 'O2_cabin')
  for (let zt = z0 + 0.45; zt < z0 + nz * dx - 0.2; zt += 0.4) {
    const id = `TC_${f(zt, 2)}`
    L(`&DEVC ID=${q(id)}, QUANTITY='TEMPERATURE', XYZ=0.,0.,${f(zt)} /`)
    devices.push(id)
  }
  L('')
  L(`&SLCF PBY=0., QUANTITY='TEMPERATURE' /`)
  L(`&SLCF PBY=0., QUANTITY='DENSITY', SPEC_ID='SOOT' /`)
  L(`&SLCF PBZ=${f(snap(z0 + 1.05) + dx / 2)}, QUANTITY='TEMPERATURE' /`)
  L('')
  L('&TAIL /')

  return {
    // FDS reads ASCII: keep comments plain.
    text: ascii(lines.join('\n') + '\n'),
    chid: opts.chid,
    cells: n * n * nz,
    ijk: [n, n, nz],
    xb,
    dx,
    obstCount,
    surfs,
    burner: { xb: burner, kw, offAt, under: target ? nearest.part : undefined },
    devices,
  }
}
