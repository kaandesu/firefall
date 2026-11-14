// Small SVG line charts for FDS time series, in the report's style.
export type Series = { label: string; t: number[]; y: number[]; color: string; width?: number }
export type Marker = { y?: number; x?: number; label: string; color: string }

export function TimeChart({ series, markers = [], h = 120, yLabel, time, yMax: yMaxIn, yMin = 0 }: { series: Series[]; markers?: Marker[]; h?: number; yLabel: string; time?: number; yMax?: number; yMin?: number }) {
  const W = 600
  const tMax = Math.max(1, ...series.map((s) => s.t.at(-1) ?? 0))
  const yMax = yMaxIn ?? Math.max(...series.flatMap((s) => s.y), ...markers.map((m) => m.y ?? 0), 1e-9) * 1.1
  const X = (t: number) => (t / tMax) * W
  const Y = (v: number) => h - ((v - yMin) / (yMax - yMin || 1)) * h
  return (
    <svg viewBox={`0 0 ${W} ${h + 16}`} className="w-full">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={h * f} y2={h * f} stroke="#10161e" strokeWidth={0.8} />
      ))}
      {markers.map((m, i) =>
        m.y !== undefined ? (
          <g key={i}>
            <line x1={0} x2={W} y1={Y(m.y)} y2={Y(m.y)} stroke={m.color} strokeDasharray="4 3" strokeWidth={0.8} />
            <text x={4} y={Y(m.y) - 3} fill={m.color} fontSize={9}>
              {m.label}
            </text>
          </g>
        ) : (
          <g key={i}>
            <line x1={X(m.x!)} x2={X(m.x!)} y1={0} y2={h} stroke={m.color} strokeDasharray="3 3" strokeWidth={0.8} />
            <text x={X(m.x!) + 3} y={10 + 10 * (i % 3)} fill={m.color} fontSize={9}>
              {m.label}
            </text>
          </g>
        ),
      )}
      {series.map((s) => (
        <polyline key={s.label} points={s.t.map((t, i) => `${X(t).toFixed(1)},${Y(s.y[i]).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.5} />
      ))}
      {time !== undefined && <line x1={X(time)} x2={X(time)} y1={0} y2={h} stroke="#e6edf3" strokeWidth={0.6} opacity={0.5} />}
      <text x={0} y={h + 12} fill="#4a5665" fontSize={9}>
        0 s
      </text>
      <text x={W} y={h + 12} fill="#4a5665" fontSize={9} textAnchor="end">
        {tMax.toFixed(0)} s · {yLabel}
      </text>
      <g transform={`translate(${W - 4}, 12)`}>
        {series.map((s, i) => (
          <text key={s.label} x={0} y={i * 11} fill={s.color} fontSize={9} textAnchor="end">
            {s.label}
          </text>
        ))}
      </g>
    </svg>
  )
}
