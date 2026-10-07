import { randomUUID } from 'node:crypto'
import { GUIDE_SECTION_IDS, GUIDE_SECTION_TITLES, type GuideOut } from '@shared/ai/schemas'
import type { AIError, Result } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import { classifyFile } from '../../domain/reprise/fileFilter'
import { checkSource, knownSources } from '../../domain/reprise/guideSources'
import { MANIFEST_NAMES } from '../../domain/reprise/manifests'
import type { CodeGraphRepository } from '../../infrastructure/db/repositories/CodeGraphRepository'
import type { RepriseRepository } from '../../infrastructure/db/repositories/RepriseRepository'
import type { AIResult } from '../ai/AIGateway'
import type { GuideInput } from '../ai/RepriseGuideTask'
import type { DocumentService } from '../documents/DocumentService'

export const GUIDE_TITLE = 'Guide de reprise'
const README = /^readme(\.(md|markdown|txt|rst))?$/i
const DOC = /^docs\/[^/]+\.md$/i
const LIMITS = { manifests: 8, docs: 3, fileBytes: 256 * 1024 } as const

export interface GuideDeps {
  readonly reprise: Pick<RepriseRepository, 'project' | 'startRun' | 'endRun' | 'setGuideDocument'>
  readonly graph: Pick<CodeGraphRepository, 'modules' | 'files' | 'symbols' | 'entryPoints' | 'setModuleSummaries'>
  readonly documents: Pick<DocumentService, 'create' | 'write'>
  /** Document encore présent (ni supprimé ni inconnu) : régénérer y ajoute une version. */
  readonly documentAlive: (documentId: string) => boolean
  /** Garde de confidentialité (spec 017 R5) : faux → le modèle local rédige, rien ne part vers Claude. */
  readonly claudeAllowed: (genesisId: string) => boolean
  readonly runGuide: (
    input: GuideInput,
    options: { readonly localOnly: boolean }
  ) => Promise<Result<AIResult<GuideOut>, AIError>>
  /** Texte d'un fichier du projet (chemin relatif), lu sous sa racine réelle, borné ; `null` si illisible. */
  readonly readText: (root: string, path: string, maxBytes: number) => string | null
  readonly emit: (event: { readonly type: 'reprise:changed'; readonly payload: { readonly genesisId: string } }) => void
  /** Écriture sur la carte (lot d'Historique annulable), annoncée comme celles du pont MCP. */
  readonly onWritten: (event: { readonly batchId: string; readonly summary: string; readonly count: number }) => void
  readonly now?: () => Date
}

const depth = (path: string): number => path.split('/').length

/**
 * Guide de reprise d'un projet analysé (spec 017 US4) : contexte borné (graphe résumé, README, docs, configurations,
 * jamais un fichier sensible), rédigé par Claude ou par le modèle local selon la confidentialité, sources vérifiées
 * sur le projet, enregistré comme document du genesis (une version par génération), résumés des modules gardés.
 * Le run est journalisé sans contenu.
 */
export class GuideService {
  private readonly running = new Set<string>()

  constructor(private readonly deps: GuideDeps) {}

  isRunning(genesisId: string): boolean {
    return this.running.has(genesisId)
  }

  async generate(genesisId: string): Promise<{ readonly documentId: string }> {
    const project = this.deps.reprise.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    if (project.analyzedAt === null) throw new AppError('NOT_ANALYZED', 'Le projet doit d’abord être analysé.')
    if (this.running.has(genesisId)) throw new AppError('BUSY', 'Le guide de ce projet est déjà en cours de rédaction.')
    this.running.add(genesisId)
    const runId = randomUUID()
    const started = Date.now()
    this.deps.reprise.startRun({ id: runId, genesisId, kind: 'guide', at: this.now() })
    try {
      const files = this.deps.graph
        .files(genesisId)
        .map((file) => file.path)
        .sort()
      const modules = this.deps.graph.modules(genesisId)
      const symbols = this.deps.graph.symbols(genesisId)
      const input = this.input(project.rootDir, genesisId, files, modules, symbols)
      const localOnly = !this.deps.claudeAllowed(genesisId)
      const result = await this.deps.runGuide(input, { localOnly })
      if (!result.ok) {
        throw new AppError(
          result.error.code === 'AI_UNAVAILABLE' ? 'AI_UNAVAILABLE' : 'AI_FAILED',
          localOnly && result.error.code === 'AI_UNAVAILABLE'
            ? 'Le modèle local (Ollama) est indisponible : le guide d’un projet « Local uniquement » ne part jamais vers Claude.'
            : result.error.message
        )
      }

      const known = knownSources(
        files,
        modules.map((module) => module.key),
        symbols
      )
      let cited = 0
      let removed = 0
      const sections = GUIDE_SECTION_IDS.map((id) => {
        const section = result.value.data.sections.find((entry) => entry.id === id)
        const kept: string[] = []
        const unknown: string[] = []
        for (const source of section?.sources ?? []) {
          const checked = checkSource(source, known)
          if (checked === null) unknown.push(source)
          else if (!kept.includes(checked)) kept.push(checked)
        }
        cited += kept.length
        removed += unknown.length
        return { id, analogy: section?.analogy ?? '', markdown: section?.markdown ?? '', kept, unknown }
      })
      const moduleKeys = new Set(modules.map((module) => module.key))
      const summaries = result.value.data.modules.filter((module) => moduleKeys.has(module.key))
      this.deps.graph.setModuleSummaries(genesisId, summaries)

      const content = this.render(input.name, result.value, sections)
      const { documentId, batchId, created } = this.save(genesisId, project.guideDocumentId, content)
      this.deps.onWritten({ batchId, summary: `${GUIDE_TITLE} ${created ? 'rédigé' : 'régénéré'}`, count: 1 })
      this.deps.reprise.endRun(runId, 'done', this.now(), {
        sections: sections.length,
        sources: cited,
        removedSources: removed,
        modules: summaries.length,
        local: localOnly ? 1 : 0,
        durationMs: Date.now() - started
      })
      this.deps.emit({ type: 'reprise:changed', payload: { genesisId } })
      return { documentId }
    } catch (error) {
      this.deps.reprise.endRun(runId, 'failed', this.now(), { durationMs: Date.now() - started })
      throw error
    } finally {
      this.running.delete(genesisId)
    }
  }

  /** Entrée de la tâche : seuls des fichiers retenus par l'analyse (les fichiers sensibles n'y sont jamais). */
  private input(
    root: string,
    genesisId: string,
    files: readonly string[],
    modules: readonly {
      readonly key: string
      readonly name: string
      readonly kind: string
      readonly rootPath: string
    }[],
    symbols: readonly { readonly id: string; readonly path: string }[]
  ): GuideInput {
    const read = (path: string): string | null =>
      classifyFile(path, 0, () => false).kind === 'sensitive' ? null : this.deps.readText(root, path, LIMITS.fileBytes)
    const byDepth = (paths: readonly string[]): string[] =>
      [...paths].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))
    const readme = byDepth(files.filter((path) => README.test(path.split('/').at(-1) ?? '')))[0]
    const pathOf = new Map(symbols.map((symbol) => [symbol.id, symbol.path] as const))
    const entryPoints = new Map<string, string>()
    for (const entry of this.deps.graph.entryPoints(genesisId)) {
      const path = pathOf.get(entry.symbolId)
      if (path !== undefined && !entryPoints.has(path)) entryPoints.set(path, entry.kind)
    }
    const configs = [
      ...byDepth(files.filter((path) => MANIFEST_NAMES.test(path))).slice(0, LIMITS.manifests),
      ...files.filter((path) => DOC.test(path)).slice(0, LIMITS.docs)
    ].flatMap((path) => {
      const content = read(path)
      return content === null ? [] : [{ path, content }]
    })
    return {
      name: root.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? 'projet',
      modules: modules.map((module) => ({
        key: module.key,
        name: module.name,
        kind: module.kind,
        rootPath: module.rootPath
      })),
      entryPoints: [...entryPoints].map(([path, kind]) => ({ path, kind })),
      files,
      readme: (readme === undefined ? null : read(readme)) ?? '',
      configs
    }
  }

  private render(
    name: string,
    result: AIResult<GuideOut>,
    sections: readonly {
      readonly id: (typeof GUIDE_SECTION_IDS)[number]
      readonly analogy: string
      readonly markdown: string
      readonly kept: readonly string[]
      readonly unknown: readonly string[]
    }[]
  ): string {
    const lines = [`# ${GUIDE_TITLE} — ${name}`, '']
    if (result.engine === 'ollama') lines.push('> Rédigé par le modèle local, qualité moindre.', '')
    lines.push(
      `> Rédigé le ${this.now().slice(0, 10)} (${result.model}). Les commandes sont montrées, jamais lancées par l’app.`
    )
    sections.forEach((section, index) => {
      lines.push('', `## ${index + 1}. ${GUIDE_SECTION_TITLES[section.id]}`, '', `*${section.analogy.trim()}*`, '')
      lines.push(section.markdown.trim() === '' ? 'Non trouvé dans le projet.' : section.markdown.trim())
      if (section.kept.length > 0) {
        lines.push('', `**Sources :** ${section.kept.map((source) => `\`${source}\``).join(', ')}`)
      }
      if (section.unknown.length > 0) {
        const shown = section.unknown.map((source) => `\`${source.replace(/`/g, '')}\``).join(', ')
        lines.push('', `> ⚠️ Introuvables dans le projet, retirées des sources : ${shown}`)
      }
    })
    return `${lines.join('\n')}\n`
  }

  /** Première génération : document créé ; ensuite une nouvelle version, la précédente reste consultable. */
  private save(
    genesisId: string,
    existing: string | null,
    content: string
  ): { readonly documentId: string; readonly batchId: string; readonly created: boolean } {
    if (existing !== null && this.deps.documentAlive(existing)) {
      const { batchId } = this.deps.documents.write({
        documentId: existing,
        content,
        mode: 'remplacer',
        author: 'claude'
      })
      return { documentId: existing, batchId, created: false }
    }
    const { document, batchId } = this.deps.documents.create({
      neuronId: genesisId,
      title: GUIDE_TITLE,
      content,
      author: 'claude'
    })
    this.deps.reprise.setGuideDocument(genesisId, document.id)
    return { documentId: document.id, batchId, created: true }
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
