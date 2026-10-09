import type { SavePointRestoredView, SavePointView } from '@shared/ipc/brainstorms'
import { parseViewState, type ViewState } from '@shared/brainstorms/viewState'
import { AppError } from '../../domain/errors'
import { decodeSnapshot, encodeSnapshot, idsToRetire } from '../../domain/brainstorms/snapshot'
import type {
  CanvasRows,
  SavePointRepository,
  SavePointRow
} from '../../infrastructure/db/repositories/SavePointRepository'

export interface SavePointDeps {
  readonly repository: SavePointRepository
  /** État de vue enregistré du brainstorm (gardé dans l'instantané) ; `null` s'il n'existe plus. */
  readonly brainstorm: (id: string) => { readonly viewStateJson: string | null } | undefined
  readonly saveViewState: (id: string, json: string) => void
  readonly now?: () => Date
}

/** 50 points visibles par brainstorm ; les points cachés « avant retour » gardés : les 5 derniers. */
export const SAVE_POINT_LIMITS = { visible: 50, hidden: 5, name: 80 } as const

const view = (row: SavePointRow): SavePointView => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
  sizeBytes: row.sizeBytes
})

/**
 * Points de sauvegarde (spec 024 US2, R3) : un état nommé du canevas d'un brainstorm (nœuds, blocs, liens, vue).
 * Revenir à un point pose d'abord un point caché « avant retour à … », puis remplace le canevas en une transaction ;
 * annuler le retour revient à ce point caché. Les conversations et les fichiers du projet ne sont jamais touchés.
 */
export class SavePointService {
  constructor(private readonly deps: SavePointDeps) {}

  list(brainstormId: string): SavePointView[] {
    return this.deps.repository.list(brainstormId).map(view)
  }

  create(brainstormId: string, name: string): SavePointView {
    const clean = name.trim().slice(0, SAVE_POINT_LIMITS.name)
    if (clean === '') throw new AppError('VALIDATION', 'Donne un nom au point de sauvegarde.')
    if (this.deps.repository.list(brainstormId).length >= SAVE_POINT_LIMITS.visible) {
      throw new AppError('LIMIT', `${SAVE_POINT_LIMITS.visible} points au plus : supprime d’abord un ancien point.`)
    }
    return view(this.pose(brainstormId, clean, false))
  }

  rename(id: string, name: string): { readonly ok: true } {
    const clean = name.trim().slice(0, SAVE_POINT_LIMITS.name)
    if (clean === '') throw new AppError('VALIDATION', 'Donne un nom au point de sauvegarde.')
    this.visibleOrThrow(id)
    this.deps.repository.rename(id, clean)
    return { ok: true }
  }

  remove(id: string): { readonly ok: true } {
    this.visibleOrThrow(id)
    this.deps.repository.remove(id)
    return { ok: true }
  }

  /** Revient à un point ; `undoId` : le point caché qui permet d'annuler ce retour. */
  restore(id: string): SavePointRestoredView {
    const point = this.visibleOrThrow(id)
    const { repository } = this.deps
    return repository.transaction(() => {
      const undo = this.pose(point.brainstormId, `avant retour à « ${point.name} »`, true)
      const viewState = this.apply(point)
      for (const old of repository.list(point.brainstormId, true).slice(SAVE_POINT_LIMITS.hidden)) {
        repository.remove(old.id)
      }
      return { undoId: undo.id, viewState }
    })
  }

  /** Annule un retour : le canevas d'avant revient, et le point caché disparaît. */
  undoRestore(undoId: string): { readonly viewState: ViewState | null } {
    const point = this.deps.repository.get(undoId)
    if (point === undefined || !point.hidden) throw new AppError('NOT_FOUND', 'Ce retour ne peut plus être annulé.')
    return this.deps.repository.transaction(() => {
      const viewState = this.apply(point)
      this.deps.repository.remove(undoId)
      return { viewState }
    })
  }

  private pose(brainstormId: string, name: string, hidden: boolean): SavePointRow {
    const brainstorm = this.deps.brainstorm(brainstormId)
    if (brainstorm === undefined) throw new AppError('NOT_FOUND', 'Ce brainstorm n’existe plus.')
    const rows = this.deps.repository.capture(brainstormId)
    const snapshot = encodeSnapshot({ version: 1, ...rows, view: parseViewState(brainstorm.viewStateJson) })
    return this.deps.repository.insert({ brainstormId, name, hidden, snapshot, at: this.now() })
  }

  private apply(point: SavePointRow): ViewState | null {
    const packed = this.deps.repository.snapshot(point.id)
    if (packed === undefined) throw new AppError('NOT_FOUND', 'Ce point de sauvegarde n’existe plus.')
    const snapshot = decodeSnapshot(packed)
    const current = this.deps.repository.capture(point.brainstormId)
    const target = snapshot as unknown as CanvasRows
    const retire: CanvasRows = {
      neurons: pick(current.neurons, idsToRetire(ids(current.neurons), snapshot.neurons)),
      blocks: pick(current.blocks, idsToRetire(ids(current.blocks), snapshot.blocks)),
      links: pick(current.links, idsToRetire(ids(current.links), snapshot.links))
    }
    this.deps.repository.replace(point.brainstormId, target, retire, this.now())
    if (snapshot.view !== null) this.deps.saveViewState(point.brainstormId, JSON.stringify(snapshot.view))
    return snapshot.view
  }

  private visibleOrThrow(id: string): SavePointRow {
    const point = this.deps.repository.get(id)
    if (point === undefined || point.hidden) throw new AppError('NOT_FOUND', 'Ce point de sauvegarde n’existe plus.')
    return point
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}

const ids = (rows: readonly { readonly id: string }[]): string[] => rows.map((row) => row.id)
const pick = <T extends { readonly id: string }>(rows: readonly T[], wanted: readonly string[]): T[] => {
  const set = new Set(wanted)
  return rows.filter((row) => set.has(row.id))
}
