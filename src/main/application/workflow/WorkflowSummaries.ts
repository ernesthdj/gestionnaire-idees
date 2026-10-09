import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { FileSummaryOut } from '@shared/ai/schemas'
import type {
  WorkflowAnatomyView,
  WorkflowFileSummaryView,
  WorkflowFileView,
  WorkflowSavedSummaryView
} from '@shared/ipc/workflow'
import type { AIError, Result } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import type { FileSummaryRepository } from '../../infrastructure/db/repositories/FileSummaryRepository'
import type { AIResult } from '../ai/AIGateway'
import type { FileSummaryInput } from '../ai/FileSummaryTask'

export interface WorkflowSummariesDeps {
  /** Fichier lisible depuis une carte Workflow (mêmes gardes que `workflow:file`). */
  readonly file: (genesisId: string, path: string) => WorkflowFileView
  readonly anatomy: (genesisId: string, path: string) => Promise<WorkflowAnatomyView | null>
  /** Projet repris « Local uniquement » : rien n'est envoyé à Claude (constitution IV). */
  readonly localOnly: (genesisId: string) => boolean
  readonly run: (
    input: FileSummaryInput,
    options: { readonly localOnly: boolean }
  ) => Promise<Result<AIResult<FileSummaryOut>, AIError>>
  /** Explications enregistrées (D18). */
  readonly store: Pick<FileSummaryRepository, 'get' | 'put'>
}

const Text = (max: number) => z.string().max(max)
/** Explication relue en base : revalidée (une ligne abîmée ou d'un ancien format est ignorée, jamais affichée). */
const StoredView = z.strictObject({
  role: Text(400),
  receives: Text(400),
  produces: Text(400),
  parts: z
    .array(
      z.strictObject({
        name: Text(200),
        why: Text(300),
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive()
      })
    )
    .max(6),
  flow: z.array(z.strictObject({ from: Text(200), to: Text(200), label: Text(40) })).max(10),
  engine: z.enum(['claude', 'ollama']),
  model: Text(200)
})

const fingerprint = (file: WorkflowFileView): string => createHash('sha256').update(file.lines.join('\n')).digest('hex')

/**
 * « Que fait ce fichier ? » (spec 023 D15, D18) : à la demande de mentalyas, la tâche `file_summary` explique un fichier
 * cité (rôle, ce qu'il reçoit, ce qu'il produit, ses morceaux importants, son petit schéma). Un morceau dont le nom
 * n'est pas un bloc du fichier est écarté (Claude ne peut pas inventer un bloc). L'explication est **enregistrée** avec
 * l'empreinte du contenu : elle revient telle quelle tant que le code ne change pas, même après un redémarrage ; deux
 * demandes simultanées partagent la même tâche.
 */
export class WorkflowSummaries {
  private readonly pending = new Map<string, Promise<WorkflowFileSummaryView>>()

  constructor(private readonly deps: WorkflowSummariesDeps) {}

  /** Explication enregistrée, sans appel à l'IA : `outdated` si une explication existe mais pour un autre contenu. */
  saved(genesisId: string, path: string): WorkflowSavedSummaryView {
    const file = this.deps.file(genesisId, path)
    const stored = this.deps.store.get(genesisId, file.path)
    if (stored === undefined) return { summary: null, outdated: false }
    if (stored.contentHash !== fingerprint(file)) return { summary: null, outdated: true }
    return { summary: this.parse(stored.summaryJson), outdated: false }
  }

  /** Explication du contenu actuel : celle enregistrée si elle est à jour, sinon rédigée puis enregistrée. */
  async summary(genesisId: string, path: string): Promise<WorkflowFileSummaryView> {
    const file = this.deps.file(genesisId, path)
    const hash = fingerprint(file)
    const stored = this.deps.store.get(genesisId, file.path)
    const known = stored?.contentHash === hash ? this.parse(stored.summaryJson) : null
    if (known !== null) return known
    const key = `${genesisId}\n${file.path}\n${hash}`
    const running = this.pending.get(key)
    if (running !== undefined) return running
    const task = this.explain(genesisId, file).then((summary) => {
      this.deps.store.put(genesisId, file.path, { contentHash: hash, summaryJson: JSON.stringify(summary) })
      return summary
    })
    this.pending.set(key, task)
    // Réussie ou non, la tâche quitte la liste des demandes en cours (une panne n'est pas enregistrée).
    void task.then(
      () => this.pending.delete(key),
      () => this.pending.delete(key)
    )
    return task
  }

  private parse(json: string): WorkflowFileSummaryView | null {
    try {
      const parsed = StoredView.safeParse(JSON.parse(json))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }

  private async explain(genesisId: string, file: WorkflowFileView): Promise<WorkflowFileSummaryView> {
    const anatomy = await this.deps.anatomy(genesisId, file.path)
    const blocks = anatomy?.blocks ?? []
    const localOnly = this.deps.localOnly(genesisId)
    const result = await this.deps.run({ path: file.path, lang: file.lang, lines: file.lines, blocks }, { localOnly })
    if (!result.ok) {
      throw new AppError(
        result.error.code === 'AI_UNAVAILABLE' ? 'AI_UNAVAILABLE' : 'AI_FAILED',
        localOnly && result.error.code === 'AI_UNAVAILABLE'
          ? 'Projet « Local uniquement » : l’IA locale est arrêtée, et ce fichier n’est jamais envoyé à Claude.'
          : 'L’explication n’a pas pu être rédigée. Réessaie dans un instant.'
      )
    }
    const { data, engine, model } = result.value
    const byName = new Map(blocks.filter((block) => block.kind !== 'namespace').map((block) => [block.name, block]))
    const seen = new Set<string>()
    const parts = data.morceaux.flatMap((part) => {
      const block = byName.get(part.nom)
      if (block === undefined || seen.has(part.nom)) return []
      seen.add(part.nom)
      return [{ name: block.name, why: part.utilite, startLine: block.startLine, endLine: block.endLine }]
    })
    // Flèches du petit schéma : seulement entre l'entrée, des morceaux gardés et la sortie, sans doublon.
    const kept = new Set(parts.map((part) => part.name))
    const end = (name: string, side: 'from' | 'to'): string | null => {
      if (kept.has(name)) return name
      if (side === 'from' && name === 'entree') return 'in'
      if (side === 'to' && name === 'sortie') return 'out'
      return null
    }
    const arrows = new Set<string>()
    const flow = data.liens.flatMap((link) => {
      const from = end(link.de, 'from')
      const to = end(link.vers, 'to')
      if (from === null || to === null || from === to || arrows.has(`${from}>${to}`)) return []
      arrows.add(`${from}>${to}`)
      return [{ from, to, label: link.verbe }]
    })
    return { role: data.role, receives: data.recoit, produces: data.produit, parts, flow, engine, model }
  }
}
