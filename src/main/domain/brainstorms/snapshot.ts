import { gunzipSync, gzipSync } from 'node:zlib'
import { z } from 'zod'
import { ViewStateSchema, type ViewState } from '@shared/brainstorms/viewState'
import { AppError } from '../errors'

/**
 * Instantané d'un canevas (spec 024 R3) : les lignes des nœuds, des blocs et des liens d'un brainstorm, et son état de
 * vue, en JSON compressé (gzip). Relu par Zod au retour ; bornes : 20 Mo compressé, 100 Mo une fois décompressé.
 */

export const SNAPSHOT_LIMITS = { compressed: 20 * 1024 * 1024, raw: 100 * 1024 * 1024 } as const

type Row = Readonly<Record<string, unknown>> & { readonly id: string }

const RowSchema = z.looseObject({ id: z.string().min(1).max(200) })

const SnapshotSchema = z.strictObject({
  version: z.literal(1),
  neurons: z.array(RowSchema),
  blocks: z.array(RowSchema),
  links: z.array(RowSchema),
  view: ViewStateSchema.nullable()
})

export interface CanvasSnapshot {
  readonly version: 1
  readonly neurons: readonly Row[]
  readonly blocks: readonly Row[]
  readonly links: readonly Row[]
  readonly view: ViewState | null
}

export function encodeSnapshot(snapshot: CanvasSnapshot): Buffer {
  const packed = gzipSync(Buffer.from(JSON.stringify(snapshot), 'utf8'))
  if (packed.length > SNAPSHOT_LIMITS.compressed) {
    throw new AppError('TOO_LARGE', 'Ce canevas est trop volumineux pour un point de sauvegarde (20 Mo au plus).')
  }
  return packed
}

export function decodeSnapshot(packed: Buffer): CanvasSnapshot {
  let json: unknown
  try {
    json = JSON.parse(gunzipSync(packed, { maxOutputLength: SNAPSHOT_LIMITS.raw }).toString('utf8'))
  } catch {
    throw new AppError('CORRUPT', 'Ce point de sauvegarde est illisible.')
  }
  const parsed = SnapshotSchema.safeParse(json)
  if (!parsed.success) throw new AppError('CORRUPT', 'Ce point de sauvegarde est illisible.')
  return parsed.data as CanvasSnapshot
}

/** Ce qui existe maintenant mais pas dans l'instantané : à retirer de la carte (archivé, jamais effacé). */
export function idsToRetire(current: readonly string[], snapshot: readonly Row[]): string[] {
  const kept = new Set(snapshot.map((row) => row.id))
  return current.filter((id) => !kept.has(id))
}
