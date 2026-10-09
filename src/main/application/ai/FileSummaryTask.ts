import { FileSummaryOut } from '@shared/ai/schemas'
import type { WorkflowBlockView } from '@shared/ipc/workflow'
import type { AIError, Engine, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Bornes de l'entrée : le code (~40 000 caractères, comme le guide de reprise) et la liste des blocs. */
export const SUMMARY_INPUT_LIMITS = { codeChars: 40_000, blocks: 120 } as const

export interface FileSummaryInput {
  readonly path: string
  readonly lang: string
  readonly lines: readonly string[]
  readonly blocks: readonly WorkflowBlockView[]
}

/** Neutralise une balise fermante : le code ne peut pas « sortir » de son bloc. */
const guard = (text: string): string => text.replace(/<\s*\/\s*(fichier|blocs)\s*>/giu, '<\\/$1>')
/** Chemin ou langage dans un attribut : rien qui puisse fermer la balise. */
const attribute = (value: string): string => value.replace(/[^\w./-]/g, '')

const KINDS: Readonly<Record<WorkflowBlockView['kind'], string>> = {
  namespace: 'espace de noms',
  class: 'classe',
  interface: 'type',
  function: 'fonction',
  method: 'méthode'
}

/** Entrée balisée : code du fichier (tronqué avec mention), puis ses blocs avec leur phrase de commentaire. */
export function fileSummaryInput(input: FileSummaryInput): string {
  const code = input.lines.join('\n')
  const truncated = code.length > SUMMARY_INPUT_LIMITS.codeChars
  const blocks = input.blocks.filter((block) => block.kind !== 'namespace').slice(0, SUMMARY_INPUT_LIMITS.blocks)
  return [
    `<fichier chemin="${attribute(input.path)}" langage="${attribute(input.lang)}">`,
    guard(code.slice(0, SUMMARY_INPUT_LIMITS.codeChars)) + (truncated ? '\n[… code tronqué]' : ''),
    '</fichier>',
    '<blocs>',
    ...blocks.map((block) =>
      guard(
        `- ${block.name} (${KINDS[block.kind]}${block.exported ? ', offert' : ''}, lignes ${block.startLine}-${block.endLine})` +
          (block.doc === null ? '' : ` : ${block.doc}`)
      )
    ),
    '</blocs>'
  ].join('\n')
}

/**
 * Tâche `file_summary` par la passerelle (spec 023 D15, constitution III) : Claude **sans outil**, consigne figée
 * (`FileSummaryFrame`), code balisé comme donnée, sortie au schéma fermé ; le modèle local pour un projet « Local
 * uniquement » (constitution IV). Jamais mise en file.
 */
export function runFileSummary(
  gateway: Pick<AIGateway, 'run'>,
  input: FileSummaryInput,
  options: { readonly localOnly: boolean; readonly onEngine?: (engine: Engine, model: string) => void }
): Promise<Result<AIResult<FileSummaryOut>, AIError>> {
  return gateway.run({
    kind: 'file_summary',
    input: fileSummaryInput(input),
    schema: FileSummaryOut,
    localOnly: options.localOnly,
    noQueue: true,
    ...(options.onEngine === undefined ? {} : { onEngine: options.onEngine })
  })
}
