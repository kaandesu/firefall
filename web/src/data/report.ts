// Search a long report page by page (plain term scoring, no index). Used by the Library and by the tools server.
export type ReportPage = { page: number; text: string }
export type Report = { title: string; pages: ReportPage[] }
export type Passage = { page: number; text: string }

/** The pages that best match the words of a question, each cut to a passage around its first hit. */
export function searchPages(pages: ReportPage[], query: string, n = 3, span = 1200): Passage[] {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9.%-]{3,}/g) ?? [])]
  if (!terms.length) return []
  return pages
    // Contents pages and reference lists match everything and say nothing.
    .filter((pg) => (pg.text.match(/\.{5,}/g)?.length ?? 0) < 4 && (pg.text.match(/\bpp?\. ?\d+|\bvol\. ?\d+/g)?.length ?? 0) < 5)
    .map((pg) => {
      const low = pg.text.toLowerCase()
      let score = 0
      for (const t of terms) score += Math.min(5, low.split(t).length - 1)
      return { pg, low, score, hit: terms.filter((t) => low.includes(t)).length }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.hit - a.hit || b.score - a.score || a.pg.page - b.pg.page)
    .slice(0, n)
    .map(({ pg, low }) => {
      const at = Math.max(0, Math.min(...terms.map((t) => low.indexOf(t)).filter((i) => i >= 0)) - 200)
      return { page: pg.page, text: pg.text.slice(at, at + span).trim() }
    })
}
