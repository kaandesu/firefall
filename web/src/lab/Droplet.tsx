// FLEX-style droplet burning in µg: the droplet shrinks by the d² law inside a spherical flame shell.
// CO₂ dilution raises the limiting oxygen index; large heptane droplets show an invisible cool flame.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { droplet } from '@/sims/models'

const shellVert = /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`
const shellFrag = /* glsl */ `uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor * f * 1.8, f * uAlpha); }`

export type DropletState = { d: number; t: number; phase: 'hot' | 'cool' | 'out' | 'none' }

const SPEED = 0.6 // visual time scale

export function DropletScene({ o2, co2, d0, showCool, onState }: { o2: number; co2: number; d0: number; showCool: boolean; onState?: (s: DropletState) => void }) {
  const m = droplet(o2, co2, d0)
  const drop = useRef<THREE.Mesh>(null)
  const hot = useRef<THREE.Mesh>(null)
  const cool = useRef<THREE.Mesh>(null)
  const st = useRef({ t: 0 })
  useEffect(() => {
    st.current.t = 0
  }, [o2, co2, d0])
  const hotU = useMemo(() => ({ uColor: { value: new THREE.Color('#4d7dff') }, uAlpha: { value: 1 } }), [])
  const coolU = useMemo(() => ({ uColor: { value: new THREE.Color('#9b6bff') }, uAlpha: { value: 0 } }), [])
  const last = useRef(0)
  useFrame(({ clock }, dt) => {
    const s = st.current
    s.t += dt * SPEED
    const K = m.burns ? m.K : 0.05 // unburnt droplet barely evaporates
    const d2 = Math.max(0, d0 * d0 - K * s.t)
    const d = Math.sqrt(d2)
    let phase: DropletState['phase'] = 'none'
    if (m.burns) phase = m.coolFlame && d < m.hotExtD ? 'cool' : d > 0.05 ? 'hot' : 'out'
    if (d <= 0.05 || s.t > 40) s.t = 0
    const scale = d / d0
    const R = 0.55 * Math.max(0.0001, scale)
    if (drop.current) drop.current.scale.setScalar(R)
    const shellR = R * m.standoff * 0.38
    if (hot.current) {
      hot.current.scale.setScalar(Math.max(0.001, shellR))
      hotU.uAlpha.value += ((phase === 'hot' ? 1 : 0) - hotU.uAlpha.value) * Math.min(1, dt * 6)
      hotU.uColor.value.set(o2 > 0.3 ? '#7aa2ff' : '#4d7dff')
    }
    if (cool.current) {
      cool.current.scale.setScalar(Math.max(0.001, shellR * 0.8))
      coolU.uAlpha.value += ((phase === 'cool' && showCool ? 0.7 : 0) - coolU.uAlpha.value) * Math.min(1, dt * 4)
    }
    if (onState && clock.getElapsedTime() - last.current > 0.2) {
      last.current = clock.getElapsedTime()
      onState({ d, t: s.t, phase })
    }
  })
  return (
    <group>
      {/* tether fibres */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 6, 6]} />
        <meshBasicMaterial color="#3a4655" />
      </mesh>
      <mesh ref={drop}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhysicalMaterial color="#c8d6e6" roughness={0.05} transmission={0.6} thickness={0.5} metalness={0} />
      </mesh>
      <mesh ref={hot}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial vertexShader={shellVert} fragmentShader={shellFrag} uniforms={hotU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={cool}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial vertexShader={shellVert} fragmentShader={shellFrag} uniforms={coolU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}
