// The materials matrix: every item on the bill of materials judged at the target atmosphere and gravity,
// next to its Earth-gravity screening result, plus the test requests sent to the lab.
import { FlaskConical } from 'lucide-react'
import { AgentTag, CiteChip, Section, StatusPill } from '@/components/bits'
import { MATERIALS } from '@/sims/models'
import { PACKAGES } from '@/demo/packages'
import { useMission } from '@/live/store'
import { cn } from '@/lib/utils'

const pct = (x: number) => `${(x * 100).toFixed(1)} %`

export function MaterialsView() {
  const scenario = useMission((s) => s.scenario)
  const matrix = useMission((s) => s.model.matrix)
  const tests = useMission((s) => s.model.tests)
  const setParams = useMission((s) => s.setParams)
  const setSimTab = useMission((s) => s.setSimTab)
  const setTab = useMission((s) => s.setTab)
  const pkg = PACKAGES[scenario]
  const assessed = new Map(matrix.map((r) => [r.id, r]))
  const count = (st: string) => matrix.filter((r) => r.status === st).length

  const openSim = (material: string) => {
    setParams({ material, o2: pkg.atmosphere.o2, psi: pkg.atmosphere.psi, g: pkg.gravity.g, flow: pkg.ventFlow })
    setSimTab('spread')
    setTab('sim')
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Materials matrix</div>
            <h2 className="mt-1 text-lg font-semibold">Will each material burn in this cabin?</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
              Target: {pkg.atmosphere.label}, {pkg.gravity.label}, {pkg.ventFlow} cm/s ventilation. Compared with the Earth-gravity screening test (NASA-STD-6001 Test 1 at 21 % O₂ / 14.7 psia).
            </p>
          </div>
          {matrix.length > 0 && (
            <div className="flex gap-2">
              <Count n={count('pass')} label="pass" color="var(--ok)" />
              <Count n={count('retest')} label="need retest" color="var(--warn)" />
              <Count n={count('fail')} label="fail" color="var(--bad)" />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11.5px] text-muted-foreground">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-2 font-medium">Material</th>
                <th className="px-2 font-medium">Where · how much</th>
                <th className="px-2 font-medium">Test 1 on Earth</th>
                <th className="px-2 text-right font-medium">Burns above O₂</th>
                <th className="px-2 font-medium">In this cabin</th>
                <th className="px-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pkg.bom.map((b) => {
                const r = assessed.get(b.id)
                return (
                  <tr key={b.id} className={cn('border-b border-line align-top last:border-0', !r && 'text-muted-foreground')}>
                    <td className="px-3 py-2 font-medium text-ink">{b.item}</td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => openSim(b.material)} className="text-left hover:text-primary hover:underline" title="Open in the flame-spread simulation">
                        {MATERIALS[b.material].label}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {b.location} · {b.qty}
                    </td>
                    <td className="px-2 py-2">{r ? <StatusPill status={r.test1} /> : <span className="text-faint">—</span>}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2 text-right">{r ? <span className={r.limitO2 < r.targetO2 ? 'text-bad' : ''}>{pct(r.limitO2)}</span> : '—'}</td>
                    <td className="px-2 py-2">{r ? <StatusPill status={r.status} /> : <span className="text-[11.5px] text-faint">not assessed yet</span>}</td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{r?.action ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {matrix.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            Evidence:
            {(matrix[0].cites ?? []).map((c) => (
              <CiteChip key={c.id} id={c.id} />
            ))}
            <span className="ml-1">· assessed by</span> <AgentTag handle="prevent" />
          </div>
        )}

        <Section title="Test requests" right={<span className="text-[11.5px] text-muted-foreground">sent to the test lab over the network</span>}>
          {tests.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-[12.5px] text-muted-foreground">
              <FlaskConical size={15} className="text-faint" /> None yet. When a result is too close to call, the Materials agent asks the lab and files a request here.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {tests.map((t) => (
                <div key={t.id} className="grid gap-1 px-3 py-2.5 text-[12.5px] md:grid-cols-[70px_1fr_auto]">
                  <span className="mono text-muted-foreground">{t.id}</span>
                  <div>
                    <div className="font-medium">
                      {t.material} · {t.atmosphere}
                    </div>
                    <div className="text-muted-foreground">
                      {t.test} at {t.lab}. {t.reason}.
                    </div>
                  </div>
                  <span
                    className={cn('h-fit rounded-full px-2 py-px text-[11px] font-medium', t.status === 'scheduled' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn')}
                  >
                    {t.status}
                    {t.eta ? ` · ${t.eta}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <p className="text-[11.5px] leading-relaxed text-faint">
          “Burns above” is the predicted limiting oxygen at the cabin’s pressure, gravity and airflow, from a simplified model tuned to PSI trends (BASS-II, Saffire, BRE). Retest = within model
          uncertainty, only a test can decide. Fails = predicted to burn here: replace the material or prove the design stops spread.
        </p>
      </div>
    </div>
  )
}

function Count({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-1.5 text-center">
      <div className="tnum text-lg font-semibold" style={{ color }}>
        {n}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
