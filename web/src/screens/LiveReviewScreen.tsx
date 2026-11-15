// A real review by a connected agent: its tool calls on the left as they happen, its report on the right.
// Nothing on this screen is scripted except the brief the agent was sent (src/live/brief.ts).
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useReview, type Turn } from '@/live/review'
import { useRoster } from '@/live/roster'
import { useMission } from '@/live/store'

const field = 'min-w-0 flex-1 rounded-sm border border-line-2 bg-bg px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-ug'

function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [on])
  return now
}
const dur = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function TurnCalls({ turn }: { turn: Turn }) {
  return (
    <div className="border-b border-line">
      <div className="sans truncate bg-surface-2 px-3 py-1.5 text-[11.5px] text-muted-foreground" title={turn.label}>
        <span className="text-faint">{turn.kind === 'brief' ? 'brief · ' : 'you · '}</span>
        {turn.label}
      </div>
      {turn.calls.length === 0 && <div className="sans px-3 py-2 text-[11.5px] text-faint">{turn.state === 'working' ? 'no tool call yet' : 'no tool calls'}</div>}
      {turn.calls.map((c) => {
        const fds = c.input?.match(/run-\d{6}-\d{6}/)?.[0]
        return (
          <div key={c.id} className="flex items-start gap-2 px-3 py-1 text-[11.5px]">
            <span className="mt-0.5 shrink-0">
              {c.status === 'running' ? <Loader2 size={11} className="animate-spin text-k-task" /> : c.status === 'done' ? <Check size={11} className="text-ok" /> : <X size={11} className="text-bad" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <span className="text-ink">{c.tool}</span>
                {c.doneAt && <span className="ml-auto shrink-0 text-faint tnum">{((Date.parse(c.doneAt) - Date.parse(c.at)) / 1000).toFixed(1)} s</span>}
              </div>
              {c.input && (
                <div className="truncate text-[10.5px] text-muted-foreground" title={c.input}>
                  {c.input}
                </div>
              )}
              {fds && (
                <a href={`?view=fds&run=${fds}`} target="_blank" rel="noreferrer" className="text-[10.5px] text-ug hover:underline">
                  open {fds} in the FDS viewer ↗
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LiveReviewScreen() {
  const { agent, turns, error, followUp, answer, cancel } = useReview()
  const url = useRoster((s) => s.conn.url)
  const setPhase = useMission((s) => s.setPhase)
  const [text, setText] = useState('')
  const [shown, setShown] = useState<number>()
  const last = turns.at(-1)
  const busy = !!last && (last.state === 'working' || last.state === 'asking')
  const now = useNow(busy)
  // Show the newest turn that has an answer, unless one was picked.
  const withText = turns.map((t, i) => (t.text ? i : -1)).filter((i) => i >= 0)
  const idx = shown !== undefined && turns[shown]?.text ? shown : (withText.at(-1) ?? turns.length - 1)
  const turn = turns[idx]
  const nCalls = turns.reduce((n, t) => n + t.calls.length, 0)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void (last?.state === 'asking' ? answer(text) : followUp(text))
    setText('')
    setShown(undefined)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-5 lg:flex-row">
      <div className="pane max-h-[40vh] w-full shrink-0 pt-2.5 lg:max-h-none lg:w-[380px]">
        <header className="pane-head text-[11px]">
          <span className="tracking-[0.14em] text-ink">1 WORK</span>
          <span className="text-ok">live</span>
          <span className="truncate text-faint">
            @{agent} · {nCalls} tool calls{last && ` · ${dur((last.endedAt ?? now) - turns[0].startedAt)}`}
          </span>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {turns.map((t) => (
            <TurnCalls key={t.taskId} turn={t} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 px-3 py-2 text-[11.5px] text-k-task">
              <Loader2 size={11} className="animate-spin" /> {last.state === 'asking' ? 'waiting for your answer' : `@${agent} is working`}
              <button type="button" onClick={() => void cancel()} className="ml-auto text-faint hover:text-bad">
                stop
              </button>
            </div>
          )}
        </div>
        <div className="sans border-t border-line px-3 py-2 text-[10.5px] leading-snug text-faint">
          Every call is a real tool run on this machine. The same run, with full inputs and outputs, is in{' '}
          {url ? (
            <a href={`${url}/runs`} target="_blank" rel="noreferrer" className="text-ug hover:underline">
              Lagrange → Runs ↗
            </a>
          ) : (
            'Lagrange → Runs'
          )}
          .
        </div>
      </div>

      <div className="pane min-h-0 min-w-0 flex-1 pt-2.5">
        <header className="pane-head text-[11px]">
          <span className="tracking-[0.14em] text-ink">2 REPORT</span>
          <span className="truncate text-faint">written by @{agent}, not by FIREFALL</span>
          {turn?.text && (
            <button type="button" onClick={() => download('hazard-report.md', turn.text)} className="ml-auto text-muted-foreground hover:text-ink">
              download .md
            </button>
          )}
        </header>
        {withText.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-1.5 text-[11px]">
            {withText.map((i) => (
              <button key={turns[i].taskId} type="button" onClick={() => setShown(i)} className={cn('max-w-[220px] shrink-0 truncate rounded-sm px-2 py-0.5', i === idx ? 'bg-surface-2 text-ink' : 'text-muted-foreground hover:text-ink')}>
                {turns[i].kind === 'brief' ? 'report' : turns[i].label}
              </button>
            ))}
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="sans mb-3 rounded-sm border border-bad/40 px-3 py-2 text-[12px] text-bad">{error}</div>}
          {turn?.error && !turn.text && <div className="sans text-[12.5px] text-bad">{turn.error}</div>}
          {turn?.text ? (
            <div className="report-md report-doc sans mx-auto max-w-[820px] text-[13px] leading-relaxed text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
            </div>
          ) : (
            !error &&
            !turn?.error && (
              <div className="sans flex h-full flex-col items-center justify-center gap-2 text-center text-[12.5px] text-muted-foreground">
                <Loader2 size={16} className="animate-spin text-k-task" />
                <div>@{agent} is running the tools. The report appears here as it writes it.</div>
                <div className="text-faint">A full review takes about 2 to 4 minutes, most of it the FDS run.</div>
              </div>
            )
          )}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-line px-3 py-2">
          <input value={text} onChange={(e) => setText(e.target.value)} disabled={!agent || (busy && last.state !== 'asking')} placeholder={last?.state === 'asking' ? 'answer the agent’s question' : busy ? 'wait for it to finish, or stop it' : 'ask a follow-up, e.g. redo section 3 at 34 % O₂ and Moon gravity'} className={cn(field, 'disabled:opacity-50')} aria-label="message to the agent" />
          <button type="submit" disabled={!text.trim() || (busy && last.state !== 'asking')} className="shrink-0 rounded-sm bg-flame px-3 py-1.5 text-[12px] font-medium text-bg hover:brightness-110 disabled:bg-surface-3 disabled:text-faint">
            send
          </button>
          <button type="button" onClick={() => setPhase('setup')} className="shrink-0 text-[11px] text-muted-foreground hover:text-ink">
            ◂ team
          </button>
        </form>
      </div>
    </div>
  )
}
