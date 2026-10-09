import { z } from 'zod'

// Lancer un projet (spec 025).

export interface RunScriptsView {
  /** Projet marqué de confiance (spec 014) : seul un projet de confiance se lance. */
  readonly trusted: boolean
  /** `package.json` trouvé et lisible. */
  readonly hasPackage: boolean
  readonly scripts: readonly { readonly name: string; readonly command: string }[]
  readonly favorite: string | null
}

export type RunState = 'running' | 'exited' | 'failed' | 'stopped'

export interface RunView {
  readonly runId: string
  readonly genesisId: string
  readonly project: string
  readonly script: string
  readonly state: RunState
  readonly exitCode: number | null
  readonly startedAt: string
  /** Dernières lignes de sortie (bornées). */
  readonly output: string
}

/** Événement `run:output` : morceau de sortie à ajouter. */
export interface RunOutputEvent {
  readonly runId: string
  readonly chunk: string
}

const genesisId = z.uuid()
const Script = z.string().regex(/^[A-Za-z0-9:._-]{1,100}$/)
export const RunGenesisInput = z.strictObject({ genesisId })
export const RunStartInput = z.strictObject({ genesisId, script: Script })
export const RunFavoriteInput = z.strictObject({ genesisId, script: Script })
export const RunIdInput = z.strictObject({ runId: z.uuid() })
export const ProjectTrustInput = z.strictObject({ genesisId, trusted: z.boolean(), confirm: z.literal(true) })
