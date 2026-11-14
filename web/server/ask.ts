// Dev-server route for the report chat: POST /api/ask {question, context, history} → SSE `data: {"delta": "…"}`.
// Calls OpenAI chat completions with streaming. The key is read on the server (web/.env.local) and never reaches
// the browser bundle. Without a key it answers 503 and the chat falls back to its scripted answers.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

const SYSTEM = `You are the assistant beside a spacecraft fire-safety review report (FIREFALL).
Answer only from the report data you are given; if the data does not say, say so plainly.
Be brief and concrete: numbers with units, and which agent or person produced them. Cite source ids (PSI-xx) only when the data gives one for that fact; never write a placeholder or say a source is missing.
When something in the report would help the reader, pull it up by writing one of these tags on its own line:
[[section:<id>]]  jump to a report section (ids are in the data)
[[row:<zone>]]    a materials matrix row
[[evidence:<test id>]]  an evidence row (test point)
[[chart:pressure]] or [[chart:smoke]] or [[chart:acme]]  a chart from the report
Pull up at least one chart, row or evidence card when it shows the answer, and end with the section tag it comes from. Do not invent tags or ids that are not in the data. Plain prose, short paragraphs or bullets, no headings.`

type Body = { question: string; context: string; history?: { role: 'user' | 'assistant'; content: string }[] }

const read = (req: IncomingMessage) =>
  new Promise<string>((res, rej) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => res(b))
    req.on('error', rej)
  })

export function askPlugin(): Plugin {
  let key = ''
  let model = 'gpt-5.4-mini'
  return {
    name: 'firefall-ask',
    configResolved(cfg) {
      const env = loadEnv(cfg.mode, cfg.root, '')
      key = env.OPENAI_API_KEY ?? ''
      model = env.OPENAI_MODEL || model
    },
    configureServer(server) {
      server.middlewares.use('/api/ask', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ live: !!key, model }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        if (!key) {
          res.statusCode = 503
          return res.end('no OPENAI_API_KEY in web/.env.local')
        }
        let body: Body
        try {
          body = JSON.parse(await read(req)) as Body
        } catch {
          res.statusCode = 400
          return res.end('bad json')
        }
        const messages = [
          { role: 'system', content: SYSTEM },
          { role: 'system', content: `Report data:\n${body.context.slice(0, 60_000)}` },
          ...(body.history ?? []).slice(-10),
          { role: 'user', content: body.question },
        ]
        const up = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages, stream: true }),
        }).catch((e: Error) => e)
        if (up instanceof Error || !up.ok || !up.body) {
          res.statusCode = 502
          return res.end(up instanceof Error ? up.message : `upstream ${up.status}: ${(await up.text()).slice(0, 300)}`)
        }
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        const dec = new TextDecoder()
        let buf = ''
        for await (const chunk of up.body as unknown as AsyncIterable<Uint8Array>) {
          buf += dec.decode(chunk, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const l of lines) {
            if (!l.startsWith('data: ')) continue
            const d = l.slice(6).trim()
            if (d === '[DONE]') continue
            try {
              const delta = JSON.parse(d).choices?.[0]?.delta?.content
              if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`)
            } catch {
              /* partial line */
            }
          }
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
      })
    },
  }
}
