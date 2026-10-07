# Niveau 3 — Conception Technique : GIT-A — Volet « Dépôt » local (socle git commun)
> Basé sur : L1i-git-github.md + L2-git-depot-local.md · Réutilise : `GitCli.ts` (spec 016 : `resolveGit`, `runGit`),
> `projectPath.ts` (`isSecretFileName`), `fileFilter.ts` (fichiers sensibles, spec 017), `trusted_projects` (spec 014),
> `AIGateway` · Date : 2026-10-07

Ce document pose aussi le **socle** que B, C, E et F réutilisent : profil d'arguments sûrs, verrou par dépôt,
lecture d'état, codes d'erreur.

## 1. Contrat IPC (`git:*`, schémas Zod dans `shared/ipc/git.ts`)
Format uniforme : `{ success: true, data } | { success: false, error: { code, message } }`. Toute entrée porte
`genesisId` (identifiant, jamais un chemin) : le main retrouve le dossier lié et le revérifie (`realpath`, existe,
n'est pas le dossier de données).

| Canal | Entrée | Sortie (`data`) | Erreurs |
|-------|--------|-----------------|---------|
| `git:status` | `{ genesisId }` | `GitStatusView` (ci-dessous) | `NOT_FOUND`, `DIR_MISSING`, `GIT_MISSING` |
| `git:diff` | `{ genesisId, path: RelPath, staged: boolean }` | `{ path, binary, truncated, hunks: { header, lines: { kind (ajout / retrait / contexte), oldNo?, newNo?, text }[] }[] }` | `NOT_FOUND`, `VALIDATION` |
| `git:stage` | `{ genesisId, paths: RelPath[] ≤ 500 }` | `GitStatusView` | `SENSITIVE_FILE`, `BUSY`, `VALIDATION` |
| `git:unstage` | `{ genesisId, paths: RelPath[] ≤ 500 }` | `GitStatusView` | `BUSY` |
| `git:proposeMessage` | `{ genesisId }` | `{ message, groups: { paths: RelPath[], message }[] }` | `NOTHING_STAGED`, `AI_UNAVAILABLE` |
| `git:commit` | `{ genesisId, message: string 1..5 000, expectedStaged: RelPath[] ≤ 500, confirm: true }` | `{ hash (court), branch }` | `NOTHING_STAGED`, `STAGED_CHANGED`, `SENSITIVE_FILE`, `HOOK_FAILED`, `IDENTITY_MISSING`, `BUSY`, `MERGE_IN_PROGRESS` |
| `git:restoreFile` | `{ genesisId, path: RelPath, confirm: true }` | `{ trashId }` | `NOT_FOUND`, `BUSY` |
| `git:branches` | `{ genesisId }` | `{ current, detached, local: BranchView[], remote: BranchView[] }` | — |
| `git:createBranch` | `{ genesisId, name: string ≤ 100 }` | `GitStatusView` | `INVALID_NAME`, `NAME_TAKEN`, `BUSY` |
| `git:switchBranch` | `{ genesisId, name }` | `GitStatusView` | `DIRTY_TREE`, `READ_ONLY_BRANCH`, `NOT_FOUND`, `BUSY` |
| `git:history` (lot D) | `{ genesisId, before?: hash, limit ≤ 5 000 }` | `{ commits: { hash, authorKey, date, subject, files: RelPath[] }[], authors: { key, name, email, initials }[], more }` | — |
| `git:changed` (événement) | — | `{ genesisId }` | — |

```ts
GitStatusView = {
  state: 'no_repo' | 'ok',
  branch: string | null, detached: boolean,
  upstream: { remote: string, branch: string } | null,
  ahead: number, behind: number, lastFetchAt: string | null,     // behind = valeur du dernier fetch (lot B)
  files: { path, origPath?, status: 'M' | 'A' | 'D' | 'R' | '?' | 'U', staged: boolean, sensitive: boolean }[],
  operation: 'none' | 'merge',                                   // lot E
  trusted: boolean,                                              // hooks exécutés ou non
  riskyConfig: string[]                                          // clés de configuration locale à risque (§2)
}
```
- `RelPath` : relatif au dépôt, sans `..`, ni absolu, ni lecteur, ni caractère de contrôle, ≤ 400 caractères ; le main
  revérifie qu'il est dans le dossier (`realpath`).
- `expectedStaged` : la liste vue par mentalyas ; si l'index réel diffère au moment du commit → `STAGED_CHANGED` (un
  autre outil a préparé des fichiers entre-temps) : on ne commite jamais autre chose que ce qui a été montré.
- `git:history` : `name` et `email` ne sortent que vers le renderer de l'app (affichage) ; ils ne sont ni journalisés
  ni transmis à une tâche d'IA (les tâches reçoivent `authorKey` → « Auteur A »).

## 2. Socle : `GitRunner` (évolution de `GitCli.runGit`)
- **Évolutions nécessaires** de `runGit` (aujourd'hui : sortie limitée à 4 000 caractères, `stdin` ignoré, pas
  d'annulation) : options `{ timeoutMs, maxOutput (≤ 8 Mo pour diff et log), stdin?: string, signal?: AbortSignal,
  onProgress?: (line) => void }`. Les messages de commit passent par **stdin** (`commit -F -`), jamais en argument.
- **Arguments communs** (préfixe, construit par le main) :
  `-c core.quotepath=off -c color.ui=never -c core.pager=cat -c core.fsmonitor=false` ; jamais d'éditeur
  ouvert (`commit -F -`, `merge --no-edit`) ;
  diff / log / show : `--no-ext-diff --no-textconv` ; sorties machine : `--porcelain=v2 -z`, `-z` partout où il existe.
- **Dépôt non de confiance** (absent de `trusted_projects`, toujours le cas d'un clone) : en plus
  `-c core.hooksPath=<profil>/git-empty-hooks` (dossier vide créé par l'app) ; écritures refusées si `riskyConfig`
  n'est pas vide.
- **Configuration locale à risque** (lue par `git config --local --name-only --list`, lecture sans effet) : clés
  `core.sshCommand`, `core.hooksPath`, `core.fsmonitor`, `core.editor`, `core.pager`, `credential.helper`,
  `include.path`, `includeIf.*`, `filter.*`, `diff.*.command`, `diff.*.textconv`, `merge.*.driver`, `gpg.program`,
  `sequence.editor`, `uploadpack.*` → listées dans `riskyConfig` ; dépôt non de confiance : écriture refusée
  (`RISKY_CONFIG`) avec la liste ; dépôt de confiance : simple avertissement.
- **Environnement** : `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, `GIT_OPTIONAL_LOCKS=0` pour les lectures (un `status` ne
  prend pas le verrou de l'index), `GCM_INTERACTIVE` laissé tel quel (la fenêtre d'identifiants Windows reste possible
  au push, comme en terminal).
- **Verrou** : une file d'écriture par dépôt dans le main (`GitWriteQueue`) ; `index.lock` présent → `BUSY` (jamais
  supprimé par l'app).
- **Arguments utilisateur** (chemins, noms de branche) : toujours après `--` ; noms de branche vérifiés par
  `git check-ref-format --branch <nom>` **et** une règle pure (`^[A-Za-z0-9._/-]{1,100}$`, ne commence pas par `-`,
  ni `analyste/`).

## 3. Commandes par opération
| Opération | Commande(s) |
|-----------|-------------|
| État | `status --porcelain=v2 --branch -z --untracked-files=all` (+ lecture de `.git/MERGE_HEAD`) |
| Diff | `diff [--cached] --no-ext-diff --no-textconv -U3 -- <path>` (fichier non suivi : lecture directe, bornée) |
| Préparer | `add -- <paths…>` (après refus des sensibles : `isSecretFileName` + règles de `fileFilter.ts`) |
| Retirer | `restore --staged -- <paths…>` |
| Commit | vérif. `diff --cached --name-only -z` = `expectedStaged` → `commit -F -` (stdin) ; jamais `-a`, `--amend`, `--no-verify` |
| Rétablir | copie du fichier vers la corbeille de l'app, puis `restore --worktree -- <path>` |
| Branches | `branch --list --format=…`, `branch -r --format=…`, `switch -c <nom>` (nom vérifié), `switch <nom>` |

Note : `git switch` n'accepte pas `--` avant le nom ; la sûreté vient de la vérification du nom (règle pure +
`check-ref-format`), qui interdit le `-` initial.

## 4. Tâche d'IA `git_message`
- Passe par l'`AIGateway` (constitution III), `claude -p` **sans outil** ; projet « Local uniquement » → routage local
  (Ollama) ou `AI_UNAVAILABLE`.
- Entrée (données balisées) : liste des fichiers préparés, diff préparé (≤ 40 000 caractères, fichiers sensibles
  exclus, binaires résumés en une ligne), 10 derniers sujets de commit (pour imiter le style), scope suggéré (slug).
- Sortie Zod : `{ message: string ≤ 5 000, groups: { paths: string[] ≤ 500, message }[] ≤ 6 }` ; message vérifié :
  première ligne `^(feat|fix|refactor|chore|docs|test|security|perf)(\([a-z0-9-]+\))?: .{1,100}$` (sinon gardée mais
  signalée « hors format ») ; toute ligne `Co-Authored-By:` retirée ; `paths` ⊆ fichiers préparés.
- Journal : tâche, durée, statut, modèle — jamais le diff ni le message (constitution IV).

## 5. Données (migration « git » — numéro fixé au moment de coder, après 0033 de la spec 020)
| Table | Colonnes | Contraintes | Index |
|-------|----------|-------------|-------|
| `git_repos` | `genesis_id` text PK → `neurons.id` · `default_remote` text null · `remote_url` text null (**sans identifiant**) · `github_repo` text null (`owner/name`) · `upstream_repo` text null (fork, lot F) · `last_fetch_at` text null · `last_seen_commit` text null (lot C) · `sensitive_checked_head` text null (lot B) · `created_at`, `updated_at` | une ligne par genesis lié à un dépôt | PK |
| `git_operations` | `id` text PK · `genesis_id` → `neurons.id` · `kind` (`commit`, `branch_create`, `branch_switch`, `restore`, `fetch`, `pull`, `merge`, `merge_abort`, `push`, `repo_create`, `clone`, `fork`, `pr_create`, `issue_create`) · `status` (`ok`, `failed`, `cancelled`) · `error_code` null · `commit_hash` null (court) · `branch` null · `remote` null · `count` int null · `started_at`, `finished_at` | pas de message, pas de chemin complet, pas d'auteur | `(genesis_id, started_at)` |
| `git_author_aliases` (lot D) | `id` PK · `genesis_id` → `neurons.id` · `alias_key` · `main_key` · `created_at` | `UNIQUE(genesis_id, alias_key)` | — |

`down` écrit à la main (`migrations/down/<nom>.down.sql`) : `DROP TABLE` des trois tables, dans l'ordre inverse.
`git_operations` alimente l'Historique de l'app (libellés « Commit `a1b2c3d` sur `main` », « Poussé 3 commits vers
`origin/main` »).

## 6. Diagramme de séquence (commit)
```mermaid
sequenceDiagram
    actor U as mentalyas
    participant R as Renderer (volet Dépôt)
    participant M as Main (GitService)
    participant G as git (GitRunner)
    participant AI as AIGateway (git_message)
    U->>R: coche 2 fichiers
    R->>M: git:stage { paths }
    M->>M: refus des sensibles, RelPath, realpath
    M->>G: add -- a.ts b.ts
    U->>R: Proposer un message
    R->>M: git:proposeMessage
    M->>G: diff --cached (borné)
    M->>AI: données balisées
    AI-->>M: { message, groups } (Zod)
    M-->>R: message sans Co-Authored-By
    U->>R: corrige, clic Commiter
    R->>M: git:commit { message, expectedStaged, confirm }
    M->>G: diff --cached --name-only = expectedStaged ?
    M->>G: commit -F - (stdin) — hooks selon confiance
    G-->>M: hash ou sortie du hook
    M->>M: git_operations ; événement git:changed
    M-->>R: { hash } ou HOOK_FAILED (+ sortie)
```

## 7. Cas limites techniques
- **Concurrence :** Claude (conversation, spec 014) ou le terminal peuvent lancer git en même temps → `index.lock` →
  `BUSY` ; `expectedStaged` détecte un index changé ; lecture d'état sans verrou (`GIT_OPTIONAL_LOCKS=0`).
- **Idempotence :** `git:stage` / `unstage` rejouables ; `git:commit` rejoué après succès → `NOTHING_STAGED`.
- **Transactions :** le commit est atomique côté git ; la ligne `git_operations` est écrite après le résultat ;
  « Rétablir » copie dans la corbeille **avant** de restaurer (échec de copie → rien n'est restauré).
- **Volumétrie :** 10 000 fichiers modifiés → liste virtualisée, `status` en une commande ; diff borné à 8 Mo,
  `truncated: true` au-delà ; fichiers non suivis lus ≤ 1 Mo.
- **Encodage :** chemins en UTF-8 (`core.quotepath=off`, `-z`) ; fins de ligne laissées à git.
- **HEAD détaché** (après un checkout de commit en terminal) : commit refusé (`DETACHED_HEAD`) avec « crée une branche
  ici » proposé.

## 8. Sécurité spécifique
| Risque | Vecteur | Mitigation |
|--------|---------|------------|
| Exécution de code à la lecture | `core.fsmonitor`, `diff.external`, textconv dans la config d'un dépôt importé | `-c core.fsmonitor=false`, `--no-ext-diff --no-textconv`, `riskyConfig` bloquant hors confiance |
| Hooks d'un dépôt tiers | `.git/hooks`, `core.hooksPath` | `core.hooksPath` vide hors confiance ; jamais `--no-verify` ailleurs |
| Secret commité | `.env`, clés | `isSecretFileName` + règles spec 017 ; refus de préparer, `SENSITIVE_FILE` |
| Commit d'autre chose que ce qui est montré | Index modifié entre-temps | `expectedStaged` vérifié juste avant |
| Injection d'arguments | Chemin ou nom commençant par `-` | `--` avant les chemins, règle de nom, `check-ref-format` |
| Remontée de dossier | `../` dans un chemin | `RelPath` + `realpath` dans le dépôt |
| Fuite de PII | Noms / e-mails d'auteurs | Jamais journalisés ni envoyés à une tâche d'IA (pseudonymes) |
| Message piégé dans le diff | Texte « ignore tes consignes » dans un fichier | Diff balisé comme donnée, tâche sans outil, sortie validée |
