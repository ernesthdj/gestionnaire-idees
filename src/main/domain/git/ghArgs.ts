/**
 * Seul constructeur d'arguments `gh` de l'app (spec 021 research R9) : une liste blanche de sous-commandes, valeurs en
 * forme collée (`--description=…`), dépôt `<propriétaire>/<nom>` vérifié. Toute autre forme est inconstructible
 * (`auth token`, `pr merge`, `api repos/…`, `--source`…). Pur.
 */

const OWNER_REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/
/** Nom d'un nouveau dépôt GitHub : lettres, chiffres, `.`, `_`, `-`, sans `.` initial. */
export const REPO_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/

export function ownerRepo(value: string): string {
  if (!OWNER_REPO.test(value) || value.includes('..')) throw new Error(`dépôt GitHub refusé : ${value}`)
  return value
}

/** Compte connecté. */
export const ghLoginArgs = (): string[] => ['api', 'user', '--jq', '.login']

/** Droits et propriétaire d'un dépôt (règles du push, R10). */
export const ghRepoViewArgs = (repo: string): string[] => [
  'repo',
  'view',
  ownerRepo(repo),
  '--json',
  'viewerPermission,owner,defaultBranchRef,nameWithOwner,url'
]

/**
 * Création d'un dépôt SANS `--source` ni `--push` (git n'est jamais lancé par `gh`) ; privé par défaut.
 * La description passe en forme collée, nettoyée des retours à la ligne.
 */
export function ghRepoCreateArgs(name: string, visibility: 'private' | 'public', description: string): string[] {
  if (!REPO_NAME.test(name)) throw new Error(`nom de dépôt refusé : ${name}`)
  const clean = description
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 350)
  return [
    'repo',
    'create',
    name,
    visibility === 'public' ? '--public' : '--private',
    ...(clean === '' ? [] : [`--description=${clean}`])
  ]
}

// PR, issues et fork (spec 021 US6, research R9) : lectures bornées, écritures seulement sur clic confirmé (le
// service s'en charge). Les textes longs passent par l'entrée standard (`--body-file -`), les courts en forme collée,
// sans retour à la ligne. Ni approbation, ni fusion, ni fermeture, ni réouverture : inconstructibles.

/** Titre d'une PR ou d'une issue : une ligne, 256 caractères au plus. */
const oneLine = (text: string, max: number): string => text.replace(/\s+/g, ' ').trim().slice(0, max)
const number = (value: number): string => {
  if (!Number.isInteger(value) || value < 1 || value > 10_000_000) throw new Error(`numéro refusé : ${value}`)
  return String(value)
}
/** Nom de branche déjà vérifié par le schéma partagé ; jamais une option. */
const branch = (name: string): string => {
  if (name.startsWith('-') || /[\s~^:?*[\\]/.test(name) || name.includes('..')) {
    throw new Error(`branche refusée : ${name}`)
  }
  return name
}

export type PrState = 'open' | 'closed' | 'merged' | 'all'
export type IssueState = 'open' | 'closed' | 'all'

const PR_FIELDS = 'number,title,author,state,isDraft,headRefName,baseRefName,updatedAt,url'
const ISSUE_FIELDS = 'number,title,author,state,labels,updatedAt,url'

export const ghPrListArgs = (repo: string, state: PrState, limit: number): string[] => [
  'pr',
  'list',
  `--repo=${ownerRepo(repo)}`,
  `--state=${state}`,
  `--limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`,
  `--json=${PR_FIELDS}`
]
export const ghPrViewArgs = (repo: string, value: number): string[] => [
  'pr',
  'view',
  number(value),
  `--repo=${ownerRepo(repo)}`,
  `--json=${PR_FIELDS},body,files,createdAt`
]
export const ghPrDiffArgs = (repo: string, value: number): string[] => [
  'pr',
  'diff',
  number(value),
  `--repo=${ownerRepo(repo)}`,
  '--color=never'
]
export const ghPrCommentArgs = (repo: string, value: number): string[] => [
  'pr',
  'comment',
  number(value),
  `--repo=${ownerRepo(repo)}`,
  '--body-file=-'
]
export function ghPrCreateArgs(input: {
  readonly repo: string
  readonly base: string
  readonly head: string
  readonly title: string
  readonly draft: boolean
}): string[] {
  const title = oneLine(input.title, 256)
  if (title === '') throw new Error('titre de PR vide')
  return [
    'pr',
    'create',
    `--repo=${ownerRepo(input.repo)}`,
    `--base=${branch(input.base)}`,
    `--head=${input.head.split(':').map(branch).join(':')}`,
    `--title=${title}`,
    '--body-file=-',
    ...(input.draft ? ['--draft'] : [])
  ]
}
export function ghIssueListArgs(repo: string, state: IssueState, limit: number, search: string | null): string[] {
  const query = search === null ? '' : oneLine(search, 200)
  return [
    'issue',
    'list',
    `--repo=${ownerRepo(repo)}`,
    `--state=${state}`,
    `--limit=${Math.max(1, Math.min(1_000, Math.trunc(limit)))}`,
    `--json=${ISSUE_FIELDS}`,
    ...(query === '' ? [] : [`--search=${query}`])
  ]
}
export const ghIssueViewArgs = (repo: string, value: number): string[] => [
  'issue',
  'view',
  number(value),
  `--repo=${ownerRepo(repo)}`,
  `--json=${ISSUE_FIELDS},body,createdAt`
]
export function ghIssueCreateArgs(repo: string, title: string): string[] {
  const clean = oneLine(title, 256)
  if (clean === '') throw new Error('titre d’issue vide')
  return ['issue', 'create', `--repo=${ownerRepo(repo)}`, `--title=${clean}`, '--body-file=-']
}
/** Fork sur le compte connecté, sans clone ni remote ajouté par `gh` (git reste à l'app). */
export const ghRepoForkArgs = (repo: string): string[] => [
  'repo',
  'fork',
  ownerRepo(repo),
  '--clone=false',
  '--remote=false'
]

/** Sous-commandes permises (dernier garde-fou, comme `assertSafeArgs` pour git). */
const ALLOWED: readonly (readonly string[])[] = [
  ['api', 'user'],
  ['repo', 'view'],
  ['repo', 'create'],
  ['repo', 'fork'],
  ['pr', 'list'],
  ['pr', 'view'],
  ['pr', 'diff'],
  ['pr', 'comment'],
  ['pr', 'create'],
  ['issue', 'list'],
  ['issue', 'view'],
  ['issue', 'create']
]
const FORBIDDEN_FLAGS = new Set([
  '--source',
  '--push',
  '-s',
  '--web',
  '-w',
  '--approve',
  '--merge',
  '--admin',
  '--auto',
  '--delete-branch',
  '--edit-last',
  '--body',
  '-b',
  '--fill'
])

export function assertSafeGhArgs(args: readonly string[]): void {
  const [first, second] = args
  if (!ALLOWED.some(([a, b]) => a === first && b === second)) throw new Error(`gh ${first} ${second} interdit`)
  if (first === 'api' && args.join(' ') !== 'api user --jq .login') throw new Error('gh api interdit')
  for (const arg of args)
    if (FORBIDDEN_FLAGS.has(arg.split('=')[0] ?? arg)) throw new Error(`option gh interdite : ${arg}`)
  // `gh` ne clone jamais : seul `--clone=false` est permis (fork).
  if (args.some((arg) => arg.startsWith('--clone') && arg !== '--clone=false'))
    throw new Error('option gh interdite : --clone')
}
