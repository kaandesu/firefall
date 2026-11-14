// Runs the detection study off the main thread (the "lab cluster" job). Posts progress, then the result.
import { smokeStudy, type StudyInput } from './smokeStudy'

self.onmessage = (e: MessageEvent<StudyInput>) => {
  const res = smokeStudy(e.data, (done, total) => self.postMessage({ type: 'progress', done, total }))
  const transfer = res.frames.flatMap((f) => f.frames.map((a) => a.buffer))
  self.postMessage({ type: 'done', study: res }, { transfer: transfer as Transferable[] })
}
