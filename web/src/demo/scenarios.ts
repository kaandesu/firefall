import type { Beat } from '@/live/script'
import type { SimKind } from '@/live/types'
import type { Params, ViewId } from '@/live/store'
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
  tiles: ViewId[]
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  habitat: {
    id: 'habitat',
    title: 'Habitat Review',
    kind: 'review',
    tagline: 'Certify the PR-2 rover cabin at 8.2 psia / 34 % O₂',
    build: habitatReview,
    params: { o2: 0.34, psi: 8.2, g: 0.165, flow: 8, material: 'nomex' },
    simTab: 'flame',
    tiles: ['orbit', 'plan', 'comms', 'workspace'],
  },
  incident: {
    id: 'incident',
    title: 'Rover Incident',
    kind: 'incident',
    tagline: 'Smoke alarm in the aft avionics bay',
    build: roverIncident,
    params: { o2: 0.34, psi: 8.2, g: 0.165, flow: 0, material: 'kapton' },
    simTab: 'smoke',
    tiles: ['orbit', 'sim', 'comms', 'plan'],
  },
  apollo1: {
    id: 'apollo1',
    title: 'Case · Apollo 1',
    kind: 'case',
    tagline: '1967 pad fire — would a materials review have caught it?',
    build: apollo1,
    params: { o2: 1, psi: 16.7, g: 1, flow: 10, material: 'cotton' },
    simTab: 'flame',
    tiles: ['case', 'orbit', 'comms', 'sim'],
  },
}
