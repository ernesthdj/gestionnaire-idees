# Tasks: Accueil ProjectMaster (spec 024)

**Input**: `specs/024-accueil-projectmaster/` — [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md).
**Tests**: exigés par la constitution (V) — purs, intégration sur coffre et base temporaires, renderer + axe.
**Règle de travail** : un test guidé à la fin de chaque lot (attendre le retour de mentalyas) ; **un commit par lot
livré** ; JOURNAL et cases à jour à chaque tâche.

## Phase 1 — Mise en place
- [ ] T001 Proposer à mentalyas (sans rien écrire hors du dépôt avant son accord) les deux modifications de sa configuration : option `--github oui|non` du skill `~/.claude/skills/hub` (FR-017) et lecture de `path` pour les entrées `external` dans `ProjectsMaster/scripts/launcher.sh` (research R6) ; noter sa réponse dans `docs/JOURNAL.md`
- [x] T002 [P] Coffre de test fictif pour les tests : `tests/support/vault.ts` (crée un coffre temporaire avec `.hub/registry.json`, `.hub/sessions.json`, `projects/`, `docs/JOURNAL.md` au format du skill `/hub`)

## Phase 2 — Fondations (bloquant)
- [x] T003 Schéma : tables `brainstorms`, `save_points` et colonnes `neurons.brainstorm_id`, `canvas_blocks.brainstorm_id` dans `src/main/infrastructure/db/schemaNeurons.ts` ([data-model.md](data-model.md)) ; `npm run db:generate`, renommer en `0040_brainstorms` (0039 pris par la spec 021 ; fichier et `tag` de `meta/_journal.json`), écrire `migrations/down/0040_brainstorms.down.sql` ; test dans `tests/integration/neurons/migrations.test.ts` (ajout puis annulation)
- [x] T004 [P] Purs `src/main/domain/brainstorms/paths.ts` (chemin résolu, refus du profil de l'app, des racines de disque et des dossiers système, dossier dans le coffre ou externe) + `tests/unit/brainstorms/paths.test.ts`
- [x] T005 [P] Pur `src/shared/brainstorms/viewState.ts` (schéma Zod `ViewState` borné : viewport, vues par genesis, ≤ 20 cartes ouvertes, conversation active) + `tests/unit/brainstorms/view-state.test.ts`
- [ ] T006 [P] (lecture faite dans `infrastructure/hub/HubFiles.ts` ; écriture avec US6, décision D15) `src/main/infrastructure/hub/HubSessions.ts` (`.hub/sessions.json` : lecture, ouverture et fermeture de session, écriture atomique, jamais sur un JSON illisible, champs inconnus gardés) + `tests/integration/hub/hub-sessions.test.ts` (coffre de T002)
- [x] T007 [P] `src/main/infrastructure/hub/ProjectVault.ts` (`.brainstormer/brainstorm.json` et `sessions.json` revalidés par Zod, aperçu des écritures, création, ligne `.brainstormer/` dans `.gitignore` créé s'il manque, reconnaissance d'un vault) + `tests/integration/hub/project-vault.test.ts` (vault abîmé signalé, jamais écrasé)
- [x] T008 `src/main/infrastructure/db/repositories/BrainstormRepository.ts` (créer, lister, lire, `last_opened_at`, état de vue, archiver) et `SavePointRepository.ts` ; `src/shared/ipc/brainstorms.ts` (types des vues) ; `src/shared/ipc/channels.ts` (canaux de [contracts](contracts/interfaces.md))

## Phase 3 — US1 Reprendre un brainstorm là où je m'étais arrêté (P1) 🎯 MVP
**Test indépendant** : travailler sur `gestionnaire-idees`, fermer l'app, la rouvrir, recharger : tout est identique.
- [x] T009 [US1] Rattachement au brainstorm actif : `NeuronRepository` (création d'un genesis : `brainstorm_id` du brainstorm actif ; `canvasRoots(brainstormId)`), `BlockRepository` (création et lecture filtrées), `CanvasService.ts` (carte du seul brainstorm actif) ; tests `tests/integration/canvas/canvas-by-brainstorm.test.ts` (rien d'un autre brainstorm ne s'affiche)
- [x] T010 [US1] `src/main/application/brainstorms/LegacyCanvasMigration.ts` (R10, marqueur `migration.brainstorms` dans `settings`) : genesis lié au dépôt du Brainstormer → brainstorm `gestionnaire-idees` ; autres genesis liés → un brainstorm chacun (coffre ou externe) ; tout le reste → brainstorm local « Idées en vrac » (dossier `projects/idees-en-vrac` créé avec la structure minimale, registre mis à jour) ; inventaire avant / après journalisé + `tests/integration/brainstorms/legacy-migration.test.ts` (SC-008, idempotent)
- [x] T011 [US1] Pur `src/main/domain/brainstorms/anomalies.ts` (session mal fermée, fichiers non commités, commits non poussés, distant en avance à partir des sorties git déjà lues) + `tests/unit/brainstorms/anomalies.test.ts`
- [x] T012 [US1] `src/main/application/brainstorms/BrainstormService.ts` : `list` (coffre via `HubRegistry` + `.hub/external.json`, externes, dossier introuvable, session ouverte via `HubSessions` ou le vault), `open` (brainstorm actif, session ouverte côté `.hub` ou vault, anomalies sans `git fetch`, résumé : dernières entrées du JOURNAL, prochaine tâche de la vue Workflow), `close` (état de vue, session), une seule session à la fois (`SESSION_ELSEWHERE`) ; `HubFlow.ts` (partie ouverture) ; tests `tests/integration/brainstorms/brainstorm-service.test.ts`
- [x] T013 [US1] `src/main/ipc/brainstormHandlers.ts` (`brainstorms:list|open|close|viewState`, `hub:checkRemote` : `git fetch` sur clic) + `bootstrap.ts` + `tests/unit/ipc/brainstorm-handlers.test.ts` (entrées Zod, chemins refusés)
- [x] T014 [P] [US1] Renderer : section `home` (`src/renderer/src/home/ProjectManager.tsx`, `BrainstormList.tsx` : « Reprendre <dernier> », « Charger un brainstorm existant », « Nouveau brainstorm » ; recherche ; grisé « dossier introuvable » ; session ouverte), `AppShell.tsx` (home au démarrage tant qu'aucun brainstorm n'est actif ; entrée « Projets » dans la navigation)
- [x] T015 [US1] Renderer : état de vue restauré à l'ouverture et écrit en différé (`src/renderer/src/canvas/useViewState.ts` : 500 ms, et à la fermeture) ; `uiStore.ts` (vues par genesis, cartes ouvertes) ; anomalies et résumé à l'ouverture (`src/renderer/src/home/OpenSummary.tsx`, actions sur clic) ; capture rapide rangée dans le brainstorm actif ou « Idées en vrac »
- [x] T016 [US1] Tests renderer + axe `tests/unit/renderer/project-manager.test.tsx` (liste, ouverture, reprise de l'état de vue, anomalies) ; mesure SC-009 (30 brainstorms)
- [x] T017 [US1] Test guidé US1 → remplacé par l'e2e `tests/e2e/project-manager.e2e.ts` (2026-10-10, profil vide, reprise après redémarrage) ; (quickstart scénarios 1, 2, 3, 10 ; migration d'abord sur une copie du profil réel) — attendre le retour

## Phase 4 — US2 Points de sauvegarde (P2)
**Test indépendant** : poser un point, supprimer trois nœuds, revenir, annuler le retour : inventaire identique.
- [x] T018 [P] [US2] Pur `src/main/domain/brainstorms/snapshot.ts` (canevas ↔ instantané `{ version, neurons, blocks, links, view }`, gzip par `node:zlib`, bornes 20 Mo) + `tests/unit/brainstorms/snapshot.test.ts`
- [x] T019 [US2] `src/main/application/brainstorms/SavePointService.ts` (poser, lister, renommer, supprimer, revenir : point caché « avant retour à … » puis remplacement en une transaction ; annuler le retour ; 50 points au plus ; conversations et fichiers jamais touchés) + canaux `savepoints:*` + `tests/integration/brainstorms/save-points.test.ts` (SC-003 : inventaire identique après retour puis annulation)
- [x] T020 [P] [US2] Renderer `src/renderer/src/canvas/SavePoints.tsx` (poser avec un nom, liste datée, revenir avec confirmation, annuler le retour, renommer, supprimer) dans la barre du canevas ; tests `tests/unit/renderer/save-points.test.tsx` + axe
- [x] T021 [US2] Test guidé US2 → e2e `project-manager.e2e.ts` (poser, idée ajoutée, retour, annulation) ; (quickstart scénario 4) — attendre le retour

## Phase 5 — US3 Nouveau brainstorm de zéro (P2)
**Test indépendant** : « essai-local » sans GitHub : dossier dans le coffre, registre, canevas, première question liée.
- [x] T022 [US3] `BrainstormService.createScratch` : règles de slug avant toute écriture, `ProjectService.create` dans `projects/` du coffre, `initGit`, brainstorm `vault` + genesis au nom du projet ; GitHub seulement si la spec 021 lot B existe (sinon refus clair « local seulement pour l'instant ») ; tests dans `brainstorm-service.test.ts`
- [x] T023 [US3] Démarrage du brainstorm : conversation du genesis ouverte avec une consigne pré-remplie qui cite le nom et la description (`/brainstorm`, jamais envoyée sans geste) ; `src/renderer/src/home/NewBrainstorm.tsx` (choix De zéro / Projet en chantier / Depuis un lien Git ; formulaire De zéro) ; tests renderer + axe
- [x] T024 [US3] Test guidé US3 → e2e `project-manager.e2e.ts` ; (quickstart scénario 5) — attendre le retour

## Phase 6 — US4 Projet en chantier : propriétaire ou sans dépôt (P2)
**Test indépendant** : un dossier hors du coffre → `.brainstormer/` créé et ignoré par git, référence externe, dossier non déplacé.
- [x] T025 [US4] (dans `ExistingProjectService`, sélecteur natif dans le main : l'interface n'envoie qu'un jeton ; rôle « pas de dépôt » sans `git init` automatique, D17) `BrainstormService.previewExisting|adoptExisting` (aperçu des écritures, vault créé ou repris, `.gitignore`, référence externe : `external` + `path` au registre si T001 l'a permis, sinon `.hub/external.json`, rôle « mon propre dépôt » ou « pas de dépôt » → `initGit` proposé) et `relink` (projet déplacé reconnu par son vault) ; tests `tests/integration/brainstorms/adopt-existing.test.ts` (SC-006 : inventaire des fichiers avant / après)
- [x] T026 [US4] Renderer : parcours « Projet en chantier » dans `NewBrainstorm.tsx` (dialogue de dossier, aperçu, choix du rôle — « collaborateur » affiché « bientôt, avec Git et GitHub (spec 021) »), « Relier » dans `BrainstormList.tsx` ; tests renderer + axe
- [x] T027 [US4] Test guidé US4 → e2e `project-manager.e2e.ts` (aperçu, vault, `.gitignore`, déplacement puis « Relier ») ; (quickstart scénario 6, rôle propriétaire) — attendre le retour

## Phase 7 — US5 Nouveau brainstorm depuis un lien Git (P3)
**Test indépendant** : un petit dépôt public de test cloné dans le coffre, listé, son canevas ouvert.
- [ ] T028 [US5] `BrainstormService.clone` : `CloneService` profil `historique` vers `projects/<slug>` du coffre (adresse contrôlée, destination montrée, progression, annulation), brainstorm `vault` d'origine `clone`, registre ; contenu cloné jamais exécuté ; tests `tests/integration/brainstorms/clone-brainstorm.test.ts` (lanceur git simulé)
- [ ] T029 [US5] Renderer : parcours « Depuis un lien Git » dans `NewBrainstorm.tsx` (lien, destination, progression, erreurs claires) ; tests renderer + axe
- [ ] T030 [US5] Test guidé US5 (quickstart scénario 7) — attendre le retour

## Phase 8 — US7 Définir mon coffre au premier lancement (P3)
**Test indépendant** : profil neuf → choisir ou créer un coffre ; `pm.bat` lit le coffre créé.
- [ ] T031 [US7] `vault:status|choose|create` (coffre = parent de `projectsRoot` avec `.hub/registry.json` ; créer : `.hub/registry.json`, `.hub/sessions.json`, `projects/`, `docs/JOURNAL.md` au format du skill ; dossier refusé si sensible) ; `src/renderer/src/home/VaultSetup.tsx` avant le Project Manager ; tests intégration + renderer + axe
- [ ] T032 [US7] Test guidé US7 (quickstart scénario 9, profil neuf) — attendre le retour

## Phase 9 — Après la spec 021 (lots A, B, G) : collaborateur, fin de session, extraire
- [ ] T033 [US4] Rôle « collaborateur » : branche personnelle (nom proposé, `git switch -c` ou reprise) par le `GitRunner` de la 021 ; garde « jamais de push vers la branche par défaut » pour ce projet ; PR proposée (021 lot F si présent) ; rôle mémorisé dans le vault ; tests d'intégration (push vers la branche par défaut refusé, SC-007)
- [ ] T034 [US6] Pur `src/main/domain/brainstorms/hubEnd.ts` (plan des étapes de `/hub end` cochées selon la session : commit, push, JOURNAL projet, JOURNAL global, graphe, cours académique, fermeture ; dépendances entre étapes) + tests
- [ ] T035 [US6] `HubFlow.endStep` : commit et push par la 021 (diff et destination montrés, clic), entrées de JOURNAL écrites par l'app (texte proposé, modifiable), graphe et cours confiés à la conversation du projet (consignes `/graphify . --update`, `/professor parcours --auto` pré-remplies, lancées sur clic), fermeture (`HubSessions` ou vault, `last_session` du registre) ; canaux `hub:endPlan|endStep` ; tests (un échec arrête les étapes dépendantes)
- [ ] T036 [US6] Renderer `src/renderer/src/canvas/SessionEnd.tsx` (cases, raisons, résultat de chaque étape, annulation d'une étape longue) ; tests + axe
- [ ] T037 [US5] « Extraire un morceau » d'un projet cloné vers un autre brainstorm (licence et attribution, 021 lot G)
- [ ] T038 Tests guidés US4 collaborateur, US6 et extraction (quickstart scénarios 6 et 8) — attendre le retour

## Phase 10 — Finitions
- [ ] T039 [P] Démo : coffre fictif dans le profil démo (`seedDemo.ts`, `demoMethod.ts`) avec deux brainstorms (l'un dans le coffre, l'autre externe) et un point de sauvegarde ; ligne `seed:demo` de `CLAUDE.md`
- [ ] T040 [P] `docs/FOUNDATION.md` (amendement « Accueil ProjectMaster »), `CLAUDE.md` (Workflows actifs, commandes), amendement daté des specs 016 (projets) et 017 (import combiné avec B2)
- [ ] T041 Vérifications finales (`npm run typecheck`, `npm run lint`, `npx prettier --check src tests`, `npm test`, `npm run build`) et quickstart complet ; JOURNAL ; demander la confirmation avant commit

## Dépendances
- Phase 1 → Phase 2 → US1 (bloquant : brainstorm actif, canevas filtré, migration).
- US2, US3, US4 (propriétaire), US5 (clone) et US7 dépendent d'US1, et sont indépendantes entre elles (US3, US4 et US5
  partagent `NewBrainstorm.tsx` : à enchaîner, pas en parallèle).
- Phase 9 dépend de la spec 021 (lots A, B ; G pour T037) ; T001 conditionne la forme des références externes (T025).
- Finitions après les user stories.

## Parallélisme
- Phase 2 : T004, T005, T006, T007 en parallèle ; T008 ensuite.
- US1 : T014 en parallèle de T011–T013 ; T018 (US2) peut commencer dès la Phase 2.
- US2 : T020 en parallèle de T019 une fois les canaux fixés.
- Finitions : T039, T040 en parallèle.

## Stratégie
- **MVP = Phases 1–3 (US1)** : le Project Manager, la reprise exacte et le passage de la carte unique aux brainstorms
  (testé d'abord sur une copie du profil réel).
- Puis US2 (points de sauvegarde), US3 (de zéro), US4 (projet en chantier, propriétaire), US5 (clone), US7 (coffre).
- La spec 021 (lots A, B, G) passe avant la Phase 9.
- Un commit par lot livré, après son test guidé.
