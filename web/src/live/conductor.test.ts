import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCabin, parseMaterials, toPackage } from '@/intake/parse'
import { ROLE_BRIEFS, briefFor } from './brief'
import { parseReport, realPlan, summarize } from './conductor'

describe('real review', () => {
  it('reads the scribe’s answer: verdict, key facts, report body', () => {
    const r = parseReport('**VERDICT:** No, the hull ruptures at 14.9 s.\n- All five burn.\n- Rupture 14.9 s vs hatch 90 s.\n- Nothing tested above 40 %.\n\n## Materials\n| a | b |\n')
    expect(r.headline).toBe('No, the hull ruptures at 14.9 s.')
    expect(r.would).toHaveLength(3)
    expect(r.body.startsWith('## Materials')).toBe(true)
    const loose = parseReport('Just a paragraph without the format.')
    expect(loose).toEqual({ headline: 'Review complete', would: [], body: 'Just a paragraph without the format.' })
  })

  it('has a brief for every step of the plan, with the cabin and the findings in it', () => {
    const ex = 'public/examples/apollo-cm012/'
    const pkg = toPackage(parseCabin(readFileSync(ex + 'cabin.yaml', 'utf8')), parseMaterials(readFileSync(ex + 'materials.csv', 'utf8')))
    for (const s of realPlan()) {
      expect(ROLE_BRIEFS[s.agent as keyof typeof ROLE_BRIEFS]).toBeDefined()
      const b = briefFor(s.agent as keyof typeof ROLE_BRIEFS, { request: 'Is it safe?', pkg, files: { cabin: '', materials: '' }, findings: 'FINDING-X' })
      expect(b).toContain('Is it safe?')
      expect(b).toContain('FINDING-X')
      expect(b).toContain('nylon')
    }
  })

  it('shortens tool results for the agent panel', () => {
    expect(summarize('spread_rate', { burns: true, spread_mm_s: 4.1, limiting_o2: 0.25, caution: 'x' })).toEqual({ burns: true, spread_mm_s: 4.1, limiting_o2: 0.25 })
    expect(summarize('fire_spread', 'FDS is busy')).toBe('FDS is busy')
  })
})
