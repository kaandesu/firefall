// Plays a scripted run as if Lagrange were streaming it: stamps seq/at and emits entries on a clock.
// A gated beat (ask_human) holds the clock until the human answers, or answers itself after `auto` seconds.
import { HUMAN } from '@/demo/crew'
import type { Beat } from './script'
import type { Entry } from './types'

export type ReplayStatus = { playing: boolean; t: number; total: number; holding: boolean; finished: boolean }

export class Replay {
  private idx = 0
  private t = 0
  private seq = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private last = 0
  private hold: { beat: Beat; since: number } | null = null
  speed = 1
  readonly total: number

  constructor(
    private beats: Beat[],
    private emit: (e: Entry) => void,
    private onStatus: (s: ReplayStatus) => void,
  ) {
    this.total = beats.length ? beats[beats.length - 1].t : 0
  }

  get playing() {
    return this.timer !== null
  }

  play() {
    if (this.timer) return
    this.last = performance.now()
    this.timer = setInterval(() => this.tick(), 40)
    this.status()
  }

  pause() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.status()
  }

  setSpeed(s: number) {
    this.speed = s
  }

  dispose() {
    this.pause()
  }

  /** The human answered the held question. */
  answer(text: string) {
    if (!this.hold) return
    const e = this.hold.beat.e
    this.hold = null
    this.out({ kind: 'message', taskId: e.taskId, sender: HUMAN, recipient: e.sender, data: { name: 'fc.comm', kind: 'human', text } })
    this.out({ kind: 'task', taskId: e.taskId, parentTaskId: e.parentTaskId, sender: e.sender, recipient: HUMAN, state: 'TASK_STATE_COMPLETED', summary: text })
    this.status()
  }

  private out(e: Beat['e']) {
    this.emit({ ...e, seq: ++this.seq, at: new Date().toISOString() } as Entry)
  }

  private tick() {
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    if (this.hold) {
      const options = (this.hold.beat.e.data?.options as string[]) ?? ['Approve']
      if ((now - this.hold.since) / 1000 >= (this.hold.beat.gate?.auto ?? 9) / Math.max(1, this.speed / 2)) this.answer(`${options[0]} (auto)`)
      return
    }
    this.t = Math.min(this.total, this.t + dt * this.speed)
    while (this.idx < this.beats.length && this.beats[this.idx].t <= this.t) {
      const b = this.beats[this.idx++]
      this.out(b.e)
      if (b.gate) {
        this.hold = { beat: b, since: now }
        this.t = b.t
        break
      }
    }
    if (this.idx >= this.beats.length && !this.hold) this.pause()
    this.status()
  }

  private status() {
    this.onStatus({ playing: this.playing, t: this.t, total: this.total, holding: !!this.hold, finished: this.idx >= this.beats.length && !this.hold })
  }
}
