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

/** Sous-commandes permises (dernier garde-fou, comme `assertSafeArgs` pour git). */
const ALLOWED: readonly (readonly string[])[] = [
  ['api', 'user'],
  ['repo', 'view'],
  ['repo', 'create']
]
const FORBIDDEN_FLAGS = new Set(['--source', '--push', '--clone', '-s', '--web'])

export function assertSafeGhArgs(args: readonly string[]): void {
  const [first, second] = args
  if (!ALLOWED.some(([a, b]) => a === first && b === second)) throw new Error(`gh ${first} ${second} interdit`)
  if (first === 'api' && args.join(' ') !== 'api user --jq .login') throw new Error('gh api interdit')
  for (const arg of args)
    if (FORBIDDEN_FLAGS.has(arg.split('=')[0] ?? arg)) throw new Error(`option gh interdite : ${arg}`)
}
