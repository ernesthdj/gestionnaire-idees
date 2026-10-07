# Implementation Plan: Git et GitHub (spec 021)

**Branch**: `main` (spec `021-git-github`) | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

## Summary

Un volet **Dépôt** (38 %, cinq onglets) sur la carte d'un projet lié à un dossier git, et un badge d'état sur son
genesis : voir les changements et leur diff, cocher, commiter avec un message proposé par Claude (tâche **sans outil**),
créer / changer de branche, annuler un commit par `revert` ; **publier** sur GitHub (privé par défaut), **tirer**
(avance rapide, sinon fusion) et **pousser** après un récapitulatif et un **contrôle bloquant** des fichiers sensibles
de
tous les commits envoyés ; **cloner** par lien depuis « Reprendre un projet » (spec 017) avec un `CloneService` unique à
deux profils (partagé avec la spec 020) et suivre « Depuis ta dernière visite ». Puis conflits guidés (vue qui remplace
la carte), frise et rediffusion par auteur, PR / issues / fork par `gh` en liste blanche, extraction avec licence.
Toutes les commandes git / `gh` sont construites par deux modules purs testés (aucun forçage, rebase, reset, amend ni
`--no-verify` assemblable) ; hooks seulement dans un dépôt de confiance ; aucun jeton touché.

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron, React, React Flow, Zod, Drizzle, `react-markdown` + `remark-gfm` (déjà présents) ;
Node `child_process` (`ProcessRunner`), `crypto` (HMAC des auteurs, empreintes) ; programmes **git** et **gh** du poste
(résolus par chemin absolu) ; Claude Code via `AIGateway` (6 tâches sans outil). **Aucune dépendance npm nouvelle**
(diff de lignes, détection de licence, liste fenêtrée : code maison) ; programme ajouté : `gh` (constitution 4.4.0).
**Storage**: migration `00NN_git` (prochain numéro libre au moment de coder ; 0033 réservée par la spec 020) + down :
`git_repos`, `git_operations`, `git_clones_running`, `git_merge_sessions`, `git_conflict_hunks`, `git_author_aliases`,
`git_issue_links` ; réglage `git.lastCloneParent` ; dossier vide `<profil>/git-empty-hooks`.
**Testing**: Vitest — purs (arguments et interdits, analyse des sorties git, fichiers sensibles, configuration à risque,
règles de push, URL, découpage en blocs, auteurs / rediffusion, licences, en-têtes) ; intégration avec **git réel** sur
dépôts temporaires (dépôt nu local comme « GitHub », hooks témoins, faux `.env` dans un ancien commit, 3 auteurs
fictifs, conflits) et **`gh` simulé** (`RunProcess` injecté) ; Claude simulé ; renderer + `expectNoAxeViolations`.
Aucun appel réel à GitHub en test automatique.
**Target Platform**: Windows 11 (git pour Windows, GitHub CLI)
**Project Type**: desktop-app (Electron)
**Performance Goals**: `git:status` < 300 ms sur 10 000 fichiers ; feedback < 200 ms ; 5 000 commits lus < 2 s ;
clone ≈ 10 000 commits visible < 3 min (SC-006)
**Constraints**: 0 commande interdite (SC-002) ; 100 % des faux secrets bloquent (SC-003) ; aucun jeton / identifiant /
nom d'auteur en base, journal ou entrée d'IA (SC-004) ; 0 programme lancé pour une adresse piégée, 0 hook sur un clone
(SC-005) ; fetch jamais en tâche de fond
**Scale/Scope**: ~35 fichiers main / shared, ~20 renderer ; 1 migration ; fixtures (constructeur de dépôts git fictifs,
sorties `gh` fictives, licences)

## Constitution Check (4.4.1)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | git et `gh` résolus par chemin absolu dans les dossiers absolus du PATH, sans shell, arguments construits par deux modules purs (`args.ts`, `ghArgs.ts`), `--` avant chemins / remote / URL, messages et corps par **stdin** ; `gh` en liste blanche (R9, + `pr diff` = lecture de PR) ; aucun jeton demandé, lu, stocké ni journalisé, adresses nettoyées ; hors confiance : hooks vides, `fsmonitor` coupé, ni diff externe ni textconv, **et** configuration non neutralisable = aucune commande (R3) ; dépôt cloné jamais de confiance ; IPC Zod, `genesisId` seulement ; Markdown GitHub sans HTML, liens `https://github.com/` seuls ; dossier de données refusé comme cible | ✅ |
| II Humain dans la boucle | Commit, fusion, push, branche, revert, dépôt, fork, PR, commentaire, issue : sur clic + `confirm` + état attendu (R5) ; aucune réécriture ni forçage assemblable (R11) ; push précédé du contrôle sensible bloquant ; branche par défaut d'un tiers refusée (tiers = ni son compte, ni droit `admin` / `maintain`, D11) ; hooks coupés sur une branche `pr/*` ; Claude ne fait que proposer ; textes GitHub = données ; liens issue ↔ nœud et alias d'auteurs annulables | ✅ |
| III IA cadrée | 6 tâches par l'`AIGateway`, sans outil, cadres figés, entrées balisées comme données, sorties Zod + contrôles (co-auteur retiré, marqueurs refusés, chemins ⊆) | ✅ |
| IV Local d'abord | Auteurs pseudonymisés pour Claude, clés HMAC en base ; diff borné, sensibles exclus ; « Local uniquement » → aucune tâche (FR-038) ; journal `ai_calls` sans contenu, `git_operations` sans contenu | ✅ |
| V Tests | Tout le pur testé ; git réel sur dépôts temporaires ; `gh` et Claude simulés ; test exhaustif des tableaux d'arguments | ✅ |
| VI Simplicité | Aucune dépendance ; `ProcessRunner` = 2 usages (git, gh) ; `CloneService` = 2 usages (021, 020) ; `fileToNode` partagé (US3, US5) ; diff de lignes partagé avec la spec 020 ; `revert` au lieu d'« annuler le commit » ; « Rétablir un fichier » écarté | ✅ |

Re-vérification après la conception (Phase 1) : aucun écart nouveau ; R3 (plus strict que le L3) va dans le sens de la
constitution. Re-vérification après la remédiation de l'analyse (2026-10-08) : C1 corrigé (`initGit` par stdin) ; H2
(hooks coupés sur `pr/*`) renforce II ; H3 (D11 : propriétaire = son compte ou droit `admin` / `maintain`) suppose de
lire « dépôt tiers » du principe II comme « dépôt sans ces droits » — **clarification appliquée : constitution 4.4.1 (2026-10-08)**
par mentalyas (non faite ici).

## Project Structure

### Documentation (this feature)
```text
specs/021-git-github/
├── plan.md · research.md · data-model.md · quickstart.md · tasks.md · analysis-report.md
├── contracts/interfaces.md
└── checklists/requirements.md
```

### Source Code
```text
src/shared/git/model.ts                     vues, codes d'erreur, limites, RelPath, BranchName, Hash
src/shared/ipc/git.ts                       schémas Zod des canaux git:* (et reprise:* complétés)
src/shared/reprise/gitUrl.ts                contrôle d'URL (= spec 017 T028 = spec 020 T026)
src/main/domain/git/                        pur : args.ts (constructeurs + assertSafeArgs), ghArgs.ts (liste blanche),
                                            parse.ts (status v2, log -z, diff, push --porcelain, progression),
                                            sensitive.ts + sensitivePatterns.ts, riskyConfig.ts, pushRules.ts,
                                            authors.ts (clés, initiales, palette, alias, pseudonymes), fileToNode.ts,
                                            replay.ts, splitHunks.ts, license.ts, attribution.ts
src/main/domain/text/lineDiff.ts            diff de lignes (ou réemploi de spec 020 `skills/diff.ts`, research R14)
src/main/infrastructure/process/ProcessRunner.ts   spawn borné, stdin, annulation, resolveProgram
src/main/infrastructure/git/GitRunner.ts, GhRunner.ts, GitWriteQueue.ts
src/main/infrastructure/projects/GitCli.ts  runGit conservé (enveloppe de GitRunner)
src/main/application/git/RepoLocator.ts     genesisId → dossier réel, confiance, état R3
src/main/application/git/GitService.ts      US1 : état, diff, préparer, commit, branches, log, revert
src/main/application/git/SyncService.ts     US2 : fetch, pull, merge, mergeAbort
src/main/application/git/SensitiveScan.ts   US2 : contrôle des commits à pousser
src/main/application/git/PushService.ts, PublishService.ts
src/main/application/reprise/CloneService.ts      US3 (profils historique / superficiel)
src/main/application/git/UpdatesService.ts  US3 : depuis ta dernière visite
src/main/application/git/ConflictService.ts US4
src/main/application/git/HistoryService.ts  US5 : frise, rediffusion, alias, récit
src/main/application/git/GitHubService.ts   US6 : PR, issues, fork, liens
src/main/application/git/ExtractService.ts  US7
src/main/application/ai/Git*Task.ts ; src/main/infrastructure/ai/Git*Frame.ts ; src/shared/ai/schemas.ts (sorties)
src/main/infrastructure/db/…                migration 00NN_git (+ down), schemaGit.ts, GitRepository.ts
src/main/ipc/gitHandlers.ts ; src/main/ipc/repriseHandlers.ts (clone)
src/renderer/src/git/                       RepoPanel.tsx (volet 38 %), RepoBadge.tsx, ChangesTab.tsx, DiffView.tsx,
                                            BranchesTab.tsx, HistoryTab.tsx, Timeline.tsx, PrTab.tsx, IssuesTab.tsx,
                                            PublishDialog.tsx, PushDialog.tsx, ForkDialog.tsx, ConflictView.tsx,
                                            ExtractDialog.tsx, GitHubMarkdown.tsx, useRepo.ts, WindowedList.tsx
src/renderer/src/reprise/ImportWizard.tsx   source « Lien GitHub » (E5)
src/renderer/src/explorer/                  mode Rediffusion (E6)
tests/support/gitRepos.ts                   constructeur de dépôts fictifs (aussi lançable pour les tests guidés)
tests/fixtures/git/                         sorties `gh` fictives (JSON), licences, textes piégés (XSS, consignes)
```

**Structure Decision**: même découpage que les specs précédentes (shared / domain pur / infrastructure / application /
ipc / renderer) ; un dossier `git/` par couche ; le clone reste sous `reprise/` (il alimente la reprise et l'import de
skills).

## Lots
1. **Fondations** : modèle, IPC, `ProcessRunner` / `GitRunner`, préfixe sûr, configuration à risque, constructeurs
   d'arguments et interdits, analyseurs, fichiers sensibles, file d'écriture, migration, dépôt de données.
2. **Dépôt local (US1)** : volet, badge, changements, diff, commit (message proposé), branches, derniers commits +
   revert, « Initialiser git » si pas de dépôt. Test guidé.
3. **GitHub (US2)** : `GhRunner`, fetch / pull / fusion (conflit → abandon expliqué), contrôle sensible, push,
   publication. Test guidé.
4. **Cloner (US3)** : `gitUrl`, `CloneService` (profil historique), assistant « Lien GitHub », nettoyage, mises à jour
   depuis la dernière visite. Test guidé. **Fin du MVP.**
5. **Conflits (US4)** · 6. **Historique (US5)** · 7. **PR / issues / fork (US6)** · 8. **Extraire (US7)** : un test
   guidé chacun (ordre D10 : E avant D).
9. **Finitions** : bouts en bout SC-002 / SC-004 / SC-005, mesure SC-006, documentation, report vers les specs 017 et
   020.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| `ProcessRunner` commun | git et `gh` ont les mêmes besoins (stdin, sortie bornée, annulation, progression) | Deux copies de `spawn` : divergence des garde-fous |
| Blocage total sur configuration non neutralisable (R3) | Un filtre `clean` s'exécute dès `git status` | Bloquer seulement les écritures (L3) : exécution de code à la lecture |
| Contrôle sensible par contenu (`git grep`) | Une clé privée peut porter un nom anodin | Noms seulement : SC-003 non tenu |
| Fusion à trois voies par l'app | Montrer les blocs et appliquer des choix par bloc, depuis l'index | Fichier à marqueurs : modifiable, ambigu |
| Poids « commits » en clone partiel (R13) | `--numstat` téléchargerait tout le contenu caché | Lignes toujours : téléchargement massif à la lecture |
| Clés d'auteur HMAC | Alias en base sans e-mail (SC-004) | E-mail en clair : PII en base |
