// 4 VERDICT: one card. Headline, three numbers, what the tool would not have caught, exports.
import { ArrowLeft, Download } from 'lucide-react'
import { useMemo } from 'react'
import { CiteChip } from '@/components/bits'
import { fireRuns } from '@/demo/apollo1'
import { useMission } from '@/live/store'
import type { MatrixRow } from '@/live/types'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const q = (s: string | number) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s))

export function matrixCsv(rows: MatrixRow[]) {
  const head = ['id', 'part', 'material', 'zone', 'qty', 'test1_21pct', 'limit_o2_pct', 'cabin_o2_pct', 'status', 'action', 'citations']
  return [head.join(','), ...rows.map((r) => [r.id, r.item, r.material, r.zone ?? '', r.qty, r.test1, (r.limitO2 * 100).toFixed(1), (r.targetO2 * 100).toFixed(1), r.status, r.action, (r.cites ?? []).map((c) => c.id).join(' ')].map(q).join(','))].join('\n')
}

export function VerdictScreen() {
  const caseFile = useMission((s) => s.model.caseFile)
  const dossier = useMission((s) => s.model.dossier)
  const matrix = useMission((s) => s.model.matrix)
  const pkg = useMission((s) => s.pkg)
  const cabin = useMission((s) => s.cabin)
  const showVerdict = useMission((s) => s.showVerdict)
  const reset = useMission((s) => s.reset)
  const runs = useMemo(() => (pkg && cabin ? fireRuns(pkg, cabin) : []), [pkg, cabin])
  const v = caseFile?.verdict
  const asBuilt = runs[0]
  const burn = matrix.filter((r) => r.status !== 'pass').length
  const summary = dossier.find((d) => d.id === 'summary')

  const report = () => {
    const lines = [
      `# Fire hazard review · ${pkg?.vehicle}`,
      '',
      `${pkg?.atmosphere.label} · ${pkg?.gravity.label} · ${pkg?.volume} · crew ${pkg?.crew}`,
      '',
      `## Verdict`,
      v?.headline ?? '',
      '',
      ...(v?.would ?? []).map((w) => `- ${w}`),
      '',
      ...(summary?.body ?? []),
      '',
      '## Materials matrix',
      '| part | material | zone | status | limit O₂ | action |',
      '|---|---|---|---|---|---|',
      ...matrix.map((r) => `| ${r.item} | ${r.material} | ${r.zone ?? ''} | ${r.status} | ${(r.limitO2 * 100).toFixed(0)} % | ${r.action} |`),
      '',
      v?.bridge ? `## What-ifs\n${v.bridge}\n` : '',
      '## Limits',
      'Spread and pressure are illustrative lumped models, checked against the Apollo 204 Review Board timeline. Egress (the hatch) is outside what combustion data can judge.',
      '',
      `Sources: ${[...new Set([...(summary?.cites ?? []), ...matrix.flatMap((r) => r.cites ?? [])].map((c) => c.id))].join(', ') || 'none'}`,
    ]
    download('hazard-report.md', lines.join('\n'), 'text/markdown')
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="pane w-full max-w-[860px] gap-5 p-6 pt-7">
        <header className="pane-head text-[11px]">
          <span className="tracking-[0.14em] text-ink">VERDICT · {pkg?.vehicle}</span>
          <span className="ml-auto text-ok">review complete</span>
        </header>
        <div>
          <div className="label text-bad">fails at design review</div>
          <h2 className="sans mt-1 text-[24px] font-semibold leading-tight">{v?.headline ?? 'The review is still running.'}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Big n={matrix.length ? `${burn}/${matrix.length}` : '—'} label={`materials burn at ${pkg?.atmosphere.label ?? ''}`} color="var(--bad)" />
          <Big n={asBuilt?.rupture !== undefined ? `T+${asBuilt.rupture.toFixed(0)} s` : 'none'} label="hull rupture after ignition" color="var(--flame)" />
          <Big n={`${pkg?.hatch?.openTime ?? '—'} s`} label="to open the hatch" color="var(--warn)" />
        </div>
        <div className="rounded-sm border border-warn/40 bg-warn/5 p-3">
          <div className="label text-warn">what this review would not have caught</div>
          <div className="sans mt-1 text-[13.5px] leading-snug">{v?.would[2] ?? 'The hatch: egress design is outside combustion data.'}</div>
        </div>
        {v?.bridge && (
          <div className="text-[12px] text-muted-foreground">
            <span className="label mr-2">what-ifs</span>
            {v.bridge}
          </div>
        )}
        {summary?.cites && summary.cites.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label mr-1">sources</span>
            {summary.cites.map((c) => (
              <CiteChip key={c.id} id={c.id} note={c.note} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-line pt-4 text-[12px]">
          <button type="button" onClick={() => download('materials-matrix.csv', matrixCsv(matrix), 'text/csv')} className="flex items-center gap-1.5 rounded-sm border border-line-2 px-3 py-1.5 hover:border-ug">
            <Download size={12} /> matrix.csv
          </button>
          <button type="button" onClick={report} className="flex items-center gap-1.5 rounded-sm border border-line-2 px-3 py-1.5 hover:border-ug">
            <Download size={12} /> hazard-report.md
          </button>
          <button type="button" onClick={() => showVerdict(false)} className="ml-auto flex items-center gap-1.5 text-muted-foreground hover:text-ink">
            <ArrowLeft size={12} /> back to the run
          </button>
          <button type="button" onClick={reset} className="text-faint hover:text-ink">
            new review
          </button>
        </div>
      </div>
    </div>
  )
}

function Big({ n, label, color }: { n: string; label: string; color: string }) {
  return (
    <div className="rounded-sm border border-line-2 bg-surface-2 p-3">
      <div className="text-[28px] leading-none tnum" style={{ color }}>
        {n}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
