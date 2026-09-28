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

- [ ] T003 Clés `settings` `app.*` + `capture.draft` (migration avec `down`)
- [ ] T004 `WindowManager` (fenêtre principale à la demande, capture pré-chargée cachée, toutes durcies) + preloads `main.ts` / `capture.ts` distincts
- [ ] T005 [P] `lifecycle.ts` : instance unique, `--hidden`, `setLoginItemSettings`
- [ ] T006 [P] `TrayController` (Capturer / Ouvrir / À valider (n) / Quitter)
- [ ] T007 [P] Handlers `app:*` + événement `app:navigate`
- [ ] T008 [P] Motion : `useReducedMotionPreference` (système OU `app.motion`), `durations.ts` (FR-025), `MotionConfig` global + tests `tests/unit/ui/motion.test.ts`
- [ ] T009 `AppShell` : navigation Idées · À valider (compteur) · Historique, ⚙, thème, QueryClient (invalidation sur événements 002), Zustand
- [ ] T010 [P] Tests composants coquille (clavier, focus visible, axe clair/sombre) `tests/unit/renderer/app-shell.test.tsx`

**Checkpoint**: app installable, démarre en arrière-plan, navigue

---

## Phase 3: User Story 1 — Capture (Priority: P1) 🎯 MVP

- [ ] T011 [P] [US1] Intégration `CaptureService` : neurone créé sans IA, nature/catégorie appliquées ensuite, choix `user` jamais écrasé, brouillon, texte vide `tests/integration/capture/capture.test.ts`
- [ ] T012 [P] [US1] Composant `CaptureApp` (touches, compteur, confirmation, brouillon, axe) `tests/unit/renderer/capture-app.test.tsx`
- [ ] T013 [US1] `CaptureService` (→ `NeuronService.create` 002) + `GlobalShortcut` (échec → notification + réglage) + affichage écran du curseur + fermeture `blur()`/`hide()`
- [ ] T014 [US1] Handlers `capture:*` (preload de capture uniquement) ; `diveNow` → `app:openMain { diveRootId }`
- [ ] T015 [US1] `CaptureApp.tsx` (E1)
- [ ] T016 [US1] Vérification manuelle focus/délai + vidéo plein écran (quickstart #1) consignée

---

## Phase 4: User Story 2 — Écran Idées : incubateur & réseau (Priority: P1) 🎯 MVP

- [ ] T017 [P] [US2] Tests `forceLayout` : bruts/en dév. contraints à gauche, éclos à droite, pas de chevauchement, positions stables après convergence, dérive suspendue pendant l'interaction `tests/unit/ui/layout.test.ts`
- [ ] T018 [P] [US2] Intégration `CanvasService.get` (compteurs, répartition, filtres, recherche, liens acceptés + suggérés) + `savePositions` `tests/integration/canvas/canvas.test.ts`
- [ ] T019 [US2] `CanvasService` + handlers `canvas:*`
- [ ] T020 [P] [US2] Nœuds personnalisés `RawNode` (pointillé), `DevelopingNode`, `HatchedNode` (double anneau + halo Motion), couleurs de catégorie AA, **badge « proposé par l'IA » sur nature/catégorie + changement en un clic (menu contextuel)** *(analyse C1, FR-008)* ; arête `LabeledEdge` (libellé ; pointillés + ✓/✗ si suggérée)
- [ ] T021 [US2] `IdeasCanvas` (React Flow) : deux zones, en-tête compteurs, « + Une idée ? », zoom/recentrer, filtres, recherche, état vide, `onlyRenderVisibleElements`, dérive des bruts (coupée en mode réduit)
- [ ] T050 [US2] Type de nœud « bloc » (conteneur vide : placer, déplacer, redimensionner, supprimer ; position/taille persistées ; aucun code exécuté) — support des mini-widgets v2 (FR-026, L4c)
- [ ] T022 [US2] Navigation clavier du canvas (Tab entre neurones, Entrée = plonger, flèches = déplacer la vue) + test `tests/unit/renderer/canvas-keyboard.test.tsx`

---

## Phase 5: User Story 3 — Plongée & croissance (Priority: P1) 🎯 MVP

- [ ] T023 [P] [US3] Tests `radialLayout` (centre, arc des enfants, parent à gauche, emplacements « + ») `tests/unit/ui/radial.test.ts`
- [ ] T024 [P] [US3] Tests composants `QuestionPanel` + `Gauge` + `Breadcrumb` (réponses rapides, texte, « Je ne sais pas », « Plus de questions », « Ajouter ma branche », écarter ; jauge + manques ; remonter ; clavier ; axe) `tests/unit/renderer/dive.test.tsx`
- [ ] T025 [US3] `CanvasService.dive` (`DiveView` : fil d'Ariane, focus, parent, enfants, extensions, jauge, synthèse, résultat) + handler `dive:get`
- [ ] T026 [US3] `DiveView` : transition de plongée/remontée (400 ms, réduite si besoin), disposition radiale, sous-neurones, emplacements « + », parent estompé cliquable, badge de profondeur
- [ ] T027 [US3] `QuestionPanel`, `Gauge`, `Breadcrumb` branchés sur `growth:*` (002) ; sous-neurone affiché **immédiatement** (mise à jour optimiste confirmée par l'événement) + indicateur « réfléchit… » ; pousse animée 250 ms
- [ ] T051 [US3] Neurones fantômes (FR-027) : rendu pointillé rattaché au neurone, accepter (Tab/clic → `growth:acceptSuggestion`, solidification animée) / ignorer (Échap/× → `growth:dismissSuggestion`), indicateur de vérification web + sources au survol/focus (liens externes via `shell.openExternal` en liste blanche http/https), mise à jour sur `suggestion:updated`, tests clavier + lecteur d'écran
- [ ] T028 [US3] Édition/suppression de sous-neurone (confirmation si descendants), changement de nature/catégorie depuis la plongée

---

## Phase 6: User Story 4 — Verrouiller, aperçu, fusion (Priority: P1) 🎯 MVP

- [ ] T029 [US4] **Spike** animation de fusion : interpoler avec Motion les positions des sous-neurones React Flow vers le parent (600–800 ms) + changement d'aspect ; repli overlay SVG si non concluant ; décision consignée dans research.md (R3)
- [ ] T030 [P] [US4] Tests `SynthesisPreview` (Action : tâches/conditions/dates éditables ; Réflexion : sections ; Réviser/Refuser/Confirmer ; périmé non confirmable ; avertissement « insuffisant » avec manques ; axe) `tests/unit/renderer/preview.test.tsx`
- [ ] T031 [US4] Canal `fusion:editProposed` (patch revalidé P1–P6/S1) côté main + test d'intégration `tests/integration/fusion/edit-proposed.test.ts`
- [ ] T032 [US4] `SynthesisPreview` branché sur `fusion:lock|revise|reject|confirm|editProposed` (002/003)
- [ ] T033 [US4] `FusionAnimation` (résorption → aspect éclos → migration vers le réseau ~600 ms ; fondu court en mode réduit) + notification « Annuler » 10 s

**Checkpoint**: MVP-1 démontrable — capturer, voir, plonger, faire pousser, verrouiller, voir éclore

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

- [ ] T040 [P] [US6] Intégration `HistoryService` : annulation exacte d'une fusion (racine → développement, plan/synthèse non courants, synthèse `proposed`/`stale`, exemple retiré), conflit après réouverture + réponses, annulation annulable `tests/integration/history/undo.test.ts`
- [ ] T041 [US6] `HistoryService` + handlers `history:*` + `HistoryPage`
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
