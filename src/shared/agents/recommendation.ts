import { AGENT_ROLES, AGENT_ROLE_LABELS, type AgentProfileView, type AgentRole } from './profile'

/**
 * Agents recommandés par le PO dans sa spec (L1o D1, docs/TACHES-AGENTS.md T009). Ce sont des propositions : mentalyas
 * crée les agents et les relie (D2), le PO ne le fait jamais.
 */

/** Un profil existant que le PO recommande pour la tâche. */
export interface RecommendedAgent {
  readonly profile: string
  readonly reason: string
}

/** Un profil qui n'existe pas encore : rôle, consignes et skills que le PO suggère de créer (rôle « Autre » possible). */
export interface SuggestedAgent {
  readonly name: string
  readonly role: AgentRole
  readonly instructions: string
  readonly skills: readonly string[]
}

export interface SpecAgents {
  readonly recommended: readonly RecommendedAgent[]
  readonly suggested: readonly SuggestedAgent[]
}

export const MAX_SPEC_AGENTS = 12

/** Une ligne par agent, n'importe où dans la spec ; les accents des mots-clés sont facultatifs. */
const RECOMMENDED_LINE = /^(?:[-*]\s*)?RECOMMAND[ÉE]\s*:\s*(.+?)\s+[—–-]\s+(.+)$/i
const SUGGESTED_LINE = /^(?:[-*]\s*)?SUGG[ÉE]R[ÉE]\s*:\s*(.+)$/i

const isRole = (value: string): value is AgentRole => (AGENT_ROLES as readonly string[]).includes(value)

/** « Backend », « backend », « Product Owner » → le rôle ; autre chose → `autre`. */
const roleOf = (text: string): AgentRole => {
  const wanted = text.trim().toLowerCase()
  if (isRole(wanted)) return wanted
  const byLabel = AGENT_ROLES.find((role) => AGENT_ROLE_LABELS[role].toLowerCase() === wanted)
  return byLabel ?? 'autre'
}

/** Lit les lignes `RECOMMANDÉ:` et `SUGGÉRÉ:` d'une spec ; une ligne mal formée est ignorée, jamais une erreur. */
export function parseSpecAgents(spec: string): SpecAgents {
  const recommended: RecommendedAgent[] = []
  const suggested: SuggestedAgent[] = []
  for (const raw of spec.split('\n')) {
    const line = raw.trim()
    const rec = RECOMMENDED_LINE.exec(line)
    if (rec !== null) {
      const profile = (rec[1] as string).trim()
      if (!recommended.some((r) => r.profile === profile)) {
        recommended.push({ profile, reason: (rec[2] as string).trim() })
      }
      continue
    }
    const sug = SUGGESTED_LINE.exec(line)
    if (sug === null) continue
    const [name = '', role = '', instructions = '', skills = ''] = (sug[1] as string).split('|').map((p) => p.trim())
    if (name === '' || instructions === '' || suggested.some((s) => s.name === name)) continue
    suggested.push({
      name,
      role: roleOf(role),
      instructions,
      skills: skills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
    })
  }
  return { recommended: recommended.slice(0, MAX_SPEC_AGENTS), suggested: suggested.slice(0, MAX_SPEC_AGENTS) }
}

/**
 * Sépare les recommandations qui visent un profil existant de celles qui n'en nomment aucun (le PO s'est trompé de nom :
 * à signaler à mentalyas plutôt qu'à créer en silence).
 */
export function matchRecommended(
  agents: SpecAgents,
  profiles: readonly Pick<AgentProfileView, 'name'>[]
): { readonly known: readonly RecommendedAgent[]; readonly unknown: readonly RecommendedAgent[] } {
  const names = new Set(profiles.map((profile) => profile.name.toLowerCase()))
  return {
    known: agents.recommended.filter((r) => names.has(r.profile.toLowerCase())),
    unknown: agents.recommended.filter((r) => !names.has(r.profile.toLowerCase()))
  }
}

const CONSIGNES_EXTRACT = 160

/** Les profils existants, tels que le PO les voit dans sa mission : nom, rôle, droits, modèle, skills, début des consignes. */
export function profileCatalog(profiles: readonly AgentProfileView[]): string {
  if (profiles.length === 0) return 'Aucun profil d’agent n’existe encore.'
  return profiles
    .map((p) => {
      const skills = p.skills.length === 0 ? 'aucun skill' : `skills : ${p.skills.join(', ')}`
      const extract = p.instructions.replace(/\s+/g, ' ').trim().slice(0, CONSIGNES_EXTRACT)
      return `- ${p.name} (${AGENT_ROLE_LABELS[p.role]}, ${p.model}, effort ${p.effort}, ${skills})${extract === '' ? '' : ` — ${extract}`}`
    })
    .join('\n')
}

/** Consigne donnée au PO : comment recommander des agents et en suggérer de nouveaux (format lu par `parseSpecAgents`). */
export const SPEC_AGENTS_INSTRUCTIONS = [
  'Termine ta spec par la liste des agents à intégrer, une ligne chacun :',
  '- « RECOMMANDÉ: <nom exact d’un profil existant> — <pourquoi il convient à cette tâche> » ;',
  '- si aucun profil existant ne convient à une partie complexe de la tâche : « SUGGÉRÉ: <nom> | <rôle : po, architecte, backend, frontend, qa ou autre> | <consignes> | <skills séparés par des virgules, ou vide> ».',
  'Ce ne sont que des propositions : mentalyas crée les agents et les relie. Ne recommande pas de profil absent de la liste ci-dessus.'
].join('\n')
