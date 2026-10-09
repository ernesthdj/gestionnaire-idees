import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Coffre ProjectMaster FICTIF pour les tests (spec 024 T002) : `.hub/registry.json` et `.hub/sessions.json` au format du
 * skill `/hub`, `projects/`, `docs/JOURNAL.md`. Renvoie le dossier `projects/` (réglage `projectsRoot`).
 */
export function buildVault(
  dir: string,
  projects: readonly { readonly slug: string; readonly name: string; readonly journal?: readonly string[] }[] = [],
  activeSession: { readonly slug: string; readonly openedAt: string } | null = null
): string {
  const root = join(dir, 'projects')
  mkdirSync(join(dir, '.hub'), { recursive: true })
  mkdirSync(join(dir, 'docs'), { recursive: true })
  mkdirSync(root, { recursive: true })
  writeFileSync(join(dir, 'docs', 'JOURNAL.md'), '# Journal global\n')
  const registry = Object.fromEntries(
    projects.map((project) => [
      project.slug,
      {
        slug: project.slug,
        name: project.name,
        description: `Projet fictif ${project.name}`,
        type: 'Web App',
        visibility: 'private',
        status: 'active',
        created_at: '2026-01-01T10:00:00Z',
        last_session: null,
        branch: 'main',
        github_url: null,
        folder: project.slug
      }
    ])
  )
  writeFileSync(join(dir, '.hub', 'registry.json'), JSON.stringify({ version: '1.0', projects: registry }, null, 2))
  writeFileSync(
    join(dir, '.hub', 'sessions.json'),
    JSON.stringify({
      version: '1.0',
      active_session:
        activeSession === null
          ? null
          : { project_slug: activeSession.slug, opened_at: activeSession.openedAt, branch: 'main' },
      sessions: []
    })
  )
  for (const project of projects) {
    const folder = join(root, project.slug)
    mkdirSync(join(folder, 'docs'), { recursive: true })
    writeFileSync(
      join(folder, 'docs', 'JOURNAL.md'),
      ['# Journal', ...(project.journal ?? []).map((entry) => `\n### ${entry}\nTexte.`)].join('\n')
    )
  }
  return root
}
