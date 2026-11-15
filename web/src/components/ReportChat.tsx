// The chat beside the report. Live: streams from /api/ask (OpenAI, key on the dev server), grounded in the report
// JSON. Demo: scripted answers built from the same report. Either way, answers can pull things up: tags like
// [[chart:smoke]] become cards the reader can click (jump to the section, see the chart, the row, the test point).
import { ArrowUp, MessageSquare, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SECTIONS, numberOf, type SectionId } from '@/report/build'
import { cn } from '@/lib/utils'

export type Pull = { kind: 'section' | 'row' | 'evidence' | 'chart'; id: string }
type Msg = { role: 'user' | 'assistant'; content: string; via?: 'live' | 'demo'; error?: string }

const TAG = /\[\[(section|row|evidence|chart):([^\]]+)\]\]/g

function split(text: string): (string | Pull)[] {
  const out: (string | Pull)[] = []
  let last = 0
  for (const m of text.matchAll(TAG)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    out.push({ kind: m[1] as Pull['kind'], id: m[2].trim() })
    last = m.index! + m[0].length
  }
  // Hide a tag that is still streaming in.
  const rest = text.slice(last).replace(/\[\[[^\]]*$/, '')
  if (rest) out.push(rest)
  return out
}

export function ReportChat({ context, section, seed, onSeedUsed, renderPull, script }: {
  context: string
  section: SectionId
  /** A question queued by a section's Ask button. */
  seed?: string
  onSeedUsed: () => void
  renderPull: (p: Pull) => ReactNode
  script: (q: string) => string
}) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [server, setServer] = useState<{ live: boolean; model: string }>()
  const [demo, setDemo] = useState(false)
  const stop = useRef<() => void>(undefined)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/ask')
      .then((r) => (r.ok ? r.json() : { live: false, model: '' }))
      .then((j: { live: boolean; model: string }) => {
        setServer(j)
        if (!j.live) setDemo(true)
      })
      .catch(() => {
        setServer({ live: false, model: '' })
        setDemo(true)
      })
  }, [])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs])

  const append = (d: string) => setMsgs((ms) => ms.map((m, i) => (i === ms.length - 1 ? { ...m, content: m.content + d } : m)))
  const fail = (e: string) => setMsgs((ms) => ms.map((m, i) => (i === ms.length - 1 ? { ...m, error: e } : m)))

  const send = async (q: string) => {
    if (!q.trim() || busy) return
    const history = msgs.map(({ role, content }) => ({ role, content }))
    const via = demo || !server?.live ? 'demo' : 'live'
    setMsgs((ms) => [...ms, { role: 'user', content: q }, { role: 'assistant', content: '', via }])
    setText('')
    setBusy(true)
    if (via === 'demo') {
      // Type the scripted answer out, a few characters per tick.
      const full = script(q)
      let i = 0
      const id = setInterval(() => {
        const n = Math.min(full.length, i + 9)
        append(full.slice(i, n))
        i = n
        if (i >= full.length) {
          clearInterval(id)
          setBusy(false)
        }
      }, 16)
      stop.current = () => {
        clearInterval(id)
        setBusy(false)
      }
      return
    }
    const ctl = new AbortController()
    stop.current = () => ctl.abort()
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: `[reader is on §${numberOf(section)} ${section}] ${q}`, context, history }), signal: ctl.signal })
      if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text()}`)
      const rd = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await rd.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const p of parts) {
          const d = p.replace(/^data: /, '')
          try {
            const j = JSON.parse(d) as { delta?: string }
            if (j.delta) append(j.delta)
          } catch {
            /* keep-alive */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') fail(`${(e as Error).message.slice(0, 160)} · switched to demo answers`)
      if ((e as Error).name !== 'AbortError') {
        setDemo(true)
        append(script(q))
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (seed) {
      onSeedUsed()
      void send(seed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const sec = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const chips = [...new Set([sec.ask, 'Why does this cabin fail?', 'What did the ACME data show?', 'Where should the smoke sensors go?', 'What did people decide?', "What's still open?"])].slice(0, 5)

  return (
    <aside className="flex h-full w-[400px] shrink-0 flex-col border-l border-line bg-surface print:hidden">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px]">
        <MessageSquare size={12} className="text-ug" />
        <span className="tracking-[0.12em] text-ink">ASK THE REPORT</span>
        <span className="ml-auto text-faint">{demo ? 'scripted answers' : server?.live ? `OpenAI · ${server.model}` : 'checking…'}</span>
        <button
          type="button"
          onClick={() => setDemo((d) => (server?.live ? !d : true))}
          title={server?.live ? 'switch between the model and the scripted demo answers' : 'no OPENAI_API_KEY on the dev server: demo answers only'}
          className={cn('rounded-sm border px-1.5 py-px', demo ? 'border-k-ask/60 text-k-ask' : 'border-line-2 text-muted-foreground hover:text-ink')}
        >
          demo
        </button>
      </header>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-1.5 text-[10.5px] text-muted-foreground">
        <span className="text-faint">talking about</span>
        <span className="text-ink">
          {numberOf(section) ? `§${numberOf(section)} ` : ''}
          {sec.title}
        </span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!msgs.length && (
          <div className="sans space-y-2 text-[12.5px] leading-snug text-muted-foreground">
            <p>Ask anything about this review. Answers come only from the report: its numbers, the runs, the real ACME data and who decided what.</p>
            <p className="text-faint">Answers can pull things up: a chart, a matrix row, a test point, a section.</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="sans ml-8 rounded-sm border border-line-2 bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink">
              {m.content}
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-1.5 text-[9.5px] text-faint">
                <Sparkles size={10} className={m.via === 'live' ? 'text-ug' : 'text-k-ask'} />
                {m.via === 'live' ? server?.model : 'demo'}
              </div>
              {split(m.content).map((p, k) =>
                typeof p === 'string' ? (
                  <div key={k} className="report-md sans text-[12.5px] leading-relaxed text-ink">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{p}</ReactMarkdown>
                  </div>
                ) : (
                  <div key={k}>{renderPull(p)}</div>
                ),
              )}
              {busy && i === msgs.length - 1 && <span className="inline-block h-3 w-1.5 animate-pulse bg-ug" />}
              {m.error && <div className="text-[10.5px] text-warn">{m.error}</div>}
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <div className="flex flex-wrap gap-1 border-t border-line px-3 pt-2">
        {chips.map((c) => (
          <button key={c} type="button" disabled={busy} onClick={() => void send(c)} className="rounded-sm border border-line-2 px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:border-ug/60 hover:text-ink disabled:opacity-40">
            {c}
          </button>
        ))}
      </div>
      <form
        className="flex items-end gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(text)
            }
          }}
          rows={2}
          placeholder={numberOf(section) ? `Ask about §${numberOf(section)} or anything in the report…` : 'Ask anything in the report…'}
          className="sans min-h-[44px] flex-1 resize-none rounded-sm border border-line-2 bg-surface-2 px-2 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-ug/60"
        />
        {busy ? (
          <button type="button" onClick={() => stop.current?.()} className="rounded-sm border border-line-2 p-2 text-muted-foreground hover:text-ink" title="stop">
            <Square size={12} />
          </button>
        ) : (
          <button type="submit" disabled={!text.trim()} className="rounded-sm border border-ug/50 bg-ug/10 p-2 text-ug disabled:opacity-30" title="ask">
            <ArrowUp size={12} />
          </button>
        )}
      </form>
    </aside>
  )
}
