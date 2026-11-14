// Fortran unformatted sequential records: [u32 length][payload][u32 length]. FDS writes all binary output this way.
// Ported from fds-viewer (Prof Rino Lovreglio, Massey University, MIT licence): js/slice-reader.js FortranRecordCursor.
export type Rec = { offset: number; length: number }

export class RecordCursor {
  readonly view: DataView
  offset = 0
  constructor(
    readonly buf: ArrayBuffer,
    readonly le: boolean,
  ) {
    this.view = new DataView(buf)
  }
  remaining() {
    return this.buf.byteLength - this.offset
  }
  read(): Rec {
    if (this.offset + 8 > this.buf.byteLength) throw new Error('unexpected end of file in a Fortran record')
    const length = this.view.getUint32(this.offset, this.le)
    const offset = this.offset + 4
    if (length <= 0 || offset + length + 4 > this.buf.byteLength) throw new Error(`invalid Fortran record length at byte ${this.offset}`)
    if (this.view.getUint32(offset + length, this.le) !== length) throw new Error(`Fortran record marker mismatch at byte ${this.offset}`)
    this.offset = offset + length + 4
    return { offset, length }
  }
  str(r: Rec) {
    return new TextDecoder('ascii').decode(new Uint8Array(this.buf, r.offset, r.length)).replace(/\0/g, '').trim()
  }
  real(r: Rec) {
    if (r.length === 4) return this.view.getFloat32(r.offset, this.le)
    if (r.length === 8) return this.view.getFloat64(r.offset, this.le)
    throw new Error(`unexpected real record length ${r.length}`)
  }
  ints(r: Rec, n: number) {
    if (r.length < n * 4) throw new Error(`record too short for ${n} integers`)
    return Array.from({ length: n }, (_, i) => this.view.getInt32(r.offset + i * 4, this.le))
  }
}

/** The first record's length marker is repeated after it; try little then big endian. */
export function detectEndian(buf: ArrayBuffer, ok: (len: number) => boolean): boolean {
  const v = new DataView(buf)
  for (const le of [true, false]) {
    const len = v.getUint32(0, le)
    if (ok(len) && 4 + len + 4 <= buf.byteLength && v.getUint32(4 + len, le) === len) return le
  }
  throw new Error('could not detect the byte order of this FDS file')
}
