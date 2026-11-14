// Starts the detection study for the case under review once, in a worker, and keeps the result in a module cache.
import { useEffect, useSyncExternalStore } from 'react'
import type { DesignPackage } from '@/demo/packages'
import type { CabinModel } from '@/intake/parse'
import type { SmokeStudy } from './smokeStudy'

type State = { key?: string; progress: number; study?: SmokeStudy; error?: string }
let state: State = { progress: 0 }
const subs = new Set<() => void>()
const emit = (s: Partial<State>) => {
  state = { ...state, ...s }
  for (const f of subs) f()
}

export function startSmokeStudy(pkg: DesignPackage, model: CabinModel) {
  const key = `${pkg.vehicle}|${pkg.ventFlow}|${JSON.stringify(pkg.sensors ?? [])}|${model.primitives.length}`
  if (state.key === key) return
  emit({ key, progress: 0, study: undefined, error: undefined })
  const w = new Worker(new URL('./smoke.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<{ type: 'progress'; done: number; total: number } | { type: 'done'; study: SmokeStudy }>) => {
    if (state.key !== key) return w.terminate()
    if (e.data.type === 'progress') emit({ progress: e.data.done / e.data.total })
    else {
      emit({ progress: 1, study: e.data.study })
      w.terminate()
    }
  }
  w.onerror = (e) => emit({ error: e.message })
  w.postMessage({ model, pkg: { ventFlow: pkg.ventFlow, ignitionZones: pkg.ignitionZones, sensors: pkg.sensors, bom: pkg.bom } })
}

export const getSmokeStudy = () => state

/** Resolves when the study is ready (or after `ms`, with whatever is there). */
export function whenSmokeStudy(ms: number): Promise<SmokeStudy | undefined> {
  if (state.study) return Promise.resolve(state.study)
  return new Promise((res) => {
    const t = setTimeout(() => {
      subs.delete(f)
      res(state.study)
    }, ms)
    const f = () => {
      if (!state.study) return
      clearTimeout(t)
      subs.delete(f)
      res(state.study)
    }
    subs.add(f)
  })
}

export function useSmokeStudy(pkg?: DesignPackage, model?: CabinModel) {
  useEffect(() => {
    if (pkg && model) startSmokeStudy(pkg, model)
  }, [pkg, model])
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
}
