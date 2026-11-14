import { describe, expect, it } from 'vitest'
import { HUMAN, LAB } from '@/demo/crew'
import { Script } from './script'
import { fold } from './model'
import { signature } from './sign'
import type { Entry } from './types'

const entries = (s: Script) => s.build().map((b, i) => ({ ...b.e, seq: i + 1, at: new Date(1000 * b.t).toISOString() }) as Entry)
const answer = (id: string, text: string, seq: number): Entry => ({ kind: 'task', taskId: id, sender: 'flight', recipient: HUMAN, state: 'TASK_STATE_COMPLETED', summary: text, seq, at: new Date(99_000).toISOString() })

describe('inbox', () => {
  it('collects decisions, lab jobs and FYIs, and closes them', () => {
    const s = new Script()
    s.start('t', 'x', {}, 'go')
    s.wait(1).askHuman('ask-sign', 'Sign?', ['Sign the hazard report', 'Not yet, keep it a draft'])
    s.wait(1).task('t-lab', 'wstf', LAB, 'Run Test 1')
    s.state('t-lab', 'input_required', 'running')
    s.wait(1).say('flight', HUMAN, 'reply', 'Review done.')
    const es = entries(s)
    let m = fold(es)
    expect(m.inbox.map((x) => [x.kind, x.to, x.status])).toEqual([
      ['decide', HUMAN, 'open'],
      ['task', LAB, 'open'],
      ['fyi', HUMAN, 'done'],
    ])
    expect(signature(m).signed).toBe(false)
    m = fold([answer('ask-sign', 'Sign the hazard report', es.length + 1)], m)
    expect(m.inbox[0].status).toBe('done')
    expect(signature(m)).toMatchObject({ signed: true, by: 'You' })
  })
  it('a "not yet" leaves the report a draft', () => {
    const s = new Script()
    s.start('t', 'x', {}, 'go')
    s.wait(1).askHuman('ask-sign', 'Sign?', ['Sign the hazard report', 'Not yet, keep it a draft'])
    const es = entries(s)
    const m = fold([...es, answer('ask-sign', 'Not yet, keep it a draft', es.length + 1)])
    expect(signature(m).signed).toBe(false)
  })
})
