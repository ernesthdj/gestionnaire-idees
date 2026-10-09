import type { CodeLang } from '@shared/ipc/reprise'
import type { WorkflowAnatomyView } from '@shared/ipc/workflow'
import { WORKER_LANGS, WorkerMessage } from '../../../analysis-worker/protocol'
import { fileAnatomy } from '../../domain/workflow/anatomy'
import type { RunWorker } from '../reprise/AnalysisService'

/** Au-delà, l'analyse d'un fichier est abandonnée (le lecteur garde le code, sans schéma ni raccourcis). */
export const ANATOMY_TIMEOUT_MS = 10_000

export interface WorkflowAnatomyDeps {
  /** Fichier lisible depuis une carte Workflow (mêmes gardes que `workflow:file`). */
  readonly target: (genesisId: string, path: string) => { root: string; path: string; lang: CodeLang }
  /** Processus d'analyse syntaxique de l'app (tree-sitter, spec 017 R2), isolé du main. */
  readonly runWorker: RunWorker
  readonly timeoutMs?: number
}

const isWorkerLang = (lang: CodeLang): lang is (typeof WORKER_LANGS)[number] =>
  (WORKER_LANGS as readonly string[]).includes(lang)

/**
 * Anatomie d'un fichier dans le lecteur d'une carte Workflow (spec 023 D12, D14, R10) : ses blocs, imports et appels
 * internes, d'où l'interface tire le schéma et les raccourcis. Une seule analyse par le processus d'analyse syntaxique
 * (tree-sitter) — le code est lu, jamais exécuté, dans un processus séparé dont la réponse est revalidée (un fichier du
 * projet a pu piéger l'analyse). Langage non analysé, erreur ou délai dépassé : `null`, jamais d'erreur.
 */
export class WorkflowAnatomy {
  constructor(private readonly deps: WorkflowAnatomyDeps) {}

  async anatomy(genesisId: string, path: string): Promise<WorkflowAnatomyView | null> {
    const target = this.deps.target(genesisId, path)
    const lang = target.lang
    if (!isWorkerLang(lang)) return null
    return new Promise((resolve) => {
      let settled = false
      let found: WorkflowAnatomyView | null = null
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
          if (data.type === 'file') found = fileAnatomy(data.extraction)
          if (data.type === 'done' || data.type === 'initError' || data.type === 'fileError') finish()
        },
        finish
      )
      if (settled) return
      delay.timer = setTimeout(() => {
        worker.cancel()
        finish()
      }, this.deps.timeoutMs ?? ANATOMY_TIMEOUT_MS)
    })
  }
}
