// One chart style for every plot: dotted hairline grid, mono tick labels, data in the heat / orb colours.
export const GRID = { stroke: 'var(--line-2)', strokeDasharray: '1 3', strokeWidth: 1 } as const
export const TICK = { fill: 'var(--faint)', fontSize: 8, fontFamily: 'var(--font-mono)' } as const
/** A threshold you must not cross (burst pressure, tested limit): pink, dashed. */
export const LIMIT = { stroke: 'var(--pink)', strokeDasharray: '4 3', strokeWidth: 0.9 } as const
/** A time you need (hatch open, alarm deadline): ink, dashed. */
export const DEADLINE = { stroke: 'var(--muted)', strokeDasharray: '2 3', strokeWidth: 0.9 } as const
/** Scenario colours: the as-built case runs hot, the proposal is your move, what-ifs are knob colours. */
export const RUN_COLOR: Record<string, string> = { 'as-built': 'var(--pink)', proposal: 'var(--you)', '60-40': 'var(--orange)', ug: 'var(--steel)', base: 'var(--tan)' }
