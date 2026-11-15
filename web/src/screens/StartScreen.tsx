// The first screen: watch the scripted demo, or connect to a real Lagrange server and bring your own agents.
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMission } from '@/live/store'
import { useRoster } from '@/live/roster'

const GUIDE = 'https://github.com/kaandesu/firefall/blob/main/docs/get-started.md'

const field = 'w-full rounded-sm border border-line-2 bg-bg px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-ug'

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className="space-y-1.5 text-[11px]">
      {items.map(([what, cmd], i) => (
        <li key={what} className="flex gap-2">
          <span className="text-faint">{i + 1}</span>
          <span className="min-w-0">
            <span className="sans text-muted-foreground">{what}</span>
            {cmd && <code className="mt-0.5 block truncate text-ink">{cmd}</code>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function StartScreen() {
  const setPhase = useMission((s) => s.setPhase)
  const conn = useRoster((s) => s.conn)
  const check = useRoster((s) => s.check)
  const connect = useRoster((s) => s.connect)
  const [url, setUrl] = useState('http://localhost:8080')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(false)

  useEffect(() => void check(), [check])
  useEffect(() => {
    if (conn.url) setUrl(conn.url)
  }, [conn.url])

  const demo = () => {
    useRoster.getState().useDemo()
    useMission.getState().setRealAgent(undefined)
    setPhase('setup')
  }
  const open = () => {
    useRoster.setState({ net: 'lagrange' })
    setPhase('setup')
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await connect(url, key)
    setBusy(false)
    if (ok) {
      setKey('')
      setEdit(false)
      setPhase('setup')
    }
  }

  const connected = conn.state === 'ok' && !edit

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[980px] flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <div className="tracking-[0.2em] text-ink">FIREFALL</div>
          <h1 className="sans mt-2 text-[24px] font-semibold leading-tight">A spacecraft fire-safety review, run by a team of agents and people.</h1>
          <p className="sans mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Give it a cabin and a materials list. Agents check them against NASA microgravity combustion data, run the fire and smoke models, and ask a person whenever a decision is theirs.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="pane gap-3 p-4 pt-5">
            <header className="pane-head text-[11px]">
              <span className="tracking-[0.14em] text-flame">1 DEMO</span>
              <span className="text-faint">no setup</span>
            </header>
            <div className="sans text-[14px] font-medium text-ink">Watch the Apollo CM-012 review</div>
            <p className="sans text-[12px] leading-snug text-muted-foreground">
              A scripted replay. The agents and their messages are simulated. The data and the models behind the numbers are real: NASA ACME test files, figures read from the BASS-II, Saffire and FLEX papers, a NIST FDS run of the cabin, and smoke CFD in your browser.
            </p>
            <button type="button" onClick={demo} className="mt-auto self-start rounded-sm bg-flame px-4 py-2 text-[12px] font-medium text-bg hover:brightness-110">
              watch the demo ▸
            </button>
          </div>

          <div className="pane gap-3 p-4 pt-5">
            <header className="pane-head text-[11px]">
              <span className="tracking-[0.14em] text-gold">2 CONNECT</span>
              <span className="text-faint">your Lagrange server, your agents</span>
            </header>
            <div className="sans text-[14px] font-medium text-ink">Bring your own team</div>

            {conn.state === 'checking' && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 size={13} className="animate-spin" /> checking for a saved server
              </div>
            )}

            {conn.state !== 'checking' && !conn.proxy && (
              <>
                <p className="sans text-[12px] leading-snug text-muted-foreground">
                  This build has no server to keep an API key. Run FIREFALL with its server (pnpm dev, or the Docker image) to connect it to a Lagrange server:
                </p>
                <Steps
                  items={[
                    ['Start a Lagrange server.', 'scripts/lagrange-local.sh up'],
                    ['Start FIREFALL locally.', 'cd web && pnpm install && pnpm dev'],
                    ['Open it and choose Connect.', 'http://localhost:5180'],
                  ]}
                />
              </>
            )}

            {conn.proxy && connected && (
              <>
                <div className="rounded-sm border border-line bg-surface-2 p-2.5 text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-ok" />
                    <span className="truncate text-ink">{conn.url}</span>
                  </div>
                  <div className="sans mt-1 text-muted-foreground">
                    Signed in as {conn.user || `@${conn.handle}`}
                    {conn.workspace && ` · workspace ${conn.workspace}`}
                    {conn.role && ` · ${conn.role}`}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-3">
                  <button type="button" onClick={open} className="rounded-sm bg-gold px-4 py-2 text-[12px] font-medium text-bg hover:brightness-110">
                    open the team ▸
                  </button>
                  <button type="button" onClick={() => setEdit(true)} className="text-[11px] text-muted-foreground hover:text-ink">
                    use another server
                  </button>
                </div>
              </>
            )}

            {conn.proxy && conn.state !== 'checking' && !connected && (
              <form onSubmit={submit} className="flex flex-col gap-2.5">
                <label className="block">
                  <span className="label">server url</span>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} className={`${field} mt-1`} placeholder="http://localhost:8080" spellCheck={false} />
                </label>
                <label className="block">
                  <span className="label">api key</span>
                  <input value={key} onChange={(e) => setKey(e.target.value)} type="password" className={`${field} mt-1`} placeholder="lgk_…" autoComplete="off" spellCheck={false} />
                </label>
                {conn.error && <div className="sans text-[11.5px] text-bad">{conn.error}</div>}
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={busy || !url || !key} className="flex items-center gap-2 rounded-sm bg-gold px-4 py-2 text-[12px] font-medium text-bg hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-faint">
                    {busy && <Loader2 size={12} className="animate-spin" />} connect
                  </button>
                  {edit && (
                    <button type="button" onClick={() => setEdit(false)} className="text-[11px] text-muted-foreground hover:text-ink">
                      cancel
                    </button>
                  )}
                </div>
                <div className="border-t border-line pt-2.5">
                  <Steps
                    items={[
                      ['No server yet? From the repo root. It also saves the key, so reload after it:', 'scripts/lagrange-local.sh up'],
                      ['Or with Docker (Lagrange and Postgres):', 'cp .env.example .env && docker compose -f docker-compose.yml -f docker-compose.local.yml up -d'],
                      ['Your own server: a key from Settings → API keys. The FIREFALL server keeps it (web/.env.local, or a cookie the page cannot read) and does not send it to the browser again.', ''],
                    ]}
                  />
                </div>
              </form>
            )}
            {conn.state !== 'checking' && (
              <a href={GUIDE} target="_blank" rel="noreferrer" className="sans text-[11.5px] text-ug hover:underline">
                Step-by-step guide: server, agents, tools, FDS ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
