# Tasks: Plan d'attaque (spec 011)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md)
**Tests** : requis (constitution V) — écrits avant le code qu'ils couvrent, nommés `should_<comportement>_when_<condition>`.
**Chemins** : relatifs à la racine du projet ; `main/` = `src/main/`, `renderer/` = `src/renderer/src/`.

## Phase 1 — Setup

- [ ] T001 Migration `src/main/infrastructure/db/migrations/0022_plan_attaque.sql` (`npm run db:generate` après T003) : colonnes `neurons.rank`, `step_status`, `locked_at`, `lock_proposed_at`, index `(parent_id, rank)`, tables `step_dependencies`, `plan_proposals`, `plan_proposal_items` ; écrire à la main `migrations/down/0022_plan_attaque.down.sql`
- [ ] T002 [P] Test de migration aller-retour dans `tests/integration/neurons/migrations.test.ts` (tables et colonnes créées, puis retirées par le down)

## Phase 2 — Fondations (bloquant)

- [ ] T003 `src/main/infrastructure/db/schemaNeurons.ts` : `kind` + `'step'`, colonnes et 3 tables de [data-model.md](data-model.md) ; `ChangeKind` + `'plan'` dans `changeLog.ts`, `HistoryRepository.ts`, `src/shared/ipc/history.ts`
- [ ] T004 Un élément de structure se reconnaît à `kind = 'element'` (plus à `genesis_id`) : `ElementRepository.list/views` filtrent `kind = 'element'` ; `ConversationService` (rôle, `contextOf`, `modelOf`, `folderOf`) distingue genesis / élément / étape ; tests existants verts (`tests/integration/structure`, `tests/unit/conversation`)
- [ ] T005 [P] Tests purs `tests/unit/plan/dependencies.test.ts` : cycle refusé, dépendance hors fratrie refusée, `respectsDependencies` (rang de l'attendu < rang de l'étape), renumérotation après retrait / déplacement
- [ ] T006 [P] `src/main/domain/plan/dependencies.ts` : `hasCycle`, `respectsDependencies`, `renumber`, `moveRank` (purs) — fait passer T005
- [ ] T007 [P] Tests `tests/unit/plan/lock.test.ts` + `src/main/domain/plan/lock.ts` : `assertUnlocked(neuron)` lève `AppError('LOCKED', …)` avec le message de [contracts/ipc.md](contracts/ipc.md)
- [ ] T008 `src/main/infrastructure/db/repositories/PlanRepository.ts` : étapes d'un arbre (`steps(genesisId?)`), enfants d'un nœud, insertion d'étape, rang, statut, dépendances, propositions (création, remplacement, items, décision, refus mémorisés par titre normalisé), verrou (`lock`, `proposeLock`, `clearLockProposal`) ; `transaction`, `log`
- [ ] T009 `HistoryRepository` : `snapshot` / `apply` des entités `step`, `step_rank`, `step_status`, `step_dependency`, `neuron_lock` ; `HistoryService` : `plan` annulable, résumés (« Plan de « X » : 3 étapes », « Verrouillage de « X » », « Statut de « ② … » »), garde D6 (annulation refusée si elle déverrouille un nœud qui garde des enfants vivants hors du lot)

**Checkpoint** : `npm test` vert ; aucun changement visible.

## Phase 3 — US1 : Claude propose le plan d'attaque d'un nœud mûr (P1) 🎯 MVP

**Test indépendant** : genesis mûr → `plan_proposer` (3 étapes) → 3 fantômes → « Tout valider » → 3 étapes + genesis verrouillé, un seul lot annulable ; ouvrir ② → la fiche du genesis est dans le contexte.

- [ ] T010 [P] [US1] Tests d'intégration `tests/integration/plan/plan-service.test.ts` : proposer (bornes 1..12, profondeur ≤ 4, cycle, refus mémorisés), remplacer une proposition en attente, décider (tout / partiel / refus), D6 (parent verrouillé dans le même lot), annuler le lot (étapes et verrou retirés), retirer une étape (descendants, renumérotation, dépendances)
- [ ] T011 [US1] `src/main/application/plan/PlanService.ts` : `propose`, `decide`, `remove` (étape + descendants) — fait passer T010
- [ ] T012 [P] [US1] Contrats `src/shared/ipc/plan.ts` (entrées Zod, `StepView`, `ProposalView`) et `src/shared/ipc/canvas.ts` (`steps`, `proposals`, `locked`, `lockProposed`) ; canaux dans `src/shared/ipc/channels.ts`
- [ ] T013 [US1] `src/main/ipc/planHandlers.ts` (`plan:decide`) + `CanvasService.get` (étapes, propositions en attente, verrous) + branchement `bootstrap.ts` ; `neuron:remove` accepte une étape ; tests `tests/integration/plan/plan-ipc.test.ts`
- [ ] T014 [P] [US1] Outil MCP `plan_proposer` : schéma dans `src/shared/mcp/tools.ts`, branchement `toolHandler.ts` / `NeuronTools` ou `PlanTools`, émission `map:changed` ; ligne `MCP_INSTRUCTIONS` ; tests `tests/integration/mcp/plan-tools.test.ts` (arbre de la conversation seulement, refus motivés)
- [ ] T015 [US1] Contexte hérité : `contextBlock` reçoit `path` (genesis → parent, fiches, troncature des plus anciennes), rôle « étape ② de « X » » ; `neurone_contexte` ajoute chemin, rang, statut, enfants ; modèle par défaut d'une étape = `elementModel` ; tests `tests/unit/conversation/context-block.test.ts`, `tests/unit/conversation/conversation-service.test.ts`
- [ ] T016 [US1] Affichage minimal : fantômes et étapes sur la carte (nœud provisoire, placement simple à droite du genesis), ✓ / ✗ par fantôme et « Tout valider » → `plan:decide` ; clic sur une étape = sa conversation ; tests `tests/unit/renderer/plan-ghosts.test.tsx`
- [ ] T017 [US1] Test guidé US1 — **validation mentalyas**

## Phase 4 — US4 : Verrouiller un nœud mûr (P1)

**Test indépendant** : `verrou_proposer` → proposition visible → accepter → cadenas ; toute écriture du contexte refusée (interface et pont) ; dialogue toujours possible.

- [ ] T018 [P] [US4] Tests `tests/integration/plan/lock.test.ts` : proposer / accepter / refuser ; garde sur `fiche_ecrire`, `maturite_evaluer`, `noeud_modifier` (idée et étape), `neuron:update` (titre, description) ; permis : position, statut, catégorie, nature, enfants ; annulation du verrou refusée si enfants (D6)
- [ ] T019 [US4] Garde `assertUnlocked` branchée dans `NeuronTools.ts` (`writeSheet`, `evaluate`), `MapService.ts` (`noeud_modifier`), `NeuronService.update` ; code MCP `NON_MODIFIABLE` « nœud verrouillé » — fait passer T018
- [ ] T020 [US4] Outil MCP `verrou_proposer` + canal `lock:decide` (`planHandlers.ts`, `PlanService.decideLock`) ; bloc de contexte : « nœud verrouillé : n'écris plus dans ce nœud » (D5) ; tests dans `tests/integration/mcp/plan-tools.test.ts`
- [ ] T021 [US4] Interface : proposition de verrou sur le nœud et dans le chat (fiche qui sera figée, Accepter / Refuser), cadenas, menu de l'idée sans « renommer » quand verrouillé, bandeau du chat « nœud verrouillé » ; tests `tests/unit/renderer/lock.test.tsx`
- [ ] T022 [US4] Test guidé US4 — **validation mentalyas**

## Phase 5 — US2 : Un plan lisible, ordonné, qui pousse sans tout bousculer (P1)

**Test indépendant** : plan de 3 étapes + 2 sous-étapes ; ajout de ①.3 : seule la branche ① et ce qui est en dessous bougent ; réouverture identique ; glisser respectant les dépendances.

- [ ] T023 [P] [US2] Tests purs `tests/unit/ui/plan-layout.test.ts` : colonnes par profondeur, ordre par rang, parent centré sur ses enfants, fantômes après les existants, aucun chevauchement, déterminisme, incrément (ajout d'un nœud → positions hors branche inchangées au pixel), décalage au-dessus de la carte de structure
- [ ] T024 [US2] `src/renderer/src/canvas/planLayout.ts` (fonction pure) — fait passer T023 ; remplace le placement provisoire de T016 dans `buildGraph.ts`
- [ ] T025 [US2] Physique : le plan = un corps (cercle englobant) relié au genesis par un ressort rigide à décalage fixe dans `useCanvasPhysics.ts` ; les étapes suivent le genesis ; tests `tests/unit/ui/physics.test.ts`
- [ ] T026 [US2] Flèches de dépendance (nouveau style d'arête « attend », `edges/BranchEdge.tsx` ou `edges/DependencyEdge.tsx`) et animation de 250 ms des positions (coupée si mouvement réduit) dans `canvas.css`
- [ ] T027 [US2] Réordonner : glisser une étape dans sa colonne → `plan:reorder` (rang calculé depuis la position lâchée) ; refus `DEPENDENCY` affiché ; `PlanService.reorder` + `plan:setStatus` ; tests `tests/integration/plan/plan-service.test.ts`, `tests/unit/renderer/plan-reorder.test.tsx`
- [ ] T028 [US2] Outil MCP `etape_modifier` (statut, dépendances ; permis sur une étape verrouillée) ; tests `tests/integration/mcp/plan-tools.test.ts`
- [ ] T029 [US2] Test guidé US2 — **validation mentalyas**

## Phase 6 — US3 : Voir d'un coup d'œil ce qui est quoi (P2)

**Test indépendant** : plan à 3 niveaux, clair et sombre : genesis / étape / sous-étape / fantôme / verrouillé distincts ; annonces lecteur d'écran complètes ; axe sans violation.

- [ ] T030 [P] [US3] Tests `tests/unit/renderer/plan-node.test.tsx` : rendu étape / sous-étape / fantôme / verrouillé, pastilles ① et ①.1, anneau de statut, annonce « Étape ② de « X », en cours, verrouillée », ✓ / ✗ au clavier, axe
- [ ] T031 [US3] `src/renderer/src/canvas/nodes/PlanNode.tsx` + styles `canvas.css` (tokens `--cat` mêlés à la surface 35 % / 20 %, tailles 240 × 72 et 200 × 52, pointillés et opacité 0,5 du fantôme, cadenas SVG) ; `NeuronNode.tsx` : anneau de maturité et cadenas du genesis — fait passer T030
- [ ] T032 [US3] Contrastes WCAG AA vérifiés dans les deux thèmes (`styles/tokens.css` si un token manque) ; changement de statut au clavier depuis le menu de l'étape
- [ ] T033 [US3] Test guidé US3 (visuel, clair et sombre) — **validation mentalyas**

## Phase 7 — Finitions

- [ ] T034 [P] `docs/FOUNDATION.md` (§00 : plan d'attaque, verrou), `CLAUDE.md` du projet (commandes, rappel « élément = kind element »), `docs/JOURNAL.md`
- [ ] T035 `npm run typecheck && npm run lint && npm test && npm run build` ; parcours complet de [quickstart.md](quickstart.md)

## Dépendances

- Phase 1 → Phase 2 → US1 (MVP).
- US4 dépend de US1 (D6 : valider une couche verrouille ; garde de verrou utilisée par `plan:decide`).
- US2 dépend de US1 (étapes à disposer) ; indépendante de US4.
- US3 dépend de US2 (le nœud final remplace le provisoire) et de US4 (cadenas).
- Chaque phase se termine par son test guidé ; on n'enchaîne qu'après validation de mentalyas.

## Parallélisme

- Phase 2 : T005–T007 ensemble (fichiers purs distincts), puis T008 → T009.
- US1 : T010, T012, T014 en parallèle ; puis T011 → T013 → T015 → T016.
- US2 : T023 en parallèle de T028 ; puis T024 → T025 → T026 → T027.
- US3 : T030 puis T031 → T032.

## Stratégie

1. **MVP = Phases 1–3 (US1)** : Claude propose, mentalyas valide, les étapes naissent avec un contexte hérité ; placement
   provisoire mais lisible.
2. **US4** : le verrou rend le plan sûr (aucune cascade cassée).
3. **US2** : la disposition définitive, ordonnée et incrémentale.
4. **US3** : l'identité visuelle complète.
