# Tasks: Git et GitHub (spec 021)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>` ; interface : renderer + axe
(`expectNoAxeViolations`) ; git **réel** sur dépôts temporaires (dépôt nu local = « GitHub ») ; `gh` et `claude`
simulés ; aucun appel réel à GitHub.

## Phase 1 — Mise en place
- [x] T001 Constitution 4.4.0 (D9) : principes I et II amendés pour git / `gh` (appliquée le 2026-10-07, à commiter avec
  la spec)
- [x] T002 [P] Constructeur de dépôts **fictifs** `tests/support/gitRepos.ts` (aussi lançable :
  `npx tsx tests/support/gitRepos.ts <dossier> <scénario>`) : `trois-auteurs` (auteurs `*@example.invalid`, 2 identités
  pour un même auteur), `conflit` (dépôt nu + 2 clones divergents, 2 fichiers en conflit dont un binaire),
  `secret-ancien` (faux `.env` et fausse clé privée dans un ancien commit, faux préfixe de jeton dans un test),
  `hook-temoin` (hook qui écrit un fichier témoin), `config-piegee` (`filter.x.clean`, `core.sshCommand`), `licences`
  (MIT, GPL-3.0, sans licence) ; + `tests/fixtures/git/` : sorties `gh` JSON fictives, textes piégés (XSS, consignes
  cachées, liens non GitHub)

## Phase 2 — Fondations (bloquant)
- [x] T003 [P] Modèle partagé `src/shared/git/model.ts` (vues, codes d'erreur, limites, `RelPath`, `BranchName`, `Hash`)
  + `src/shared/ipc/git.ts` (schémas Zod de `contracts/interfaces.md`) ; canaux ajoutés à `src/shared/ipc/channels.ts`
  au fil des gestionnaires + tests de schémas (chemins hostiles, noms de branche `-x`, `analyste/…`)
- [x] T004 [P] Pur : constructeurs d'arguments `src/main/domain/git/args.ts` (préfixe research R2, profils confiance /
  non confiance, `--` avant chemins, remote, refspec, URL) + `assertSafeArgs` (research R11) + tests : **chaque**
  constructeur appelé avec des entrées hostiles ne produit aucun argument interdit (SC-002)
- [x] T005 [P] Pur : analyseurs `src/main/domain/git/parse.ts` (status `--porcelain=v2 --branch -z`, `branch.ab`, log
  `-z`, diff en blocs bornés, `push --porcelain`, progression `Receiving objects: n%`, `config --name-only -z`) + tests
  (noms UTF-8, espaces, renommages, sortie tronquée)
- [x] T006 [P] Pur : fichiers sensibles `src/main/domain/git/sensitive.ts` (réemploi de `isSecretFileName` et
  `fileFilter.ts` ; motifs déclaratifs `sensitivePatterns.ts` validés par Zod : clé privée bloquante, préfixes de jetons
  non bloquants, extrait masqué) + tests (SC-003 : 100 % du jeu fictif)
- [x] T007 [P] Pur : configuration à risque `src/main/domain/git/riskyConfig.ts` (neutralisées / non neutralisables,
  research R3) + tests
- [x] T008 `ProcessRunner` `src/main/infrastructure/process/ProcessRunner.ts` (spawn sans shell, sortie bornée 8 Mo,
  stdin, `AbortSignal`, délai, lignes de stderr, `resolveProgram` = dossiers absolus du PATH) ; `GitRunner`
  `src/main/infrastructure/git/GitRunner.ts` (préfixe, environnement, `<profil>/git-empty-hooks` créé, profil selon la
  confiance ; aucun hook tant que HEAD est sur `pr/*`, FR-005) ; `runGit` de `GitCli.ts` devient une enveloppe ;
  `ProjectService.initGit` (spec 016) passe à `commit -F -` (message par stdin, constitution I — analyse C1),
  `add --all` gardé (dossier neuf, research R11) + tests (git réel : `hook-temoin` sans témoin hors confiance, avec
  témoin en confiance ; stdin ; annulation ; sortie bornée ; `git.exe` piégé dans le dossier du projet ignoré ; tests
  `project-service` existants verts avec le message par stdin)
- [x] T009 `GitWriteQueue` `src/main/infrastructure/git/GitWriteQueue.ts` + `RepoLocator`
  `src/main/application/git/RepoLocator.ts` (genesisId → `projectDir` réel, existe, n'est pas le dossier de données ;
  confiance par `PermissionRepository.isTrusted(projectKey)` ; lecture de la configuration locale → `risky_config` :
  aucune autre commande git, lecture comprise, pour un dépôt non de confiance — FR-005, analyse H1) + tests
  (`config-piegee` : ni `status` ni `fetch` lancés ; `index.lock` → `BUSY`, jamais supprimé)
- [x] T010 Migration `00NN_git` (**prochain numéro libre au moment de coder** ; 0033 réservée par la spec 020) :
  7 tables de `data-model.md` via `npm run db:generate` (`src/main/infrastructure/db/schemaGit.ts`) +
  `src/main/infrastructure/db/migrations/down/00NN_git.down.sql` écrit à la main + aller-retour testé
- [x] T011 `GitRepository` `src/main/infrastructure/db/repositories/GitRepository.ts` (`git_repos`, journal
  `git_operations` sans contenu, `git_clones_running`) + tests d'intégration (une adresse avec identifiant est refusée à
  l'écriture)

## Phase 3 — US1 Gérer le dépôt local (P1) 🎯 MVP
**Test indépendant** : dépôt de test : 3 fichiers modifiés, 2 cochés, message accepté → un commit de ces 2 fichiers,
sans co-auteur ; le 3ᵉ reste modifié ; `.env` jamais cochable ; hooks selon la confiance.
- [x] T012 [US1] Lecture `src/main/application/git/GitService.ts` : `git:status` (état, opération en cours,
  `newSinceVisit`, 10 000 fichiers au plus), `git:diff` (borné, non suivi lu ≤ 1 Mo, binaire résumé, sensible refusé),
  `git:branches`, `git:log` (50 derniers) ; `operation` = `merge` seulement si une session de l'app correspond à
  `MERGE_HEAD`, sinon `other` (analyse M3) ; `onPrBranch` + tests (git réel ; HEAD détachée, rebase en cours et fusion
  lancée en terminal → `other` / `READ_ONLY_STATE`)
- [x] T013 [US1] Écritures dans `GitService` : `git:stage` / `git:unstage` (sensibles refusés, ajout nommé),
  `git:commit` (`expectedStaged` revérifié, `commit -F -` par stdin, `HOOK_FAILED` + sortie, `IDENTITY_MISSING`,
  `DETACHED_HEAD`), `git:createBranch` / `git:switchBranch` (règle pure + `check-ref-format`, `DIRTY_TREE`),
  `git:revert` (commit simple seulement, conflit → `revert --abort` + `CONFLICTS_ABORTED`) ; file d'écriture ;
  `git_operations` ; événement `git:changed` + tests (scénario indépendant ci-dessus, `STAGED_CHANGED`, hook en échec,
  US1-8 : revert d'un commit simple = commit d'annulation, commit de fusion → `MERGE_COMMIT`)
- [x] T014 [P] [US1] Tâche `git_message` sans outil : `GIT_TASK_KINDS` dans `src/main/domain/ai/types.ts` et
  `routing.ts`, `src/main/infrastructure/ai/GitMessageFrame.ts` (cadre figé, diff balisé comme donnée), schéma dans
  `src/shared/ai/schemas.ts`, `src/main/application/ai/GitMessageTask.ts` (diff ≤ 40 000, sensibles exclus, ligne
  `Co-Authored-By` retirée, `paths` ⊆ préparés, hors format signalé ; « Local uniquement » → aucune tâche, champs vides)
  + tests (Claude simulé, sortie invalide rejetée, consigne cachée dans le diff sans effet)
- [x] T015 [US1] IPC `src/main/ipc/gitHandlers.ts` (canaux US1 + `git:proposeMessage`) + câblage
  `src/main/bootstrap.ts` + tests des canaux (Zod, `genesisId` seulement, aucun chemin absolu accepté)
- [x] T016 [US1] Interface `src/renderer/src/git/` : `RepoBadge.tsx` sur le genesis (`NeuronNode.tsx` ; états texte :
  à jour, modifiés, fusion, non vérifié, dossier introuvable, « pas de git — Initialiser » → spec 016), `RepoPanel.tsx`
  (volet 38 %, en-tête d'état, onglets ; PR / Issues absents avant US6), `ChangesTab.tsx` (rien coché d'office, « Tout
  cocher / décocher », `Espace`, sensibles verrouillés avec raison, `WindowedList.tsx` au-delà de 200 lignes),
  `DiffView.tsx` (− / + en plus de la couleur), message + « Proposer un message » + découpage suggéré, CTA
  « Commiter (n fichiers) » + `Ctrl+Entrée`, `BranchesTab.tsx`, `HistoryTab.tsx` (derniers commits + « Annuler ce
  commit » confirmé), bandeau « configuration à risque », `Ctrl+Maj+G`, relecture au retour du focus + tests
  renderer/axe
- [x] T017 [US1] Test guidé (quickstart §1) → fait par mentalyas le 2026-10-09 (« rapide »), puis e2e `tests/e2e/git-local.e2e.ts`

## Phase 4 — US2 Publier, tirer, pousser (P1) 🎯 MVP
**Test indépendant** : dépôt nu local + `gh` simulé : publier, pousser 2 commits, tirer un commit fait ailleurs ;
`secret-ancien` bloque le push ; aucune commande de forçage construite.
- [x] T018 [P] [US2] Pur : `src/main/domain/git/ghArgs.ts` (liste blanche research R9, forme collée, corps par stdin,
  `<o/n>` vérifié) + tests (toute sous-commande hors liste refusée ; `auth token`, `pr merge`, `pr review`,
  `api repos/…` inconstructibles)
- [x] T019 [P] [US2] Pur : `src/main/domain/git/pushRules.ts` (research R10 : sensible, droits, propriétaire = son
  compte **ou** `admin` / `maintain` (D11), branche par défaut d'un tiers, hors GitHub) + tests (table de décision
  complète, dont les deux cas D11 : dépôt d'organisation avec `admin` ou `maintain` → push permis sur la branche
  principale après récapitulatif ; dépôt d'autrui avec `write` seulement → `THIRD_PARTY_DEFAULT_BRANCH`)
- [x] T020 [US2] `GhRunner` `src/main/infrastructure/git/GhRunner.ts` (`gh.exe` par chemin absolu, environnement R9,
  délai 60 s, sorties JSON validées par Zod, sortie jamais journalisée) + `git:ghStatus` (`api user --jq .login`) +
  tests (`gh` absent, non connecté, sortie inattendue)
- [x] T021 [US2] `SyncService` `src/main/application/git/SyncService.ts` : `git:fetch` (à l'ouverture du volet, sur ⟳ et
  avant tirer / pousser seulement ; `last_fetch_at`), `git:pull` (`merge --ff-only`, `diverged`,
  `HISTORY_REWRITTEN`), `git:merge` (`--no-ff --no-edit`, `expectedUpstreamHead` ; conflits → `merge --abort` +
  `CONFLICTS_ABORTED` tant qu'US4 n'existe pas), `git:mergeAbort` + tests (dépôt nu local, dépôt intact après abandon ;
  FR-040 : réseau coupé, délai, identifiants refusés simulés → `git status`, refs et `git_repos` inchangés)
- [x] T022 [US2] `SensitiveScan` `src/main/application/git/SensitiveScan.ts` (plage à pousser, premier push, noms +
  contenu par `git grep`, bornes et repli « noms seulement », `sensitive_checked_head`) + tests (SC-003 : faux `.env`
  dans le dernier **et** dans un ancien commit)
- [x] T023 [US2] `PushService` `src/main/application/git/PushService.ts` : `git:pushPreview` (≤ 200 commits affichés,
  droits par `repo view --json viewerPermission,owner,defaultBranchRef`), `git:push` (`expectedHead/Remote/Branch`,
  refspec unique, `acceptFindings` non bloquants seulement, `NON_FAST_FORWARD` → « Tirer d'abord ») + tests (dont
  FR-040 : échec réseau / délai / identifiants refusés → rien de modifié localement)
- [x] T024 [US2] `PublishService` `src/main/application/git/PublishService.ts` : `git:publishPreview`, `git:publish`
  (`repo create` **sans** `--source`, privé par défaut, `confirmPublic`, `remote add origin` par git, push ;
  `PUSH_FAILED` laisse « créé, pas encore poussé »), `git:addGitignore`, `git_repos.github_repo` + tests (`gh` simulé ;
  FR-040 : `gh` en échec avant création → aucun remote ajouté, rien de modifié localement)
- [x] T025 [US2] Interface : en-tête Tirer (n) / Pousser (n) + âge de la vérification + ⟳, `PublishDialog.tsx` (E3 :
  compte, nom, description, Privé coché, seconde confirmation pour Public, contrôle avant publication, blocage sans
  contournement), `PushDialog.tsx` (E4 : destination, branche, commits, constats, « ce n'est pas un secret » ligne par
  ligne, refus avec action : Tirer d'abord, Créer une branche (active dès US2 : crée et pousse la branche ; PR
  mentionnée en texte jusqu'à US6 — analyse M5), Forker (désactivé avant US6)), message `gh` absent
  avec [Copier la commande], infobulles « tirer / pousser » + tests renderer/axe
- [x] T026 [US2] Test guidé (quickstart §2) → e2e `tests/e2e/git-sync.e2e.ts` (2026-10-10 : push de 2 commits après aperçu, ⟳, tirer un commit poussé ailleurs ; distant = dépôt nu local) ; publication testée en intégration avec `gh` simulé (aucun appel réseau)

## Phase 5 — US3 Cloner par lien et suivre (P1) 🎯 MVP
**Test indépendant** : clone d'un dépôt de démonstration local (transport de test injecté) : projet créé, reprise
lancée, aucun hook ni script ; adresse piégée refusée sans lancement ; clone annulé = aucun dossier restant.
- [x] T027 [P] [US3] (livrée par la spec 020 T026) Pur : `src/shared/reprise/gitUrl.ts` (research R8 ; = spec 017 T028 = spec 020 T026) + tests
  d'adresses hostiles (SC-005)
- [x] T028 [US3] (livrée par la spec 020 T027 ; complétée le 2026-10-10 : registre des clones en base, question 500 Mo par la 024 US5) `CloneService` `src/main/application/reprise/CloneService.ts` (research R6 : profils `historique` et
  `superficiel` ; = spec 017 T029 ; profil `superficiel` = spec 020 T027 ; **au début de la tâche**, reporter
  « `CloneService` à profils » dans `specs/020-arbre-de-skills/research.md` R7 / T027 et
  `specs/017-reprise-voir/tasks.md` T028–T031, analyse M6) : `git_clones_running` avant lancement,
  progression, question à 500 Mo (`reprise:cloneLarge`, `reprise:cloneContinue`), annulation, délai, nettoyage du seul
  dossier créé, nettoyage au démarrage, échecs classés, espace libre, un clone à la fois, journal sans adresse complète
  + tests (git réel sur dépôt local via transport de test, valeur de production vérifiée ; processus simulé pour les
  échecs ; aucun hook exécuté)
- [x] T029 [US3] (remplacée par D13 : entrée du Project Manager, spec 024 US5 ; projet repris + analyse + `git_repos` cloné à la fin du clone) Reprise par lien : `reprise:checkUrl`, `reprise:clone` complété (`folderName`, `full`, sélecteur natif
  pré-positionné sur `git.lastCloneParent`, cible vide, dossier de données refusé) dans
  `src/main/ipc/repriseHandlers.ts` ; fin → `RepriseService.preview(path, 'git', display)` ; à `reprise:create` :
  `git_repos` (`cloned`, `last_seen_commit`), ni `trusted_projects` ni registre du hub + tests
- [ ] T030 [P] [US3] (reportée, D13) Pur : `src/main/domain/git/fileToNode.ts` (préfixe le plus long sur la cartographie de la spec 017,
  repli sur dossiers de premier niveau) + tests
- [x] T031 [US3] (dans `GitService.updates` / `markSeen` ; `last_seen_commit` avancé seulement par « Marquer comme vu », scénario 7) `UpdatesService` `src/main/application/git/UpdatesService.ts` : `git:updates`
  (`last_seen..@{upstream}`, ≤ 500 commits, nœuds touchés), `git:markSeen` ; `last_seen_commit` avancé aussi par
  « Tirer » + tests
- [x] T032 [US3] (formulaire « Depuis un lien Git » du Project Manager au lieu de l'assistant, D13 ; nœuds touchés reportés) Interface : `src/renderer/src/reprise/ImportWizard.tsx` source « Depuis un lien GitHub » (E5 :
  adresse vérifiée en direct, dossier, nom, « Tout télécharger » replié, progression par phase, Annuler, question
  500 Mo, erreurs claires), badge « ✦ N nouveautés », section « Depuis ta dernière visite » dans `HistoryTab.tsx`
  (Marquer comme vu, nœuds touchés surlignés) + tests renderer/axe
- [x] T033 [US3] Test guidé (quickstart §3) → e2e `project-manager.e2e.ts` (vrai clone, confidentialité choisie) + intégration « Depuis ta dernière visite » ; — attendre le retour ; cocher alors T028–T031 de la spec 017 (livrées ici)
  et signaler à la spec 020 que T026–T027 sont couvertes (profil `superficiel`)

## Phase 6 — US4 Résoudre un conflit avec Claude (P2)
**Test indépendant** : `conflit` : proposition simulée contenant un marqueur rejetée ; « Terminer » refusé tant qu'un
fichier reste ; « Abandonner » rend l'état exact d'avant.
- [x] T034 [P] [US4] Pur : diff de lignes `src/main/domain/text/lineDiff.ts` (ou réemploi de
  `src/main/domain/skills/diff.ts` si la spec 020 l'a livré) + `src/main/domain/git/splitHunks.ts` (fusion à trois
  voies, aperçu, empreinte, lignes nouvelles) + tests (non-régression « tout la mienne » = `:2:`, fins de ligne)
- [x] T035 [P] [US4] Tâche `git_conflict` sans outil (`GitConflictFrame.ts`, `GitConflictTask.ts` : blocs balisés,
  auteurs « Auteur A », bornes 200 Ko / 30 blocs / 50 fichiers, bloc avec marqueur ou index inconnu rejeté) + tests
- [x] T036 [US4] `ConflictService` `src/main/application/git/ConflictService.ts` : `git:mergeState`,
  session ouverte seulement pour une fusion lancée par l'app (une fusion de terminal reste `other`, analyse M3),
  `git:conflictFile` (`show :1:/:2:/:3:`), `git:conflictPropose` (sur clic, fichier par fichier ; « Local uniquement »
  → `LOCAL_ONLY`), `git:conflictDecide`, `git:conflictResolveFile` (empreinte, `MARKERS_LEFT`, écriture atomique,
  `add --`), `git:conflictWholeFile`, `git:mergeFinish` (`--diff-filter=U` vide, hooks selon confiance) ; sessions,
  reprise au démarrage, `lost`, blocs effacés en fin + tests (git réel, `STALE`, Abandonner = état exact d'avant)
- [x] T037 [US4] `SyncService.merge` : conflits → session ouverte au lieu de l'abandon automatique (fin de la garde D10)
  + tests
- [x] T038 [US4] Interface `src/renderer/src/git/ConflictView.tsx` (E7 : remplace la carte 62 %, liste des fichiers
  38 %, trois colonnes, explication et niveau de confiance en texte, 5 choix par bloc, édition, lignes nouvelles
  surlignées icône + texte, aperçu, « Valider ce fichier », « Terminer la fusion » grisé tant qu'un fichier reste,
  « Abandonner la fusion » confirmé ; badge « ⚠ fusion en cours ») + tests renderer/axe
- [x] T039 [US4] Test guidé (quickstart §4) → e2e `tests/e2e/git-conflicts.e2e.ts` (tirer, fusionner, binaire en entier, bloc « leur version », terminer) + intégration (git réel : marqueur rejeté, STALE, abandon = état d'avant, Local uniquement, fusion perdue) ;, avec la mesure SC-007 (< 3 min) — attendre le retour

## Phase 7 — US5 Voir qui a fait quoi et quand (P2)
**Test indépendant** : `trois-auteurs` : 3 lignes dans la frise ; au curseur donné, couleur et initiales attendues par
nœud ; récit envoyé à Claude sans nom ni e-mail réel.
- [x] T040 [P] [US5] (palette, alias, pseudonymes ; `replay.ts` reporté au lot 2, D15) Pur : `src/main/domain/git/authors.ts` (clé HMAC, initiales, palette 12 teintes contraste ≥ 3:1
  sur les deux thèmes, alias, pseudonymes) + `replay.ts` (agrégation par nœud jusqu'à un commit, poids lignes ou
  commits) + tests
- [ ] T041 [US5] (lot 1 livré : `git:history` par pages `skip`, `git:mergeAuthors`, `git:unmergeAuthor` dans `GitHistoryService` ; restent `git:replay`, `git:fetchAll`, poids lignes / commits — lot 2, D15) `HistoryService` `src/main/application/git/HistoryService.ts` : `git:history` (5 000 par lecture,
  `before`, `--numstat` si dépôt complet ; clone partiel → nombre de commits, `weight: 'commits'` affiché
  « par commits » — D12, research R13), `git:replay`, `git:fetchAll` (« Tout télécharger » sur clic : retrait du
  filtre partiel puis `fetch --refetch`, `GIT_TOO_OLD`), `git:mergeAuthors` / `git:unmergeAuthor` (`git_author_aliases`, lot `git`
  annulable) + tests (git réel ; clone partiel local : aucun téléchargement déclenché par la lecture, poids `commits` ;
  après `git:fetchAll` : poids `lines`)
- [x] T042 [P] [US5] Tâche `git_story` sans outil (`GitStoryFrame.ts`, `GitStoryTask.ts`, alias seulement) + `git:story`
  + tests (passerelle simulée : aucun nom ni e-mail fictif réel dans l'entrée — SC-004)
- [ ] T043 [US5] (lot 1 livré : `Timeline.tsx` dans l'onglet Historique ; rediffusion dans l'explorateur — lot 2, D15) Interface : `Timeline.tsx` dans `HistoryTab.tsx` (une ligne par auteur, légende toujours visible,
  zoom semaine / mois / année, flèches = commit précédent / suivant, « Charger plus », fusion d'identités, « Raconter la
  période » avec vrais noms remis à l'affichage), rediffusion dans `src/renderer/src/explorer/` (E6 : couleur +
  initiales, mode principal / dernier, légende « par lignes » ou « par commits » + bouton « Tout télécharger » en clone
  partiel, curseur, ▶, panneau des parts d'auteurs, « Quitter la rediffusion » / `Échap`)
  + tests renderer/axe
- [ ] T044 [US5] (lot 1 : e2e `tests/e2e/git-history.e2e.ts` + intégration ; mesure SC-008 avec le lot 2) Test guidé (quickstart §5), avec la mesure SC-008 (< 5 s) — attendre le retour

## Phase 8 — US6 Pull requests, issues et fork (P3)
**Test indépendant** : `gh` simulé : listes bornées ; création de PR et commentaire seulement sur clic après
récapitulatif ; lien non GitHub non cliquable ; aucune approbation ni fusion possible.
- [ ] T045 [US6] `GitHubService` lectures `src/main/application/git/GitHubService.ts` : `git:prList`, `git:prView`
  (+ `pr diff`), `git:issueList`, `git:issueView` (Zod strict, bornes, cache 5 min, `NOT_GITHUB`) + tests (fixtures
  JSON)
- [ ] T046 [P] [US6] `src/renderer/src/git/GitHubMarkdown.tsx` (sans HTML, images jamais chargées, seuls
  `https://github.com/…` cliquables via `git:openExternal`, autres copiables) + canal `git:openExternal` + tests
  renderer (XSS, hameçonnage) / axe
- [ ] T047 [P] [US6] Tâches `git_pr_text`, `git_pr_review`, `git_issue_text` sans outil (cadres, schémas, auteurs
  pseudonymisés, co-auteur retiré) + `git:prPropose`, `git:prReview`, `git:issuePropose` + tests
- [ ] T048 [US6] Écritures `GitHubService` : `git:prCreate` (`expectedHead`, `PR_EXISTS`), `git:prComment`,
  `git:issueCreate`, `git:forkPreview` / `git:fork` (remotes `origin` = fork, `upstream` = original, adresse du fork par
  `gitUrl`), `git:prFetchBranch` (fetch seulement, sans exécution) ; récapitulatif + `confirm` ; `git_operations` +
  tests (aucune approbation, fusion ni fermeture constructible ; FR-005 / analyse H2 : dépôt **de confiance** avec
  `core.hooksPath=.husky`, branche `pr/<n>` dont la PR modifie le hook → commit sur `pr/<n>` sans témoin du hook)
- [ ] T049 [US6] Liens issue ↔ nœud : `git:issueLink` / `git:issueUnlink` (`git_issue_links`, lot `git` annulable),
  pastille `#n` sur le nœud (numéro seul hors ligne) + tests
- [ ] T050 [US6] Interface : `PrTab.tsx` (liste, détail, diff, relecture de Claude, « Publier ce commentaire »,
  « Nouvelle PR »), `IssuesTab.tsx` (liste, recherche, créer depuis un nœud, relier par menu ⋯ ou glisser),
  `ForkDialog.tsx` ; action « Forker » activée et « Créer une branche » enchaînée sur « Nouvelle PR » dans
  `PushDialog.tsx` ; onglets masqués hors
  GitHub + tests renderer/axe
- [ ] T051 [US6] Test guidé (quickstart §6) — attendre le retour

## Phase 9 — US7 Extraire un morceau (P3)
**Test indépendant** : dépôts fictifs MIT et sans licence : licence affichée avant copie, en-tête présent, note d'étude
seule sans licence, destination hors `snippets/` / `techno/` refusée.
- [ ] T052 [P] [US7] Pur : `src/main/domain/git/license.ts` (règles fixes research R16, copyright) +
  `attribution.ts` (en-tête selon la syntaxe de commentaire) + tests
- [ ] T053 [US7] `ExtractService` `src/main/application/git/ExtractService.ts` : `git:extractPreview`, `git:extract`
  (workspace par `HubRegistry.locate`, `NO_WORKSPACE`, destination `snippets/` ou `techno/` + `realpath`, texte
  ≤ 200 Ko, jamais d'écrasement, note d'étude si licence inconnue, jamais commité ni exécuté, `git_operations`
  `extract`) + tests
- [ ] T054 [US7] Interface `src/renderer/src/git/ExtractDialog.tsx` (E8) depuis le menu ⋯ de l'explorateur (fichier ou
  extrait sélectionné) + tests renderer/axe
- [ ] T055 [US7] Test guidé (quickstart §7) — attendre le retour

## Phase 10 — Finitions
- [ ] T056 Bout en bout `tests/integration/git/` : SC-002 (toutes les commandes lancées pendant les scénarios
  enregistrées : aucune interdite), SC-004 (base, journaux, entrées d'IA parcourus : ni faux jeton, ni identifiant
  d'adresse, ni nom / e-mail fictif d'auteur), SC-005 (aucun hook ni script sur un clone)
- [ ] T057 Mesure SC-006 (dépôt public ≈ 10 000 commits : cloné et visible < 3 min), consignée dans `research.md`
- [ ] T058 `docs/FOUNDATION.md` (§000000 : 021 livrée), `CLAUDE.md` (spec en cours, `gh`), `docs/JOURNAL.md` ; vérifier
  que le report « `CloneService` à profils » fait en T028 est toujours juste dans les specs 017 et 020

## Dépendances
T001 ✅ → T002 → (T003, T004, T005, T006, T007 en parallèle) → T008 → T009 → T010 → T011
→ US1 (T012 → T013 ; T014 en parallèle → T015 → T016 → T017)
→ US2 (T018, T019 en parallèle → T020 → T021 → T022 → T023 → T024 → T025 → T026)
→ US3 (T027, T030 en parallèle → T028 → T029 → T031 → T032 → T033) — **MVP**
→ US4 (T034, T035 en parallèle → T036 → T037 → T038 → T039)
→ US5 (T040 en parallèle → T041 → T042 → T043 → T044)
→ US6 (T046, T047 en parallèle → T045 → T048 → T049 → T050 → T051)
→ US7 (T052 en parallèle → T053 → T054 → T055) → T056–T058.
US3 ne dépend que des fondations et d'US1 (badge, volet) ; T027–T028 peuvent avancer dès la Phase 2. US7 ne dépend que
des fondations et de la reprise (spec 017). US6 réutilise `PushDialog` (US2). US5 réutilise `fileToNode` (US3).

## Parallélisme
- Fondations : T003, T004, T005, T006, T007 (cinq fichiers purs distincts).
- US1 : T014 (tâche d'IA) pendant T012–T013.
- US2 : T018 et T019 (purs) pendant T020.
- US3 : T027 et T030 (purs) dès la Phase 2.
- US4 : T034 et T035 ; US5 : T040 et T042 ; US6 : T046 et T047 ; US7 : T052.

## Stratégie
MVP = US1 + US2 + US3 (le git local prolongé vers GitHub, et la récupération par lien), avec la garde D10 : un pull en
conflit est annulé proprement. Puis US4 (conflits), US5 (historique), US6 (PR, issues, fork), US7 (extraire). Test guidé
à la fin de chaque histoire ; commit après validation, sur confirmation.
