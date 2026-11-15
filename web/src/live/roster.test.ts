import { describe, expect, it } from 'vitest'
import { upsertEnv } from '../../server/lagrange'
import { ROLES, replyText, taskState, toAddress, tunnelCommands } from './roster'

describe('roster', () => {
  it('reads an address as the server lists it', () => {
    expect(toAddress({ handle: 'echo-1', kind: 'agent', displayName: '', online: true, sessions: [{ agent: 'echo' }, { agent: 'echo' }] })).toEqual({
      handle: 'echo-1',
      kind: 'agent',
      name: 'echo-1',
      description: '',
      online: true,
      runs: 'echo',
      workers: 2,
    })
    expect(toAddress({ handle: 'ada', kind: 'human', displayName: 'Ada', online: true }).kind).toBe('human')
    expect(toAddress({ handle: 'x' })).toMatchObject({ online: false, workers: 0, runs: undefined })
  })

  it('finds the answer in a finished task', () => {
    expect(replyText({ status: 'a status line', task: { artifacts: [{ parts: [{ text: 'from the artifact' }] }] } })).toBe('from the artifact')
    expect(replyText({ status: 'You said: hi', task: { artifacts: [] } })).toBe('You said: hi')
    expect(replyText({ task: { artifacts: [{ name: 'thoughts', parts: [{ text: 'hm' }] }, { name: 'response', parts: [{ text: 'Bur' }, { text: 'ns at ' }, { text: '34 %' }] }] } })).toBe('Burns at 34 %')
    expect(replyText({})).toBe('')
  })

  it('maps A2A task states', () => {
    expect(taskState('TASK_STATE_COMPLETED')).toBe('done')
    expect(taskState('TASK_STATE_FAILED')).toBe('failed')
    expect(taskState('TASK_STATE_CANCELED')).toBe('failed')
    expect(taskState('TASK_STATE_WORKING')).toBe('working')
    expect(taskState(undefined)).toBe('working')
  })

  it('has a seat for every agent and person of the scripted review', () => {
    expect(ROLES.filter((r) => !r.person)).toHaveLength(9)
    expect(ROLES.filter((r) => r.person).map((r) => r.id)).toEqual(['you', 'lab'])
  })

  it('writes tunnel commands with the server and token', () => {
    const cmds = tunnelCommands('http://localhost:8080', 'lgr_x')
    expect(cmds[0].cmd).toBe('lagrange tunnel --server http://localhost:8080 --token lgr_x --echo')
    expect(cmds.every((c) => c.cmd.includes('--token lgr_x'))).toBe(true)
  })
})

describe('upsertEnv', () => {
  it('adds keys and keeps the rest', () => {
    expect(upsertEnv('OPENAI_API_KEY=sk\n', { LAGRANGE_URL: 'http://a', LAGRANGE_KEY: 'k' })).toBe('OPENAI_API_KEY=sk\nLAGRANGE_URL=http://a\nLAGRANGE_KEY=k\n')
    expect(upsertEnv('', { LAGRANGE_URL: 'http://a' })).toBe('LAGRANGE_URL=http://a\n')
  })
  it('replaces a key in place', () => {
    expect(upsertEnv('LAGRANGE_URL=http://old\nOPENAI_API_KEY=sk\n', { LAGRANGE_URL: 'http://new' })).toBe('LAGRANGE_URL=http://new\nOPENAI_API_KEY=sk\n')
  })
})
