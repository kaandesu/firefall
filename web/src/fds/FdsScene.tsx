// The FDS case in 3-D: obstructions drawn straight from the parsed .fds (hull blocks cut away at the front),
// the burner, the detectors and the mesh outline; on top, the output: a colour-mapped slice and Smoke3D soot / fire
// as stacked alpha planes. FDS is z-up; three.js is y-up, so FDS (x, y, z) is drawn at (x, z, y), the same frame as
// cabin.model.json.
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FdsInput } from './namelist'
import { FDS_COLORS } from './namelist'
import type { Slice } from './slice'
import type { Smoke3D } from './smoke3d'

export type SliceView = { slice: Slice; frame: number; range: [number, number]; map: 'heat' | 'soot' }

const box = (xb: number[]) => {
  const [x0, x1, y0, y1, z0, z1] = xb
  return {
    pos: [(x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2] as const,
    size: [Math.max(0.012, Math.abs(x1 - x0)), Math.max(0.012, Math.abs(z1 - z0)), Math.max(0.012, Math.abs(y1 - y0))] as const,
  }
}

function surfColor(input: FdsInput, id?: string) {
  const c = id ? input.surfs[id]?.COLOR : undefined
  return (typeof c === 'string' && FDS_COLORS[c]) || '#8b97a6'
}

function HullBlocks({ input, cutaway }: { input: FdsInput; cutaway: boolean }) {
  const blocks = useMemo(() => input.obsts.filter((o) => o.surf === 'HULL' && (!cutaway || (o.xb[2] + o.xb[3]) / 2 > 0)), [input, cutaway])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    blocks.forEach((o, i) => {
      const b = box(o.xb)
      m.compose(new THREE.Vector3(...b.pos), new THREE.Quaternion(), new THREE.Vector3(...b.size))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [blocks])
  return (
    <instancedMesh key={blocks.length} ref={ref} args={[undefined, undefined, blocks.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3a4654" transparent opacity={cutaway ? 0.55 : 0.12} depthWrite={cutaway} />
    </instancedMesh>
  )
}

function Parts({ input, dim }: { input: FdsInput; dim: boolean }) {
  return (
    <group>
      {input.obsts
        .filter((o) => o.surf !== 'HULL')
        .map((o, i) => {
          const b = box(o.xb)
          const burner = o.id === 'BURNER'
          return (
            <mesh key={`${o.id}-${i}`} position={b.pos}>
              <boxGeometry args={b.size} />
              <meshStandardMaterial color={burner ? '#ff3030' : surfColor(input, o.surf)} transparent opacity={dim ? 0.35 : 0.9} emissive={burner ? '#ff3030' : '#000'} emissiveIntensity={burner ? 0.6 : 0} />
            </mesh>
          )
        })}
    </group>
  )
}

function Devices({ input, alarmed }: { input: FdsInput; alarmed: Set<string> }) {
  return (
    <group>
      {input.devcs
        .filter((d) => d.xyz && d.prop)
        .map((d) => (
          <mesh key={d.id} position={[d.xyz![0], d.xyz![2], d.xyz![1]]}>
            <boxGeometry args={[0.11, 0.11, 0.11]} />
            <meshBasicMaterial color={alarmed.has(d.id) ? '#ff4d4d' : '#e6edf3'} />
          </mesh>
        ))}
    </group>
  )
}

function MeshOutline({ input }: { input: FdsInput }) {
  const geo = useMemo(() => {
    const xb = input.meshes[0]?.xb
    if (!xb) return undefined
    const b = box(xb)
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(...b.size))
    g.translate(...b.pos)
    return g
  }, [input])
  if (!geo) return null
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#5aa9ff" transparent opacity={0.35} />
    </lineSegments>
  )
}

/** Inferno-ish ramp for temperature; grey ramp for soot. Returns [r, g, b] 0..255. */
export function heat(v: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0, 10, 8, 30],
    [0.25, 90, 20, 110],
    [0.5, 200, 50, 70],
    [0.75, 250, 140, 20],
    [1, 252, 240, 160],
  ]
  const x = Math.min(1, Math.max(0, v))
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, b] = [stops[i - 1], stops[i]]
      const t = (x - a[0]) / (b[0] - a[0])
      return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3])]
    }
  }
  return [252, 240, 160]
}

function SlicePlane({ input, view }: { input: FdsInput; view: SliceView }) {
  const { slice, frame, range, map } = view
  const xb = input.meshes[0].xb
  const ijk = input.meshes[0].ijk
  const dx = (xb[1] - xb[0]) / ijk[0], dy = (xb[3] - xb[2]) / ijk[1], dz = (xb[5] - xb[4]) / ijk[2]
  const [nx, ny, nz] = slice.dims
  const vertical = ny === 1
  const w = vertical ? nx : nx
  const h = vertical ? nz : ny
  const tex = useMemo(() => {
    const f = slice.frames[Math.min(frame, slice.frames.length - 1)]
    const data = new Uint8Array(w * h * 4)
    const [lo, hi] = range
    for (let k = 0; k < w * h; k++) {
      const v = (f[k] - lo) / (hi - lo || 1)
      const c = map === 'heat' ? heat(v) : ([180, 186, 196] as [number, number, number])
      data[k * 4] = c[0]
      data[k * 4 + 1] = c[1]
      data[k * 4 + 2] = c[2]
      data[k * 4 + 3] = Math.round(255 * Math.min(1, map === 'heat' ? 0.15 + 1.6 * Math.max(0, v) : Math.sqrt(Math.max(0, v))))
    }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }, [slice, frame, range, map, w, h])
  const [i1, i2, j1, j2, k1, k2] = slice.ijk
  const x0 = xb[0] + i1 * dx, x1 = xb[0] + i2 * dx
  const y0 = xb[2] + j1 * dy, y1 = xb[2] + j2 * dy
  const z0 = xb[4] + k1 * dz, z1 = xb[4] + k2 * dz
  if (vertical)
    return (
      <mesh position={[(x0 + x1) / 2, (z0 + z1) / 2, y0]}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    )
  // Horizontal: texture rows run along FDS y (= three z).
  return (
    <mesh position={[(x0 + x1) / 2, z0, (y0 + y1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[x1 - x0, y1 - y0]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Smoke3D as stacked planes along FDS y: each plane is the x–z field at one j. */
function Smoke3DPlanes({ input, s3d, time, kind }: { input: FdsInput; s3d: Smoke3D; time: number; kind: 'soot' | 'fire' }) {
  const xb = input.meshes[0].xb
  const [nx, ny, nz] = s3d.dims
  let n = 0
  for (let i = 0; i < s3d.times.length; i++) if (s3d.times[i] <= time + 1e-6) n = i
  const texs = useMemo(() => {
    const fr = s3d.frame(n)
    const out: THREE.DataTexture[] = []
    for (let j = 0; j < ny; j++) {
      const data = new Uint8Array(nx * nz * 4)
      let any = false
      for (let k = 0; k < nz; k++)
        for (let i = 0; i < nx; i++) {
          const v = fr[i + nx * (j + ny * k)]
          const o = (i + nx * k) * 4
          if (kind === 'soot') {
            data[o] = 40
            data[o + 1] = 42
            data[o + 2] = 46
            data[o + 3] = Math.min(255, v * 1.6)
          } else {
            data[o] = 255
            data[o + 1] = 120 + Math.min(120, v)
            data[o + 2] = 40
            data[o + 3] = Math.min(255, v * 3)
          }
          if (v) any = true
        }
      const t = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat)
      t.magFilter = THREE.LinearFilter
      t.needsUpdate = true
      t.userData.any = any
      out.push(t)
    }
    return out
  }, [s3d, n, nx, ny, nz, kind])
  const w = xb[1] - xb[0], hgt = xb[5] - xb[4]
  return (
    <group>
      {texs.map((t, j) =>
        t.userData.any ? (
          <mesh key={j} position={[(xb[0] + xb[1]) / 2, (xb[4] + xb[5]) / 2, xb[2] + (j / (ny - 1)) * (xb[3] - xb[2])]}>
            <planeGeometry args={[w, hgt]} />
            <meshBasicMaterial map={t} transparent depthWrite={false} side={THREE.DoubleSide} blending={kind === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending} />
          </mesh>
        ) : null,
      )}
    </group>
  )
}

export function FdsScene({
  input,
  mode,
  slice,
  smoke,
  fire,
  time,
  alarmed,
  compact = false,
}: {
  input: FdsInput
  mode: 'input' | 'output'
  slice?: SliceView
  smoke?: Smoke3D
  fire?: Smoke3D
  time: number
  alarmed: Set<string>
  /** Small Lab tile: lower resolution, slow turntable, no grid. */
  compact?: boolean
}) {
  const out = mode === 'output'
  return (
    <Canvas camera={{ position: compact ? [4.4, 2.9, -5.2] : [5.0, 3.3, -5.9], fov: 40 }} dpr={compact ? [1, 1.5] : [1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#030508']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 6, -4]} intensity={1.4} />
      <group>
        <HullBlocks input={input} cutaway />
        <Parts input={input} dim={out} />
        <Devices input={input} alarmed={alarmed} />
        <MeshOutline input={input} />
        {out && slice && <SlicePlane input={input} view={slice} />}
        {out && smoke && <Smoke3DPlanes input={input} s3d={smoke} time={time} kind="soot" />}
        {out && fire && <Smoke3DPlanes input={input} s3d={fire} time={time} kind="fire" />}
      </group>
      {!compact && <gridHelper args={[6, 12, '#1b2430', '#10161e']} position={[0, -0.01, 0]} />}
      <OrbitControls target={[0, 1.2, 0]} enableDamping={false} minDistance={2.5} maxDistance={12} autoRotate={compact} autoRotateSpeed={0.6} />
    </Canvas>
  )
}
