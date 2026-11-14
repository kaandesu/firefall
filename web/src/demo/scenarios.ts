import type { Beat } from '@/live/script'
import type { SimKind } from '@/live/types'
import type { Params } from '@/live/store'
import { apollo1 } from './apollo1'
import { habitatReview } from './habitat-review'
import { roverIncident } from './rover-incident'

export type ScenarioId = 'habitat' | 'incident' | 'apollo1'

export type Scenario = {
  id: ScenarioId
  title: string
  tagline: string
  kind: 'review' | 'incident' | 'case'
  build: () => Beat[]
  params: Partial<Params>
  simTab: SimKind
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  habitat: {
    id: 'habitat',
    title: 'PR-2 rover · design review',
    kind: 'review',
    tagline: 'Phase II fire safety review of a lunar rover cabin at 34 % O₂ / 8.2 psia',
    build: habitatReview,
    params: { o2: 0.34, psi: 8.2, g: 0.165, flow: 8, material: 'nomex' },
    simTab: 'flame',
  },
  incident: {
    id: 'incident',
    title: 'PR-2 rover · smoke alarm',
    kind: 'incident',
    tagline: 'Operations: smoke alarm in the aft avionics bay — what is burning, what does the crew do?',
    build: roverIncident,
    params: { o2: 0.34, psi: 8.2, g: 0.165, flow: 0, material: 'kapton' },
    simTab: 'smoke',
  },
  apollo1: {
    id: 'apollo1',
    title: 'Apollo 1 · case file',
    kind: 'case',
    tagline: '1967 pad fire — would a materials review have caught it?',
    build: apollo1,
    params: { o2: 1, psi: 16.7, g: 1, flow: 10, material: 'cotton' },
    simTab: 'flame',
  },
}
