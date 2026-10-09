import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { BlockView } from '@shared/ipc/canvas'
import type { CanvasScope } from './canvasScope'
import type { AppDatabase } from '../client'
import { canvasBlocks } from '../schemaNeurons'
import { writeChanges, type ChangeEntry } from './changeLog'

const COLUMNS = {
  id: canvasBlocks.id,
  kind: canvasBlocks.kind,
  x: canvasBlocks.x,
  y: canvasBlocks.y,
  width: canvasBlocks.width,
  height: canvasBlocks.height,
  text: canvasBlocks.text,
  versionId: canvasBlocks.currentVersionId,
  sourceBlockId: canvasBlocks.sourceBlockId,
  title: canvasBlocks.title,
  parentBlockId: canvasBlocks.parentBlockId,
  frameId: canvasBlocks.frameId,
  origin: canvasBlocks.origin
}

/** Nouveau bloc : les champs propres aux cadres résultat (005) et aux primitives du pont (007) sont facultatifs. */
export type NewBlock = Omit<
  BlockView,
  'id' | 'versionId' | 'sourceBlockId' | 'title' | 'parentBlockId' | 'frameId' | 'origin'
> &
  Partial<Pick<BlockView, 'sourceBlockId' | 'title' | 'parentBlockId' | 'frameId' | 'origin'>>

export interface BlockPatch {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Texte d'une note (absent : inchangé). */
  readonly text?: string
}

/** Blocs de l'écran Idées : vides (spec 003 FR-026), notes et widgets (spec 004), cadres résultat (spec 005). */
export class BlockRepository {
  constructor(
    private readonly db: AppDatabase,
    /** Brainstorm actif (spec 024) : seuls ses blocs sont sur la carte, un bloc nouveau lui appartient. */
    private readonly scope?: CanvasScope
  ) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  /** Blocs visibles (les blocs supprimés restent en base pour l'annulation). */
  list(): BlockView[] {
    const active = this.scope?.active()
    if (active === null) return []
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .where(
        and(isNull(canvasBlocks.deletedAt), active === undefined ? undefined : eq(canvasBlocks.brainstormId, active))
      )
      .orderBy(asc(sql`${canvasBlocks}.rowid`))
      .all()
  }

  get(id: string): BlockView | undefined {
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
      .get()
  }

  insert(block: NewBlock): BlockView {
    const created = {
      id: randomUUID(),
      ...block,
      sourceBlockId: block.sourceBlockId ?? null,
      title: block.title ?? null,
      parentBlockId: block.parentBlockId ?? null,
      frameId: block.frameId ?? null,
      origin: block.origin ?? 'user'
    }
    this.db
      .insert(canvasBlocks)
      .values({ ...created, brainstormId: this.scope?.forNew() ?? null })
      .run()
    return { ...created, versionId: null }
  }

  /** Cadre résultat visible d'un widget (le plus ancien s'il y en a plusieurs après une annulation). */
  resultBlockOf(widgetBlockId: string): BlockView | undefined {
    return this.companionOf(widgetBlockId, 'result')
  }

  /** Panneau de réglages visible d'un widget (spec 026 D7). */
  settingsBlockOf(widgetBlockId: string): BlockView | undefined {
    return this.companionOf(widgetBlockId, 'settings')
  }

  private companionOf(widgetBlockId: string, kind: 'result' | 'settings'): BlockView | undefined {
    return this.db
      .select(COLUMNS)
      .from(canvasBlocks)
      .where(
        and(eq(canvasBlocks.kind, kind), eq(canvasBlocks.sourceBlockId, widgetBlockId), isNull(canvasBlocks.deletedAt))
      )
      .orderBy(asc(sql`${canvasBlocks}.rowid`))
      .get()
  }

  update(patch: BlockPatch): boolean {
    const { id, text, ...geometry } = patch
    return (
      this.db
        .update(canvasBlocks)
        .set({ ...geometry, ...(text === undefined ? {} : { text }) })
        .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
        .run().changes > 0
    )
  }

  /** Suppression annulable : le bloc disparaît de la carte, ses versions et sa conversation sont gardées. */
  softDelete(id: string): boolean {
    return (
      this.db
        .update(canvasBlocks)
        .set({ deletedAt: new Date().toISOString() })
        .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
        .run().changes > 0
    )
  }

  /** Titre et texte d'une note ou d'un cadre (spec 007, `noeud_modifier`). */
  updateText(id: string, patch: { readonly title?: string | null; readonly text?: string | null }): boolean {
    return (
      this.db
        .update(canvasBlocks)
        .set({
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.text === undefined ? {} : { text: patch.text })
        })
        .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt)))
        .run().changes > 0
    )
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude' = 'user'): void {
    writeChanges(this.db, batchId, entries, actor)
  }
}
