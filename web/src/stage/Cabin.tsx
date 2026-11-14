// The cabin, built from cabin.model.json primitives. Each primitive is a named zone; the caller decides how a
// zone looks (material status, burning, charred). No animation in here: the stage drives everything by frame.
import type { ThreeEvent } from '@react-three/fiber'
import { DoubleSide } from 'three'
import type { CabinModel, Primitive } from '@/intake/parse'

export type ZoneLook = { color: string; emissive?: string; glow?: number; opacity?: number }

function Geometry({ p }: { p: Primitive }) {
  if (p.kind === 'box') return <boxGeometry args={p.size} />
  if (p.kind === 'cone') return <cylinderGeometry args={[p.radiusTop ?? 0.01, p.radiusBottom ?? 1, p.height ?? 1, 40, 1, true]} />
  return <cylinderGeometry args={[p.radius ?? 0.1, p.radius ?? 0.1, p.height ?? 1, 20]} />
}

/** The pressure hull: a faint skin and a wire cage so you can see inside. */
function Shell({ p, tint }: { p: Primitive; tint: string }) {
  return (
    <group position={p.pos} rotation={p.rot}>
      <mesh>
        <cylinderGeometry args={[p.radiusTop ?? 0.01, p.radiusBottom ?? 1, p.height ?? 1, 40, 1, true]} />
        <meshStandardMaterial color={tint} transparent opacity={0.07} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[p.radiusTop ?? 0.01, p.radiusBottom ?? 1, p.height ?? 1, 20, 5, true]} />
        <meshBasicMaterial color={tint} wireframe transparent opacity={0.22} />
      </mesh>
      {/* heat shield / floor ring */}
      <mesh position={[0, -(p.height ?? 1) / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, p.radiusBottom ?? 1, 40]} />
        <meshStandardMaterial color={tint} transparent opacity={0.09} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function Cabin({
  model,
  look,
  shellTint = '#5aa9ff',
  highlight,
  onPick,
}: {
  model: CabinModel
  look: (zone: string) => ZoneLook
  shellTint?: string
  highlight?: string
  onPick?: (zone: string | undefined) => void
}) {
  return (
    <group>
      {model.primitives.map((p) => {
        if (p.shell) return <Shell key={p.id} p={p} tint={shellTint} />
        const l = look(p.zone)
        const hi = highlight === p.zone
        return (
          <mesh
            key={p.id}
            position={p.pos}
            rotation={p.rot}
            onClick={
              onPick
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation()
                    onPick(p.zone)
                  }
                : undefined
            }
          >
            <Geometry p={p} />
            <meshStandardMaterial
              color={l.color}
              emissive={hi ? '#5aa9ff' : (l.emissive ?? '#000000')}
              emissiveIntensity={hi ? 0.55 : (l.glow ?? 0)}
              transparent={l.opacity !== undefined && l.opacity < 1}
              opacity={l.opacity ?? 1}
              roughness={0.8}
              metalness={0.05}
            />
          </mesh>
        )
      })}
    </group>
  )
}
