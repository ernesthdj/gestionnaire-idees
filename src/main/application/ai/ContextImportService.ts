import { z } from 'zod'
import { validateContextBundle, ImportedExample, CONTEXT_FILES, type ContextBundle } from '../../domain/context/bundle'
import { AppError } from '../../domain/errors'
import type { TaskKind } from '../../domain/ai/types'
import type { InboxFolder } from '../../infrastructure/context-inbox/InboxFolder'
import type { ContextRepository, VersionRow } from '../../infrastructure/db/repositories/ContextRepository'
import type { ExampleStore } from './ExampleStore'
import type { AgentContext } from './ports'

export interface TextDiff {
  readonly before: string
  readonly after: string
  readonly changed: boolean
}

export interface ImportDiff {
  readonly files: readonly string[]
  readonly profile: TextDiff
  readonly rules: TextDiff
  readonly examples: { readonly before: number; readonly after: number }
}

export interface PendingImport {
  readonly id: string
  readonly detectedAt: string
  readonly status: 'pending'
  readonly diff: ImportDiff
}

export interface ContextHistory {
  readonly versions: readonly Omit<VersionRow, 'profileMd' | 'rulesMd'>[]
  readonly imports: readonly { id: string; detectedAt: string; status: string; error: string | null }[]
}

const StoredPayload = z.object({
  bundle: z.object({
    files: z.array(z.enum(CONTEXT_FILES)),
    profile: z.string().optional(),
    rules: z.string().optional(),
    examples: z.array(ImportedExample).optional()
  }),
  diff: z.unknown()
})

export interface ContextImportDependencies {
  readonly repository: ContextRepository
  readonly inbox: InboxFolder
  readonly examples: ExampleStore
  readonly now: () => Date
  readonly onNewImport: (importId: string) => void
}

/** Import de contexte depuis Claude Code : validation, aperçu, application, refus, versions et retour arrière. */
export class ContextImportService {
  constructor(private readonly deps: ContextImportDependencies) {}

  /** Crée la version 1 (vide) au premier lancement : point de retour « aucun profil ». */
  ensureSeed(): void {
    const { repository } = this.deps
    if (repository.versions().length > 0) return
    repository.transaction(() => {
      const id = repository.createVersion({
        version: 1,
        profileMd: '',
        rulesMd: '',
        source: 'seed',
        appliedAt: this.deps.now().toISOString(),
        importId: null
      })
      repository.setActive(id)
    })
  }

  /** Examine le dossier d'import ; appelé au démarrage et à chaque écriture de `manifest.json`. */
  scan(): void {
    const manifest = this.deps.inbox.readManifest()
    if (manifest === null) return
    const validated = validateContextBundle(manifest, (file) => this.deps.inbox.readFile(file))
    const detectedAt = this.deps.now().toISOString()
    const id = this.deps.repository.insertImport(
      validated.ok
        ? {
            status: 'pending',
            detectedAt,
            manifestJson: manifest,
            payloadJson: JSON.stringify({ bundle: validated.value, diff: this.diffWith(validated.value) }),
            error: null
          }
        : { status: 'invalid', detectedAt, manifestJson: manifest, payloadJson: null, error: validated.error }
    )
    this.deps.inbox.archive(id)
    if (validated.ok) this.deps.onNewImport(id)
  }

  pending(): PendingImport[] {
    return this.deps.repository.imports().flatMap((row) => {
      if (row.status !== 'pending' || row.payloadJson === null) return []
      const payload = StoredPayload.parse(JSON.parse(row.payloadJson))
      return [{ id: row.id, detectedAt: row.detectedAt, status: 'pending' as const, diff: payload.diff as ImportDiff }]
    })
  }

  apply(importId: string): VersionRow {
    const { repository } = this.deps
    const row = repository.importById(importId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Import introuvable')
    if (row.status !== 'pending' || row.payloadJson === null) {
      throw new AppError('INVALID_STATE', "Cet import n'est plus en attente")
    }
    const { bundle } = StoredPayload.parse(JSON.parse(row.payloadJson))
    const previous = repository.activeVersion()

    const versionId = repository.transaction(() => {
      const id = repository.createVersion({
        version: repository.nextVersionNumber(),
        profileMd: bundle.profile ?? previous?.profileMd ?? '',
        rulesMd: bundle.rules ?? previous?.rulesMd ?? '',
        source: 'import',
        appliedAt: this.deps.now().toISOString(),
        importId
      })
      const carried =
        bundle.examples ??
        (previous === undefined
          ? []
          : repository.importedExamples(previous.id).map((example) => this.toImported(example)))
      for (const example of carried) {
        repository.insertExample({
          polarity: example.polarity,
          taskKind: example.taskKind,
          contentJson: JSON.stringify({ input: example.input, output: example.output, reason: example.reason }),
          source: 'import',
          contextVersionId: id
        })
      }
      repository.setActive(id)
      repository.setImportStatus(importId, 'applied')
      return id
    })
    const created = repository.version(versionId)
    if (created === undefined) throw new AppError('INTERNAL', 'Version introuvable après création')
    return created
  }

  reject(importId: string): void {
    const row = this.deps.repository.importById(importId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Import introuvable')
    if (row.status !== 'pending') throw new AppError('INVALID_STATE', "Cet import n'est plus en attente")
    this.deps.repository.setImportStatus(importId, 'rejected')
  }

  rollback(versionId: string): VersionRow {
    const target = this.deps.repository.version(versionId)
    if (target === undefined) throw new AppError('NOT_FOUND', 'Version introuvable')
    this.deps.repository.transaction(() => this.deps.repository.setActive(versionId))
    return { ...target, isActive: true }
  }

  history(): ContextHistory {
    return {
      versions: this.deps.repository
        .versions()
        .map(({ id, version, source, isActive, appliedAt }) => ({ id, version, source, isActive, appliedAt })),
      imports: this.deps.repository
        .imports()
        .map(({ id, detectedAt, status, error }) => ({ id, detectedAt, status, error }))
    }
  }

  /** Contexte injecté par la passerelle IA pour une tâche donnée (profil, règles, exemples du type). */
  activeContext(kind: TaskKind): AgentContext | undefined {
    const active = this.deps.repository.activeVersion()
    if (active === undefined) return undefined
    return { profile: active.profileMd, rules: active.rulesMd, examples: this.deps.examples.select(kind, active.id) }
  }

  private diffWith(bundle: ContextBundle): ImportDiff {
    const active = this.deps.repository.activeVersion()
    const beforeProfile = active?.profileMd ?? ''
    const beforeRules = active?.rulesMd ?? ''
    const beforeExamples = active === undefined ? 0 : this.deps.repository.importedExamples(active.id).length
    const afterProfile = bundle.profile ?? beforeProfile
    const afterRules = bundle.rules ?? beforeRules
    return {
      files: bundle.files,
      profile: { before: beforeProfile, after: afterProfile, changed: afterProfile !== beforeProfile },
      rules: { before: beforeRules, after: afterRules, changed: afterRules !== beforeRules },
      examples: { before: beforeExamples, after: bundle.examples?.length ?? beforeExamples }
    }
  }

  private toImported(row: {
    polarity: 'positive' | 'negative'
    taskKind: string
    contentJson: string
  }): ImportedExample {
    const content = JSON.parse(row.contentJson) as { input: string; output: unknown; reason?: string }
    return ImportedExample.parse({ polarity: row.polarity, taskKind: row.taskKind, ...content })
  }
}
