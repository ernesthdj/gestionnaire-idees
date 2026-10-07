# Niveau 3 — Conception Technique : GIT-F — Pull requests, issues et fork
> Basé sur : L1i-git-github.md (D3, D4, D7) + L2-git-pr-issues.md + L3-git-publier.md (`GhRunner`, liste blanche) +
> L3-git-depot-local.md (socle) · Date : 2026-10-07

## 1. Contrat IPC
| Canal | Entrée | Sortie (`data`) | Erreurs |
|-------|--------|-----------------|---------|
| `git:prList` | `{ genesisId, state: 'open' \| 'closed' \| 'merged' \| 'all' }` | `{ items: PrView[] ≤ 50, more }` | `GH_MISSING`, `GH_NOT_LOGGED_IN`, `NOT_GITHUB`, `NETWORK` |
| `git:prView` | `{ genesisId, number: int ≥ 1 }` | `PrDetailView` | `NOT_FOUND` |
| `git:prPropose` | `{ genesisId, base }` | `{ title, body }` | `AI_UNAVAILABLE`, `NOTHING_TO_COMPARE` |
| `git:prCreate` | `{ genesisId, base, title ≤ 256, body ≤ 20 000, draft, confirm: true, expectedHead }` | `{ number, url }` | `BRANCH_NOT_PUSHED`, `PR_EXISTS` (+ number), `NO_WRITE_ACCESS`, `HEAD_CHANGED` |
| `git:prFetchBranch` | `{ genesisId, number }` | `{ branch: 'pr/<n>' }` | `BUSY`, `NAME_TAKEN` |
| `git:issueList` | `{ genesisId, state, search?: string ≤ 200 }` | `{ items: IssueView[] ≤ 100, more }` | comme `prList` |
| `git:issueView` | `{ genesisId, number }` | `IssueDetailView` | `NOT_FOUND` |
| `git:issueCreate` | `{ genesisId, title, body, fromNeuronId?, confirm: true }` | `{ number, url }` | `NO_WRITE_ACCESS` |
| `git:issueLink` / `git:issueUnlink` | `{ genesisId, kind: 'issue' \| 'pr', number, neuronId }` | `{ linkId }` / `{}` | `NOT_FOUND` |
| `git:forkPreview` | `{ genesisId }` | `{ source: 'owner/name', target: '<login>/name', alreadyForked: boolean }` | `NOT_GITHUB`, `OWN_REPO` |
| `git:fork` | `{ genesisId, confirm: true }` | `{ fork: 'login/name' }` | `FORK_EXISTS` (réutilisé), `NETWORK` |
| `git:openExternal` | `{ url }` | `{}` | `URL_REFUSED` (hors `https://github.com/…`) |

`PrView` : `{ number, title, author (pseudo GitHub), headRef, baseRef, state, isDraft, review: 'approved' |
'changes_requested' | 'review_required' | null, checks: 'success' | 'failure' | 'pending' | null, updatedAt, url }`.
`IssueView` : `{ number, title, labels: string[] ≤ 10, assignees: string[] ≤ 5, state, updatedAt, url, linkedNeurons }`.

## 2. Commandes
| Opération | Commande | Validation de sortie |
|-----------|----------|----------------------|
| Liste PR | `gh pr list --repo <o/n> --state <s> --limit 50 --json number,title,author,headRefName,baseRefName,state,isDraft,reviewDecision,statusCheckRollup,updatedAt,url` | Zod strict, chaînes bornées, valeurs inconnues → `null` |
| Détail PR | `gh pr view <n> --repo <o/n> --json …,body,commits,files` | corps ≤ 20 000 car., 300 fichiers |
| Créer PR | `gh pr create --repo <o/n> --base <b> --head <login>:<branche> --title=<t> --body-file - [--draft]` (corps par **stdin**) | numéro + URL extraits, URL vérifiée |
| Récupérer la branche d'une PR | `git fetch --no-recurse-submodules -- <remote> pull/<n>/head:refs/heads/pr/<n>` (profil sûr, hooks selon confiance) | — |
| Issues | `gh issue list --repo <o/n> --state <s> --limit 100 [--search=<q>] --json number,title,labels,assignees,state,updatedAt,url` | idem |
| Créer issue | `gh issue create --repo <o/n> --title=<t> --body-file -` | idem |
| Fork | `gh repo fork <o/n> --clone=false --remote=false` puis, par git : `remote rename origin upstream`, `remote add origin <url du fork>` | URL du fork contrôlée par `gitUrl.ts` |

`<o/n>` vient toujours de `git_repos.github_repo` (enregistré au clone ou à la publication, vérifié
`^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$`), jamais du renderer.

## 3. Tâches d'IA
- `git_pr_text` (sans outil) : entrée = sujets des commits de la branche, liste des fichiers, diff borné (40 000 car.,
  sensibles exclus), modèle de PR du dépôt s'il existe (`.github/pull_request_template.md`, **donnée**, ≤ 5 000 car.) ;
  sortie Zod `{ title ≤ 256, body ≤ 20 000 }` ; titre vérifié Conventional Commits (signalé sinon) ; aucune ligne de
  co-auteur.
- `git_issue_text` (sans outil) : entrée = titre et contenu du nœud (donnée de mentalyas) ; même schéma.
- Projet « Local uniquement » : routage local ou champs vides.

## 4. Données (même migration « git »)
| Table | Colonnes | Contraintes | Index |
|-------|----------|-------------|-------|
| `git_issue_links` | `id` PK · `genesis_id` → `neurons.id` · `kind` (`issue`, `pr`) · `number` int · `neuron_id` → `neurons.id` · `created_at` · `deleted_at` null | `UNIQUE(neuron_id, kind, number)` actif | `(genesis_id)` |

- Pas de cache des titres en base : lus à l'ouverture de l'onglet (cache mémoire 5 min). Le repère `#42` sur un nœud
  s'affiche même hors ligne (numéro seul).
- Lier / délier : historisé et annulable (constitution II, opération utilisateur).
- `git_repos.upstream_repo` renseigné après un fork.
- `down` à la main : `DROP TABLE git_issue_links;`.

## 5. Diagramme de séquence (PR depuis un fork)
```mermaid
sequenceDiagram
    actor U as mentalyas
    participant M as Main (GitHubService)
    participant GH as gh
    participant G as git
    participant AI as AIGateway (git_pr_text)
    U->>M: git:forkPreview / git:fork
    M->>GH: repo fork o/n --clone=false --remote=false
    M->>G: remote rename origin upstream ; remote add origin <fork>
    U->>M: pousser la branche (lot B, vers origin = fork)
    U->>M: git:prPropose { base: main }
    M->>AI: commits + diff (données)
    AI-->>M: { title, body }
    U->>M: git:prCreate { base, title, body, confirm, expectedHead }
    M->>GH: pr create --repo o/n --head login:branche --body-file - (stdin)
    GH-->>M: URL
    M->>M: git_operations (pr_create, numéro)
    M-->>U: #57 ouverte
```

## 6. Cas limites techniques
- **Pas GitHub** (GitLab, serveur d'entreprise) : onglets PR / Issues masqués avec « disponible pour GitHub seulement »
  (`NOT_GITHUB`).
- **Fork déjà existant** : `gh` le signale ; réutilisé (`FORK_EXISTS` informatif), remotes réglés s'ils ne le sont pas.
- **Branche `pr/<n>` existante** : `NAME_TAKEN` → « Mettre à jour » refait le fetch sans forçage (échec si divergence).
- **Limites d'API GitHub** (quota) : message de `gh` reformulé, nouvel essai manuel.
- **Idempotence :** `prCreate` rejoué → `PR_EXISTS` avec le numéro.
- **Volumétrie :** pagination simple (« Charger plus »), corps tronqués avec lien vers GitHub.

## 7. Sécurité spécifique
| Risque | Vecteur | Mitigation |
|--------|---------|------------|
| XSS par une PR ou une issue | `<script>`, `<img onerror>` dans le corps | Rendu Markdown **sans HTML brut** (désactivé), images distantes non chargées, liens filtrés (GF-3) ; CSP stricte du renderer |
| Hameçonnage | Lien vers un faux site dans une issue | `git:openExternal` seulement `https://github.com/…`, sinon texte copiable |
| Injection d'instructions | Corps de PR / issue donné à Claude | Toujours balisé comme donnée, tâches sans outil |
| Injection d'arguments | Titre `--repo=…` | Forme collée `--title=`, corps par stdin, `<o/n>` venant de la base |
| Code d'une PR exécuté | Récupérer la branche | Fetch seulement ; aucune installation ni exécution ; hooks selon confiance |
| Écriture GitHub non voulue | Clic involontaire | Récapitulatif + `confirm` ; aucune fusion / fermeture dans ce lot |
