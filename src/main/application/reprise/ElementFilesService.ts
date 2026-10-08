import type { CodeLang, ElementFileView, ElementFilesView } from '@shared/ipc/reprise'
import { AppError } from '../../domain/errors'
import { langOf } from '../../domain/reprise/fileFilter'
import { covers, normalizeElementPath } from '../../domain/reprise/measured'
import { readProjectText } from '../../infrastructure/files/projectFiles'
import type { CodeGraphRepository } from '../../infrastructure/db/repositories/CodeGraphRepository'
import type { ConversationNeuron } from '../../infrastructure/db/repositories/ConversationRepository'
import type { ProjectScan } from '../../infrastructure/reprise/ProjectScanner'
import { FILE_SYMBOL_NAME } from './AnalysisService'

/** Au plus ce nombre de fichiers listés pour un élément (un dossier large est tronqué, signalé). */
export const ELEMENT_FILES_MAX = 200

export interface ElementFilesDeps {
  readonly neuron: (id: string) => ConversationNeuron | undefined
  /** Graphe d'un projet repris analysé (fichiers, symboles, liens) ; vide sinon. */
  readonly graph: Pick<CodeGraphRepository, 'files' | 'symbols' | 'edges'>
  readonly scan: (root: string) => ProjectScan
  readonly readText?: (path: string) => string
}

function pathsOf(element: ConversationNeuron): string[] {
  try {
    const value: unknown = JSON.parse(element.pathsJson ?? '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').map(normalizeElementPath)
      : []
  } catch {
    return []
  }
}

/**
 * Fichiers d'un élément de carte de structure (spec 017 US7, FR-032) : ses chemins développés en fichiers du projet,
 * lus sous la racine, en lecture seule, jamais un fichier sensible. Pour un projet repris analysé, chaque fichier vient
 * avec ses symboles et le nombre de leurs appelants.
 */
export class ElementFilesService {
  constructor(private readonly deps: ElementFilesDeps) {}

  files(elementId: string): ElementFilesView {
    const { element, genesis, root } = this.context(elementId)
    const paths = pathsOf(element)
    const analyzed = this.deps.graph.files(genesis.id)
    const candidates: { path: string; lang: CodeLang; lines: number | null }[] =
      analyzed.length > 0
        ? analyzed.map((file) => ({ path: file.path, lang: file.lang, lines: file.lines }))
        : this.deps.scan(root).retained.map((file) => ({ path: file.path, lang: file.lang, lines: null }))
    const matching = candidates.filter((file) => covers(paths, file.path)).sort((a, b) => a.path.localeCompare(b.path))
    return {
      elementId,
      title: element.title,
      paths,
      files: matching.slice(0, ELEMENT_FILES_MAX),
      truncated: matching.length > ELEMENT_FILES_MAX,
      analyzed: analyzed.length > 0
    }
  }

  file(elementId: string, path: string): ElementFileView {
    const { element, genesis, root } = this.context(elementId)
    const normalized = path.replace(/\\/g, '/')
    if (!covers(pathsOf(element), normalized)) {
      throw new AppError('NOT_FOUND', 'Ce fichier n’appartient pas à cet élément.')
    }
    const text = readProjectText(
      root,
      normalized,
      this.deps.readText === undefined ? {} : { readText: this.deps.readText }
    )
    const symbols = this.deps.graph
      .symbols(genesis.id)
      .filter((symbol) => symbol.path === normalized && symbol.name !== FILE_SYMBOL_NAME)
    const ids = new Set(symbols.map((symbol) => symbol.id))
    const callers = new Map<string, number>()
    for (const edge of this.deps.graph.edges(genesis.id)) {
      if (edge.toSymbolId === null || !ids.has(edge.toSymbolId) || ids.has(edge.fromSymbolId)) continue
      callers.set(edge.toSymbolId, (callers.get(edge.toSymbolId) ?? 0) + edge.count)
    }
    return {
      path: normalized,
      lang: langOf(normalized),
      lines: text.split(/\r?\n/),
      symbols: symbols
        .sort((a, b) => a.startLine - b.startLine)
        .map((symbol) => ({
          id: symbol.id,
          name: symbol.name,
          kind: symbol.kind,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          callers: callers.get(symbol.id) ?? 0
        }))
    }
  }

  private context(elementId: string): { element: ConversationNeuron; genesis: ConversationNeuron; root: string } {
    const element = this.deps.neuron(elementId)
    if (
      element === undefined ||
      element.state === 'archived' ||
      element.kind !== 'element' ||
      element.genesisId === null
    ) {
      throw new AppError('NOT_FOUND', 'Élément de carte introuvable.')
    }
    const genesis = this.deps.neuron(element.genesisId)
    if (genesis === undefined || genesis.projectDir === null) {
      throw new AppError('FOLDER_MISSING', 'Aucun dossier de projet lié à cette carte.')
    }
    return { element, genesis, root: genesis.projectDir }
  }
}
