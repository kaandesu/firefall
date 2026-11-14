// The cabin intro, before the agents start: a camera tour of cabin.model.json, one zone at a time, with what sits
// there from materials.csv, the listed ignition source pulsing, the smoke detectors from cabin.yaml, and the
// atmosphere last. A Remotion composition: a pure function of the frame.
import { useThree } from '@react-three/fiber'
import { ThreeCanvas } from '@remotion/three'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { DesignPackage } from '@/demo/packages'
import type { CabinModel } from '@/intake/parse'
import { Cabin } from './Cabin'

export const INTRO_FPS = 30
const OPEN = 2.2
const PER = 2.0
const CLOSE = 3.2
const Y0 = -1.5

export type IntroProps = { model: CabinModel; pkg: DesignPackage }

type Stop = { zone: string; at: [number, number, number]; parts: DesignPackage['bom']; ignition: boolean; sensors: NonNullable<DesignPackage['sensors']> }

export function introStops(model: CabinModel, pkg: DesignPackage): Stop[] {
  const zones = [...new Set(model.primitives.filter((p) => !p.shell).map((p) => p.zone))]
  return zones.map((zone) => {
    const ps = model.primitives.filter((p) => p.zone === zone && !p.shell)
    const at = [0, 1, 2].map((k) => ps.reduce((a, p) => a + p.pos[k], 0) / ps.length) as [number, number, number]
    return { zone, at, parts: pkg.bom.filter((b) => b.zone === zone), ignition: (pkg.ignitionZones ?? []).includes(zone), sensors: (pkg.sensors ?? []).filter((s) => s.zone === zone) }
  })
}
export const introFrames = (model: CabinModel, pkg: DesignPackage) => Math.round((OPEN + introStops(model, pkg).length * PER + CLOSE) * INTRO_FPS)

const OVERVIEW = { pos: [5.6, 3.6, 5.8] as [number, number, number], look: [0, 0.1, 0] as [number, number, number] }
function shotFor(s: Stop) {
  const look: [number, number, number] = [s.at[0], s.at[1] + Y0, s.at[2]]
  const h = Math.hypot(s.at[0], s.at[2])
  const dir = h > 0.2 ? [s.at[0] / h, s.at[2] / h] : [0.7, 0.7]
  return { pos: [look[0] + dir[0] * 3.4 + 1.3, look[1] + 2.0, look[2] + dir[1] * 3.4 + 1.3] as [number, number, number], look }
}
const ease = (x: number) => x * x * (3 - 2 * x)
const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number]

function Rig({ pos, look }: { pos: [number, number, number]; look: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  camera.position.set(...pos)
  camera.lookAt(...look)
  return null
}

export function IntroComp({ model, pkg }: IntroProps) {
  const frame = useCurrentFrame()
  const { width, height, durationInFrames } = useVideoConfig()
  const t = frame / INTRO_FPS
  const stops = introStops(model, pkg)
  const total = durationInFrames / INTRO_FPS
  const idx = t < OPEN ? -1 : Math.min(stops.length - 1, Math.floor((t - OPEN) / PER))
  const closing = t >= OPEN + stops.length * PER
  const local = idx >= 0 ? t - OPEN - idx * PER : t
  const cur = closing ? undefined : stops[idx]

  // Camera: glide to each stop over the first 0.7 s, then drift slowly.
  const prev = idx <= 0 ? OVERVIEW : shotFor(stops[idx - 1])
  const next = closing || idx < 0 ? OVERVIEW : shotFor(stops[idx])
  const k = closing ? ease(Math.min(1, (t - OPEN - stops.length * PER) / 0.9)) : idx < 0 ? 0 : ease(Math.min(1, local / 0.7))
  const from = closing ? shotFor(stops[stops.length - 1]) : prev
  const drift = idx < 0 || closing ? t * 0.06 : local * 0.05
  const base = lerp3(from.pos, next.pos, k)
  const pos: [number, number, number] = [base[0] * Math.cos(drift) - base[2] * Math.sin(drift), base[1], base[0] * Math.sin(drift) + base[2] * Math.cos(drift)]
  const look = lerp3(from.look, next.look, k)

  const pulse = 0.5 + 0.5 * Math.sin(t * 7)
  const look3 = (zone: string) => {
    const ign = (pkg.ignitionZones ?? []).includes(zone)
    if (cur?.zone === zone) return { color: ign ? '#ff5a1f' : '#6d8bff', emissive: ign ? '#ff4a5e' : '#6d8bff', glow: ign ? 0.5 + 0.6 * pulse : 0.45 }
    if (ign && (closing || idx < 0)) return { color: '#ff5a1f', emissive: '#ff4a5e', glow: 0.3 + 0.5 * pulse }
    return { color: '#333333', opacity: cur ? 0.55 : 1 }
  }
  const fadeIn = interpolate(t, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' })
  const cardIn = idx >= 0 && !closing ? interpolate(local, [0.35, 0.75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #0c0c0c 0%, #050505 70%)', fontFamily: 'DM Mono, monospace', color: '#f1f1ef' }}>
      <ThreeCanvas width={width} height={height} camera={{ position: OVERVIEW.pos, fov: 36 }}>
        <Rig pos={pos} look={look} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 4]} intensity={0.9} />
        <directionalLight position={[-4, 3, -5]} intensity={0.3} color="#6d8bff" />
        <group position={[0, Y0, 0]}>
          <Cabin model={model} look={look3} shellTint="#9a9a95" />
          {(pkg.sensors ?? []).map((s) => {
            const on = cur ? cur.zone === s.zone : true
            return (
              <mesh key={s.id} position={s.pos}>
                <boxGeometry args={[0.14, 0.06, 0.14]} />
                <meshStandardMaterial color={on ? '#ffc21a' : '#5d5130'} emissive="#ffc21a" emissiveIntensity={on ? 0.9 : 0.1} />
              </mesh>
            )
          })}
          <gridHelper args={[8, 16, '#232323', '#111111']} position={[0, -0.02, 0]} />
        </group>
      </ThreeCanvas>

      {/* opening title */}
      {idx < 0 && (
        <div style={{ position: 'absolute', left: 40, top: 36, opacity: fadeIn }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#6d8bff' }}>BEFORE THE AGENTS START · THE CABIN</div>
          <div style={{ fontSize: 30, fontFamily: 'Inter, sans-serif', fontWeight: 600, marginTop: 6 }}>{pkg.vehicle}</div>
          <div style={{ fontSize: 13, color: '#9a9a95', marginTop: 4 }}>
            {pkg.volume} · crew {pkg.crew} · {stops.length} zones · {pkg.bom.length} listed materials · {(pkg.sensors ?? []).length} smoke detectors
          </div>
          <div style={{ fontSize: 11, color: '#6b6b66', marginTop: 10 }}>from cabin.model.json · materials.csv · cabin.yaml</div>
        </div>
      )}

      {/* per-zone card */}
      {cur && (
        <div style={{ position: 'absolute', left: 36, bottom: 64, width: 400, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 12}px)`, background: 'rgba(10,14,19,0.86)', border: `1px solid ${cur.ignition ? '#ff5a1f' : '#2f2f2f'}`, borderRadius: 3, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#6b6b66' }}>
              {idx + 1}/{stops.length}
            </span>
            <span style={{ fontSize: 20, fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'capitalize' }}>{cur.zone}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#6b6b66' }}>
              at ({cur.at.map((v) => v.toFixed(1)).join(', ')}) m
            </span>
          </div>
          {cur.ignition && <div style={{ marginTop: 6, fontSize: 11.5, color: '#ff5a1f', letterSpacing: '0.08em', opacity: 0.6 + 0.4 * pulse }}>● LISTED IGNITION SOURCE</div>}
          <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
            {cur.parts.length ? (
              cur.parts.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', color: '#f1f1ef', flex: 1 }}>{b.item}</span>
                  <span style={{ color: '#ffc21a' }}>{b.material}</span>
                  <span style={{ color: '#9a9a95' }}>{b.qty}</span>
                  {b.rating && <span style={{ color: b.rating === 'A' ? '#3fd17f' : b.rating === 'X' ? '#ff8fb1' : '#ffc21a' }}>{b.rating}</span>}
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: '#9a9a95' }}>structure · no listed materials</div>
            )}
          </div>
          {cur.sensors.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: '#ffc21a' }}>
              detector {cur.sensors.map((s) => `${s.id} · ${s.type}`).join(', ')}
            </div>
          )}
          {cur.parts.some((b) => b.distance !== undefined) && <div style={{ marginTop: 6, fontSize: 10.5, color: '#6b6b66' }}>{cur.parts.map((b) => (b.distance !== undefined ? `${b.distance} m from ignition` : '')).filter(Boolean)[0]}</div>}
        </div>
      )}

      {/* atmosphere, last */}
      {closing && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', opacity: interpolate(t, [OPEN + stops.length * PER + 0.4, OPEN + stops.length * PER + 1.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#ff6a33' }}>AND THE AIR THEY SIT IN</div>
          <div style={{ fontSize: 44, fontFamily: 'Inter, sans-serif', fontWeight: 600, marginTop: 8 }}>
            {Math.round(pkg.atmosphere.o2 * 100)} % O₂ · {pkg.atmosphere.psi} psia · {pkg.gravity.g} g
          </div>
          <div style={{ fontSize: 13, color: '#9a9a95', marginTop: 8 }}>
            hatch {pkg.hatch?.type ?? ''} · {pkg.hatch?.openTime ?? '—'} s to open · hull bursts at {pkg.hull?.burstPsia ?? '—'} psia
          </div>
        </div>
      )}

      {/* progress */}
      <div style={{ position: 'absolute', left: 36, right: 36, bottom: 28, height: 2, background: '#232323' }}>
        <div style={{ width: `${(t / total) * 100}%`, height: '100%', background: '#6d8bff' }} />
      </div>
    </AbsoluteFill>
  )
}
