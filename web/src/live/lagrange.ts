// Live source: the same snapshot → backfill → SSE sequence the Lagrange web app uses
// (org/lagrange/web/src/store/live.ts), read through our server's proxy (/api/lagrange → Lagrange),
// which holds the Bearer key and avoids CORS.
import { HUMAN } from '@/demo/crew'
import type { Entry } from './types'

export class LagrangeSource {
  private es: EventSource | null = null
  private seq = 0

  constructor(
    private base: string,
    private emit: (e: Entry) => void,
    private onError: (msg: string) => void,
  ) {}

  async open() {
    try {
      const res = await fetch(`${this.base}/api/activity?limit=500`)
      if (!res.ok) throw new Error(`activity ${res.status}`)
      const page = (await res.json()) as { entries?: Entry[] } | Entry[]
      const entries = Array.isArray(page) ? page : (page.entries ?? [])
      for (const e of entries) this.take(e)
    } catch (err) {
      this.onError(`Backfill failed: ${(err as Error).message}`)
    }
    this.es = new EventSource(`${this.base}/api/events?since=${this.seq}`)
    this.es.addEventListener('activity', (ev) => this.take(JSON.parse((ev as MessageEvent).data) as Entry))
    this.es.onerror = () => this.onError('Event stream disconnected — retrying')
  }

  private take(e: Entry) {
    if (e.seq <= this.seq) return
    this.seq = e.seq
    this.emit(e)
  }

  /** Answer an INPUT_REQUIRED task addressed to the human. */
  async answer(taskId: string, text: string) {
    await fetch(`${this.base}/api/tasks/${encodeURIComponent(taskId)}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from: HUMAN }),
    })
  }

  close() {
    this.es?.close()
    this.es = null
  }
}
