import { SkillCard } from '@shared/skills/card'
import type { AIError, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Bornes de l'entrée (`L3-skills-comprendre.md` §2). */
export const CARD_INPUT_LIMITS = { skillChars: 60_000, canvas: 150, descriptionChars: 200 } as const

export interface CardInput {
  readonly name: string
  readonly family: string
  readonly markdown: string
  /** Autres skills de la toile (noms et descriptions). */
  readonly canvas: readonly { readonly name: string; readonly description: string }[]
  readonly domains: readonly { readonly id: string; readonly label: string }[]
}

/** Neutralise une balise fermante : le texte du skill ne peut pas « sortir » de son bloc. */
const guard = (text: string): string => text.replace(/<\s*\/\s*(skill|toile|domaines)\s*>/giu, '<\\/$1>')
/** Nom ou famille dans un attribut : rien qui puisse fermer la balise. */
const attribute = (value: string): string => value.replace(/[^a-z0-9:/_.-]/gi, '')

/** Entrée balisée : SKILL.md (tronqué avec mention), toile, domaines, tous comme données. */
export function cardInput(input: CardInput): string {
  const truncated = input.markdown.length > CARD_INPUT_LIMITS.skillChars
  const text = input.markdown.slice(0, CARD_INPUT_LIMITS.skillChars)
  return [
    `<skill nom="${attribute(input.name)}" famille="${attribute(input.family)}">`,
    guard(text) + (truncated ? '\n[… texte tronqué]' : ''),
    '</skill>',
    '<toile>',
    ...input.canvas
      .slice(0, CARD_INPUT_LIMITS.canvas)
      .map((skill) => guard(`- ${skill.name} : ${skill.description.slice(0, CARD_INPUT_LIMITS.descriptionChars)}`)),
    '</toile>',
    '<domaines>',
    ...input.domains.map((domain) => guard(`- ${domain.id} : ${domain.label}`)),
    '</domaines>'
  ].join('\n')
}

/**
 * Tâche `skill_card` par la passerelle (spec 020 US2, constitution III) : Claude **sans outil**, consigne figée
 * (`SkillCardFrame`), skill balisé comme donnée, sortie au schéma fermé. Jamais mise en file.
 */
export function runSkillCard(
  gateway: Pick<AIGateway, 'run'>,
  input: CardInput,
  requestId: string,
  signal?: AbortSignal
): Promise<Result<AIResult<SkillCard>, AIError>> {
  return gateway.run({
    kind: 'skill_card',
    input: cardInput(input),
    schema: SkillCard,
    requestId,
    noQueue: true,
    ...(signal === undefined ? {} : { signal })
  })
}
