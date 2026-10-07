# Tasks: Actions finales (spec 013)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>`.

## Phase 1 — Socle sûr (bloquant)
- [x] T001 [P] Contrôle pur des chemins (relatif, `..`, absolu, réservés Windows, flux `:`, liste noire, binaires) dans `src/main/domain/finals/projectPath.ts` + `tests/unit/finals/project-path.test.ts` (chemins hostiles)
- [x] T002 [P] Différence ligne à ligne (Myers) et résumé au-delà des bornes dans `src/shared/diff/lineDiff.ts` + `tests/unit/diff/line-diff.test.ts`
- [x] T003 Fichiers du projet : `realpath` sous le projet, lien/jonction sortants refusés, lecture texte (octet nul, 1 Mo), écriture atomique, corbeille dans `src/main/infrastructure/finals/ProjectFiles.ts` + `tests/integration/finals/project-files.test.ts`
- [x] T004 Schéma `final_actions`, `executions`, `execution_events`, `deliverable_files` dans `src/main/infrastructure/db/schemaNeurons.ts`, migration `0025_final_actions` + `migrations/down/0025_final_actions.down.sql`, aller-retour dans `tests/integration/db/migrations.test.ts`
- [x] T005 `FinalRepository` (actions, exécutions, événements, fichiers du livrable) dans `src/main/infrastructure/db/repositories/FinalRepository.ts` + `tests/integration/finals/final-repository.test.ts`

## Phase 2 — US1 Proposer l'action finale (P1) 🎯
- [x] T006 [US1] Transitions d'état pures dans `src/main/domain/finals/state.ts` + tests
- [x] T007 [US1] `FinalService` : proposer (feuille, pas de proposition de plan en attente), décider, rétrograder, lots `final` annulables dans `src/main/application/finals/FinalService.ts` + `tests/integration/finals/final-service.test.ts`
- [x] T008 [US1] Outil MCP `action_proposer` (`src/shared/mcp/tools.ts`, `src/main/application/mcp/FinalTools.ts`, `toolHandler`) ; `plan_proposer` refuse une action finale ; `neurone_contexte` montre l'état + tests
- [x] T009 [US1] IPC `final:decide`, `final:demote` (`src/main/ipc/finalHandlers.ts`, `channels.ts`), événement `final:proposed`, `StepView.final` dans `CanvasService` + tests
- [x] T010 [US1] Carte : variante action de `PlanNode` (bord, icône, pastille d'état), bandeau de proposition ✓/✗ + lecture au clic ; chat : bouton « Proposer l'action finale » (`FINAL_MESSAGE`), section ACTION FINALE du cadre + tests renderer/axe
- [x] T011 [US1] Test guidé US1 (quickstart §1) — attendre le retour de mentalyas

## Phase 3 — US2 Exécuter (P1) 🎯
- [x] T012 [US2] Dossier d'exécution (chemin, dépendances, documents, livrable annoncé, correction, bornes) dans `src/main/application/finals/executionBrief.ts` + tests
- [x] T013 [US2] `ExecutionService` : exécuter (prérequis → `PREREQUISITES` sauf `force`, `BUSY` par genesis, `FOLDER_MISSING`), envoi `EXECUTE_MESSAGE` dans la conversation, fin au `chat:turnEnd`, arrêt, durée 15 min, reprise au démarrage (`interrompue`), trace des lectures depuis `chat:tool` + tests
- [x] T014 [US2] Outils `fichier_ecrire`, `fichier_modifier` : exécution en cours exigée, contrôle T001/T003, 40 fichiers, livrable cumulé, événements, Historique `mcp_write` (entité externe `project_file`) + tests hostiles (SC-002)
- [x] T015 [US2] IPC `final:execute`, `final:stop`, événement `final:changed` ; sans dossier lié → documents seulement + tests
- [x] T016 [US2] Carte : Exécuter / Arrêter, état en cours, confirmation des prérequis ; annexe `DeliverableNode` minimale (liste des fichiers) placée par `planLayout` + tests
- [x] T017 [US2] Test guidé US2 dont scénario hostile (quickstart §2, §3, §5) — attendre le retour

## Phase 3 bis — US2 bis Commandes approuvées (P1) 🎯 (D2 bis, 2026-10-06)
- [x] T023 [US2b] Pur : lecture des scripts de `package.json`, nom de script, sortie (ANSI, fin 20 Ko) dans `src/main/domain/finals/commands.ts` + tests
- [x] T024 [US2b] Migration `0026_approved_commands` (+ down), `CommandRepository` + tests
- [x] T025 [US2b] `CommandRunner` (node + npm-cli résolus, sans shell, délai 5 min, arrêt de l'arbre) dans `src/main/infrastructure/finals/CommandRunner.ts` + tests (processus réel `node -e`)
- [x] T026 [US2b] `CommandService` (lister, approuver, lancer pendant une exécution, texte changé → refus, une à la fois, trace) + tests
- [x] T027 [US2b] Pont asynchrone (`PipeServer`, relais 6 min pour `commande_lancer`, `MCP_TOOL_TIMEOUT`), outil `commande_lancer`, dossier d'exécution (scripts approuvés) + tests
- [x] T028 [US2b] IPC `commands:get` / `commands:approve` ; volet de l'action : liste à cocher ; livrable : résultats des scripts + tests renderer/axe
- [ ] T029 [US2b] Test guidé (projet test avec package.json) — attendre le retour

## Phase 4 — US3 Revoir le livrable (P1) 🎯
- [x] T018 [US3] `deliverable:get` (différences, « modifié depuis »), `deliverable:accept` (→ `fait`), `deliverable:correct`, `deliverable:revert` (restaure, épargne les retouchés, corbeille), `deliverable:move/resize` + tests
- [ ] T019 [US3] `DeliverableNode` complet : différences dépliables, Accepter / Corriger / Revenir en arrière, fil de l'exécution + tests renderer/axe
- [x] T030 [US3] D4 : `deliverable:file` (contenu actuel via `ProjectFiles`, langage, trop gros, binaire, absent) + tests
- [x] T031 [US3] D4 : volet de lecture (onglets Différences / Fichier, `highlight.js` cœur + langages choisis, numéros de ligne) ouvert au clic sur un fichier du livrable + tests renderer/axe — dépendance `highlight.js` à annoncer
- [x] T032 [US3] D4 : analyseur pur de `editor.command` (guillemets, `{fichier}`, `{ligne}`), liste blanche d'extensions, `deliverable:openInEditor` (spawn sans shell, détaché ; repli `shell.openPath` filtré), réglage dans Réglages + tests (commandes et extensions hostiles)
- [ ] T020 [US3] Test guidé US3 (quickstart §4, §6) — attendre le retour

## Phase 4 bis — US4 Tests du livrable (P2) (D5, 2026-10-06)
- [ ] T033 [US4] Pur : sélection des fichiers de test du livrable (motif, présents, non revenus, 20 max) et liste sûre de caractères (`^[A-Za-z0-9_./@-]{1,200}$`) dans `src/main/domain/finals/deliverableTests.ts` + tests (chemins hostiles : espace, `&`, `%`, `^`, `"`, `..`)
- [ ] T034 [US4] Migration `0027_test_runs` (+ down), dépôt (10 derniers par action) + aller-retour de migration
- [ ] T035 [US4] `CommandService` : `runTests` (script `test` approuvé et inchangé, `run test -- <fichiers>`, une commande à la fois par projet, refus pendant une exécution du genesis), trace `test_runs` ; `TEST_FIX_MESSAGE` / `TEST_WRITE_MESSAGE` via `deliverable:correct` + tests
- [ ] T036 [US4] IPC `deliverable:tests`, `deliverable:runTests`, `deliverable:fixTests`, `deliverable:writeTests` ; `DeliverableView.tests` ; événements `final:changed` + tests
- [ ] T037 [US4] Carte : « Lancer les tests » / « Demander les tests à Claude » sur l'action et le livrable, pastille ✓ / ✗ / en cours, sortie dépliable, « Faire corriger », raison si indisponible + tests renderer/axe
- [ ] T038 [US4] Test guidé US4 (quickstart §7) — attendre le retour

## Phase 5 — Finitions
- [ ] T021 Profil démo : une action finale fictive sans exécution (`src/main/infrastructure/db/demo/`)
- [ ] T022 Constitution 3.1.0 (principe I : écriture dans le projet lié, confinée par l'app ; scripts approuvés lancés sans shell), `docs/FOUNDATION.md`, `CLAUDE.md`, `docs/JOURNAL.md`

## Dépendances
Phase 1 → US1 → US2 → US2b → US3 (+ D4) → US4 → Finitions. US4 dépend de `deliverable:correct` (T018). T001, T002 parallélisables ; T003 dépend de T001.
