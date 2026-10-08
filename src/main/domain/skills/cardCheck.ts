import { starsOf, type SemanticLinkKind, type SkillCard } from '@shared/skills/card'

/**
 * Contrôles d'une fiche rendue par Claude (spec 020 T014, `L3-skills-comprendre.md` §2) : fonction pure. Les liens ne
 * visent qu'un skill inventorié, jamais le skill lui-même ; un domaine inconnu devient une proposition en attente de
 * mentalyas (avec son libellé) ou retombe sur « divers » ; les étoiles viennent de la grille, pas d'une déclaration.
 */

export interface CardCheckInput {
  readonly card: SkillCard
  /** Nom du skill analysé. */
  readonly self: string
  /** Noms des skills inventoriés → identifiant (famille qui l'emporte). */
  readonly skills: ReadonlyMap<string, string>
  /** Identifiants des domaines connus (validés ou déjà proposés). */
  readonly domains: ReadonlySet<string>
}

export interface CheckedCard {
  readonly stars: number
  readonly domain: { readonly id: string; readonly proposedLabel?: string }
  readonly links: readonly { readonly to: string; readonly kind: SemanticLinkKind; readonly reason: string }[]
  /** Liens écartés (skill inconnu, lien vers soi, doublon) : comptés, jamais stockés. */
  readonly rejectedLinks: number
}

export const FALLBACK_DOMAIN = 'divers'

export function cardCheck(input: CardCheckInput): CheckedCard {
  const { card } = input
  const seen = new Set<string>()
  const links: CheckedCard['links'][number][] = []
  for (const link of card.liens) {
    const to = input.skills.get(link.vers)
    const key = `${to ?? ''}|${link.sorte}`
    if (to === undefined || link.vers === input.self || seen.has(key)) continue
    seen.add(key)
    links.push({ to, kind: link.sorte, reason: link.raison })
  }
  const known = input.domains.has(card.domaine)
  const domain = known
    ? { id: card.domaine }
    : card.nouveau_domaine === undefined
      ? { id: FALLBACK_DOMAIN }
      : { id: card.domaine, proposedLabel: card.nouveau_domaine }
  return { stars: starsOf(card.grille), domain, links, rejectedLinks: card.liens.length - links.length }
}
