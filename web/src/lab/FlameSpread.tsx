// Saffire-style flame spread over a fabric sample in a flow duct. The front advances against the flow
// (opposed spread) at the model's rate; below the limiting O₂ it ignites and dies.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NOISE } from './glsl'
import { MATERIALS, flameShape, spreadRate } from '@/sims/models'

const LEN = 3.2
const WID = 1.0
const SPEEDUP = 18 // visual time compression

const sheetFrag = /* glsl */ `
uniform float uFront, uTime, uBurn; uniform vec3 uBase;
varying vec2 vUv;
${NOISE}
void main(){
  float x = vUv.x;               // 1 = ignition end (downstream), front moves toward 0
  float edge = uFront + (fbm(vec3(vUv.y*6.0, uTime*0.2, 0.0)) - 0.5) * 0.05;
  float weave = 0.06 * (step(0.5, fract(vUv.x*80.0)) + step(0.5, fract(vUv.y*28.0)));
  vec3 fabric = uBase * (0.85 + weave);
  float burnt = smoothstep(edge - 0.004, edge + 0.004, x);
  float glow = exp(-pow((x - edge) / 0.018, 2.0)) * uBurn;
  vec3 col = mix(fabric, vec3(0.05,0.04,0.035) + 0.04*fbm(vec3(vUv*20.0, 1.0)), burnt);
  col += vec3(1.0, 0.42, 0.08) * glow * 2.2;
  gl_FragColor = vec4(col, 1.0);
}
`
const sheetVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`

const flameFrag = /* glsl */ `
uniform float uTime, uSoot, uAlive, uHeight; varying vec2 vUv;
${NOISE}
void main(){
  float n = fbm(vec3(vUv.x*3.0, vUv.y*5.0 - uTime*1.5, uTime*0.2));
  float h = vUv.y;
  float shape = smoothstep(0.0, 0.08, h) * smoothstep(1.0, 0.2 + n*0.5, h) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  vec3 blue = vec3(0.3, 0.5, 1.0);
  vec3 yellow = vec3(1.0, 0.6, 0.15);
  vec3 col = mix(blue, yellow, clamp(uSoot * smoothstep(0.1, 0.6, h), 0.0, 1.0));
  float a = shape * uAlive * (0.6 + n*0.6);
  gl_FragColor = vec4(col * a * 2.0, a);
}
`

const BASE: Record<string, string> = { cotton: '#c9c1ad', nomex: '#d8c27a', pmma: '#9fc7d8', kapton: '#d88a2a', teflon: '#e8e8e8', silicone: '#d06a6a' }

export function FlameSpreadScene({ o2, psi, g, flow, material, onState }: { o2: number; psi: number; g: number; flow: number; material: string; onState?: (s: { front: number; rate: number; burning: boolean }) => void }) {
  const mat = MATERIALS[material] ?? MATERIALS.cotton
  const rate = spreadRate(o2, flow, g, psi, mat) // mm/s
  const shape = flameShape(g, o2, flow)
  const sheet = useRef<THREE.ShaderMaterial>(null)
  const fl = useRef<THREE.ShaderMaterial>(null)
  const flameMesh = useRef<THREE.Group>(null)
  const st = useRef({ front: 0.97, alive: 1, t: 0, ignitedFor: 0 })
  useEffect(() => {
    st.current = { front: 0.97, alive: 1, t: 0, ignitedFor: 0 }
  }, [o2, psi, g, flow, material])
  const sheetU = useMemo(() => ({ uFront: { value: 0.97 }, uTime: { value: 0 }, uBurn: { value: 1 }, uBase: { value: new THREE.Color(BASE[material] ?? '#ccc') } }), [material])
  const flameU = useMemo(() => ({ uTime: { value: 0 }, uSoot: { value: 0 }, uAlive: { value: 1 }, uHeight: { value: 1 } }), [])
  const lastReport = useRef(0)
  useFrame(({ clock }, dt) => {
    const s = st.current
    s.t += dt
    const burning = rate > 0
    if (burning) {
      s.front = Math.max(0, s.front - ((rate / 1000) * SPEEDUP * dt) / (LEN * 0.25))
      if (s.front <= 0.001) s.alive = Math.max(0, s.alive - dt)
    } else {
      s.ignitedFor += dt
      s.front = Math.max(0.94, s.front - dt * 0.01)
      s.alive = Math.max(0, 1 - s.ignitedFor / 2.5) // igniter flame dies
    }
    if (s.t > 2 && s.front <= 0.001 && s.alive <= 0) st.current = { front: 0.97, alive: 1, t: 0, ignitedFor: 0 }
    if (sheet.current) {
      sheet.current.uniforms.uFront.value = s.front
      sheet.current.uniforms.uTime.value = clock.getElapsedTime()
      sheet.current.uniforms.uBurn.value = s.alive
    }
    if (fl.current) {
      fl.current.uniforms.uTime.value = clock.getElapsedTime()
      fl.current.uniforms.uSoot.value = shape.soot
      fl.current.uniforms.uAlive.value = s.alive
    }
    if (flameMesh.current) {
      const x = -LEN / 2 + s.front * LEN
      flameMesh.current.position.x = x + 0.05
      const hgt = 0.25 + 0.35 * Math.min(2.5, shape.stretch) * Math.pow(o2 / 0.21, 0.5)
      flameMesh.current.scale.set(1, hgt, 1)
      flameMesh.current.position.y = hgt / 2 + 0.01
      // Flow leans the flame downstream (+x); buoyancy stands it up.
      flameMesh.current.rotation.z = -Math.atan2(flow / 30, 0.3 + g)
    }
    if (onState && clock.getElapsedTime() - lastReport.current > 0.3) {
      lastReport.current = clock.getElapsedTime()
      onState({ front: s.front, rate, burning })
    }
  })
  return (
    <group rotation={[-0.35, 0, 0]}>
      {/* duct */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[LEN + 0.6, 1.1, WID + 0.5]} />
        <meshBasicMaterial color="#56d4ef" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
      <lineSegments position={[0, 0.5, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(LEN + 0.6, 1.1, WID + 0.5)]} />
        <lineBasicMaterial color="#24364a" />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LEN, WID, 1, 1]} />
        <shaderMaterial ref={sheet} vertexShader={sheetVert} fragmentShader={sheetFrag} uniforms={sheetU} />
      </mesh>
      <group ref={flameMesh}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[WID * 0.98, 1, 1, 1]} />
          <shaderMaterial ref={fl} vertexShader={sheetVert} fragmentShader={flameFrag} uniforms={flameU} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2 + 0.5, 0]}>
          <planeGeometry args={[WID * 0.9, 1, 1, 1]} />
          <shaderMaterial vertexShader={sheetVert} fragmentShader={flameFrag} uniforms={flameU} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
