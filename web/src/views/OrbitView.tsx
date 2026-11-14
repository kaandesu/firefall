// Halo's orbit, in 3D: the Lagrange hub at the centre, the crew on a tilted ring, you above.
// Every A2A message is a packet that flies sender → hub → recipient (Lagrange relays everything).
import { Html, Line, Stars } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CREW, HUB, HUMAN, agentColor, agentName } from '@/demo/crew'
import { KIND_COLOR, STATE_COLOR } from '@/components/bits'
import { useMission } from '@/live/store'
import type { AgentRT, Packet } from '@/live/model'

const FLIGHT_TIME = 1.5 // s, like Halo's PacketTime

function layout(): Record<string, THREE.Vector3> {
  const pos: Record<string, THREE.Vector3> = { [HUB]: new THREE.Vector3(0, 0, 0), [HUMAN]: new THREE.Vector3(0, 2.9, -0.4) }
  const ring = CREW.filter((a) => a.handle !== 'flight')
  pos.flight = new THREE.Vector3(0, 0.25, 3.3)
  ring.forEach((a, i) => {
    const t = Math.PI / 2 + ((i + 1) / (ring.length + 1)) * Math.PI * 2
    pos[a.handle] = new THREE.Vector3(Math.cos(t) * 5.0, Math.sin(t * 2) * 0.35, Math.sin(t) * 3.2)
  })
  return pos
}

function resolveColor(css: string) {
  if (!css.startsWith('var(')) return css
  const name = css.slice(4, -1)
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff'
}

function Hub() {
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (a.current) a.current.rotation.z = t * 0.25
    if (b.current) b.current.rotation.z = -t * 0.18
    if (core.current) core.current.emissiveIntensity = 1.6 + Math.sin(t * 2) * 0.25
  })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshStandardMaterial ref={core} color="#ffcf6b" emissive="#ffb547" emissiveIntensity={1.6} />
      </mesh>
      <mesh ref={a} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.05, 0.012, 8, 128]} />
        <meshBasicMaterial color="#ffcf6b" transparent opacity={0.55} />
      </mesh>
      <mesh ref={b} rotation={[Math.PI / 1.7, 0.4, 0]}>
        <torusGeometry args={[1.35, 0.008, 8, 128]} />
        <meshBasicMaterial color="#ffcf6b" transparent opacity={0.3} />
      </mesh>
      <Html center position={[0, -0.95, 0]} className="pointer-events-none">
        <div className="mono whitespace-nowrap text-[10px] tracking-[0.25em] text-gold/80">LAGRANGE</div>
      </Html>
    </group>
  )
}

function Planet({ handle, p, rt, selected, onPick }: { handle: string; p: THREE.Vector3; rt?: AgentRT; selected: boolean; onPick: () => void }) {
  const color = agentColor(handle)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const state = rt?.state ?? 'idle'
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const live = state === 'working' || state === 'asking' || state === 'waiting'
    if (mat.current) mat.current.emissiveIntensity = live ? 1.1 + Math.sin(t * 5 + p.x) * 0.45 : state === 'done' ? 0.55 : 0.25
    if (ring.current) {
      ring.current.rotation.z = t * (live ? 1.6 : 0.3)
      ring.current.visible = live || selected
    }
  })
  const stateColor = resolveColor(STATE_COLOR[state])
  return (
    <group position={p}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onPick()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[handle === HUMAN ? 0.3 : 0.34, 32, 32]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.3} roughness={0.4} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[0.55, 0.014, 8, 64]} />
        <meshBasicMaterial color={selected ? '#ffffff' : stateColor} transparent opacity={0.9} />
      </mesh>
      <Html center position={[0, -0.72, 0]} className="pointer-events-none select-none">
        <div className="flex flex-col items-center gap-0.5">
          <div className="mono whitespace-nowrap text-[10px] font-medium tracking-wider" style={{ color }}>
            {agentName(handle)}
          </div>
          {rt && rt.state !== 'idle' && rt.state !== 'done' && (
            <div className="max-w-[140px] truncate whitespace-nowrap rounded bg-black/50 px-1 text-[9px] text-white/70">{rt.doing || rt.state}</div>
          )}
        </div>
      </Html>
    </group>
  )
}

function Packets({ pos }: { pos: Record<string, THREE.Vector3> }) {
  const packets = useMission((s) => s.model.packets)
  const group = useRef<THREE.Group>(null)
  const N = 48
  const meshes = useMemo(() => Array.from({ length: N }, () => ({ color: new THREE.Color() })), [])
  const live = useRef<Packet[]>([])
  live.current = packets
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const now = Date.now()
    const active = live.current.filter((p) => now - p.at < FLIGHT_TIME * 1000 && pos[p.from] && pos[p.to])
    g.children.forEach((child, i) => {
      const m = child as THREE.Mesh
      const p = active[i]
      if (!p) {
        m.visible = false
        return
      }
      const u = (now - p.at) / (FLIGHT_TIME * 1000)
      const a = pos[p.from]
      const b = pos[p.to]
      const viaHub = p.from !== HUB && p.to !== HUB
      // Quadratic bezier through a lifted hub point: sender → Lagrange → recipient.
      const c = viaHub ? new THREE.Vector3(0, 0.9, 0) : a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.8, 0))
      const t = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2 // ease in-out
      tmp.set(0, 0, 0)
        .addScaledVector(a, (1 - t) * (1 - t))
        .addScaledVector(c, 2 * (1 - t) * t)
        .addScaledVector(b, t * t)
      m.position.copy(tmp)
      m.visible = true
      const mat = m.material as THREE.MeshBasicMaterial
      meshes[i].color.set(resolveColor(KIND_COLOR[p.kind]))
      mat.color.copy(meshes[i].color)
      const s = 0.09 + Math.sin(u * Math.PI) * 0.06
      m.scale.setScalar(s / 0.1)
    })
  })
  return (
    <group ref={group}>
      {meshes.map((_, i) => (
        <mesh key={i} visible={false}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Scene() {
  const pos = useMemo(layout, [])
  const agents = useMission((s) => s.model.agents)
  const selected = useMission((s) => s.selectedAgent)
  const selectAgent = useMission((s) => s.selectAgent)
  const directTo = useMission((s) => s.directTo)
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (root.current) root.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.08) * 0.25
  })
  const orbitPts = useMemo(() => Array.from({ length: 129 }, (_, i) => {
    const t = (i / 128) * Math.PI * 2
    return new THREE.Vector3(Math.cos(t) * 5.0, 0, Math.sin(t) * 3.2)
  }), [])
  return (
    <group ref={root}>
      <Hub />
      <Line points={orbitPts} color="#56d4ef" transparent opacity={0.12} lineWidth={1} dashed dashSize={0.15} gapSize={0.12} />
      {Object.entries(pos).map(([h, p]) =>
        h === HUB ? null : <Line key={`l-${h}`} points={[p, pos[HUB]]} color={agentColor(h)} transparent opacity={0.08} lineWidth={1} />,
      )}
      {Object.entries(pos).map(([h, p]) =>
        h === HUB ? null : (
          <Planet
            key={h}
            handle={h}
            p={p}
            rt={agents[h]}
            selected={selected === h}
            onPick={() => {
              if (h === HUMAN) return
              selectAgent(h)
              directTo('workspace', true)
            }}
          />
        ),
      )}
      <Packets pos={pos} />
    </group>
  )
}

export function OrbitView() {
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 6.5, 12.5], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}>
        <color attach="background" args={['#04060a']} />
        <ambientLight intensity={0.25} />
        <pointLight position={[0, 0, 0]} intensity={30} color="#ffcf6b" distance={14} />
        <directionalLight position={[4, 6, 5]} intensity={0.6} />
        <Stars radius={60} depth={30} count={2500} factor={3} saturation={0} fade speed={0.4} />
        <Scene />
        <EffectComposer>
          <Bloom intensity={1.1} luminanceThreshold={0.25} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <OrbitLegend />
    </div>
  )
}

function OrbitLegend() {
  return (
    <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
      {(['task', 'ask', 'reply', 'review', 'fail', 'hub'] as const).map((k) => (
        <span key={k} className="mono flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
          {k === 'hub' ? 'tool' : k}
        </span>
      ))}
    </div>
  )
}
