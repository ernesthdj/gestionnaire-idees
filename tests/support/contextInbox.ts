import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface InboxFiles {
  readonly 'profile.md'?: string
  readonly 'rules.md'?: string
  readonly 'examples.json'?: string
  readonly [extra: string]: string | undefined
}

/** Écrit un jeu de contexte FICTIF dans un dossier d'import, manifeste en dernier (comme Claude Code). */
export function writeInbox(
  dir: string,
  files: InboxFiles,
  options: { tamper?: string; manifestOverride?: string; listed?: readonly string[] } = {}
): void {
  mkdirSync(dir, { recursive: true })
  const sha256: Record<string, string> = {}
  for (const [name, content] of Object.entries(files)) {
    if (content === undefined) continue
    writeFileSync(join(dir, name), content, 'utf8')
    sha256[name] = createHash('sha256').update(content, 'utf8').digest('hex')
  }
  if (options.tamper !== undefined) writeFileSync(join(dir, options.tamper), 'contenu modifié après coup', 'utf8')
  const listed =
    options.listed ?? Object.keys(files).filter((name) => ['profile.md', 'rules.md', 'examples.json'].includes(name))
  const manifest =
    options.manifestOverride ??
    JSON.stringify({
      schemaVersion: 1,
      author: 'claude-code',
      createdAt: '2026-09-28T10:00:00Z',
      files: listed,
      sha256
    })
  writeFileSync(join(dir, 'manifest.json'), manifest, 'utf8')
}

export const FICTIVE_PROFILE = [
  '# Profil (fictif)',
  "- Double casquette : développement logiciel et photographie d'événements.",
  '- Aime les décisions argumentées, les listes courtes et les étapes numérotées.',
  '- Priorité aux solutions simples et durables.'
].join('\n')

export const FICTIVE_EXAMPLES = JSON.stringify([
  {
    taskKind: 'categoriser',
    polarity: 'positive',
    input: 'Acheter un flash cobra',
    output: { categorySlug: 'achat', nature: 'action' }
  },
  {
    taskKind: 'etendre',
    polarity: 'negative',
    input: 'Concept de portfolio',
    output: { question: 'Quelle couleur préfères-tu ?' },
    reason: 'question trop superficielle'
  }
])
