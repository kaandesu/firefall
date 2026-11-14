// The earlier rover scenarios. Hidden from the UI (v3 runs one case, Apollo CM-012, from intake files),
// kept so they can come back once the intake supports rover cabins.
import type { Beat } from '@/live/script'
import type { SimKind, SimParams } from '@/live/types'
import { habitatReview } from './habitat-review'
import { roverIncident } from './rover-incident'

export type ScenarioId = 'habitat' | 'incident'

export type Scenario = {
  id: ScenarioId
  title: string
  tagline: string
  kind: 'review' | 'incident'
  build: () => Beat[]
  params: Partial<SimParams>
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
}
