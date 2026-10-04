import { MAX_FRAME_BYTES } from '@shared/mcp/protocol'

/** Découpe un flux en lignes ; au-delà de `MAX_FRAME_BYTES` sans saut de ligne, signale un dépassement. */
export class LineSplitter {
  private buffer = ''

  constructor(private readonly maxBytes: number = MAX_FRAME_BYTES) {}

  /** Lignes complètes reçues ; `overflow` si la ligne en cours dépasse la borne. */
  push(chunk: string): { readonly lines: string[]; readonly overflow: boolean } {
    this.buffer += chunk
    const parts = this.buffer.split('\n')
    this.buffer = parts.pop() ?? ''
    const lines = parts.map((line) => line.replace(/\r$/, '')).filter((line) => line.length > 0)
    const overflow =
      Buffer.byteLength(this.buffer, 'utf8') > this.maxBytes ||
      lines.some((line) => Buffer.byteLength(line, 'utf8') > this.maxBytes)
    return { lines, overflow }
  }
}
