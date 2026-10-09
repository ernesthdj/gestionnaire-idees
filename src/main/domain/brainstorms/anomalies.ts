import type { HubAnomaly } from '@shared/ipc/brainstorms'

export interface AnomalyInput {
  readonly slug: string
  /** Session `/hub` ouverte (`.hub/sessions.json`), quel que soit le projet. */
  readonly hubSession: { readonly slug: string; readonly since: string } | null
  /** État git déjà lu (spec 021), sans `git fetch` ; `null` : pas de dépôt ou illisible. */
  readonly git: { readonly files: number; readonly ahead: number; readonly behind: number } | null
}

/** Ce que `/hub work` signale à l'ouverture d'un brainstorm (spec 024 US1 scénario 4, research R9). */
export function hubAnomalies(input: AnomalyInput): HubAnomaly[] {
  const found: HubAnomaly[] = []
  const session = input.hubSession
  if (session !== null) {
    found.push(
      session.slug === input.slug
        ? { kind: 'session_here', since: session.since }
        : { kind: 'session_elsewhere', slug: session.slug, since: session.since }
    )
  }
  const git = input.git
  if (git !== null) {
    if (git.files > 0) found.push({ kind: 'uncommitted', count: git.files })
    if (git.ahead > 0) found.push({ kind: 'unpushed', count: git.ahead })
    if (git.behind > 0) found.push({ kind: 'behind', count: git.behind })
  }
  return found
}

/** Titres des dernières entrées d'un JOURNAL (`### …`), les plus récentes d'abord, bornés. */
export function journalHeadings(markdown: string, limit = 5): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice(4).trim().slice(0, 160))
    .filter((line) => line !== '')
    .slice(-limit)
    .reverse()
}
