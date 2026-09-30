---
description: "Task list — 003 Interface MVP-1 « Brainstormer » (v2)"
---

# Tasks: Interface MVP-1 « Brainstormer »

**Input**: Design documents from `/specs/003-interface-mvp1/` (révision)

**Prerequisites**: features 001 et 002 (moteur de neurones) terminées

**Tests**: **Obligatoires** (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Faire valider puis installer les dépendances (research.md) ; Vitest en `jsdom` pour `tests/unit/renderer` ; helper `expectNoAxeViolations` (axe-core) dans `tests/support/axe.ts`
- [x] T002 [P] Fixtures FICTIVES (neurones dans les 3 états, arbres, synthèses, liens) + `scripts/seed-demo.ts` (100 neurones / 50 liens) + `npm run seed:demo`
  *(fait : `src/main/infrastructure/db/demo/seedDemo.ts` + profil démo `--demo` dans `%APPDATA%/gestionnaire-idees-demo` — la clé de base est protégée par safeStorage, donc pas de script `tsx` ; les fixtures de vues UI sont créées avec leurs vues, T018/T024)*

---

## Phase 2: Foundational (coquille)

- [x] T003 Clés `settings` `app.*` + `capture.draft` (migration avec `down`)
  *(fait sans migration : la table `settings` existe déjà ; valeurs par défaut dans le code (`DEFAULT_APP_SETTINGS`, une seule source), chaque clé validée Zod à la lecture et à l'écriture — `AppSettingsRepository`)*
- [x] T004 `WindowManager` (fenêtre principale à la demande, capture pré-chargée cachée, toutes durcies) + preloads `main.ts` / `capture.ts` distincts
  *(fait avec **un seul preload** qui n'expose que l'API de sa fenêtre selon `--gi-window=` : un preload en sandbox ne peut charger aucun autre fichier, et deux preloads partageaient un fichier commun au build ; le main vérifie en plus la page émettrice de chaque canal — `senderPage`)*
- [x] T005 [P] `lifecycle.ts` : instance unique, `--hidden`, `setLoginItemSettings`
  *(démarrage avec Windows appliqué seulement une fois installée : en développement il enregistrerait electron.exe)*
- [x] T006 [P] `TrayController` (Capturer / Ouvrir / À valider (n) / Quitter)
  *(icône provisoire dessinée en mémoire ; compteur « À valider » branché avec T042)*
- [x] T007 [P] Handlers `app:*` + événement `app:navigate`
  *(`app:openMain` non exposé : la navigation est pilotée par le main — zone de notification, capture — via l'événement `app:navigate`)*
- [x] T008 [P] Motion : `useReducedMotionPreference` (système OU `app.motion`), `durations.ts` (FR-025), `MotionConfig` global + tests `tests/unit/ui/motion.test.ts`
- [x] T009 `AppShell` : navigation Idées · À valider (compteur) · Historique, ⚙, thème, QueryClient (invalidation sur événements 002), Zustand
- [x] T010 [P] Tests composants coquille (clavier, focus visible, axe clair/sombre) `tests/unit/renderer/app-shell.test.tsx`

**Checkpoint**: app installable, démarre en arrière-plan, navigue

---

## Phase 3: User Story 1 — Capture (Priority: P1) 🎯 MVP

- [x] T011 [P] [US1] Intégration `CaptureService` : neurone créé sans IA, nature/catégorie appliquées ensuite, choix `user` jamais écrasé, brouillon, texte vide `tests/integration/capture/capture.test.ts`
- [x] T012 [P] [US1] Composant `CaptureApp` (touches, compteur, confirmation, brouillon, axe) `tests/unit/renderer/capture-app.test.tsx`
- [x] T013 [US1] `CaptureService` (→ `NeuronService.create` 002) + `GlobalShortcut` (échec → notification + réglage) + affichage écran du curseur + fermeture `blur()`/`hide()`
  *(raccourci, notification d'échec, écran du curseur et fermeture `blur()`/`hide()` livrés en phase 2 ; `CaptureService` ici)*
- [x] T014 [US1] Handlers `capture:*` (preload de capture uniquement) ; `diveNow` → `app:openMain { diveRootId }`
  *(`diveNow` : le main ferme la capture et envoie `app:navigate { section: 'ideas', diveRootId }` ; le lancement du développement se fera à l'ouverture de la plongée, US3)*
- [x] T015 [US1] `CaptureApp.tsx` (E1)
- [x] T016 [US1] Vérification manuelle focus/délai + vidéo plein écran (quickstart #1) consignée
  *(vérifié le 2026-09-28 sur le profil démo, par touches simulées + captures d'écran : raccourci → fenêtre au premier plan ; Entrée → « ✓ Idée notée » ~600 ms puis fermeture ; Échap → brouillon restauré ; Ctrl+Entrée → fenêtre principale. Reste : essai par-dessus une vidéo plein écran)*

---

## Phase 4: User Story 2 — Écran Idées : incubateur & réseau (Priority: P1) 🎯 MVP

- [x] T017 [P] [US2] Tests `forceLayout` : bruts/en dév. contraints à gauche, éclos à droite, pas de chevauchement, positions stables après convergence, dérive suspendue pendant l'interaction `tests/unit/ui/layout.test.ts`
  *(+ `crossings.ts` : échanges et déplacements vers des cases libres jusqu'à zéro croisement quand c'est possible — 0 sur arbres, groupes d'idées et même 50 liens aléatoires ; départs supplémentaires si besoin ; aucune simulation à la réouverture → carte stable)*
- [x] T018 [P] [US2] Intégration `CanvasService.get` (compteurs, répartition, filtres, recherche, liens acceptés + suggérés) + `savePositions` `tests/integration/canvas/canvas.test.ts`
- [x] T019 [US2] `CanvasService` + handlers `canvas:*`
- [x] T020 [P] [US2] Nœuds personnalisés `RawNode` (pointillé), `DevelopingNode`, `HatchedNode` (double anneau + halo Motion), couleurs de catégorie AA, **badge « proposé par l'IA » sur nature/catégorie + changement en un clic (menu contextuel)** *(analyse C1, FR-008)* ; arête `LabeledEdge` (libellé ; pointillés + ✓/✗ si suggérée)
  *(un seul composant `NeuronNode` à 3 aspects plutôt que 3 composants ; poignées invisibles au centre pour les liens)*
- [x] T021 [US2] `IdeasCanvas` (React Flow) : deux zones, en-tête compteurs, « + Une idée ? », zoom/recentrer, filtres, recherche, état vide, `onlyRenderVisibleElements`, dérive des bruts (coupée en mode réduit)
  *(cadrage calculé sur les zones — `onlyRenderVisibleElements` empêche React Flow de mesurer les nœuds hors écran ; menu d'idée : clic droit ou Maj+F10)*
- [x] T050 [US2] Type de nœud « bloc » (conteneur vide : placer, déplacer, redimensionner, supprimer ; position/taille persistées ; aucun code exécuté) — support des mini-widgets v2 (FR-026, L4c)
- [x] T022 [US2] Navigation clavier du canvas (Tab entre neurones, Entrée = plonger, flèches = déplacer la vue) + test `tests/unit/renderer/canvas-keyboard.test.tsx`
  *(liens non focalisables : Tab va d'idée en idée ; les boutons ✓/✗ des liens suggérés restent atteignables)*

---

## Phase 5: User Story 3 — Plongée & croissance (Priority: P1) 🎯 MVP

- [x] T023 [P] [US3] Tests `radialLayout` (centre, arc des enfants, parent à gauche, emplacements « + ») `tests/unit/ui/radial.test.ts`
- [x] T024 [P] [US3] Tests composants `QuestionPanel` + `Gauge` + `Breadcrumb` (réponses rapides, texte, « Je ne sais pas », « Plus de questions », « Ajouter ma branche », écarter ; jauge + manques ; remonter ; clavier ; axe) `tests/unit/renderer/dive.test.tsx`
- [x] T025 [US3] `CanvasService.dive` (`DiveView` : fil d'Ariane, focus, parent, enfants, extensions, jauge, synthèse, résultat) + handler `dive:get`
  *(fait côté interface : `diveModel(tree, focusId)` pur et testé, calculé depuis `neuron:getTree` (002) — pas de canal `dive:get` supplémentaire ; synthèse/résultat ajoutés avec US4/US5)*
- [x] T026 [US3] `DiveView` : transition de plongée/remontée (400 ms, réduite si besoin), disposition radiale, sous-neurones, emplacements « + », parent estompé cliquable, badge de profondeur
  *(clic ou Entrée sur un sous-neurone = plonger (pas de glisser dans la scène, donc pas besoin du double-clic) ; Échap écouté au niveau de la fenêtre et focus replacé sur le neurone ciblé après chaque déplacement)*
- [x] T027 [US3] `QuestionPanel`, `Gauge`, `Breadcrumb` branchés sur `growth:*` (002) ; sous-neurone affiché **immédiatement** (mise à jour optimiste confirmée par l'événement) + indicateur « réfléchit… » ; pousse animée 250 ms
- [x] T051 [US3] Neurones fantômes (FR-027) : rendu pointillé rattaché au neurone, accepter (Tab/clic → `growth:acceptSuggestion`, solidification animée) / ignorer (Échap/× → `growth:dismissSuggestion`), indicateur de vérification web + sources au survol/focus (liens externes via `shell.openExternal` en liste blanche http/https), mise à jour sur `suggestion:updated`, tests clavier + lecteur d'écran
  *(liens des sources : https uniquement, ouverts par le navigateur système via le filtre existant du main)*
- [x] T028 [US3] Édition/suppression de sous-neurone (confirmation si descendants), changement de nature/catégorie depuis la plongée
  *(nouveau canal `growth:editBranch` : modifier un sous-neurone augmente la version de l'idée (synthèse proposée → périmée) ; nature/catégorie de l'idée modifiables depuis l'en-tête de la plongée)*

---

## Phase 6: User Story 4 — Verrouiller, aperçu, fusion (Priority: P1) 🎯 MVP

- [x] T029 [US4] **Spike** animation de fusion : interpoler avec Motion les positions des sous-neurones React Flow vers le parent (600–800 ms) + changement d'aspect ; repli overlay SVG si non concluant ; décision consignée dans research.md (R3)
  *(décision consignée dans research.md R3 : fusion en HTML/Motion dans la scène de plongée, migration par transition CSS sur `transform` du nœud React Flow)*
- [x] T030 [P] [US4] Tests `SynthesisPreview` (Action : tâches/conditions/dates éditables ; Réflexion : sections ; Réviser/Refuser/Confirmer ; périmé non confirmable ; avertissement « insuffisant » avec manques ; axe) `tests/unit/renderer/preview.test.tsx`
- [x] T031 [US4] Canal `fusion:editProposed` (patch revalidé P1–P6/S1) côté main + test d'intégration `tests/integration/fusion/edit-proposed.test.ts`
  *(+ `fusion:getProposed` : retrouve un aperçu ouvert sans appel à l'IA ; correction via `domain/neurons/synthesisPatch.ts`, P1–P5/S1 revérifiés, P6 non appliquée à une valeur écrite par l'utilisateur)*
- [x] T032 [US4] `SynthesisPreview` branché sur `fusion:lock|revise|reject|confirm|editProposed` (002/003)
- [x] T033 [US4] `FusionAnimation` (résorption → aspect éclos → migration vers le réseau ~600 ms ; fondu court en mode réduit) + notification « Annuler » 10 s
  *(notification « … a éclos » 10 s avec « Annuler » (historique T040/T041))*

**Checkpoint**: MVP-1 démontrable — capturer, voir, plonger, faire pousser, verrouiller, voir éclore

---

## Phase 6b: Graines d'idées sur les liens (FR-028, ajout 2026-09-29)

**G2 — moteur**
- [x] T052 [P] Migration `0007_link_seeds` (+ down) : table `link_seeds` (lien, titre, pourquoi, origine, statut, idée née, empreinte ; une graine par lien) + `LinkSeedRepository`
- [x] T053 [P] `SuggererLiensOut` : graine facultative par lien (tolérante : graine mal formée écartée, lien gardé) + consigne ; nouveau type `germer` (lien créé par l'utilisateur, 0 ou 1 graine) `tests/unit/ai/seeds-output.test.ts`
- [x] T054 `SeedService` : enregistrement à l'éclosion, `germer` en arrière-plan après `link:create`, `seed:list`, `seed:accept` (idée brute entre ses parents, transaction + `change_log`), `seed:reject` ; annulation par `HistoryService` `tests/integration/seeds/seeds.test.ts`

**G3 — interface**
- [x] T055 Pastille 🌱 sur les liens acceptés (`LinkEdge`) : titre/pourquoi au survol ou au focus, ✓ / ✗, clavier ; idée née placée au milieu du lien dans le réseau, pousse 250 ms ; « née de A × B » dans la plongée `tests/unit/renderer/seeds.test.tsx`

**Carte unique (FR-029 à FR-031, révision 2026-09-29 après test de mentalyas)**
- [x] T056 Liens « née de » entre l'idée née d'une graine et ses deux parents (même lot annulable)
- [x] T057 Vue `canvas:get` : liste unique `ideas` + `contextLevel` ; disposition dans un seul espace (`areaFor`, agrandi pour les positions posées à la main) ; zones et migration retirées
- [x] T058 Taille des neurones en 5 paliers selon le contexte, croissance animée sur place
- [x] T059 Double-clic → idée à cet endroit (`neuron:create` avec position) ; « + Une idée ? » retiré ; état vide expliqué
- [x] T060 Lien tiré (point d'accroche) + libellé ; « Relier à une autre idée… » dans le menu (clavier) ; démo réduite à 12 idées / 8 liens / 2 graines `tests/unit/renderer/canvas-create.test.tsx`

**Idée ouverte sur la carte (FR-013 révisée, 2026-09-29)**
- [x] T061 Clic → volet latéral (`IdeaPanel`, 62/38) et arbre de l'idée sur la carte (`IdeaTree`, `ideaTreeLayout`, `ViewportPortal`) ; autres idées estompées ; recentrage ; Échap / clic dans le vide / × referment ; éclosion sur place avec résorption des sous-neurones ; double-clic sans effet ; `DiveView` / `DiveStage` retirés `tests/unit/ui/idea-tree.test.ts`, `tests/unit/renderer/{dive,preview,hatched,canvas-create}.test.tsx`

**Retours de test du 2026-09-29 (lots A et B)**
- [x] T062 Lot A : champ de réponse vidé au changement de question (sélection retenue, pas de vidage sur rafraîchissement) ; zone de réponse qui grandit ; « Répondre » jamais grisé sans explication ; `neuron:thought` garanti ; arbre qui suit l'idée glissée (ressort)
- [x] T063 Lot B : lien sans libellé, graine qui remplace le lien (FR-033) ; nœuds « idée » (FR-032)
- [x] T066 Physique de toute la carte (FR-034) : `CanvasPhysics` (d3-force continu), arbre de l'idée ouverte en nœuds React Flow (glissables), épinglage mémorisé (migration `0008_neuron_pinned`), « Libérer »
- [x] T067 Suppression d'une idée avec avertissement, annulable (FR-035, `neuron:remove`, lot `delete`)
- [x] T068 Idée suggérée éclose en idée à part entière (FR-036, `growth:promoteIdea`, lot `promote`, place d'un neurone annulable) ; « Verrouiller « idée » » ; double-clic sur un objet ≠ nouvelle idée
- [x] T070 Idée de départ (décision du 2026-09-30) : retrait de « Faire éclore cette idée » (`growth:promoteIdea`) ; idée de départ en hexagone à la couleur réservée `--color-seed` ; fiche « Idée de départ » dans le volet (texte d'origine + résumé par l'IA locale, tâche `resumer`, migration 0012 + down)
- [x] T071 Prochaine étape sur la carte (FR-037) : `nextStepOf` (document en cours), `steps` dans `canvas:get`, `canvas:saveStepPosition` (migration 0013 `idea_steps` + down), `StepNode` (étiquette en flèche, non modifiable, « Brainstormer cette étape »), corps physique relié à son idée
- [x] T069 **URGENT** : consommation API trop élevée (~5 € en une journée de tests, 29/09) — mesurer `ai_calls` par type de tâche et par jour, puis proposer des économies (modèle par tâche, fréquence d'`etendre`, recherches web, cache) ; **identifier tâche par tâche ce qui peut passer sur l'IA locale** (coût mesuré, qualité testée sur le vrai modèle local, recommandation de routage)
- [x] T064 Lot C : cycle 2 après éclosion (anciens sous-nœuds en données seulement, nouvelles questions depuis la synthèse) + synthèse en document lisible
- [ ] T065 Lot D : index de tags (IA à l'éclosion + mots-clés locaux) pour des questions orientées par les autres idées

---

## Phase 7: User Story 5 — Neurones éclos : suivi, lecture, réouverture, export (Priority: P2)

- [ ] T034 [P] [US5] Tests `computeStatuses` (après/déclencheur/branches inactives/statuts utilisateur, cascade) `tests/unit/plan/statuses.test.ts`
- [ ] T035 [P] [US5] Intégration `PlanService` (statut + propagation, branche, déclencheur, édition, ajout de tâche ; `change_log` `manual_edit`) `tests/integration/plan/plan-service.test.ts`
- [ ] T036 [P] [US5] Tests `renderNeuronMarkdown` (Action et Réflexion, liens, caractères spéciaux, nom de fichier assaini) `tests/unit/markdown/render.test.ts`
- [ ] T037 [US5] `computeStatuses` + `PlanService` + handlers `plan:*`
- [ ] T038 [US5] `PlanFollowUp` (tâches à statut, conditions en losange + choix de branche, déclencheurs, édition) et `ReflectionReader` (sections + accès aux sous-neurones sources)
- [ ] T039 [US5] `MarkdownExporter` (dialogue natif, écriture main) + handler `export:markdown` + bouton Exporter ; bouton Rouvrir (`fusion:reopen` 002)

---

## Phase 8: User Story 6 — À valider, historique, réglages, premier lancement (Priority: P2)

- [x] T040 [P] [US6] Intégration `HistoryService` : annulation exacte d'une fusion (racine → développement, plan/synthèse non courants, synthèse `proposed`/`stale`, exemple retiré), conflit après réouverture + réponses, annulation annulable `tests/integration/history/undo.test.ts`
  *(le lot inverse enregistre l'état réel avant restauration → annuler une annulation rétablit exactement ; l'exemple appris est désormais consigné dans le lot d'éclosion ; les suggestions de liens nées de l'éclosion sont retirées)*
- [x] T041 [US6] `HistoryService` + handlers `history:*` + `HistoryPage`
  *(annulables : éclosions, liens, annulations ; la réouverture (`manual_edit`) est listée mais pas encore annulable)*
- [ ] T042 [US6] `PendingPage` (liens suggérés avec justification, aperçus en attente) + handler `pending:list` + compteur `pending:countChanged` (navigation + tray)
- [ ] T043 [P] [US6] `SettingsPage` (raccourci, démarrage, thème, animations, liens vers réglages IA/Contexte 001) + test composant
- [ ] T044 [US6] `OnboardingFlow` (IA locale + raccourci obligatoires ; Claude, profil facultatifs) + test composant

---

## Phase 9: Polish

- [ ] T045 [P] Revue sécurité (preloads, CSP, export, navigation) — checklist constitution I
- [ ] T046 [P] Passe accessibilité globale (contrastes catégories clair/sombre, focus, libellés ARIA des neurones)
- [ ] T047 [P] Intégration de la direction visuelle de mentalyas dans `tokens.css` (couleurs, typographie) quand elle est fournie
- [ ] T048 [P] Packaging `electron-builder` en **brouillon soumis à revue**
- [ ] T049 Quickstart complet (dont SC-002 chronométré, SC-004 avec seed-demo) ; `docs/JOURNAL.md`, `CLAUDE.md`

---

## Dependencies & Execution Order

- Prérequis : 001 + 002. Setup → Foundational → **US1 → US2 → US3 → US4** (MVP-1) → US5 → US6 → Polish.
- US3 dépend de US2 (plongée depuis le canvas) ; US4 dépend de US3 ; **T029 (spike) avant T033**.
- US5 : `computeStatuses` (T034/T037) avant `PlanFollowUp` ; export indépendant.
- US6 : historique dépend de US4 (lots de fusion).

### Parallel Opportunities
- Foundational : T005–T008, T010 en parallèle après T003/T004.
- US2 : T017/T018/T020 en parallèle ; US3 : T023/T024 ; US5 : T034/T035/T036.

## Implementation Strategy

1. **MVP-1** : Foundational + US1 → US4 (le cœur visuel du Brainstormer).
2. Puis US5 (suivi, export), US6 (À valider, historique, réglages, premier lancement), Polish.
3. Tests verts, JOURNAL, **commit après confirmation de mentalyas**.
