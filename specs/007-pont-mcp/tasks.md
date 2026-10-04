---
description: "Task list — 007 Pont MCP"
---

# Tasks: Pont MCP — la carte lue et écrite par Claude Code

**Input**: `specs/007-pont-mcp/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)
**Prerequisites**: constitution 2.0.0 ; specs 003–005 (carte, blocs, Historique, widgets)

**Tests**: obligatoires (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>`.

## Phase 0 : Gouvernance

- [x] T000 Spec, plan et conception validés par mentalyas (2026-10-04) ; constitution amendée en 2.0.0

## Phase 1 : Setup

- [x] T001 Installer `@modelcontextprotocol/sdk` (version exacte épinglée dans `package.json`, R10) — **confirmation de mentalyas avant installation**
- [x] T002 Ajouter l'entrée `mcp-relay` (`src/mcp-relay/relay.ts`) au build `main` de `electron.vite.config.ts` (sortie `out/main/mcp-relay.js`)

## Phase 2 : Foundational (bloque toutes les histoires)

- [x] T003 [P] Tests : schémas des 9 outils (stricts, bornes, clés `[a-z0-9_-]`, `noeud_modifier` sans champ refusé) dans `tests/unit/mcp/tools.test.ts`
- [x] T004 [P] Tests : nom du canal stable par profil et distinct entre deux profils dans `tests/unit/mcp/endpoint.test.ts`
- [x] T005 Schémas Zod et bornes des outils dans `src/shared/mcp/tools.ts`, nom du canal dans `src/shared/mcp/endpoint.ts`, trames dans `src/shared/mcp/protocol.ts`
- [x] T006 Migration `0017_map_primitives` (`canvas_blocks` : kinds `note`/`frame`, `title`, `parent_block_id`, `frame_id`, `origin` ; table `map_links` ; `change_log.actor` ; kind `mcp_write`) + `migrations/down/0017_map_primitives.down.sql` + `schemaNeurons.ts` (data-model.md)
- [x] T007 [P] Tests : jeton créé au premier démarrage, relu, rotation → ancien refusé dans `tests/unit/mcp/token.test.ts`
- [x] T008 Jeton (`randomBytes(32)`, fichier `<profil>/mcp.token`) dans `src/main/infrastructure/mcp/token.ts`
- [x] T009 [P] Tests canal (vrai `net`, nom de test) : jeton faux → fermeture ; pas de poignée de main en 2 s → fermeture ; trame > 1 Mo ou JSON invalide → fermeture ; outil inconnu → erreur ; 9e client refusé ; requêtes servies dans l'ordre dans `tests/integration/mcp/pipe-server.test.ts`
- [x] T010 `PipeServer` (poignée de main, `timingSafeEqual`, trames ligne par ligne, 8 clients, dispatch vers un registre d'outils, journal sans contenu) dans `src/main/infrastructure/mcp/PipeServer.ts`
- [x] T011 Relais : serveur MCP stdio (SDK), outils déclarés depuis `src/shared/mcp/tools.ts`, instructions du serveur (contracts/mcp-tools.md), connexion au canal à chaque appel si besoin, `APP_FERMEE` / `SECRET_REFUSE` traduits en message lisible, dans `src/mcp-relay/relay.ts`
- [x] T012 Démarrage (vérifié sans interface : sonde stdio → relais → canal → serveur, jeton réel, 2026-10-04) du `PipeServer` dans `src/main/bootstrap.ts` (arrêt dans `stop()`), outil `etat` minimal branché → **vérification bout-en-bout manuelle depuis un CLI** (`claude mcp add` à la main)

**Checkpoint** : Claude Code voit `brainstormer` et `etat` répond depuis l'app.

## Phase 3 : User Story 5 — Brancher le pont (P1)

**Goal**: Réglages › Claude Code montre l'état, la commande à copier (sans secret), et régénère le secret.
**Independent Test**: copier la commande → `claude mcp list` voit `brainstormer` ; régénérer → ancien client refusé.

- [x] T013 [P] [US5] Tests IPC : commande sans jeton avec le profil, `map:selection` (ids seulement, ≤ 500), `mcp:rotateToken` — `tests/unit/mcp/mcp-routes.test.ts`
- [x] T014 [US5] Contrats `src/shared/ipc/mcp.ts`, canaux dans `src/shared/ipc/channels.ts`, handlers `src/main/ipc/mcpHandlers.ts` (composition de la commande `claude mcp add … -e ELECTRON_RUN_AS_NODE=1 -e GI_PROFILE_DIR=… -- "<electron.exe>" "<mcp-relay.js>"`)
- [x] T015 [P] [US5] Tests renderer : section affiche l'état, bouton Copier, Régénérer (confirmation) dans `tests/unit/renderer/claude-code-settings.test.tsx`
- [x] T016 [US5] Section « Claude Code » dans `src/renderer/src/pages/settings/claude/ClaudeCodeSettings.tsx` + entrée dans `SettingsPage.tsx`

## Phase 4 : User Story 1 — Claude lit la carte (P1)

**Goal**: `etat`, `carte_lire`, `selection_lire`, `noeud_lire` renvoient l'état réel, borné, paginé.
**Independent Test**: profil démo, « qu'y a-t-il sur ma carte ? » / « regarde ma sélection » depuis un CLI externe.

- [x] T017 [P] [US1] Tests : `etat` (compteurs, 10 récents, sélection), `carte_lire` (150 par page, curseur, archivés/supprimés absents, liens), `noeud_lire` (profondeur 0–3, idée avec sous-neurones, cadre avec contenu, `INTROUVABLE`), `selection_lire` (enfants directs + liens internes seulement ; `vide`), réponse ≤ 60 000 caractères dans `tests/integration/mcp/map-read.test.ts`
- [x] T018 [US1] `SelectionStore` (`src/main/application/mcp/SelectionStore.ts`) et `MapReader` (vues texte compactes + `structuredContent`, pagination) dans `src/main/application/mcp/MapReader.ts`
- [x] T019 [US1] Outils de lecture enregistrés dans le registre du `PipeServer` (`src/main/application/mcp/MapService.ts`, câblage `bootstrap.ts`)
- [ ] T020 [P] [US1] (couvert par le test manuel guidé ; test automatisé du hook à écrire) Tests renderer : changement de sélection → `map:selection` regroupé (150 ms, ≤ 500 ids) dans `tests/unit/renderer/map-selection.test.tsx`
- [x] T021 [US1] `useOnSelectionChange` → `map:selection` dans `src/renderer/src/canvas/IdeasCanvas.tsx` ; canal validé dans `mcpHandlers.ts`

## Phase 5 : User Story 2 — Claude dessine (P1) 🎯 cœur de la vision

**Goal**: un lot (notes, idées, liens, cadre) apparaît rangé, « par Claude », annulable d'un coup.
**Independent Test**: « carte des étapes d'un mariage » → cadre + ~20 notes reliées, sans chevauchement ; `Ctrl+Z` retire tout.

- [x] T022 [P] [US2] Tests purs : résolution des clés (dupliquées, absentes, cycle de parents, parent id existant, auto-lien) dans `tests/unit/mcp/batch.test.ts`
- [x] T023 [P] [US2] Tests purs : `layoutBatch` (colonnes par profondeur, frères empilés, aucun recouvrement avec les rectangles existants, sous l'ancre, cadre englobant + bandeau, 200 nœuds) dans `tests/unit/mcp/layout.test.ts`
- [x] T024 [US2] `src/main/domain/mcp/batch.ts` et `src/main/domain/mcp/layout.ts`
- [x] T025 [P] [US2] Tests intégration `dessiner` : tout-ou-rien (rien écrit si un lien est fautif), `LOT_TROP_GROS`, nœud `idee` → neurone racine brut `origin: claude` épinglé à sa place, notes avec `origin: claude`, cadre, liens libres, un seul `batchId` `mcp_write` `actor: claude`, annulation → tout retiré, rétablissement → tout revient, ancre reliée dans `tests/integration/mcp/map-draw.test.ts`
- [x] T026 [US2] `MapLinkRepository` (`src/main/infrastructure/db/repositories/MapLinkRepository.ts`), `BlockRepository` étendu (title, parent, frame, origin), `NeuronService.insert` avec `origin`/position/épingle
- [x] T027 [US2] `MapService.draw` (validation, placement, transaction, journal) + événement `map:changed` dans `src/main/application/mcp/MapService.ts`
- [x] T028 [US2] Historique : entités `map_link`, `block_text`, `neuron_text` dans `HistoryRepository.ts` ; `mcp_write` annulable et résumé « Claude : N notes, 1 cadre, M liens » dans `HistoryService.ts` ; `actor` dans `changeLog.ts`
- [x] T029 [P] [US2] Tests renderer : note (titre, texte en texte brut, badge « par Claude »), cadre derrière son contenu, liens libres libellés, idée « par Claude » ; `map:changed` → toast « … — Annuler » qui appelle l'annulation dans `tests/unit/renderer/map-primitives.test.tsx`
- [x] T030 [US2] `NoteNode.tsx`, `FrameNode.tsx`, `buildGraph.ts` (notes, cadres, `mapLinks`, origine), vues `src/shared/ipc/canvas.ts` (`BlockView`, `MapLinkView`), `CanvasService.get` (+ `mapLinks`)
- [x] T031 [US2] `map:changed` dans `MAIN_WINDOW_EVENTS` et `useMainEvents.ts` (invalidation `canvas`/`history` + toast Annuler via `useUndo`)

## Phase 6 : User Story 3 — Modifier, relier, retirer (P2)

**Goal**: chaque action = une opération « par Claude » annulable ; retirer = archiver.
**Independent Test**: « reformule la note X » puis annuler ; « retire la branche Y » puis restaurer.

- [x] T032 [P] [US3] Tests : `noeud_modifier` (note, cadre, idée ; Historique avant/après ; sous-neurone absorbé et widget → `NON_MODIFIABLE`), `relier` (`DEJA_RELIES`, auto-lien refusé, extrémité retirée → `INTROUVABLE`), `retirer` (cadre → son contenu ; élément → ses liens libres ; idée archivée ; annulation restaure tout ; ≤ 200) dans `tests/integration/mcp/map-edit.test.ts`
- [x] T033 [US3] `MapService.modify`, `link`, `retire` + enregistrement des outils

## Phase 7 : User Story 4 — Claude pose un widget (P2)

**Goal**: widget posé depuis le code de Claude, relié, « À revoir ».
**Independent Test**: « pose un compte à rebours relié à l'idée Z » → « À revoir », aucune donnée avant autorisation.

- [x] T034 [P] [US4] Tests : `widget_poser` → version créée (transpilée), entrée branchée avec les parties, aucune autorisation, `widgetIo:inputs` vide avant revue, `CODE_REFUSE` sans rien créer, une opération annulable dans `tests/integration/mcp/map-widget.test.ts`
- [x] T035 [US4] `WidgetService.createFromCode` (schéma `WidgetOut`, `transpileWidget`, version) dans `src/main/application/widgets/WidgetService.ts` ; `MapService.poseWidget` (bloc placé, `WidgetIoService.connect`) + outil

## Phase 8 : Polish

- [x] T036 `npm run typecheck`, `npm run lint`, `npm test` verts ; aucune trace de contenu ni de jeton dans les journaux (test de `PipeServer`)
- [x] T037 Mettre à jour `CLAUDE.md` du projet (stack : `@modelcontextprotocol/sdk` ; commande du pont) et `docs/JOURNAL.md`
- [x] T038 Test manuel guidé (`quickstart.md`) — validé par mentalyas (2026-10-04)

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T012) → toutes les histoires.
- US5 (T013–T016) et US1 (T017–T021) : indépendantes, après la fondation.
- US2 (T022–T031) : après US1 (réutilise `MapService`, `SelectionStore` pour l'ancre/sélection).
- US3 (T032–T033) : après US2 (Historique `block_text`, `map_link`). US4 (T034–T035) : après US2 (placement).
- Polish après tout.

## Parallel Opportunities

- T003, T004, T007, T009 (tests de fondation, fichiers distincts).
- T013 + T015 ; T017 + T020 ; T022 + T023 + T025 + T029 ; T032 et T034 entre eux.

## Implementation Strategy

1. **MVP** = Fondation + US5 + US1 : Claude lit la carte depuis le CLI (premier test réel avec mentalyas).
2. + US2 : la carte se dessine — **test manuel intermédiaire** recommandé ici (mémoire : test à chaque étape).
3. + US3, US4, Polish, test guidé complet.
