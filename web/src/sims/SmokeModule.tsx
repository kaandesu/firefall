// Smoke transport in a rover cabin. Particles drift with the vent flow, rise with g-scaled buoyancy and
// spread by mixing. Detectors respond by particle size: photoelectric sees large particles, ionization
// sees small ones — the SAME finding that ISS photoelectric detectors miss Teflon/Kapton smoke.
import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MATERIALS, detectorEfficiency } from './models'

const L = 3.2 // half length (m)
const H = 1.05 // half height
const W = 1.0 // half width
const N = 3500
const TIME_SCALE = 4

export type Detector = { id: string; kind: 'photoelectric' | 'ionization'; pos: [number, number, number]; label: string }

export const DETECTORS: Detector[] = [
  { id: 'D1', kind: 'photoelectric', pos: [2.1, 0.95, -0.5], label: 'D1 photo · aft' },
  { id: 'D3', kind: 'ionization', pos: [2.1, 0.95, 0.5], label: 'D3 ion · aft' },
  { id: 'D2', kind: 'photoelectric', pos: [-2.9, 0.7, 0], label: 'D2 photo · return vent' },
  { id: 'D4', kind: 'ionization', pos: [-2.9, 0.4, 0], label: 'D4 ion · return vent' },
]

function gauss() {
  return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random())
}

export type SmokeReadout = Record<string, { level: number; alarmAt: number | null }>

const SOURCE = new THREE.Vector3(2.6, -0.2, 0)
const CREW = new THREE.Vector3(-2.3, -0.1, 0)

const pointVert = /* glsl */ `
attribute float aSize; attribute float aAlpha;
varying float vAlpha; varying float vSize;
void main(){ vAlpha = aAlpha; vSize = aSize; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (10.0 + aSize*26.0) * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }
`
const pointFrag = /* glsl */ `
varying float vAlpha; varying float vSize;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25) discard;
  vec3 col = mix(vec3(0.62,0.66,0.72), vec3(0.85,0.82,0.75), clamp(vSize,0.0,1.0));
  gl_FragColor = vec4(col, vAlpha * smoothstep(0.25, 0.0, d) * 0.55); }
`

export function SmokeModuleScene({ g, flow, material, onReadout, running = true }: { g: number; flow: number; material: string; onReadout?: (r: SmokeReadout, t: number) => void; running?: boolean }) {
  const mat = MATERIALS[material] ?? MATERIALS.kapton
  const geo = useRef<THREE.BufferGeometry>(null)
  const sim = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const size = new Float32Array(N)
    const alpha = new Float32Array(N)
    const dia = new Float32Array(N)
    const age = new Float32Array(N).fill(-1)
    return { pos, size, alpha, dia, age, t: 0, emitted: 0, levels: Object.fromEntries(DETECTORS.map((d) => [d.id, 0])) as Record<string, number>, alarms: {} as Record<string, number | null> }
  }, [])
  // Restart when the scenario changes.
  useEffect(() => {
    sim.age.fill(-1)
    sim.alpha.fill(0)
    sim.t = 0
    sim.emitted = 0
    for (const d of DETECTORS) {
      sim.levels[d.id] = 0
      sim.alarms[d.id] = null
    }
  }, [g, flow, material, sim])

  const lastReport = useRef(0)
  useFrame((_, rdt) => {
    if (!running) return
    const dt = Math.min(0.05, rdt) * TIME_SCALE
    sim.t += dt
    const u = flow / 100 // m/s, toward the forward return vent (−x)
    const buoy = 0.06 * g // m/s rise speed scale at temperature excess
    // Eddy diffusion from crew motion + fans: dominates transport in µg (no buoyant plume to carry smoke up).
    // Gaussian step sqrt(2·D·dt) keeps the spread rate independent of frame rate.
    const D = 0.012 + 0.25 * u * u // m²/s, vent turbulence adds mixing
    const step = Math.sqrt(2 * D * dt)
    // Emit a steady stream from the overheated source.
    const rate = 70
    let toEmit = Math.floor(sim.t * rate) - sim.emitted
    for (let i = 0; i < N && toEmit > 0; i++) {
      if (sim.age[i] >= 0) continue
      sim.age[i] = 0
      sim.pos[i * 3] = SOURCE.x + (Math.random() - 0.5) * 0.1
      sim.pos[i * 3 + 1] = SOURCE.y + (Math.random() - 0.5) * 0.1
      sim.pos[i * 3 + 2] = SOURCE.z + (Math.random() - 0.5) * 0.1
      // Lognormal particle diameter around the material's median (µm).
      const z = Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * Math.cos(2 * Math.PI * Math.random())
      sim.dia[i] = mat.smokeD * Math.exp(0.45 * z)
      sim.size[i] = Math.min(1, sim.dia[i] / 1.2)
      toEmit--
      sim.emitted++
    }
    if (toEmit > 0) sim.emitted += toEmit
    const lv: Record<string, number> = Object.fromEntries(DETECTORS.map((d) => [d.id, 0]))
    for (let i = 0; i < N; i++) {
      if (sim.age[i] < 0) continue
      const k = i * 3
      let x = sim.pos[k], y = sim.pos[k + 1], z = sim.pos[k + 2]
      const a = sim.age[i]
      // Vent flow: along −x, faster on the centreline, with a gentle loop near walls.
      const vx = -u * (1 - 0.5 * (z * z) / (W * W)) + Math.sin(y * 2 + sim.t * 0.3) * u * 0.15
      const vy = buoy * Math.exp(-a / 25) + Math.cos(x * 1.5) * u * 0.1
      // Thermal expansion pushes fresh smoke outward from the hot source for the first few seconds.
      const rx = x - SOURCE.x, ry = y - SOURCE.y, rz = z - SOURCE.z
      const rl = Math.hypot(rx, ry, rz) + 1e-3
      const ex = (0.18 * Math.exp(-a / 3)) / rl
      x += (vx + rx * ex) * dt + gauss() * step
      y += (vy + ry * ex) * dt + gauss() * step
      z += rz * ex * dt + gauss() * step
      if (y > H) y = H - (y - H)
      if (y < -H) y = -H + (-H - y)
      if (z > W) z = W - (z - W)
      if (z < -W) z = -W + (-W - z)
      if (x > L) x = L - (x - L)
      sim.age[i] = a + dt
      if (x < -L || sim.age[i] > 160) {
        sim.age[i] = -1
        sim.alpha[i] = 0
        continue
      }
      sim.pos[k] = x
      sim.pos[k + 1] = y
      sim.pos[k + 2] = z
      sim.alpha[i] = Math.min(1, a / 1.5) * Math.max(0.15, 1 - a / 160)
      for (const d of DETECTORS) {
        const dx = x - d.pos[0], dy = y - d.pos[1], dz = z - d.pos[2]
        if (dx * dx + dy * dy + dz * dz < 0.36) lv[d.id] += detectorEfficiency(d.kind, sim.dia[i])
      }
    }
    for (const d of DETECTORS) {
      const target = Math.min(1, lv[d.id] / 60)
      sim.levels[d.id] += (target - sim.levels[d.id]) * Math.min(1, dt * 0.8)
      if (sim.levels[d.id] > 0.35 && sim.alarms[d.id] == null) sim.alarms[d.id] = sim.t
    }
    const gg = geo.current
    if (gg) {
      ;(gg.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(gg.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true
      ;(gg.attributes.aSize as THREE.BufferAttribute).needsUpdate = true
    }
    if (onReadout && sim.t - lastReport.current > 0.5) {
      lastReport.current = sim.t
      onReadout(Object.fromEntries(DETECTORS.map((d) => [d.id, { level: sim.levels[d.id], alarmAt: sim.alarms[d.id] ?? null }])), sim.t)
    }
  })

  const shell = useMemo(() => new THREE.BoxGeometry(L * 2, H * 2, W * 2), [])
  return (
    <group>
      <lineSegments>
        <edgesGeometry args={[shell]} />
        <lineBasicMaterial color="#2a3a4d" />
      </lineSegments>
      <mesh>
        <boxGeometry args={[L * 2, H * 2, W * 2]} />
        <meshBasicMaterial color="#0c141d" transparent opacity={0.25} side={THREE.BackSide} />
      </mesh>
      <gridHelper args={[L * 2, 16, '#1b2430', '#111820']} position={[0, -H + 0.001, 0]} scale={[1, 1, W / L]} />
      {/* source */}
      <mesh position={SOURCE}>
        <boxGeometry args={[0.35, 0.25, 0.5]} />
        <meshStandardMaterial color="#3a1a10" emissive="#ff5a1f" emissiveIntensity={1.4} />
      </mesh>
      <Html position={[SOURCE.x, SOURCE.y - 0.35, SOURCE.z]} center className="pointer-events-none">
        <div className="mono whitespace-nowrap text-[9px] text-flame">{mat.label.split(' (')[0]} · overheating</div>
      </Html>
      {/* crew station + return vent */}
      <mesh position={CREW}>
        <capsuleGeometry args={[0.14, 0.45, 6, 12]} />
        <meshStandardMaterial color="#e6edf3" emissive="#5aa9ff" emissiveIntensity={0.2} />
      </mesh>
      <Html position={[CREW.x, CREW.y - 0.55, CREW.z]} center className="pointer-events-none">
        <div className="mono whitespace-nowrap text-[9px] text-white/60">crew station</div>
      </Html>
      <mesh position={[-L + 0.02, 0.55, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 0.5]} />
        <meshBasicMaterial color="#56d4ef" transparent opacity={flow > 0 ? 0.35 : 0.08} side={THREE.DoubleSide} />
      </mesh>
      {flow > 0 &&
        [-0.4, 0.4].map((z) => <Line key={z} points={[[1.2, 0.6, z], [-1.6, 0.6, z]]} color="#56d4ef" transparent opacity={0.35} lineWidth={1} dashed dashSize={0.12} gapSize={0.1} />)}
      <points frustumCulled={false}>
        <bufferGeometry ref={geo}>
          <bufferAttribute attach="attributes-position" args={[sim.pos, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sim.size, 1]} />
          <bufferAttribute attach="attributes-aAlpha" args={[sim.alpha, 1]} />
        </bufferGeometry>
        <shaderMaterial vertexShader={pointVert} fragmentShader={pointFrag} transparent depthWrite={false} />
      </points>
      {DETECTORS.map((d) => (
        <DetectorMesh key={d.id} d={d} level={() => sim.levels[d.id]} />
      ))}
    </group>
  )
}

function DetectorMesh({ d, level }: { d: Detector; level: () => number }) {
  const m = useRef<THREE.MeshStandardMaterial>(null)
  const label = useRef<HTMLDivElement>(null)
  const c = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const v = level()
    const alarm = v > 0.35
    c.set(alarm ? '#ff6b6b' : v > 0.12 ? '#ffb547' : '#7ee787')
    if (m.current) {
      m.current.color.copy(c)
      m.current.emissive.copy(c)
      m.current.emissiveIntensity = alarm ? 1.2 + Math.sin(clock.getElapsedTime() * 10) * 0.8 : 0.4 + v
    }
    if (label.current) label.current.textContent = `${d.label} ${Math.round(v * 100)}%${alarm ? ' ALARM' : ''}`
  })
  return (
    <group position={d.pos}>
      <mesh>
        <cylinderGeometry args={[0.11, 0.11, 0.05, 20]} />
        <meshStandardMaterial ref={m} color="#7ee787" />
      </mesh>
      <Html center position={[0, 0.2, 0]} className="pointer-events-none">
        <div ref={label} className="mono whitespace-nowrap rounded bg-black/55 px-1 text-[9px] text-white/80" />
      </Html>
    </group>
  )
}

export const SMOKE_TIME_SCALE = TIME_SCALE
