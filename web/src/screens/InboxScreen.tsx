// INBOX: everything that reached a person. Switch between you (lead engineer) and the WSTF technician: each sees
// only their own items. Decisions are answered here; the technician's chamber job has a result form (in the demo it
// fills from the chamber run and submits itself when the run ends).
import { Check, Inbox as InboxIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AgentTag, Avatar, Empty } from '@/components/bits'
import { LAB_BURN } from '@/demo/apollo1'
import { PEOPLE } from '@/demo/crew'
import { useMission } from '@/live/store'
import { openFor, tPlus } from '@/live/sign'
import type { InboxItem, Job } from '@/live/types'
import { cn } from '@/lib/utils'

type Filter = 'open' | 'done' | 'fyi'

export function InboxScreen() {
  const items = useMission((s) => s.model.inbox)
  const model = useMission((s) => s.model)
  const persona = useMission((s) => s.persona)
  const setPersona = useMission((s) => s.setPersona)
  const [filter, setFilter] = useState<Filter>(() => (items.some((x) => x.to === persona && x.status === 'open') ? 'open' : 'done'))
  const [sel, setSel] = useState<string>()
  const mine = items.filter((x) => x.to === persona)
  const shown = useMemo(
    () => mine.filter((x) => (filter === 'fyi' ? x.kind === 'fyi' : filter === 'open' ? x.status === 'open' : x.status === 'done' && x.kind !== 'fyi')).sort((a, b) => b.at - a.at),
    [mine, filter],
  )
  const current = mine.find((x) => x.id === sel) ?? shown[0]
  // Follow new open items as they arrive.
  const newest = mine.filter((x) => x.status === 'open').at(-1)?.id
  useEffect(() => {
    if (newest) {
      setSel(newest)
      setFilter('open')
    }
  }, [newest])

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[420px] shrink-0 flex-col border-r border-line">
        <div className="px-4 pt-4">
          <div className="label text-ug">inbox</div>
          <div className="mt-2 flex gap-1.5">
            {PEOPLE.map((p) => {
              const n = openFor(items, p.handle)
              return (
                <button
                  key={p.handle}
                  type="button"
                  onClick={() => {
                    setPersona(p.handle)
                    setSel(undefined)
                  }}
                  className={cn('flex flex-1 items-center gap-2 rounded-sm border px-2 py-1.5 text-left', persona === p.handle ? 'border-ug/60 bg-ug/10' : 'border-line-2 hover:bg-surface-2')}
                >
                  <Avatar handle={p.handle} size={24} />
                  <span className="min-w-0">
                    <span className="block text-[12px] text-ink">{p.name}</span>
                    <span className="block truncate text-[10.5px] text-faint">{p.role}</span>
                  </span>
                  {n > 0 && <span className="ml-auto rounded-full bg-warn px-1.5 text-[10px] font-semibold text-background">{n}</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex gap-1 text-[11px]">
            {(['open', 'done', 'fyi'] as const).map((f) => {
              const n = mine.filter((x) => (f === 'fyi' ? x.kind === 'fyi' : f === 'open' ? x.status === 'open' : x.status === 'done' && x.kind !== 'fyi')).length
              return (
                <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-sm px-2 py-0.5', filter === f ? 'bg-surface-2 text-ink' : 'text-muted-foreground hover:text-ink')}>
                  {f === 'fyi' ? 'FYI' : f} · {n}
                </button>
              )
            })}
          </div>
        </div>
        <div className="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 && <div className="px-4 py-6 text-[11.5px] text-faint">{filter === 'open' ? 'Nothing waiting on you.' : 'Nothing here yet.'}</div>}
          {shown.map((x) => (
            <button key={x.id} type="button" onClick={() => setSel(x.id)} className={cn('flex w-full gap-2.5 border-b border-line/60 px-4 py-2 text-left hover:bg-surface-2', current?.id === x.id && 'bg-surface-2')}>
              <Avatar handle={x.from} size={22} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[10.5px]">
                  <AgentTag handle={x.from} className="text-[11px]" />
                  <KindTag item={x} />
                  <span className="ml-auto text-faint tnum">{tPlus(model, x.at)}</span>
                </span>
                <span className="sans mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink">{x.text}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto px-6 py-5">{current ? <Detail item={current} /> : <Empty icon={<InboxIcon size={18} />} title="Inbox" hint="Decisions, lab jobs and notes for a person land here." />}</div>
    </div>
  )
}

function KindTag({ item }: { item: InboxItem }) {
  const label = item.kind === 'fyi' ? 'FYI' : item.kind === 'task' ? 'lab job' : 'decision'
  return <span className={cn('rounded-sm px-1 text-[9.5px] uppercase tracking-wide', item.status === 'open' ? 'bg-warn/15 text-warn' : 'bg-surface-3 text-faint')}>{item.status === 'open' ? label : item.kind === 'fyi' ? label : `${label} · done`}</span>
}

function Detail({ item }: { item: InboxItem }) {
  const model = useMission((s) => s.model)
  const respond = useMission((s) => s.respond)
  return (
    <div className="max-w-[720px] space-y-4">
      <div className="flex items-center gap-2 text-[11px]">
        <Avatar handle={item.from} size={26} />
        <span>
          <AgentTag handle={item.from} /> <span className="text-faint">→ {PEOPLE.find((p) => p.handle === item.to)?.name}</span>
        </span>
        <KindTag item={item} />
        <span className="ml-auto text-faint tnum">
          {tPlus(model, item.at)}
          {item.doneAt && item.kind !== 'fyi' ? ` · answered ${tPlus(model, item.doneAt)}` : ''}
        </span>
      </div>
      <h2 className="sans text-[19px] font-semibold leading-snug text-ink">{item.text}</h2>
      {item.positions && (
        <div className="grid grid-cols-2 gap-2">
          {item.positions.map((p) => (
            <div key={p.by} className="rounded-sm border border-line bg-surface-2 px-3 py-2">
              <AgentTag handle={p.by} />
              <div className="sans mt-1 text-[12.5px] leading-snug text-ink">{p.text}</div>
            </div>
          ))}
        </div>
      )}
      {item.kind === 'decide' && item.status === 'open' && (
        <div className="flex flex-wrap gap-2">
          {item.options?.map((o, i) => (
            <button key={o} type="button" onClick={() => respond(item.id, o)} className={cn('rounded-sm border px-3 py-1.5 text-[12px]', i === 0 ? 'border-ug/60 bg-ug/15 text-ink hover:bg-ug/25' : 'border-line-2 text-muted-foreground hover:text-ink')}>
              {o}
            </button>
          ))}
          <span className="self-center text-[10.5px] text-faint">the demo picks the first option after a few seconds</span>
        </div>
      )}
      {item.kind === 'task' && <LabForm item={item} />}
      {item.status === 'done' && item.answer && item.kind !== 'fyi' && (
        <div className="flex items-center gap-2 rounded-sm border-l-2 border-ok bg-surface-2 px-3 py-2 text-[12px]">
          <Check size={13} className="text-ok" />
          <span className="text-ink">{item.answer}</span>
        </div>
      )}
    </div>
  )
}

/** The technician's result form: one burn length per sample. Fills from the chamber job as it runs. */
function LabForm({ item }: { item: InboxItem }) {
  const job = useMission((s) => s.model.jobs.find((j) => j.id === 'j-chamber')) as Job | undefined
  const respond = useMission((s) => s.respond)
  const mode = useMission((s) => s.mode)
  const p = item.status === 'done' ? 1 : (job?.progress ?? 0)
  const measured = LAB_BURN.map((b, i) => (p >= (i + 1) / LAB_BURN.length ? b * 30 : undefined))
  const [own, setOwn] = useState<string[]>(LAB_BURN.map(() => ''))
  const vals = measured.map((m, i) => (mode === 'live' ? own[i] : m === undefined ? '' : m.toFixed(1)))
  const burned = vals.filter((v) => Number(v) > 15).length
  const filled = vals.filter((v) => v !== '').length
  return (
    <div className="space-y-3 rounded-sm border border-line bg-surface-2 p-3">
      <div className="label">result form · NASA-STD-6001 Test 1 · burn length per 30 cm sample</div>
      <div className="grid grid-cols-5 gap-2">
        {vals.map((v, i) => (
          <label key={i} className="text-[10.5px] text-faint">
            sample {i + 1}
            <input
              value={v}
              readOnly={mode !== 'live' || item.status === 'done'}
              onChange={(e) => setOwn((o) => o.map((x, k) => (k === i ? e.target.value : x)))}
              placeholder="cm"
              className={cn('mt-0.5 w-full rounded-sm border bg-background px-2 py-1 text-[13px] tnum outline-none', Number(v) > 15 ? 'border-bad/60 text-bad' : v ? 'border-ok/50 text-ok' : 'border-line-2 text-ink')}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[11.5px]">
        <span className="text-muted-foreground">
          {filled}/5 measured · <span className={burned >= 1 ? 'text-bad' : 'text-ok'}>{burned} burned past 15 cm</span> (pass needs all 5 under 15 cm)
        </span>
        {item.status === 'open' &&
          (mode === 'live' ? (
            <button type="button" disabled={filled < 5} onClick={() => respond(item.id, `${burned} of 5 burned past 15 cm: ${vals.join(', ')} cm`)} className="ml-auto rounded-sm border border-ug/60 bg-ug/15 px-3 py-1 text-ink disabled:opacity-40">
              Submit result
            </button>
          ) : (
            <span className="ml-auto text-faint">demo: the technician submits when the chamber run ends</span>
          ))}
      </div>
      {item.status === 'done' && <div className="text-[11px] text-muted-foreground">Submitted. WSTF shares this summary only; raw logs and the procedure stay at WSTF.</div>}
    </div>
  )
}

