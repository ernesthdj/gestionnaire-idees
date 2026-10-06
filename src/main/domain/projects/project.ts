import { PROJECT_TYPES, type ProjectType } from '@shared/ipc/projects'

export { slugify, slugProblem } from '@shared/projects/slug'

/** Types de projet logiciels : ils reçoivent `src/` et `tests/`, et git leur est naturel (spec 016 D2). */
const CODE_TYPES: ReadonlySet<ProjectType> = new Set([
  'Web App',
  'Desktop App',
  'Desktop + Web App',
  'Mobile App',
  'CLI / Script'
])

export function isCodeType(type: ProjectType): boolean {
  return CODE_TYPES.has(type)
}

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value)
}

/**
 * Texte d'une ligne pour le registre et les gabarits : sans guillemet droit ni saut de ligne (le lanceur `pm.bat` lit
 * le registre ligne à ligne et s'arrête au premier guillemet), sans caractère de contrôle (spec 016 FR-004).
 */
export function cleanText(value: string, max: number): string {
  const flat = [...value]
    .map((char) => (char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f ? ' ' : char))
    .join('')
    .replace(/"/g, '’')
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

export interface ProjectIdentity {
  readonly name: string
  readonly slug: string
  readonly type: ProjectType
  readonly description: string
  /** Date du jour (AAAA-MM-JJ) et horodatage (AAAA-MM-JJ HH:MM), fournis par l'appelant. */
  readonly date: string
  readonly dateTime: string
}

export interface ScaffoldFile {
  /** Chemin relatif au dossier du projet, séparateurs `/`. */
  readonly path: string
  readonly content: string
}

/** Fichiers initiaux d'un projet, au format de `/hub new` (spec 016 D2) ; dossiers vides : `src/`, `tests/`. */
export function scaffoldFiles(project: ProjectIdentity): {
  readonly files: readonly ScaffoldFile[]
  readonly dirs: readonly string[]
} {
  const code = isCodeType(project.type)
  const tree = [
    `${project.slug}/`,
    '├── CLAUDE.md          # Ce fichier',
    '├── README.md',
    '├── docs/',
    '│   └── JOURNAL.md     # Journal du projet',
    ...(code ? ['├── src/               # Code source', '└── tests/             # Tests'] : [])
  ]
  const claude = [
    `# CLAUDE.md — ${project.name}`,
    '',
    `> **Projet :** ${project.name}`,
    `> **Slug :** ${project.slug}`,
    `> **Type :** ${project.type}`,
    `> **Cree le :** ${project.date}`,
    `> **Description :** ${project.description}`,
    '',
    '---',
    '',
    '## Contexte',
    '',
    'Ce projet est né d’un genesis du Brainstormer, après son premier brainstorm.',
    'La stack et les dépendances seront définies au fil du brainstorm.',
    '',
    '## Structure',
    '',
    '```',
    ...tree,
    '```',
    '',
    '## Règles spécifiques',
    '',
    '> À compléter après le brainstorm.',
    ''
  ].join('\n')
  const journal = [
    `# JOURNAL — ${project.name}`,
    '',
    `### [${project.dateTime}] INIT — projet créé depuis le Brainstormer`,
    `**Quoi :** dossier du projet « ${project.name} » (${project.type}).`,
    ''
  ].join('\n')
  const readme = [`# ${project.name}`, '', project.description === '' ? '' : `${project.description}\n`].join('\n')
  return {
    files: [
      { path: 'CLAUDE.md', content: claude },
      { path: 'README.md', content: readme },
      { path: 'docs/JOURNAL.md', content: journal }
    ],
    dirs: code ? ['src', 'tests'] : []
  }
}

/** `.gitignore` minimal d'un dépôt initialisé par l'app (spec 016 D5). */
export const GITIGNORE = [
  '# Secrets',
  '.env',
  '.env.*',
  '!.env.example',
  '*.key',
  '*.pem',
  '',
  '# Dépendances et builds',
  'node_modules/',
  'vendor/',
  'dist/',
  'out/',
  'bin/',
  'obj/',
  '',
  '# Système et IDE',
  '.DS_Store',
  'Thumbs.db',
  '.vs/',
  '.idea/',
  ''
].join('\n')

export function firstCommitMessage(slug: string): string {
  return `chore(${slug}): initial scaffolding via Brainstormer`
}

type JsonObject = Record<string, unknown>
const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Le registre ProjectMaster tel qu'on accepte de le réécrire : `{ projects: { … } }` ; sinon `null`. */
function projectsOf(registry: unknown): JsonObject | null {
  return isObject(registry) && isObject(registry['projects']) ? registry['projects'] : null
}

export class RegistryError extends Error {}

/** Registre augmenté du projet, au format de `/hub new` (spec 016 D4) ; les autres entrées sont gardées telles quelles. */
export function registryWithProject(
  registry: unknown,
  project: ProjectIdentity & { readonly folder: string; readonly createdAt: string }
): JsonObject {
  const projects = projectsOf(registry)
  if (projects === null) throw new RegistryError('Le registre ProjectMaster est illisible : rien n’a été écrit.')
  if (Object.hasOwn(projects, project.slug)) {
    throw new RegistryError(`Le registre ProjectMaster a déjà un projet « ${project.slug} ».`)
  }
  return {
    ...(registry as JsonObject),
    projects: {
      ...projects,
      [project.slug]: {
        slug: project.slug,
        name: project.name,
        description: project.description,
        type: project.type,
        visibility: 'local',
        status: 'active',
        created_at: project.createdAt,
        last_session: null,
        branch: null,
        github_url: null,
        folder: project.folder
      }
    }
  }
}

/** Registre où le projet prend sa branche git ; inchangé si le projet n'y est pas. */
export function registryWithBranch(registry: unknown, slug: string, branch: string): JsonObject | null {
  const projects = projectsOf(registry)
  if (projects === null) throw new RegistryError('Le registre ProjectMaster est illisible : rien n’a été écrit.')
  const entry = projects[slug]
  if (!isObject(entry)) return null
  return { ...(registry as JsonObject), projects: { ...projects, [slug]: { ...entry, branch } } }
}
