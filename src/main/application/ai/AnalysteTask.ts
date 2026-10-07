import { AnalysteOut } from '@shared/analyste/proposals'
import type { AIError, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

export { AnalysteOut }

export interface AnalysteTaskOptions {
  /** Dépôt désigné (chemin réel, vérifié par `RepoGuard`) : seul dossier lisible par l'Analyste. */
  readonly repoPath: string
  /** Identifiant de la demande, gardé sur l'analyse (lien vers `ai_calls`). */
  readonly requestId: string
  readonly signal?: AbortSignal
}

/**
 * Tâche `analyste` par la passerelle (spec 019 US2, constitution III et IV) : Claude par `claude -p`, consigne figée
 * (`AnalysteFrame`), dossier balisé comme donnée, outils `Read Glob Grep` dans le dépôt seulement, sortie au schéma
 * fermé `AnalysteOut`. Jamais mise en file ni confiée au modèle local.
 */
export function runAnalyste(
  gateway: Pick<AIGateway, 'run'>,
  dossier: string,
  options: AnalysteTaskOptions
): Promise<Result<AIResult<AnalysteOut>, AIError>> {
  return gateway.run({
    kind: 'analyste',
    input: dossier,
    schema: AnalysteOut,
    requestId: options.requestId,
    noQueue: true,
    readOnlyRepo: options.repoPath,
    ...(options.signal === undefined ? {} : { signal: options.signal })
  })
}
