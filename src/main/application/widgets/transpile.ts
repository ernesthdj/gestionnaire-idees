import { stripTypeScriptTypes } from 'node:module'
import type { Result } from '../../domain/ai/types'

/**
 * TypeScript d'un widget → JavaScript exécutable (spec 004 FR-006), localement et sans dépendance : transformeur
 * intégré à Node (Electron 44 / Node 24). Mode `transform` : les rares constructions non effaçables (enum,
 * namespace) sont aussi converties. Aucune vérification de types : seul le navigateur du bac à sable exécute.
 */
export function transpileWidget(ts: string): Result<string, string> {
  try {
    return { ok: true, value: stripTypeScriptTypes(ts, { mode: 'transform' }) }
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : undefined
    return {
      ok: false,
      error: `Le code TypeScript du widget est invalide${detail === undefined ? '' : ` : ${detail}`}`
    }
  }
}
