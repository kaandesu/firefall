import { describe, expect, it } from 'vitest'
import { KNOWLEDGE, reviewBrief } from './brief'
import { callsOf } from './review'

describe('live review', () => {
  it('folds tool-call entries into one row per call', () => {
    const calls = callsOf([
      { at: '2026-11-15T10:00:00Z', data: { toolCall: { id: 'a', title: 'mcp__firefall__spread_rate', status: 'in_progress', input: { material: 'nylon' } } } },
      { at: '2026-11-15T10:00:01Z', data: { toolCall: { id: 'b', title: 'mcp__firefall__run_fds', status: 'in_progress' } } },
      { at: '2026-11-15T10:00:02Z', data: { toolCall: { id: 'a', title: 'mcp__firefall__spread_rate', status: 'completed' } } },
      { at: '2026-11-15T10:00:03Z', data: {} },
    ])
    expect(calls).toEqual([
      { id: 'a', tool: 'spread_rate', status: 'done', input: '{"material":"nylon"}', at: '2026-11-15T10:00:00Z', doneAt: '2026-11-15T10:00:02Z' },
      { id: 'b', tool: 'run_fds', status: 'running', input: undefined, at: '2026-11-15T10:00:01Z', doneAt: undefined },
    ])
  })

  it('builds a brief with the request, the knowledge base and the files', () => {
    const b = reviewBrief({ request: 'Is it safe?', cabinYaml: 'o2: 1.0', materialsCsv: 'part,material' })
    expect(b).toContain('Is it safe?')
    expect(b).toContain(KNOWLEDGE)
    expect(b).toContain('o2: 1.0')
    expect(b).toContain('# Hazard report')
  })
})
