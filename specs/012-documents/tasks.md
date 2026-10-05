# Tasks: Documents (spec 012)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : requis (constitution V), écrits avant le code qu'ils couvrent, nommés `should_<comportement>_when_<condition>`.
**Chemins** : `main/` = `src/main/`, `renderer/` = `src/renderer/src/`.

## Phase 1 — Setup

- [x] T001 Schéma `src/main/infrastructure/db/schemaNeurons.ts` (tables `documents`, `document_versions`, kind d'Historique `document` dans `changeLog.ts`, `HistoryRepository.ts`, `src/shared/ipc/history.ts`) ; migration `0023_documents` générée + `migrations/down/0023_documents.down.sql` écrit à la main
- [x] T002 [P] Test aller-retour de la migration dans `tests/integration/neurons/migrations.test.ts`

## Phase 2 — Fondations (bloquant)

- [x] T003 [P] Tests purs `tests/unit/documents/file-name.test.ts` : slug (accents, ponctuation), borne 60, noms réservés Windows (`con`, `nul`, `com1`…), titres hostiles (`..`, `/`, `\`, `C:`, vide), collisions `-2`, `-3`
- [x] T004 [P] `src/main/domain/documents/fileName.ts` — fait passer T003
- [x] T005 [P] Tests `tests/integration/documents/files.test.ts` (dossier temporaire) : dossier projet `docs/brainstormer/` ou profil `documents/`, création à la demande, lien symbolique sortant refusé, écriture atomique, lecture + empreinte SHA-256, borne 500 Ko, corbeille (déplacer / remettre), fichier absent
- [x] T006 `src/main/infrastructure/documents/DocumentFiles.ts` (résolution sûre `realpath` + `path.relative`, lecture, écriture atomique, corbeille, empreinte) — fait passer T005
- [x] T007 `src/main/infrastructure/db/repositories/DocumentRepository.ts` : documents (insertion, liste vivante, taille, retrait), versions (insertion, courante, précédente), `log`, `transaction`
- [x] T008 `HistoryRepository` / `HistoryService` : entités `document` (création ↔ retrait + corbeille) et `document_version` (réécrire la version visée), kind `document` annulable, résumés (« Document « X » », « Modification de « X » »)

**Checkpoint** : `npm test` vert, rien de visible.

## Phase 3 — US1 : Claude rédige le document d'un nœud (P1) 🎯 MVP

**Test indépendant** : chat d'une étape → « Rédiger un document » → nœud relié + fichier au bon endroit, ouvrable dans Obsidian ; annuler → nœud retiré, fichier en corbeille.

- [x] T009 [P] [US1] Tests `tests/integration/documents/document-service.test.ts` : créer (dossier projet / profil, nom unique, version 1, lot annulable), réécrire et ajouter (nouvelle version), annuler création (corbeille) et rétablir, plusieurs documents par neurone, neurone verrouillé accepté, dossier de projet inaccessible → erreur claire sans écriture ailleurs
- [x] T010 [US1] `src/main/application/documents/DocumentService.ts` (`create`, `write`, `read`, `remove`, `recreate`) — fait passer T009
- [x] T011 [P] [US1] Outils MCP `document_ecrire` / `document_lire` (`src/shared/mcp/tools.ts`, `application/mcp/DocumentTools.ts`, `toolHandler.ts`, exclusion de `MapToolName`), `neurone_contexte` liste les documents, `MCP_INSTRUCTIONS` + `conversation/frame.ts` ; tests `tests/integration/mcp/document-tools.test.ts` (arbre, refus, > 500 Ko)
- [x] T012 [US1] Contrats `src/shared/ipc/documents.ts`, `DocumentView` dans `canvas.ts`, canaux ; `CanvasService.get` (documents des genesis visibles) ; `ipc/documentHandlers.ts` (`document:get`, `document:remove`, `document:reveal`) ; branchement `bootstrap.ts` ; tests `tests/integration/documents/document-ipc.test.ts`
- [x] T013 [US1] Bouton « Rédiger un document » dans `chat/ChatPanel.tsx` (`DOC_MESSAGE`, outil nommé) ; test `tests/unit/renderer/chat-panel.test.tsx`
- [x] T014 [US1] Affichage minimal : nœud `document` (titre, nom de fichier, rendu Markdown) placé dans la colonne des enfants de son neurone (`canvas/planLayout.ts`, `buildGraph.ts`), trait depuis le neurone ; tests `tests/unit/ui/plan-layout.test.ts`, `tests/unit/renderer/document-node.test.tsx`
- [ ] T015 [US1] Test guidé US1 — **validation mentalyas**

## Phase 4 — US2 : Lire dans le nœud, comme dans Obsidian (P1)

**Test indépendant** : document de 3 écrans (titres, tableau, code, cases) rendu dans le nœud ; défilement interne ; redimension gardée ; modification dans Obsidian reflétée.

- [ ] T016 [P] [US2] Tests `tests/unit/renderer/document-node.test.tsx` : rendu complet, HTML brut ignoré, lien https via le navigateur, défilement sans zoom de la carte (`nowheel`), redimension → `document:resize`, fichier absent → « Recréer », axe
- [ ] T017 [US2] `canvas/nodes/DocumentNode.tsx` : `NodeResizer` (bornes), en-tête (icône, titre, nom de fichier, « Montrer le fichier »), corps défilant ; variante « document » de `chat/Markdown.tsx` ; styles — fait passer T016
- [ ] T018 [US2] `document:resize`, `document:recreate` ; lecture avec version `externe` quand le fichier a changé (`DocumentService.read`) ; tests dans `document-service.test.ts`
- [ ] T019 [US2] `DocumentWatcher.ts` (`fs.watch` par dossier, débounce 300 ms) → événement `document:changed` ; `useMainEvents` relit le document ; tests `tests/integration/documents/watcher.test.ts`
- [ ] T020 [US2] Test guidé US2 — **validation mentalyas**

## Phase 5 — US3 : Éditer en Markdown brut et revenir en arrière (P2)

**Test indépendant** : « Modifier » → changer une ligne → « Terminé » → fichier à jour ; Annuler → version précédente ; conflit avec une modification extérieure → choix.

- [ ] T021 [P] [US3] Tests : `document:save` (version, lot `document` annulable, `CONFLICT` si le disque a changé, `force`) dans `document-service.test.ts` ; bascule édition, Terminé, Annuler l'édition, dialogue de conflit dans `document-node.test.tsx`
- [ ] T022 [US3] `DocumentService.save` + canal `document:save` ; édition `textarea` monospace dans `DocumentNode.tsx` (Modifier / Terminé / Annuler), dialogue « Garder ma version » / « Recharger » — fait passer T021
- [ ] T023 [US3] Retrait d'un document par mentalyas (menu du nœud, `document:remove`, annulable, fichier laissé) ; tests
- [ ] T024 [US3] Test guidé US3 — **validation mentalyas**

## Phase 6 — Finitions

- [ ] T025 [P] Profil démo : un document fictif (`seedDemo.ts`, dossier profil) ; test `seed-demo`
- [ ] T026 [P] `docs/FOUNDATION.md` (« État actuel »), `CLAUDE.md`, `docs/JOURNAL.md`
- [ ] T027 `npm run typecheck && npm run lint && npm test && npm run build` ; parcours [quickstart.md](quickstart.md)

## Dépendances
- Phase 1 → Phase 2 → US1 (MVP) → US2 → US3 → Finitions.
- Chaque user story se termine par son test guidé ; on n'enchaîne qu'après validation de mentalyas.

## Parallélisme
- Phase 2 : T003–T005 ensemble ; puis T006 → T007 → T008.
- US1 : T009, T011 en parallèle ; puis T010 → T012 → T013 → T014.
- US2 : T016 puis T017 → T018 → T019.
- US3 : T021 puis T022 → T023.

## Stratégie
1. **MVP = Phases 1–3 (US1)** : Claude rédige, le fichier existe, le nœud apparaît relié et lisible.
2. **US2** : lecture confortable, taille gardée, fichier vivant (Obsidian).
3. **US3** : édition brute et annulation.
