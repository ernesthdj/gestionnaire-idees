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

// ── Publier, tirer, pousser (US2, research R9–R11) ─────────────────────────────────────────────────────────────────

/** Nom de remote ou de branche venu de git lui-même, revérifié avant de l'employer comme argument. */
const REF_NAME = /^[A-Za-z0-9._/-]{1,200}$/
export function safeRef(name: string): string {
  if (!REF_NAME.test(name) || name.startsWith('-') || name.includes('..') || name.endsWith('.lock')) {
    throw new Error(`nom de référence refusé : ${name}`)
  }
  return name
}

/** Remotes du dépôt. */
export const remotesArgs = (): string[] => ['remote']
/** Adresse d'un remote (affichée sans identifiant par l'appelant). */
export const remoteUrlArgs = (remote: string): string[] => ['remote', 'get-url', safeRef(remote)]
/** Ajout du remote `origin` après publication (l'adresse vient de `gh`, contrôlée par `checkGitUrl`). */
export const remoteAddArgs = (url: string): string[] => {
  if (url.startsWith('-')) throw new Error('adresse de remote refusée')
  return ['remote', 'add', 'origin', url]
}

/** Vérifier le distant : sans étiquettes ni sous-modules (jamais `--prune`, `--tags`, `--all`). */
export const fetchArgs = (remote: string): string[] => [
  'fetch',
  '--no-tags',
  '--no-recurse-submodules',
  '--quiet',
  safeRef(remote)
]

/** Commits d'une plage (`a..b`). */
export const countArgs = (range: string): string[] => ['rev-list', '--count', range]
/** `b` contient-il `a` ? (code 0 : oui). */
export const isAncestorArgs = (ancestor: string, descendant: string): string[] => [
  'merge-base',
  '--is-ancestor',
  ancestor,
  descendant
]
/** Empreinte d'une référence (`refs/remotes/origin/main`…). */
export const refHeadArgs = (ref: string): string[] => ['rev-parse', '--verify', '-q', safeRef(ref)]

/** Tirer sans fusion : avance rapide seulement. */
export const pullFfArgs = (upstream: string): string[] => ['merge', '--ff-only', '--no-edit', safeRef(upstream)]
/** Fusion des deux historiques (après confirmation), sur une empreinte vérifiée. */
export const mergeArgs = (hash: string): string[] => ['merge', '--no-ff', '--no-edit', hash]
export const mergeAbortArgs = (): string[] => ['merge', '--abort']

/**
 * Commits à pousser : `branch` non encore sur le remote. Premier push : tout ce qu'aucune branche du remote ne contient
 * (`--not --remotes=<remote>`).
 */
export const outgoingArgs = (branch: string, remote: string, upstream: string | null, limit: number): string[] => [
  'log',
  `-n${Math.max(1, Math.min(5_000, Math.trunc(limit)))}`,
  '-z',
  '--no-color',
  '--format=%H%x1f%aI%x1f%s',
  ...outgoingRange(branch, remote, upstream)
]
export const outgoingCountArgs = (branch: string, remote: string, upstream: string | null): string[] => [
  'rev-list',
  '--count',
  ...outgoingRange(branch, remote, upstream)
]
const outgoingRange = (branch: string, remote: string, upstream: string | null): string[] =>
  upstream === null
    ? [`refs/heads/${safeRef(branch)}`, '--not', `--remotes=${safeRef(remote)}`]
    : [`${safeRef(upstream)}..refs/heads/${safeRef(branch)}`]

/** Noms des fichiers ajoutés ou modifiés par chaque commit de la plage à pousser (research R10). */
export const outgoingNamesArgs = (branch: string, remote: string, upstream: string | null): string[] => [
  'log',
  '-z',
  '--no-color',
  '--format=%x00%H',
  '--name-only',
  '--no-renames',
  '--diff-filter=AMR',
  ...outgoingRange(branch, remote, upstream)
]

/** Contenu brut d'un fichier à un commit (aucun filtre ni conversion). */
export const blobArgs = (commit: string, path: string): string[] => {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('empreinte refusée')
  return ['cat-file', 'blob', `${commit}:${path}`]
}

/** Push d'UNE branche vers UNE branche (refspec unique, jamais `+`, jamais `:`). */
export const pushArgs = (remote: string, branch: string, target: string, setUpstream: boolean): string[] => [
  'push',
  '--porcelain',
  ...(setUpstream ? ['--set-upstream'] : []),
  safeRef(remote),
  `refs/heads/${safeRef(branch)}:refs/heads/${safeRef(target)}`
]

/** Commits d'une plage `a..b` (format de `logArgs`), bornés. */
export const rangeLogArgs = (from: string, to: string, limit: number): string[] => {
  if (!/^[0-9a-f]{7,40}$/.test(from)) throw new Error('empreinte refusée')
  return [
    'log',
    `-n${Math.max(1, Math.min(500, Math.trunc(limit)))}`,
    '-z',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s',
    `${from}..${safeRef(to)}`
  ]
}
