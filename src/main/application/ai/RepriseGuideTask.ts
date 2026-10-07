import { GuideOut } from '@shared/ai/schemas'
import type { AIError, Engine, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Ce que l'analyse sait d'un projet repris, envoyé à la tâche `reprise_guide` (spec 017 contracts). */
export interface GuideInput {
  readonly name: string
  readonly modules: readonly {
    readonly key: string
    readonly name: string
    readonly kind: string
    readonly rootPath: string
  }[]
  readonly entryPoints: readonly { readonly path: string; readonly kind: string }[]
  /** Chemins relatifs des fichiers analysés (fichiers sensibles déjà exclus). */
  readonly files: readonly string[]
  readonly readme: string
  readonly configs: readonly { readonly path: string; readonly content: string }[]
}

/** Taille maximale de l'entrée (spec 017 contracts : ~40 000 caractères). */
export const GUIDE_INPUT_LIMIT = 40_000
const LIMITS = { modules: 80, entryPoints: 40, readme: 12_000, config: 4_000, configs: 12_000 } as const

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… (tronqué)`
}

function listed<T>(items: readonly T[], max: number, line: (item: T) => string): string[] {
  const shown = items.slice(0, max).map(line)
  return items.length > max ? [...shown, `… ${items.length - max} de plus`] : shown
}

/**
 * Entrée bornée, dans l'ordre d'utilité : modules, points d'entrée, README, configurations, puis l'arborescence dans
 * la place qui reste (chemins omis comptés). Le tout sera balisé comme donnée par l'assembleur de contexte.
 */
export function buildGuideInput(input: GuideInput): string {
  const head = [
    `Projet : ${clip(input.name, 200)}`,
    '',
    `## Modules (${input.modules.length})`,
    ...listed(input.modules, LIMITS.modules, (m) => `- ${m.key} · ${m.name} (${m.kind}) — ${m.rootPath || '.'}`),
    '',
    `## Points d'entrée (${input.entryPoints.length})`,
    ...listed(input.entryPoints, LIMITS.entryPoints, (e) => `- ${e.path} (${e.kind})`),
    '',
    '## README',
    input.readme.trim() === '' ? 'non trouvé dans le projet' : clip(input.readme.trim(), LIMITS.readme)
  ]
  let configBudget: number = LIMITS.configs
  for (const config of input.configs) {
    if (configBudget <= 0) break
    const content = clip(config.content.trim(), Math.min(LIMITS.config, configBudget))
    configBudget -= content.length
    head.push('', `## Configuration : ${config.path}`, content)
  }
  const top = head.join('\n')

  const title = `\n\n## Arborescence (${input.files.length} fichiers)`
  let room = GUIDE_INPUT_LIMIT - top.length - title.length - 40
  const tree: string[] = []
  for (const path of input.files) {
    if (path.length + 1 > room) break
    tree.push(path)
    room -= path.length + 1
  }
  const omitted = input.files.length - tree.length
  const text = `${top}${title}\n${tree.join('\n')}${omitted > 0 ? `\n… ${omitted} chemins omis` : ''}`
  return text.slice(0, GUIDE_INPUT_LIMIT)
}

/**
 * Tâche `reprise_guide` par la passerelle : Claude si le projet l'autorise, sinon le modèle local, sans repli
 * (`localOnly`, constitution IV) ; modèle local arrêté → `AI_UNAVAILABLE`.
 */
export function runRepriseGuide(
  gateway: AIGateway,
  input: GuideInput,
  options: { readonly localOnly: boolean; readonly onEngine?: (engine: Engine, model: string) => void }
): Promise<Result<AIResult<GuideOut>, AIError>> {
  return gateway.run({
    kind: 'reprise_guide',
    input: buildGuideInput(input),
    schema: GuideOut,
    localOnly: options.localOnly,
    ...(options.onEngine === undefined ? {} : { onEngine: options.onEngine })
  })
}
