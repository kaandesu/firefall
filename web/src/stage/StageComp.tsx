// The stage as a Remotion composition: a pure function of the frame. The same component plays in the
// run screen (scrubbable) and can render the submission video. No useFrame, no clocks.
import { OrbitControls } from '@react-three/drei'
import { ThreeCanvas } from '@remotion/three'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CabinModel } from '@/intake/parse'
import { Cabin, type ZoneLook } from './Cabin'
import { burningAt, pressureAt, zonePhase, type FireRun } from './physics'

export type StageLayer = 'none' | 'materials' | 'spread' | 'pressure' | 'whatif'

export type StageProps = {
  model: CabinModel
  run: FireRun
  layer: StageLayer
  status: Record<string, 'pass' | 'retest' | 'fail'>
  highlight?: string
  hatchTime: number
  onPick?: (zone: string | undefined) => void
  orbit?: boolean
}

export const FPS = 30

const STATUS_COLOR = { pass: '#3f9a55', retest: '#c98a2b', fail: '#c94545' }
const NEUTRAL = '#2a3442'
const CHAR = '#24130d'

const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('')}`
}

/** Deterministic flicker: depends only on the frame and the zone. */
const flicker = (frame: number, seed: number) => 0.75 + 0.25 * Math.sin(frame * 0.9 + seed * 2.3) * Math.sin(frame * 0.37 + seed)

function Flames({ model, run, t, frame }: { model: CabinModel; run: FireRun; t: number; frame: number }) {
  return (
    <>
      {model.primitives.map((p, i) => {
        if (p.shell) return null
        const z = run.zones.find((x) => x.zone === p.zone)
        if (!z?.burns) return null
        const ph = zonePhase(run, p.zone, t)
        if (ph <= 0 || ph >= 2) return null
        const k = (ph <= 1 ? ph : 2 - ph) * flicker(frame, i)
        const h = 0.25 + 0.45 * k * Math.min(1.6, z.rate / 40)
        return (
          <group key={p.id} position={[p.pos[0], p.pos[1] + h / 2 + 0.04, p.pos[2]]}>
            <mesh scale={[1, 1, 1]}>
              <coneGeometry args={[0.16 * (0.6 + k), h, 10]} />
              <meshBasicMaterial color="#ff8a3d" transparent opacity={0.55 * k + 0.15} depthWrite={false} />
            </mesh>
            <mesh position={[0, -h * 0.15, 0]}>
              <coneGeometry args={[0.09 * (0.6 + k), h * 0.6, 8]} />
              <meshBasicMaterial color="#ffe08a" transparent opacity={0.7 * k} depthWrite={false} />
            </mesh>
            <pointLight color="#ff7a3d" intensity={2.2 * k} distance={2.2} />
          </group>
        )
      })}
    </>
  )
}

function PressureChart({ run, t, hatchTime }: { run: FireRun; t: number; hatchTime: number }) {
  const W = 240
  const H = 84
  const tMax = run.duration
  const pMax = Math.max(run.burstPsia * 1.1, ...run.pressure.map((p) => p.psia))
  const x = (s: number) => (s / tMax) * W
  const y = (psi: number) => H - (psi / pMax) * H
  const pts = run.pressure.filter((p) => p.t <= Math.min(t, tMax)).map((p) => `${x(p.t).toFixed(1)},${y(p.psia).toFixed(1)}`)
  return (
    <div style={{ position: 'absolute', right: 12, top: 12, padding: 8, background: 'rgba(5,7,10,0.82)', border: '1px solid #263242', borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#7d8a99' }}>
      <div style={{ marginBottom: 4, color: '#e6edf3', letterSpacing: '0.12em' }}>CABIN PRESSURE · psia</div>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {run.burstPsia > 0 && (
          <>
            <line x1={0} x2={W} y1={y(run.burstPsia)} y2={y(run.burstPsia)} stroke="#ff6b6b" strokeDasharray="4 3" />
            <text x={W} y={y(run.burstPsia) - 4} textAnchor="end" fill="#ff6b6b">
              hull bursts {run.burstPsia}
            </text>
          </>
        )}
        <line x1={0} x2={W} y1={H} y2={H} stroke="#263242" />
        <polyline points={pts.join(' ')} fill="none" stroke="#ffb547" strokeWidth={2} />
        {run.rupture !== undefined && t >= run.rupture && (
          <text x={x(run.rupture) + 4} y={y(run.burstPsia) + 14} fill="#ff6b6b">
            rupture T+{run.rupture.toFixed(0)} s
          </text>
        )}
        <text x={0} y={H + 12}>
          T+0
        </text>
        <text x={W} y={H + 12} textAnchor="end">
          T+{tMax} s · hatch needs {hatchTime} s →
        </text>
      </svg>
    </div>
  )
}

export function StageComp({ model, run, layer, status, highlight, hatchTime, onPick, orbit = true }: StageProps) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / FPS
  const fire = layer === 'spread' || layer === 'pressure' || layer === 'whatif'
  const psia = pressureAt(run, t)
  const ruptured = run.rupture !== undefined && t >= run.rupture

  const look = (zone: string): ZoneLook => {
    if (layer === 'materials' || !fire) {
      const s = layer === 'materials' ? status[zone] : undefined
      return { color: s ? STATUS_COLOR[s] : NEUTRAL, emissive: s ? STATUS_COLOR[s] : undefined, glow: s ? 0.18 : 0 }
    }
    const ph = zonePhase(run, zone, t)
    if (ph <= 0) return { color: NEUTRAL }
    if (ph < 1) return { color: mix(NEUTRAL, '#ff7a3d', ph), emissive: '#ff5a1f', glow: 0.9 * ph }
    if (ph < 1.5) return { color: '#ff7a3d', emissive: '#ff5a1f', glow: 0.9 }
    return { color: mix('#ff7a3d', CHAR, (ph - 1.5) * 2), emissive: '#ff3a10', glow: Math.max(0, 0.9 - (ph - 1.5) * 1.8) }
  }
  const shellTint = layer === 'pressure' ? mix('#5aa9ff', '#ff6b6b', (psia - run.variant.psi) / Math.max(1, run.burstPsia - run.variant.psi)) : ruptured && fire ? '#ff6b6b' : '#5aa9ff'
  const reach = run.zones.filter((z) => z.burns).length

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #0b1119 0%, #030508 70%)' }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [5.6, 3.6, 5.8], fov: 36 }} onPointerMissed={() => onPick?.(undefined)}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 4]} intensity={0.9} />
        <directionalLight position={[-4, 3, -5]} intensity={0.3} color="#5aa9ff" />
        <group position={[0, -1.5, 0]}>
          <Cabin model={model} look={look} shellTint={shellTint} highlight={highlight} onPick={onPick} />
          {fire && <Flames model={model} run={run} t={t} frame={frame} />}
          <gridHelper args={[8, 16, '#1b2430', '#10161e']} position={[0, -0.02, 0]} />
        </group>
        {orbit && <OrbitControls target={[0, 0.1, 0]} enableDamping={false} enablePan={false} minDistance={3} maxDistance={12} />}
      </ThreeCanvas>

      {fire && (
        <div style={{ position: 'absolute', left: 14, top: 12, display: 'flex', gap: 22, fontFamily: 'DM Mono, monospace', color: '#e6edf3', pointerEvents: 'none' }}>
          <Readout label="time" value={`T+${t.toFixed(1)} s`} />
          <Readout label="zones burning" value={`${burningAt(run, t)}/${reach}`} color={burningAt(run, t) ? '#ff7a3d' : undefined} />
          <Readout label="cabin" value={`${psia.toFixed(1)} psia`} color={ruptured ? '#ff6b6b' : psia > run.variant.psi + 2 ? '#ffb547' : undefined} />
        </div>
      )}
      {fire && ruptured && (
        <div style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)', padding: '3px 10px', border: '1px solid #ff6b6b', color: '#ff6b6b', background: 'rgba(40,8,8,0.8)', fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.12em' }}>
          HULL RUPTURE · T+{run.rupture!.toFixed(0)} s
        </div>
      )}
      {layer === 'pressure' && <PressureChart run={run} t={t} hatchTime={hatchTime} />}
    </AbsoluteFill>
  )
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#4a5665', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 17, color: color ?? '#e6edf3' }}>{value}</div>
    </div>
  )
}
