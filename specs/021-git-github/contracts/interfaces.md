# Contracts — Git et GitHub (spec 021)

Format IPC uniforme `{ success, data } | { success: false, error: { code, message } }` ; entrées Zod
(`src/shared/ipc/git.ts`) validées dans le main (`defineRoute`), canaux ajoutés à `MAIN_WINDOW_CHANNELS` au fil des
gestionnaires ; canaux sans paramètre : `z.undefined()`. Le renderer ne transmet **jamais** de chemin absolu ni
d'adresse de dépôt GitHub : seulement `genesisId`, des chemins relatifs (`RelPath`), des numéros, des noms de branche.
Écritures : `confirm: true` + état attendu (research R5). Détail des commandes : `docs/brainstorm/L3-git-*.md`, écarts
dans `research.md`.

**Types communs** — `RelPath` : relatif, sans `..`, ni absolu, ni lecteur, ni caractère de contrôle, ≤ 400 car.,
revérifié par `realpath` dans le dépôt. `BranchName` : `^[A-Za-z0-9._/-]{1,100}$`, pas de `-` initial, pas
`analyste/`, + `git check-ref-format --branch`. `Hash` : `^[0-9a-f]{7,40}$`.
**Codes communs** : `NOT_FOUND`, `DIR_MISSING`, `GIT_MISSING`, `BUSY` (file d'écriture ou `index.lock`),
`RISKY_CONFIG` (research R3), `READ_ONLY_STATE` (HEAD détachée, rebase / cherry-pick en cours hors app),
`VALIDATION`, `NETWORK`, `TIMEOUT`, `AUTH_FAILED`.

## Dépôt local (US1)
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `git:status` | `{ genesisId }` | `GitStatusView` | `NOT_FOUND`, `DIR_MISSING`, `GIT_MISSING` |
| `git:diff` | `{ genesisId, path: RelPath, staged: boolean }` | `{ path, binary, truncated, hunks: { header, lines: { kind: 'add' \| 'del' \| 'ctx', oldNo?, newNo?, text }[] }[] }` | `NOT_FOUND`, `SENSITIVE_FILE` |
| `git:stage` | `{ genesisId, paths: RelPath[] ≤ 500 }` | `GitStatusView` | `SENSITIVE_FILE`, `BUSY` |
| `git:unstage` | `{ genesisId, paths: RelPath[] ≤ 500 }` | `GitStatusView` | `BUSY` |
| `git:proposeMessage` | `{ genesisId }` | `{ message, groups: { paths, message }[] ≤ 6, offFormat: boolean }` ; vide si « Local uniquement » | `NOTHING_STAGED`, `AI_UNAVAILABLE` |
| `git:commit` | `{ genesisId, message: 1..5 000, expectedStaged: RelPath[] ≤ 500, confirm: true }` | `{ hash, branch }` | `NOTHING_STAGED`, `STAGED_CHANGED`, `SENSITIVE_FILE`, `HOOK_FAILED` (+ `hookOutput` ≤ 8 000), `IDENTITY_MISSING`, `DETACHED_HEAD`, `MERGE_IN_PROGRESS` |
| `git:branches` | `{ genesisId }` | `{ current, detached, local: BranchView[], remote: BranchView[] }` | — |
| `git:createBranch` | `{ genesisId, name: BranchName }` | `GitStatusView` | `INVALID_NAME`, `NAME_TAKEN` |
| `git:switchBranch` | `{ genesisId, name: BranchName }` | `GitStatusView` | `DIRTY_TREE` (+ fichiers), `NOT_FOUND` |
| `git:log` | `{ genesisId, limit ≤ 50 }` | `{ commits: { hash, subject, date, authorKey, isMerge }[], authors: AuthorView[] }` | — |
| `git:revert` | `{ genesisId, hash: Hash, expectedHead, confirm: true }` | `{ hash }` | `MERGE_COMMIT`, `HEAD_CHANGED`, `DIRTY_TREE`, `CONFLICTS_ABORTED`, `HOOK_FAILED` |
| `git:changed` (événement) | — | `{ genesisId }` | — |

```ts
GitStatusView = {
  state: 'no_repo' | 'ok' | 'risky_config',        // risky_config : aucune autre commande lancée (research R3)
  branch: string | null, detached: boolean,
  upstream: { remote: string, branch: string } | null,
  ahead: number, behind: number, lastFetchAt: string | null,
  files: { path, origPath?, status: 'M' | 'A' | 'D' | 'R' | '?' | 'U', staged: boolean, sensitive: boolean }[],
  filesTotal: number,                                // liste bornée à 10 000
  // merge = fusion ouverte par l'app (session git_merge_sessions dont merge_head = MERGE_HEAD) ;
  // other = fusion lancée hors de l'app, rebase, cherry-pick, revert en cours… → volet en lecture seule
  operation: 'none' | 'merge' | 'other',
  onPrBranch: boolean,                               // HEAD sur pr/* : hooks coupés même en confiance (FR-005)
  trusted: boolean, riskyConfig: string[],
  github: { repo: string, isGitHub: true } | null, newSinceVisit: number
}
AuthorView = { key: string, name: string, email: string, initials: string, color: string } // renderer seulement
```

## Publier, tirer, pousser (US2)
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `git:ghStatus` | `undefined` | `{ installed: boolean, login: string \| null }` | — |
| `git:publishPreview` | `{ genesisId }` | `{ login, suggestedName, branch, commitsToPush, hasGitignore, findings: Finding[], blocked }` | `GH_MISSING`, `GH_NOT_LOGGED_IN`, `HAS_REMOTE`, `NOTHING_TO_PUSH` |
| `git:publish` | `{ genesisId, name, description? ≤ 350, visibility: 'private' \| 'public', confirm: true, confirmPublic?: true, expectedHead }` | `{ githubRepo, url }` | `NAME_INVALID`, `NAME_TAKEN`, `SENSITIVE_IN_HISTORY`, `HEAD_CHANGED`, `PUBLIC_NOT_CONFIRMED`, `PUSH_FAILED` |
| `git:addGitignore` | `{ genesisId }` | `GitStatusView` | `CONFLICT` |
| `git:fetch` | `{ genesisId }` | `GitStatusView` | `NO_REMOTE` |
| `git:pull` | `{ genesisId, confirm: true }` | `{ result: 'up_to_date' \| 'fast_forward' \| 'diverged', incoming: number }` | `DIRTY_TREE`, `NO_UPSTREAM`, `HISTORY_REWRITTEN` |
| `git:merge` | `{ genesisId, confirm: true, expectedUpstreamHead }` | `{ result: 'merged' \| 'conflicts', hash?, conflicted? }` (avant US4 : jamais `conflicts`) | `UPSTREAM_CHANGED`, `DIRTY_TREE`, `HOOK_FAILED`, `CONFLICTS_ABORTED` (avant US4) |
| `git:mergeAbort` | `{ genesisId, confirm: true }` | `GitStatusView` | `NO_MERGE` |
| `git:pushPreview` | `{ genesisId }` | `PushPreview` | `NO_REMOTE`, `DETACHED_HEAD` |
| `git:push` | `{ genesisId, confirm: true, expectedHead, expectedRemote, expectedBranch, acceptFindings?: string[] ≤ 50 }` | `{ pushed: number }` | `HEAD_CHANGED`, `NON_FAST_FORWARD`, `REJECTED`, `HOOK_FAILED`, `SENSITIVE_IN_HISTORY`, `THIRD_PARTY_DEFAULT_BRANCH`, `NO_WRITE_ACCESS` |

```ts
Finding = { id, kind: 'file_name' | 'private_key' | 'token_pattern', path: RelPath, commit: string,
            line?: number, excerpt?: string /* masqué */, reason: string, blocking: boolean }
PushPreview = { remote, remoteUrl /* sans identifiant */, githubRepo: string | null, branch, targetBranch,
  firstPush: boolean, commits: { hash, subject, date }[] /* ≤ 200 */, total: number, findings: Finding[],
  permission: 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none' | 'unknown',
  isDefaultBranch: boolean,
  ownedByViewer: boolean,   // D11 : dépôt à son compte OU permission admin / maintain
  blocked: null | 'SENSITIVE_IN_HISTORY' | 'THIRD_PARTY_DEFAULT_BRANCH' | 'NO_WRITE_ACCESS', checkedAt: string }
```
`acceptFindings` : seulement des `token_pattern` (non bloquants) ; un `file_name` ou `private_key` ne s'accepte jamais.

## Cloner, suivre (US3) — canaux de la spec 017 complétés
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `reprise:checkUrl` | `{ url: string ≤ 500 }` | `{ display, host, owner?, repo?, suggestedFolder }` (aucun lancement) | `URL_REFUSED` (+ raison) |
| `reprise:clone` | `{ url ≤ 500, folderName?: ^[A-Za-z0-9._-]{1,100}$ (ni `.` ni `..`), full?: boolean }` + sélecteur natif du parent dans le main | `{ cloneId }` ou `null` (sélecteur annulé) | `URL_REFUSED`, `GIT_MISSING`, `TARGET_EXISTS`, `TARGET_REFUSED`, `BUSY` |
| `reprise:cloneProgress` (événement) | — | `{ cloneId, phase: 'connexion' \| 'reception' \| 'resolution' \| 'extraction', percent?, receivedBytes? }` | — |
| `reprise:cloneLarge` (événement) | — | `{ cloneId, receivedBytes }` | — |
| `reprise:cloneContinue` | `{ cloneId }` | `{}` | `NOT_FOUND` |
| `reprise:cancelClone` | `{ cloneId }` | `{}` | `NOT_FOUND` |
| `reprise:cloneDone` / `reprise:cloneFailed` (événements) | — | `{ cloneId, previewId }` / `{ cloneId, code: AUTH_FAILED \| NOT_FOUND \| NETWORK \| CANCELLED \| TIMEOUT \| DISK_FULL \| INVALID_PATH \| FAILED }` | — |
| `git:updates` | `{ genesisId }` | `{ lastSeen: Hash \| null, commits: { hash, authorKey, date, subject, files: number }[] ≤ 500, authors: AuthorView[], nodes: { nodeKey, commits }[] }` | `NO_REMOTE` |
| `git:markSeen` | `{ genesisId, hash: Hash }` | `{}` | `NOT_FOUND` |

Après `reprise:cloneDone`, la suite est celle de la spec 017 (`reprise:create { previewId, confidentiality }`) ; le
main crée alors `git_repos` (`cloned = 1`, `last_seen_commit` = HEAD), sans `trusted_projects` ni registre du hub.

## Conflits (US4)
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `git:mergeState` | `{ genesisId }` | `MergeStateView` | `NO_MERGE` |
| `git:conflictFile` | `{ genesisId, path: RelPath }` | `ConflictFileView` | `FILE_TOO_LARGE` (choix entier seulement) |
| `git:conflictPropose` | `{ genesisId, path }` | `{ requestId }` puis `git:conflictProposed { requestId, path, ok, error? }` | `AI_UNAVAILABLE`, `LOCAL_ONLY`, `TOO_LARGE` |
| `git:conflictDecide` | `{ genesisId, path, hunkIndex, choice: 'ours' \| 'theirs' \| 'both' \| 'claude' \| 'manual', manualText? ≤ 200 000 }` | `ConflictFileView` | `STALE` |
| `git:conflictResolveFile` | `{ genesisId, path, expectedPreviewHash, confirm: true }` | `MergeStateView` | `UNDECIDED_HUNKS`, `MARKERS_LEFT`, `STALE` |
| `git:conflictWholeFile` | `{ genesisId, path, choice: 'ours' \| 'theirs' \| 'delete', confirm: true }` | `MergeStateView` | — |
| `git:mergeFinish` | `{ genesisId, message?: ≤ 5 000, confirm: true }` | `{ hash }` | `UNRESOLVED_FILES`, `HOOK_FAILED` |
| `git:mergeAbort` | (ci-dessus) | | |

`MergeStateView`, `ConflictFileView` : `docs/brainstorm/L3-git-conflits.md` §1 (+ `newLines` : lignes de la
proposition absentes des deux versions, surlignées icône + texte).

## Historique (US5)
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `git:history` | `{ genesisId, before?: Hash, limit ≤ 5 000 }` | `{ commits: { hash, authorKey, date, subject, files: RelPath[] ≤ 200 }[], authors: AuthorView[], more, weight: 'lines' \| 'commits' }` | — |
| `git:fetchAll` | `{ genesisId, confirm: true }` (« Tout télécharger » d'un clone partiel, research R13) | `{ weight: 'lines' }` | `NOT_PARTIAL`, `GIT_TOO_OLD` |
| `git:replay` | `{ genesisId, at: Hash, level: 1..4, parentKey? }` | `{ nodes: { nodeKey, mainAuthor: string \| null, shares: { authorKey, percent }[] ≤ 5 }[], weight }` | `NOT_ANALYZED` (rediffusion sur dossiers) |
| `git:mergeAuthors` | `{ genesisId, mainKey, aliasKeys: string[] ≤ 20 }` | `{ batchId }` | `VALIDATION` |
| `git:unmergeAuthor` | `{ genesisId, aliasKey }` | `{ batchId }` | `NOT_FOUND` |
| `git:story` | `{ genesisId, from: Hash, to: Hash }` | `{ text }` (alias remplacés par les vrais noms dans le renderer) | `AI_UNAVAILABLE`, `LOCAL_ONLY` |

## PR, issues, fork (US6) — GitHub seulement (`NOT_GITHUB` sinon), `GH_MISSING`, `GH_NOT_LOGGED_IN`
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `git:prList` | `{ genesisId, state: 'open' \| 'closed' \| 'merged' \| 'all' }` | `{ items: PrView[] ≤ 50, more }` | — |
| `git:prView` | `{ genesisId, number }` | `PrDetailView` (corps ≤ 20 000, fichiers ≤ 300, diff ≤ 2 Mo) | `NOT_FOUND` |
| `git:prReview` | `{ genesisId, number }` | `{ summary, comments: { path?, line?, text }[] ≤ 30 }` (dans l'app) | `AI_UNAVAILABLE`, `LOCAL_ONLY` |
| `git:prComment` | `{ genesisId, number, body: 1..20 000, confirm: true }` | `{ url }` | — |
| `git:prPropose` | `{ genesisId, base: BranchName }` | `{ title, body }` | `AI_UNAVAILABLE`, `NOTHING_TO_COMPARE` |
| `git:prCreate` | `{ genesisId, base, title ≤ 256, body ≤ 20 000, draft, confirm: true, expectedHead }` | `{ number, url }` | `BRANCH_NOT_PUSHED`, `PR_EXISTS`, `NO_WRITE_ACCESS`, `HEAD_CHANGED` |
| `git:prFetchBranch` | `{ genesisId, number }` | `{ branch: 'pr/<n>' }` | `NAME_TAKEN` |
| `git:issueList` | `{ genesisId, state, search? ≤ 200, page ≥ 1 }` | `{ items: IssueView[] ≤ 100, more }` | — |
| `git:issueView` | `{ genesisId, number }` | `IssueDetailView` | `NOT_FOUND` |
| `git:issuePropose` | `{ genesisId, neuronId }` | `{ title, body }` | `AI_UNAVAILABLE` |
| `git:issueCreate` | `{ genesisId, title ≤ 256, body ≤ 20 000, fromNeuronId?, confirm: true }` | `{ number, url }` | `NO_WRITE_ACCESS` |
| `git:issueLink` / `git:issueUnlink` | `{ genesisId, kind: 'issue' \| 'pr', number, neuronId }` | `{ linkId, batchId }` / `{ batchId }` | `NOT_FOUND` |
| `git:forkPreview` | `{ genesisId }` | `{ source, target, alreadyForked }` | `OWN_REPO` |
| `git:fork` | `{ genesisId, confirm: true }` | `{ fork }` | `FORK_EXISTS` (réutilisé) |
| `git:openExternal` | `{ url ≤ 2 000 }` | `{}` | `URL_REFUSED` (hors `https://github.com/…`) |

`PrView`, `IssueView`, `PrDetailView`, `IssueDetailView` : `docs/brainstorm/L3-git-pr-issues.md` §1 ; sorties de `gh`
validées par Zod strict (valeurs inconnues → `null`), chaînes bornées.

## Extraire (US7)
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `git:extractPreview` | `{ genesisId, path: RelPath, lines?: { from, to } }` | `{ origin, commit, license: { spdx: string \| null, verdict: 'permise' \| 'reciprocite' \| 'inconnue', summary }, header, destinations: { root: 'snippets' \| 'techno', folders: string[] }, studyNoteOnly }` | `NO_WORKSPACE`, `BINARY`, `TOO_LARGE` (> 200 Ko), `SENSITIVE_FILE` |
| `git:extract` | `{ genesisId, path, lines?, root: 'snippets' \| 'techno', folder: ^[a-z0-9-]{1,40}$, fileName: ^[A-Za-z0-9._-]{1,100}$, mode: 'copy' \| 'study_note', confirm: true }` | `{ written: string /* relatif au workspace */ }` | `NAME_TAKEN`, `LICENSE_FORBIDS_COPY`, `DESTINATION_REFUSED` |

## Tâches AIGateway (sans outil, `claude -p`) — aucune pour un projet « Local uniquement »
| Tâche | Entrée balisée (données) | Sortie Zod |
|---|---|---|
| `git_message` | fichiers préparés, diff préparé ≤ 40 000 (sensibles exclus), 10 derniers sujets, scope | `{ message ≤ 5 000, groups: { paths[] ≤ 500, message }[] ≤ 6 }` |
| `git_conflict` | chemin, langage, blocs `base/ours/theirs` + 15 lignes de contexte, ≤ 5 messages par côté (auteurs « Auteur A »), ≤ 200 Ko, ≤ 30 blocs | `{ hunks: { index, explanation ≤ 600, risk ≤ 300, confidence, text ≤ 100 000 }[] }` |
| `git_story` | messages de commit, fichiers touchés, alias d'auteurs, dates | `{ text ≤ 4 000 }` |
| `git_pr_text` | sujets des commits, fichiers, diff ≤ 40 000, modèle de PR du dépôt ≤ 5 000 | `{ title ≤ 256, body ≤ 20 000 }` |
| `git_pr_review` | titre, corps, diff ≤ 40 000 de la PR (auteurs pseudonymisés) | `{ summary ≤ 2 000, comments: { path?, line?, text ≤ 2 000 }[] ≤ 30 }` |
| `git_issue_text` | titre et contenu du nœud | `{ title ≤ 256, body ≤ 20 000 }` |

## Commandes externes (construites seulement par `src/main/domain/git/args.ts` et `ghArgs.ts`)
- **git** (préfixe research R2 ; hooks selon la confiance) : `status --porcelain=v2 --branch -z --untracked-files=all` ·
  `config --local --list --name-only -z` · `diff [--cached] --no-ext-diff --no-textconv -U3 -- <path>` ·
  `add -- <paths>` · `restore --staged -- <paths>` · `diff --cached --name-only -z` · `commit -F -` ·
  `branch --list|-r --format=…` · `check-ref-format --branch <nom>` · `switch [-c] <nom>` · `revert --no-edit <hash>` ·
  `revert --abort` · `fetch --no-recurse-submodules -- <remote>` ·
  `config --local --unset remote.<r>.partialclonefilter` + `fetch --refetch --no-recurse-submodules -- <r>`
  (fetchAll) · `merge --ff-only <amont>` ·
  `merge --no-ff --no-edit <amont>` · `merge --abort` · `rev-list …` · `log … -z --name-only|--numstat --no-renames` ·
  `grep -I -n -E -e <motif>… <commit> -- <fichiers>` · `push --porcelain [-u] -- <remote>
  refs/heads/<b>:refs/heads/<b>` · `remote add|rename …` · `show :1:|:2:|:3:<path>` · `checkout --ours|--theirs --
  <path>` · `rm -- <path>` · `clone --no-recurse-submodules --progress <profil> -- <url> <cible>` ·
  `fetch … -- <remote> pull/<n>/head:refs/heads/pr/<n>`.
- **Jamais** (test sur tous les constructeurs) : research R11.
- **gh** : research R9 ; jamais `auth token`, `auth login`, `auth status`, `extension`, `alias`, `pr checkout`,
  `pr merge`, `pr review`, `pr close`, `issue close`, `api` hors `user`.
