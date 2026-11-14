// A candle-like diffusion flame, raymarched in a box. Gravity drives buoyancy: µg gives a dim blue sphere
// (diffusion-limited, little soot); 1 g gives the flickering yellow teardrop. Ghost flames at µg and 1 g
// on either side show the bounds that partial gravity must sit between (PSI has no partial-g data).
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flameShape } from '@/sims/models'
import { NOISE } from './glsl'

const vert = /* glsl */ `
varying vec3 vPos;
void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`

const frag = /* glsl */ `
uniform float uTime, uStretch, uSize, uFlicker, uSoot, uLean, uGain;
uniform vec3 uCam;
varying vec3 vPos;
${NOISE}
vec3 flame(vec3 p, out float dens){
  vec3 q = p - vec3(0.0, -0.75, 0.0);
  q.x -= uLean * max(q.y, 0.0) * 0.6;
  float fl = uFlicker > 0.01 ? (0.07*sin(uTime*6.2831*uFlicker) + 0.05*sin(uTime*6.2831*uFlicker*1.7+1.3)) : 0.0;
  float st = uStretch * (1.0 + fl);
  float yy = q.y > 0.0 ? q.y / st : q.y * 1.35;
  float turb = fbm(vec3(q.x*3.0, q.y*2.2 - uTime*(0.4 + uFlicker*0.25), q.z*3.0));
  float r = length(vec3(q.x, yy, q.z)) / uSize + (turb - 0.5) * (0.06 + 0.16 * min(1.0, uFlicker/8.0)) * smoothstep(-0.2, 0.8, q.y);
  float shell = exp(-pow((r - 0.5) / 0.085, 2.0));
  float inner = smoothstep(0.52, 0.12, r);
  float h = clamp(q.y / (st * uSize) , -1.0, 1.0);
  // Blue chemiluminescent shell: everywhere in µg, only the lower part at 1 g.
  float blueW = mix(1.0, smoothstep(0.35, -0.1, h), clamp(uSoot*1.3, 0.0, 1.0));
  vec3 blue = vec3(0.25, 0.48, 1.0) * shell * blueW * 1.6;
  // Luminous soot: interior upper region, scaled by soot.
  float sootRegion = inner * smoothstep(-0.05, 0.35, h) * uSoot;
  vec3 soot = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.45), smoothstep(0.0, 0.7, inner)) * sootRegion * 2.4;
  dens = shell + sootRegion;
  return blue + soot;
}
void main(){
  vec3 ro = uCam; // camera position in the box's local space (set on the CPU)
  vec3 rd = normalize(vPos - ro);
  vec3 p = vPos;
  vec3 col = vec3(0.0);
  float stepL = 0.035;
  for (int i = 0; i < 90; i++) {
    float d;
    col += flame(p, d) * stepL;
    p += rd * stepL;
    if (abs(p.x) > 1.01 || abs(p.y) > 1.81 || abs(p.z) > 1.01) break;
  }
  col *= uGain;
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`

function Flame({ g, o2, flow, gain = 1, position = [0, 0, 0] as [number, number, number], scale = 1 }: { g: number; o2: number; flow: number; gain?: number; position?: [number, number, number]; scale?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const box = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uStretch: { value: 1 }, uSize: { value: 1 }, uFlicker: { value: 0 }, uSoot: { value: 0 }, uLean: { value: 0 }, uGain: { value: gain }, uCam: { value: new THREE.Vector3() } }),
    [gain],
  )
  const target = useRef(flameShape(g, o2, flow))
  target.current = flameShape(g, o2, flow)
  useFrame(({ clock, camera }, dt) => {
    const u = mat.current?.uniforms
    if (!u) return
    const s = target.current
    const k = Math.min(1, dt * 3)
    u.uTime.value = clock.getElapsedTime()
    u.uStretch.value += (s.stretch - u.uStretch.value) * k
    u.uSize.value += (Math.min(1.2, 0.85 * s.size) - u.uSize.value) * k
    u.uFlicker.value += (s.flickerHz - u.uFlicker.value) * k
    u.uSoot.value += (s.soot - u.uSoot.value) * k
    u.uLean.value += (s.lean - u.uLean.value) * k
    if (box.current) box.current.worldToLocal(u.uCam.value.copy(camera.position))
  })
  return (
    <group position={position} scale={scale}>
      <mesh ref={box} position={[0, 0.8, 0]}>
        <boxGeometry args={[2, 3.6, 2]} />
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 12]} />
        <meshStandardMaterial color="#222" emissive="#ff5a1f" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -0.75, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.7, 24]} />
        <meshStandardMaterial color="#d9d2c3" roughness={0.8} />
      </mesh>
    </group>
  )
}

export function GravityFlameScene({ g, o2, flow }: { g: number; o2: number; flow: number }) {
  return (
    <>
      <Flame g={g} o2={o2} flow={flow} />
      <Flame g={0} o2={o2} flow={0} gain={0.35} position={[-2.7, -0.2, -1.2]} scale={0.6} />
      <Flame g={1} o2={o2} flow={0} gain={0.35} position={[2.7, -0.2, -1.2]} scale={0.6} />
      <gridHelper args={[12, 24, '#232323', '#111111']} position={[0, -1.1, 0]} />
    </>
  )
}
