import { describe, expect, it } from 'vitest'
import { searchPages } from '@/data/report'
import { MATERIALS, limitingO2, spreadRate } from '@/sims/models'
import { ToolError, fireSpread, getCabin, limitingO2Tool, nearestTests, searchStudies, spreadRateTool } from './core'
import { TOOLS } from './mcp'

describe('firefall-tools', () => {
  it('answers from the same models the app uses', () => {
    const r = spreadRateTool({ material: 'nylon', o2: 0.34, psia: 8.2, g: 0.165 })
    expect(r.burns).toBe(true)
    expect(r.spread_mm_s).toBeCloseTo(spreadRate(0.34, 20, 0.165, 8.2, MATERIALS.nylon), 2)
    expect(limitingO2Tool({ material: 'PMMA', flow_cm_s: 5, g: 0 }).limiting_o2).toBeCloseTo(limitingO2(5, 0, 14.7, MATERIALS.pmma), 3)
  })

  it('says so when the material or the atmosphere is outside what it knows', () => {
    expect(() => spreadRateTool({ material: 'wood', o2: 0.3 })).toThrow(ToolError)
    const n = nearestTests({ o2: 1, psia: 16.7, n: 3 })
    expect(n.tests).toHaveLength(3)
    expect(n.warning).toMatch(/No real test reached 100 % O₂/)
    expect(nearestTests({ o2: 0.21, psia: 14.7 }).warning).toBeNull()
  })

  it('runs the cabin fire model with what-ifs', () => {
    const asBuilt = fireSpread({})
    expect(asBuilt.hull_rupture_at_s).not.toBeNull()
    expect(asBuilt.crew_can_get_out_first).toBe(false)
    const fixed = fireSpread({ o2: 0.6, replace: [{ from: 'nylon', to: 'nomex' }] })
    expect(fixed.hull_rupture_at_s).toBeNull()
    expect(() => fireSpread({ replace: [{ from: 'kapton', to: 'nomex' }] })).toThrow(/has no "kapton"/)
  })

  it('describes the cabin and ranks studies for it', () => {
    const c = getCabin()
    expect(c.atmosphere).toEqual({ o2: 1, psia: 16.7 })
    expect(c.materials.length).toBeGreaterThan(3)
    const s = searchStudies({ o2: 0.34, psia: 8.2, top: 4 })
    expect(s.studies).toHaveLength(4)
    expect(s.studies[0].score).toBeGreaterThanOrEqual(s.studies[3].score)
  })

  it('registers every tool once, with a description', () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length)
    expect(TOOLS.every((t) => t.description.length > 40)).toBe(true)
  })
})

describe('report search', () => {
  const pages = [
    { page: 1, text: 'Title page. Burning and Suppression of Solids.' },
    { page: 2, text: 'The blowoff limit for acrylic rods rises with flow speed. Blowoff was seen at 14 percent oxygen.' },
    { page: 3, text: 'Nomex did not burn in air.' },
  ]
  it('returns the best pages first, with the page number', () => {
    expect(searchPages(pages, 'blowoff acrylic', 2).map((p) => p.page)).toEqual([2])
    expect(searchPages(pages, 'nomex burn')[0].page).toBe(3)
    expect(searchPages(pages, 'zz')).toEqual([])
  })
})
