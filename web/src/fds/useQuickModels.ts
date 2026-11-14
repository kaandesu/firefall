// FIREFALL's quick models on the same Apollo inputs, for the FDS cross-check: the zone fire / pressure model
// (stage/physics.ts) and the 2-D smoke study's designed-layout alarm times (lab/smokeStudy.ts).
import { useEffect, useMemo, useState } from 'react'
import type { DesignPackage } from '@/demo/packages'
import { parseCabin, parseMaterials, parseModel, toPackage, type CabinModel } from '@/intake/parse'
import { useSmokeStudy } from '@/lab/useSmokeStudy'
import { EXAMPLE_DIR } from '@/live/store'
import { simulateFire, variantsFor } from '@/stage/physics'

export function useApolloInputs() {
  const [v, setV] = useState<{ pkg: DesignPackage; model: CabinModel }>()
  useEffect(() => {
    void Promise.all(['cabin.yaml', 'materials.csv', 'cabin.model.json'].map((f) => fetch(`${EXAMPLE_DIR}/${f}`).then((r) => r.text()))).then(([c, m, j]) => {
      const spec = parseCabin(c)
      setV({ pkg: toPackage(spec, parseMaterials(m)), model: parseModel(j) })
    })
  }, [])
  return v
}

export function useQuickModels() {
  const inp = useApolloInputs()
  const study = useSmokeStudy(inp?.pkg, inp?.model).study
  return useMemo(() => {
    if (!inp) return undefined
    const base = variantsFor(inp.pkg)[0]
    const fire = (g: number) => {
      const r = simulateFire(inp.model, inp.pkg, { ...base, g })
      return { burning: Object.values(r.ignite).filter((t) => t !== null).length, peakPsia: Math.max(...r.pressure.map((p) => p.psia)), rupture: r.rupture }
    }
    const listed = study?.sources.find((s) => s.listed)?.id
    const alarms = (g: number) => study?.cases.find((c) => c.source === listed && c.g === g)?.alarms
    return { g1: fire(1), ug: fire(0), alarms1g: alarms(1), alarmsUg: alarms(0) }
  }, [inp, study])
}
