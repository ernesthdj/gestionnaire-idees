/**
 * Seul constructeur d'arguments git de l'app (spec 021, research R2 et R11). Chaque commande commence par le préfixe
 * sûr ; les chemins viennent toujours après `--` ; les noms de branche et empreintes sont déjà vérifiés par les schémas
 * partagés (`BranchName`, `Hash`), et `assertSafeArgs` refuse en dernier recours tout argument interdit. Pur.
 */

/** Préfixe commun (R2) : `-c` en ligne de commande prime sur toute configuration du dépôt. */
const BASE_PREFIX = [
  '-c',
  'core.quotepath=off',
  '-c',
  'color.ui=never',
  '-c',
  'core.pager=cat',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.editor=false',
  '-c',
  'protocol.allow=never',
  '-c',
  'protocol.https.allow=always',
  '-c',
  'protocol.ssh.allow=always'
] as const

export interface PrefixOptions {
  /** Dépôt de confiance (`trusted_projects`, spec 014) : ses hooks s'exécutent, jamais contournés. */
  readonly trusted: boolean
  /** HEAD sur une branche `pr/*` : hooks coupés même en confiance (FR-005, analyse H2). */
  readonly onPrBranch: boolean
  /** Dossier vide créé par l'app (`<profil>/git-empty-hooks`). */
  readonly emptyHooksDir: string
}

export function gitPrefix(options: PrefixOptions): string[] {
  const hooksOff = !options.trusted || options.onPrBranch
  return [...BASE_PREFIX, ...(hooksOff ? ['-c', `core.hooksPath=${options.emptyHooksDir}`] : [])]
}

/** Options qui ne doivent jamais apparaître (R11, SC-002). */
const FORBIDDEN_TOKENS = new Set([
  '--force',
  '--force-with-lease',
  '--force-if-includes',
  '--mirror',
  '--all',
  '--delete',
  '--prune',
  '--tags',
  '--no-verify',
  '--amend',
  '-A',
  '-a',
  '.'
])
/** Sous-commandes interdites (réécriture d'historique, effacement). */
const FORBIDDEN_COMMANDS = new Set(['rebase', 'reset', 'clean', 'gc', 'filter-branch', 'update-ref', 'reflog'])

/**
 * Dernier garde-fou (R11) : lève une erreur si un argument interdit apparaît dans la commande (hors préfixe). Ce sont
 * des erreurs de programmation de l'app, jamais des entrées de mentalyas : elles ne doivent pas arriver en production.
 */
export function assertSafeArgs(args: readonly string[]): void {
  const separator = args.indexOf('--')
  const options = separator < 0 ? args : args.slice(0, separator)
  const command = options.find((arg, index) => !arg.startsWith('-') && options[index - 1] !== '-c')
  if (command !== undefined && FORBIDDEN_COMMANDS.has(command)) throw new Error(`git ${command} interdit`)
  for (const arg of options) {
    if (FORBIDDEN_TOKENS.has(arg)) throw new Error(`argument git interdit : ${arg}`)
    if (command === 'push' && (arg === '-f' || arg.startsWith('+') || arg.startsWith(':'))) {
      throw new Error(`push interdit : ${arg}`)
    }
    if (command === 'commit' && (arg === '-n' || arg === '--all')) throw new Error(`commit interdit : ${arg}`)
  }
}

const withPaths = (args: readonly string[], paths: readonly string[]): string[] => [...args, '--', ...paths]

/** État du dépôt (machine, `-z`), fichiers non suivis détaillés. */
export const statusArgs = (): string[] => ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all']

/** Diff d'un fichier suivi, préparé ou non, sans programme externe ni conversion de texte. */
export const diffArgs = (path: string, staged: boolean): string[] =>
  withPaths(['diff', '--no-ext-diff', '--no-textconv', '--no-color', ...(staged ? ['--cached'] : [])], [path])

/** Derniers commits : empreinte, parents, auteur, e-mail, date ISO, sujet, séparés par 0x1f, commits par NUL. */
export const logArgs = (limit: number): string[] => [
  'log',
  `-n${Math.max(1, Math.min(5_000, Math.trunc(limit)))}`,
  '-z',
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s'
]

/** Branches locales et distantes avec leur suivi. */
export const branchesArgs = (): string[] => [
  'for-each-ref',
  '--format=%(refname)%1f%(upstream:short)%1f%(upstream:track,nobracket)%1f%(HEAD)',
  'refs/heads',
  'refs/remotes'
]

/** Ajout NOMMÉ (jamais `add -A`, `add .`). */
export const stageArgs = (paths: readonly string[]): string[] => withPaths(['add'], paths)

/** Retrait de l'index ; sur une branche sans commit, `rm --cached` (il n'y a pas encore de HEAD). */
export const unstageArgs = (paths: readonly string[], unborn: boolean): string[] =>
  withPaths(unborn ? ['rm', '--cached', '-q'] : ['restore', '--staged'], paths)

/** Commit du seul contenu préparé, message lu sur stdin (constitution I : jamais en argument). */
/** Diff de tout ce qui est préparé, limité aux fichiers donnés (les sensibles sont écartés par l'appelant). */
export const stagedDiffArgs = (paths: readonly string[]): string[] =>
  withPaths(['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color'], paths)

/** Derniers sujets de commit (style du dépôt). */
export const subjectsArgs = (limit: number): string[] => [
  'log',
  `-n${Math.max(1, Math.min(50, Math.trunc(limit)))}`,
  '--no-color',
  '--format=%s'
]

export const commitArgs = (): string[] => ['commit', '-F', '-', '--cleanup=strip']

/** Vérification d'un nom de branche par git lui-même. */
export const checkRefFormatArgs = (name: string): string[] => ['check-ref-format', '--branch', name]

/** La branche locale existe-t-elle ? (code 0 : oui). */
export const branchExistsArgs = (name: string): string[] => ['rev-parse', '--verify', '-q', `refs/heads/${name}`]
export const createBranchArgs = (name: string): string[] => ['switch', '-c', name]
export const switchBranchArgs = (name: string): string[] => ['switch', name]

export const revertArgs = (hash: string): string[] => ['revert', '--no-edit', hash]
export const revertAbortArgs = (): string[] => ['revert', '--abort']

/** Clés de la configuration LOCALE (sans suivre les `include`, research R3). */
export const localConfigNamesArgs = (): string[] => ['config', '--local', '--list', '--name-only', '-z']

export const headArgs = (): string[] => ['rev-parse', '--verify', '-q', 'HEAD']
/** Parents d'un commit (un commit de fusion en a plusieurs). */
export const parentsArgs = (hash: string): string[] => ['rev-list', '--parents', '-n', '1', hash]
/** Dossier `.git` réel (worktrees, sous-modules). */
export const gitDirArgs = (): string[] => ['rev-parse', '--absolute-git-dir']
