import type { CodeLang } from '@shared/ipc/reprise'
import type { WorkflowSymbolView } from '@shared/ipc/workflow'
import { WORKER_LANGS, WorkerMessage } from '../../../analysis-worker/protocol'
import type { RunWorker } from '../reprise/AnalysisService'

/** Au-delà, l'analyse d'un fichier est abandonnée (le lecteur garde le code, sans raccourcis). */
export const SYMBOLS_TIMEOUT_MS = 10_000
/** Au plus ce nombre de raccourcis par fichier. */
export const SYMBOLS_MAX = 500

export interface WorkflowSymbolsDeps {
  /** Fichier lisible depuis une carte Workflow (mêmes gardes que `workflow:file`). */
  readonly target: (genesisId: string, path: string) => { root: string; path: string; lang: CodeLang }
  /** Processus d'analyse syntaxique de l'app (tree-sitter, spec 017 R2), isolé du main. */
  readonly runWorker: RunWorker
  readonly timeoutMs?: number
}

const isWorkerLang = (lang: CodeLang): lang is (typeof WORKER_LANGS)[number] =>
  (WORKER_LANGS as readonly string[]).includes(lang)

/**
 * Raccourcis d'un fichier dans le lecteur d'une carte Workflow (spec 023 D12) : ses classes, interfaces, fonctions et
 * méthodes, repérées par le processus d'analyse syntaxique (tree-sitter) — le code est lu, jamais exécuté, dans un
 * processus séparé dont la réponse est revalidée (un fichier du projet a pu piéger l'analyse). Langage non analysé,
 * erreur ou délai dépassé : aucun raccourci, jamais d'erreur.
 */
export class WorkflowSymbols {
  constructor(private readonly deps: WorkflowSymbolsDeps) {}

  async symbols(genesisId: string, path: string): Promise<WorkflowSymbolView[]> {
    const target = this.deps.target(genesisId, path)
    const lang = target.lang
    if (!isWorkerLang(lang)) return []
    return new Promise((resolve) => {
      let settled = false
      let found: WorkflowSymbolView[] = []
      // Le délai est posé après le lancement : une réponse immédiate (panne) le trouve encore vide.
      const delay: { timer?: ReturnType<typeof setTimeout> } = {}
      const finish = (): void => {
        if (settled) return
        settled = true
        clearTimeout(delay.timer)
        resolve(found)
      }
      const worker = this.deps.runWorker(
        { type: 'parse', root: target.root, files: [{ id: '0', path: target.path, lang, knownHash: null }] },
        (raw) => {
          const message = WorkerMessage.safeParse(raw)
          if (!message.success) return
          const data = message.data
          if (data.type === 'file') {
            found = data.extraction.symbols
              .map((symbol) => ({
                name: symbol.name,
                kind: symbol.kind,
                startLine: symbol.startLine,
                endLine: Math.max(symbol.startLine, symbol.endLine)
              }))
              .sort((a, b) => a.startLine - b.startLine)
              .slice(0, SYMBOLS_MAX)
          }
          if (data.type === 'done' || data.type === 'initError' || data.type === 'fileError') finish()
        },
        finish
      )
      if (settled) return
      delay.timer = setTimeout(() => {
        worker.cancel()
        finish()
      }, this.deps.timeoutMs ?? SYMBOLS_TIMEOUT_MS)
    })
  }
}
