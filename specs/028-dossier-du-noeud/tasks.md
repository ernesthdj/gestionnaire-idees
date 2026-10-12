---
description: 'Tâches de la spec 028 — le dossier du nœud'
---

# Tasks: Le dossier du nœud (spec 028)

**Input**: `specs/028-dossier-du-noeud/` (spec.md, plan.md, research.md, data-model.md, contracts/ipc-folders.md,
contracts/mcp-dossier.md, quickstart.md)

**Tests**: demandés (constitution V, plan « Testing ») : règles pures, intégration (main, base, pont), renderer + axe,
e2e par lot dans l'app réelle. Nommage `should_<comportement>_when_<condition>`. Les tests d'une story s'écrivent
avant son code et échouent d'abord.

**Organisation**: une phase par user story, dans l'ordre des lots du plan. La reprise des documents de la spec 012
(US5 pour l'épingle) est faite dès US1 (research R4) : sans elle, anciens documents en nœuds et nouveaux dans le
dossier.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichier différent, aucune dépendance sur une tâche non finie)
- **[Story]** : user story de la spec (US1 à US7)

---

## Phase 1 : Préparation

- [X] T001 Relever, avant de coder, les points d'appui cités par le plan et noter tout écart en tête de ce fichier :
      `DocumentService.create` / `PlanRepository.node` (`src/main/application/documents/DocumentService.ts`), refus
      `kind = 'element'` de `src/main/application/mcp/DocumentTools.ts`, nœuds documents dans
      `src/renderer/src/canvas/buildGraph.ts` et `planLayout.ts` (`documentNodeId`), `DeliverableTracker.after`,
      `ElementFilesService` (fichiers couverts), cibles de `TabReader` dans `src/renderer/src/canvas/side/sidePanelStore.ts` *(écart relevé : les documents portent déjà nœud, retrait et place → source calculée, research R11)*
- [X] T002 [P] Dessiner les tracés du dossier (panneau arrière avec onglet, verre avant, liseré) pour une scène de
      180 × 172 et les noter en constantes commentées dans `src/renderer/src/canvas/folder/folderGeometry.ts` (nos
      propres tracés, research R5 : aucune copie de la référence)

---

## Phase 2 : Fondations (bloquant)

**But** : stockage du rangement, règles pures, contrats partagés, utilisés par toutes les stories.

- [X] T003 [P] Tests purs des règles dans `tests/unit/folders/folder-rules.test.ts` : fusion des sources et priorité
      `document > manual > conversation > covered` par `path_key`, tri (documents d'abord puis `updated_at`), sorte d'un
      fichier (Docs `.md .txt .pdf`, Code = langages du lecteur, Autres), « nouveau » (`added_by = claude` et
      `updated_at > seen_at`), plafond 500, masqués exclus
- [X] T004 Règles pures dans `src/main/domain/folders/folderRules.ts` (T003 vert)
- [X] T005 [P] Vues et schémas Zod partagés dans `src/shared/ipc/folders.ts` (`FolderFileView`, `FolderView`,
      `FolderBadge`, entrées des canaux de `contracts/ipc-folders.md`, chemin relatif ≤ 512, coordonnées ±10 000) ;
      canaux et évènement `folder:changed` dans `src/shared/ipc/channels.ts` (liste blanche des évènements)
- [X] T006 Table `folders` (`src/main/infrastructure/db/schemaFolders.ts`, branchée au schéma Drizzle) et colonne
      `documents.pinned` (`schemaNeurons.ts`) ; `npm run db:generate` → `migrations/0047_node_folders.sql`, complétée à
      la main de la reprise (research R11 : `pinned = 1` pour les documents arrangés, une ligne `folders` vue maintenant
      par nœud qui a des documents) ; `down` écrit à la main `migrations/down/0047_node_folders.down.sql`
- [X] T007 [P] Tests d'intégration du dépôt dans `tests/integration/folders/folder-repository.test.ts` : insertion,
      unicité insensible à la casse, mise à jour `updated_at`, retrait logique, places et `moved`, migration puis `down` *(couvert par `folder-service.test.ts` (place, ouverture) et `folder-backfill.test.ts` (migration, `down`))*
- [X] T008 `FolderRepository` dans `src/main/infrastructure/db/repositories/FolderRepository.ts` (requêtes typées
      Drizzle, lots par 200, transaction exposée) (T007 vert)
- [X] T009 [P] Tests d'intégration des gardes dans `tests/integration/folders/folder-guards.test.ts` : `..`, chemin
      absolu, lecteur Windows, UNC, lien symbolique sortant (`realpath`), `.env` et clés, nœud sans projet lié
      (`NO_PROJECT`), nœud absent ou archivé *(reporté au lot 2 : le lot 1 ne reçoit aucun chemin de l’interface ni de Claude ; les gardes accompagnent `folder:add` et la source « conversation »)*

**Checkpoint** : rangement stocké et gardé ; les stories peuvent commencer.

---

## Phase 3 : US1 — Retrouver à côté du nœud les documents de Claude (P1) 🎯 MVP

**But** : un document rédigé par Claude pour n'importe quel nœud apparaît dans un dossier de verre relié au nœud, qui
s'ouvre en éventail et ouvre le fichier dans le lecteur ; les documents existants y sont repris.

**Test indépendant** : quickstart 1 et 2.

### Tests US1

- [X] T010 [P] [US1] Intégration dans `tests/integration/folders/folder-service.test.ts` : `record` (document),
      `view` (aperçu des 4, comptes), `markSeen`, `move` borné, Historique (annuler le document retire la ligne ; dossier
      vide → plus de badge) ; badge qui ne compte que les fichiers présents sur le disque (aucun présent → pas de
      badge) ; nœud archivé → pas de badge, restauré → badge de retour (rangement gardé)
- [X] T011 [P] [US1] Intégration dans `tests/integration/mcp/document-tools.test.ts` : `document_ecrire` sur un
      élément de structure, une étape, un genesis, un neurone de conversation Workflow → document créé et rangé dans le
      même lot ; nœud d'un autre arbre refusé (remplace le test du refus « élément » du 2026-10-12)
- [X] T012 [P] [US1] Intégration dans `tests/integration/folders/folder-backfill.test.ts` : migration jouée sur une
      base fictive à l'état 0046 (document intact, déplacé, redimensionné, retiré) → intact dans le dossier et non
      « nouveau », arrangés épinglés à leur place, retiré absent ; `down` rend l'état d'avant *(base à l’état 0046 rejouée jusqu’à 0047)*
- [X] T013 [P] [US1] Purs dans `tests/unit/canvas/folder-placement.test.ts` : place par défaut selon la sorte (genesis
      / étape sous le nœud dans `planLayout`, élément et nœud Workflow à gauche (côté libre), idée
      dessous), décalage appliqué, dossier masqué si son nœud l'est (vue, plan replié), arête `folder-link:` ; dossier
      du neurone d'une conversation Workflow posé à côté du nœud Workflow de même clé `wf:`
- [X] T014 [P] [US1] Purs dans `tests/unit/canvas/folder-art.test.ts` : palette dérivée d'une couleur (5 à 7 teintes,
      contraste), graine stable par identifiant, job d'illustration déterministe (mêmes pixels pour même entrée), découpe
      en tranches
- [X] T015 [P] [US1] Renderer + axe dans `tests/unit/renderer/glass-folder.test.tsx` : fermé (`aria-expanded=false`,
      feuilles `inert`), Entrée / Espace ouvrent, éventail ≤ 4 dans l'ordre, clic sur une feuille → `onFileSelect`,
      Échap et clic dehors referment en rendant le focus, réglage « réduire les animations » (`data-reduced`), verre
      laiteux en thème clair, fumé en thèmes sombre et carbone, aucun `img`, `a[href]` ni `style` injecté dans le rendu
      (FR-033), `expectNoAxeViolations`

### Implémentation US1

- [X] T016 [US1] `FolderService` (vue, `record`, `markSeen`, `move`, `historyHandlers` pour `folder_entry`, diffusion
      `folder:changed`) dans `src/main/application/folders/FolderService.ts` (T010 vert)
- [X] T017 [US1] `DocumentService.create` lit le nœud par `ConversationRepository.neuron` (genesis, étape, élément,
      neurone Workflow) et range le document dans la même transaction / le même lot
      (`src/main/application/documents/DocumentService.ts`) ; `DocumentTools.write` lève le refus `element`
      (`src/main/application/mcp/DocumentTools.ts`) ; description de `document_ecrire` dans `src/shared/mcp/tools.ts` et
      consigne dans `src/main/application/conversation/frame.ts` (T011 vert)
- [X] T018 [US1] Reprise dans la migration `0047` (T006) vérifiée par T012 ; `DocumentRepository` lit et écrit
      `pinned` ; un document créé n'est jamais épinglé (research R11) *(migration `0047_node_folders`)*
- [X] T019 [US1] `CanvasService` : `IdeasCanvasView.folders` (badges, aperçus sans lire de contenu, `stat` borné, seuls
      les fichiers présents comptés ; aucun présent → pas de badge) et `documents` limité aux épinglés, dans
      `src/main/application/canvas/CanvasService.ts` et `src/shared/ipc/canvas.ts` ; mesure d'intégration sur le profil
      démo : `canvas:get` ne s'alourdit pas de plus de 20 ms (plan, Performance Goals) *(mesure : 30 nœuds, 60 documents, < 20 ms ajoutés)*
- [X] T020 [US1] Canaux `folder:list`, `folder:markSeen`, `folder:move` dans `src/main/ipc/folderHandlers.ts`, branchés
      dans `src/main/bootstrap.ts` avec les `historyHandlers` du service *(lot 1 : `folder:move`, `folder:markSeen` ; `folder:list` arrive avec « Tout voir », US3)*
- [X] T021 [P] [US1] Illustration pure et file de peinture partagée (~7 ms par image, priorité, cache par palette /
      graine / taille, `IntersectionObserver`) dans `src/renderer/src/canvas/folder/folderArt.ts` (T014 vert)
- [X] T022 [US1] `GlassFolder` (trois couches, états par variables CSS, parallaxe en `requestAnimationFrame`, éventail,
      étiquette titre + « N fichiers ») dans `src/renderer/src/canvas/folder/GlassFolder.tsx` et une feuille unique
      `src/renderer/src/canvas/folder/folder.css` aux jetons du thème (`--folder-glass`, `--folder-ink`, verre laiteux /
      fumé selon `--color-surface` : thèmes sombre et carbone) (T015 vert)
- [X] T023 [US1] `FolderNode` (nœud React Flow `folder`, glissement par le bord seulement, `nodrag` sur feuilles et
      boutons ouverts, enregistrement de la place par `folder:move`) dans `src/renderer/src/canvas/folder/FolderNode.tsx`
- [X] T024 [US1] Placement : nœuds `folder:<neuronId>` et arêtes fines dans `src/renderer/src/canvas/buildGraph.ts`,
      `planLayout.ts` (place libérée par les nœuds documents) et `structureGraph.ts` ; neurone d'une conversation
      Workflow → clé `wf:` de son nœud (correspondance fournie par le main avec le badge, via `WorkflowChatRepository`) ;
      épinglés toujours rendus par le nœud document existant (T013 vert) *(élément et nœud Workflow : à gauche, corrigé à l’e2e)*
- [X] T025 [US1] Clic sur une feuille → lecteur dans l'onglet du nœud (`sidePanelStore`, cible document ou fichier
      selon la source) et `folder:markSeen` ; branchement dans `src/renderer/src/canvas/IdeasCanvas.tsx`
- [X] T026 [US1] E2E dans `tests/e2e/node-folder.e2e.ts` : quickstart 1 (document d'un élément, éventail, lecteur,
      place gardée après relance) et 2 (documents existants repris, épinglé à la même place), captures relues *(`tests/e2e/node-folder.e2e.ts` : Claude écrit par le pont MCP, dossier, éventail, lecteur, place gardée après relance, étape de plan ; quickstart 2 vérifié par `folder-backfill.test.ts`)*

**Checkpoint** : MVP utilisable — tout document de Claude se retrouve à côté de son nœud.

---

## Phase 4 : US2 — Le dossier réunit tout ce qui touche le nœud (P1)

**But** : fichiers couverts, écrits en conversation, ajoutés à la main ; retirer, masquer, « nouveau ».

**Test indépendant** : quickstart 3.

- [ ] T027 [P] [US2] Intégration dans `tests/integration/folders/folder-sources.test.ts` : couverts calculés depuis les
      chemins d'un élément (et suivant leurs changements), masquer / démasquer, `folder:add` (refus hors projet, sans
      projet lié, idempotent), retirer (disque intact, annulable), doublon de sources fusionné
- [ ] T028 [P] [US2] Intégration dans `tests/integration/finals/deliverable-tracker.test.ts` : écriture réussie en
      conversation d'une étape, d'un genesis, d'un élément → rangée « conversation » ; écriture refusée ou échouée → rien ;
      fichier sensible ou hors projet → rien ; action finale et chemins d'élément inchangés
- [ ] T029 [US2] Sources couvertes (via `ElementFilesService`), `hide` / `unhide`, `add`, `remove`, plafond 500 dans
      `src/main/application/folders/FolderService.ts` (T027 vert)
- [ ] T030 [US2] Débouché `folder.record(neuronId, relative, 'conversation')` dans `after()` pour toute conversation liée
      à un projet, lot par tour, dans `src/main/application/finals/DeliverableTracker.ts` et sa composition
      `src/main/bootstrap.ts` (T028 vert)
- [ ] T031 [US2] Canaux `folder:add`, `folder:pickFile` (sélecteur natif ouvert dans le dossier du projet),
      `folder:remove`, `folder:hide`, `folder:unhide` dans `src/main/ipc/folderHandlers.ts`
- [ ] T031b [P] [US2] Intégration dans `tests/integration/folders/folder-file.test.ts` : `folder:file` (fichier rangé
      lu, non rangé refusé `NOT_IN_FOLDER`, sensible, binaire, > 1 Mo)
- [ ] T031c [US2] Canal `folder:file` dans `src/main/ipc/folderHandlers.ts` et lecture d'un fichier rangé (source
      `conversation` ou `manual`) dans l'onglet du nœud : cible de lecteur `folder` de `TabReader`
      (`src/renderer/src/canvas/side/sidePanelStore.ts`, `ChatTabContent.tsx`), lecteurs existants (`.md` mis en forme,
      code coloré) ; un fichier couvert garde le lecteur d'élément (T031b vert)
- [ ] T032 [P] [US2] Renderer + axe dans `tests/unit/renderer/glass-folder-sources.test.tsx` : bouton « + », pastille
      « nouveau » et point d'accent, feuille qui tombe (absente en animations réduites), compteur
- [ ] T033 [US2] « + », « nouveau », point d'accent, animation de dépôt sur `folder:changed` dans
      `src/renderer/src/canvas/folder/GlassFolder.tsx` et `folder.css` (T032 vert)
- [ ] T034 [US2] E2E quickstart 3 dans `tests/e2e/node-folder.e2e.ts` (écriture simulée par le hook, ajout refusé hors
      projet, retrait puis Annuler)

---

## Phase 5 : US3 — Tout voir dans le panneau de droite (P2)

**But** : le dossier entier dans l'onglet du nœud : arborescence, filtre, recherche, lecteur, retour au même défilement.

**Test indépendant** : quickstart 4.

- [ ] T035 [P] [US3] Intégration dans `tests/integration/folders/folder-list.test.ts` : `folder:list` complet
      (comptes, plafond `truncated`), introuvable signalé (`missing`)
- [ ] T036 [P] [US3] Renderer + axe dans `tests/unit/renderer/folder-tab-view.test.tsx` : comptes par sorte,
      arborescence repliable, filtre + recherche combinés, « Aucun fichier ne correspond » + « Effacer », introuvables
      grisés, clavier, fenêtrage au-delà de 200 lignes
- [ ] T037 [US3] Canal `folder:list` (vue complète) dans `src/main/ipc/folderHandlers.ts` (T035 vert)
- [ ] T038 [US3] Vue Dossier dans l'onglet du nœud (`src/renderer/src/canvas/side/FolderTabView.tsx`) et retour
      « ← Dossier » depuis un fichier ouvert (pile d'un niveau, défilement gardé) dans
      `src/renderer/src/canvas/side/sidePanelStore.ts` et `ChatTabContent.tsx` (T036 vert)
- [ ] T039 [US3] « Tout voir (N) » sous l'éventail et entrée « Dossier » de la carte de détails
      (`src/renderer/src/canvas/folder/GlassFolder.tsx`, `src/renderer/src/canvas/cards/DetailCard.tsx`)
- [ ] T040 [US3] E2E quickstart 4 dans `tests/e2e/node-folder.e2e.ts` (500 fichiers générés par
      `tests/support/benchProject.ts` réduit, ouverture < 1 s mesurée)

---

## Phase 6 : US4 — Claude connaît et lit le dossier (P2)

**But** : `neurone_contexte` liste le dossier ; `dossier_lire` lit les fichiers rangés.

**Test indépendant** : quickstart 5.

- [ ] T041 [P] [US4] Intégration dans `tests/integration/mcp/folder-tools.test.ts` : liste (200 lignes, filtre
      `sorte`), contenu d'un fichier rangé (préfixé comme donnée, 200 Ko tronqué), autre arbre `NON_MODIFIABLE`, non rangé
      `INTROUVABLE`, sensible `SECRET_REFUSE`, binaire `ENTREE_INVALIDE` ; section `Dossier :` de `neurone_contexte`
- [ ] T042 [US4] Outil `dossier_lire` (`writes: false`) dans `src/shared/mcp/tools.ts`,
      `src/main/application/mcp/FolderTools.ts`, dispatch dans `src/main/application/mcp/toolHandler.ts`, composition
      `src/main/bootstrap.ts` ; section `Dossier :` (documents fusionnés) dans `src/main/application/mcp/NeuronTools.ts`
      (T041 vert)
- [ ] T043 [US4] Entretien : ligne d'arguments de `dossier_lire` dans `argumentsFor` de
      `tests/integration/reprise/local-only-end-to-end.test.ts` (le test énumère tous les outils publics)

---

## Phase 7 : US5 — Épingler un document (P2)

**But** : sortir un document du dossier en cadre de lecture, le ranger de nouveau ; état gardé.

**Test indépendant** : quickstart 6.

- [ ] T044 [P] [US5] Intégration dans `tests/integration/folders/folder-pin.test.ts` : épingler (place par défaut à
      côté du dossier, bornes), désépingler, idempotence, Historique
- [ ] T045 [US5] `pin` / `unpin` dans `FolderService` et canaux `folder:pin`, `folder:unpin`
      (`src/main/application/folders/FolderService.ts`, `src/main/ipc/folderHandlers.ts`) (T044 vert)
- [ ] T046 [P] [US5] Renderer + axe dans `tests/unit/renderer/folder-menu.test.tsx` : menu « ··· » (`role="menu"`,
      flèches, Début, Fin, Échap, Tab), entrées selon la source (« Retirer » / « Ne plus afficher »), épingler
- [ ] T047 [US5] Menu `src/renderer/src/canvas/folder/FolderMenu.tsx` (éventail et lignes de « Tout voir ») ; cadre
      épinglé relié au dossier par une arête fine dans `buildGraph.ts` (T046 vert)
- [ ] T048 [US5] E2E quickstart 6 dans `tests/e2e/node-folder.e2e.ts`

---

## Phase 8 : US6 — Une grande carte reste lisible et fluide (P3)

**But** : pastille au dézoom, verre allégé en mouvement, peinture suspendue hors écran, « Réorganiser ».

**Test indépendant** : quickstart 7.

- [ ] T049 [P] [US6] Purs dans `tests/unit/canvas/folder-placement.test.ts` : pastille sous 0,45 (aucun nœud `folder`),
      « Réorganiser » ne remet que `moved = 0`
- [ ] T050 [US6] Pastille « 📁 N » sur le nœud porteur et clic → zoom sur le dossier ; seuil dans `buildGraph.ts` ;
      `data-moving` posé par `onMoveStart` / `onMoveEnd` et flou réduit au-delà de 12 dossiers dans
      `src/renderer/src/canvas/IdeasCanvas.tsx` et `folder.css` ; « Réorganiser » (T049 vert)
- [ ] T051 [US6] Mesure e2e à 30 dossiers dans `tests/e2e/node-folder-bench.e2e.ts` (écarts entre images pendant
      glisser et zoom ; aucune image > 50 ms), résultats dans `test-results/e2e/node-folder-bench.json` et `research.md`

---

## Phase 9 : US7 — Ranger ailleurs et agir sur un fichier (P3)

**But** : glisser une feuille vers un autre nœud, « Ranger aussi dans… », ouvrir dans l'éditeur, demander à Claude.

**Test indépendant** : quickstart 8.

- [ ] T052 [P] [US7] Intégration dans `tests/integration/folders/folder-copy.test.ts` : `copyTo` même projet
      (rangé « manual », origine gardée), autre projet `OTHER_PROJECT`, idempotent ; `openInEditor` gardé
- [ ] T053 [US7] `copyTo` et canaux `folder:copyTo`, `folder:openInEditor` (éditeur réglé, spec 013 D4)
      (`src/main/application/folders/FolderService.ts`, `src/main/ipc/folderHandlers.ts`) (T052 vert)
- [ ] T054 [US7] Glisser une feuille (type interne `application/x-gi-folder-file`, cible par
      `getIntersectingNodes`) dans `src/renderer/src/canvas/IdeasCanvas.tsx` ; « Ranger aussi dans… » au clavier,
      « Ouvrir dans l'éditeur », « Demander à Claude de le compléter » (`seedChatDraft`, rien d'envoyé) dans
      `FolderMenu.tsx`, avec tests renderer + axe dans `tests/unit/renderer/folder-menu.test.tsx`
- [ ] T055 [US7] E2E quickstart 8 dans `tests/e2e/node-folder.e2e.ts`

---

## Phase 10 : Finitions

- [ ] T056 [P] Dossiers fictifs du profil démo (un document, des fichiers couverts, un fichier ajouté) dans
      `src/main/infrastructure/db/demo/` + test de la graine
- [ ] T057 Passe accessibilité et clavier sur tout le parcours (quickstart 9), animations réduites vérifiées
- [ ] T058 `docs/JOURNAL.md`, statut de la spec (« Livrée »), `docs/FOUNDATION.md` §00000000, `CLAUDE.md` (Workflows
      actifs, commande démo) ; vérifications avant commit (typecheck, lint, prettier, tests, `npm run e2e`) ; un commit
      pour la spec livrée après confirmation de mentalyas

---

## Dépendances

Phase 1 → Phase 2 (T003–T009) → US1 (T010–T026) → US2 (T027–T034, dont T031b–T031c) → US3 (T035–T040) → US4 (T041–T043) →
US5 (T044–T048) → US6 (T049–T051) → US7 (T052–T055) → Finitions (T056–T058).
US4 ne dépend que d'US1 (rangement et documents) ; US3, US5 et US6 ne dépendent que d'US1 ; US7 a besoin du menu
(US5). L'ordre ci-dessus suit les lots du plan.

## Parallélisme

- Phase 2 : T003, T005, T007, T009 en parallèle (fichiers distincts).
- US1 : tests T010–T015 en parallèle ; T021 (illustration) en parallèle du main (T016–T020).
- US2 : T027, T028, T032 en parallèle.
- Chaque story : ses tests [P] avant son implémentation.

## Stratégie

MVP = Phase 1 + Phase 2 + US1 : livrer, tester dans l'app réelle (quickstart 1 et 2), montrer à mentalyas, puis
continuer story par story ; un seul commit à la livraison de la spec (règle « un commit par module livré »).
