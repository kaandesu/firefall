// Run a real review from the shell, without the UI: the same conductor the app uses, folded through the same reducer.
//   node --import ./scripts/register.mjs scripts/real-review.ts <agent handle> [lagrange proxy url] [tools url]
// Needs `pnpm dev` (for the Lagrange proxy), `pnpm tools`, and the agent's tunnel. Answers every question with its first option.
import { readFileSync } from 'node:fs'
import { parseCabin, parseMaterials, toPackage } from '@/intake/parse'
import { Conductor } from '@/live/conductor'
import { emptyModel, reduce } from '@/live/model'
import type { Entry } from '@/live/types'

const [agent = 'sim', lagrange = 'http://localhost:5180/api/lagrange', tools = 'http://localhost:8765'] = process.argv.slice(2)
const ex = 'public/examples/apollo-cm012/'
const files = { cabin: readFileSync(ex + 'cabin.yaml', 'utf8'), materials: readFileSync(ex + 'materials.csv', 'utf8'), model: readFileSync(ex + 'cabin.model.json', 'utf8') }
const pkg = toPackage(parseCabin(files.cabin), parseMaterials(files.materials))
let model = emptyModel()
let seq = 0
const t0 = Date.now()
const log = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${s}`)
const c: Conductor = new Conductor({
  request: 'Would a materials review have caught this cabin before the plugs-out test?',
  pkg,
  files,
  agentFor: () => agent,
  lagrange,
  tools,
  onFix: (f) => log(`fix → ${JSON.stringify(f)}`),
  emit: (e) => {
    model = reduce(model, { ...e, seq: ++seq, at: new Date().toISOString() } as Entry)
    const d = (e.data ?? {}) as Record<string, any>
    if (d.name === 'fc.tool' && d.call.status !== 'running') log(`tool  ${d.call.agent}.${d.call.tool} ${d.call.status} ${JSON.stringify(d.call.result ?? '')}`)
    if (d.name === 'fc.job' && d.job.done) log(`job   ${d.job.id} [${d.job.scene}] ${JSON.stringify(d.job.stats).slice(0, 140)}`)
    if (d.name === 'fc.comm') log(`comm  ${e.sender}→${e.recipient} (${d.kind}) ${String(d.text).replace(/\s+/g, ' ').slice(0, 160)}`)
    if (d.name === 'fc.proposal') log(`prop  ${d.proposal.id} ${d.proposal.status} · ${d.proposal.title} · reviews ${d.proposal.reviews.map((r: any) => r.stance).join(',')}`)
    if (e.kind === 'task' && e.state === 'TASK_STATE_INPUT_REQUIRED') {
      log(`ASK   ${e.summary}`)
      setTimeout(() => c.answer(e.taskId!, ((d.options as string[]) ?? ['ok'])[0]), 300)
    }
  },
})
await c.start()
await c.run()
await new Promise((r) => setTimeout(r, 13_000))
const tools_n = Object.values(model.agents).reduce((n, a) => n + a.tools.length, 0)
console.log('\n── model')
console.log({ done: model.done, plan: model.plan?.subtasks.map((s) => `${s.id}:${s.status}`).join(' '), tools: tools_n, jobs: model.jobs.map((j) => j.id), matrix: model.matrix.length, sims: model.sims.map((s) => s.id), proposals: model.proposals.map((p) => `${p.id}:${p.status}`), kb: Object.values(model.kb).flat().length, verdict: model.caseFile?.verdict?.headline })
console.log('\n── report\n' + (model.dossier.find((d) => d.id === 'agent-report')?.body[0] ?? '(none)').slice(0, 2500))
process.exit(0)
