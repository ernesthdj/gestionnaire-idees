---
description: "Task list — 003 Interface MVP-1 (F1 · F3 · F4)"
---

# Tasks: Interface MVP-1 — coquille, capture, validation, organigramme

**Input**: Design documents from `/specs/003-interface-mvp1/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ ; **features 001 et 002 terminées**

**Tests**: **Obligatoires** (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>` ; aucun réseau.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Faire valider puis installer les dépendances annoncées (research.md § Dépendances) ; configurer Vitest en `jsdom` pour `tests/unit/renderer`
- [ ] T002 [P] Fixtures FICTIVES : propositions (dont « 2e écran » acceptable), arbres, et script `scripts/seed-demo.ts` (50 idées / 300 nœuds) + commande `npm run seed:demo`, dans `tests/fixtures/mvp1/`

---

## Phase 2: Foundational (coquille)

**⚠️ CRITICAL**: requis par toutes les stories

- [ ] T003 Migration : `proposals` (+ `archived`, `selection_json`, `batch_id`), `change_log` (+ `batch_id`, `kind`, `undone_by_batch`), clés `settings` `app.*` et `capture.draft` (data-model.md) avec `down`
- [ ] T004 `WindowManager` : fenêtre principale (créée à la demande, cachée à la fermeture) et fenêtre de capture pré-chargée cachée, toutes deux durcies ; deux preloads distincts `src/preload/main.ts` / `src/preload/capture.ts` dans `src/main/shell/WindowManager.ts`
- [ ] T005 [P] Instance unique + lancement `--hidden` + `setLoginItemSettings` dans `src/main/shell/lifecycle.ts`
- [ ] T006 [P] `TrayController` (menu Capturer / Ouvrir / À valider (n) / Quitter, info-bulle, icône avec pastille) dans `src/main/shell/TrayController.ts`
- [ ] T007 [P] Handlers `app:getSettings|setSettings|completeOnboarding|openMain` + événement `app:navigate` dans `src/main/ipc/appHandlers.ts` (validation Zod, `SHORTCUT_UNAVAILABLE`)
- [ ] T008 `AppShell` : navigation latérale (Idées, À valider + badge, Organigramme, Historique), ⚙ en haut à droite, Zustand (section/sélection), QueryClient (invalidation sur événements), thème clair/sombre/système dans `src/renderer/src/app/AppShell.tsx` ; intégrer `IdeasPage`/`QuestionnairePage` de 002 (fin de la route provisoire)
- [ ] T009 [P] Tests composants de la coquille (navigation au clavier, focus visible, axe sans violation en clair et sombre) dans `tests/unit/renderer/app-shell.test.tsx`

**Checkpoint**: app installable qui démarre en arrière-plan, s'ouvre depuis l'icône et navigue

---

## Phase 3: User Story 1 — Capture rapide (Priority: P1) 🎯 MVP

**Goal**: raccourci → saisie → `Entrée` → idée enregistrée, focus rendu, catégorisation en arrière-plan

**Independent Test**: depuis une autre app, capturer une idée ; IA arrêtée → « À classer » puis catégorie rejouée

### Tests ⚠️
- [ ] T010 [P] [US1] Intégration `CaptureService` : idée enregistrée IA arrêtée (SC-002) ; demande `categoriser` mise en file (001 LocalQueue) puis appliquée ; catégorie `user` jamais écrasée (FR-010) ; brouillon conservé ; texte vide rejeté dans `tests/integration/capture/capture.test.ts`
- [ ] T011 [P] [US1] Composant `CaptureApp` : `Entrée`, `Maj+Entrée`, `Ctrl+Entrée`, `Échap`, compteur 2 000, confirmation, restauration du brouillon ; axe dans `tests/unit/renderer/capture-app.test.tsx`

### Implementation
- [ ] T012 [US1] `CaptureService` (création via `IdeaService` 002, catégorisation non bloquante via AIGateway 001, application conditionnelle) dans `src/main/application/capture/CaptureService.ts`
- [ ] T013 [US1] `GlobalShortcut` (enregistrement, échec → événement `shortcut:unavailable` + notification, ré-enregistrement au changement de réglage) dans `src/main/shell/GlobalShortcut.ts`
- [ ] T014 [US1] Affichage de la capture sur l'écran du curseur, centre-haut ; fermeture `blur()` + `hide()` pour rendre le focus (R2) dans `WindowManager.ts`
- [ ] T015 [US1] Handlers `capture:getDraft|saveDraft|submit|close` (exposés **uniquement** au preload de capture) ; `structureNow` → `app:openMain` sur le questionnaire dans `src/main/ipc/captureHandlers.ts`
- [ ] T016 [US1] `CaptureApp` (E1) dans `src/renderer/src/capture/CaptureApp.tsx`
- [ ] T017 [US1] Badge « proposée par l'IA » + changement de catégorie en un clic dans `IdeasPage` ; événement `idea:categorized`
- [ ] T018 [US1] Vérification manuelle focus/délai (quickstart #1, #2, #7) **+ capture au-dessus d'une vidéo plein écran et d'un jeu fenêtré sans vol durable du focus** consignée dans `quickstart.md` § Résultats *(analyse C3)*

**Checkpoint**: capture quotidienne utilisable

---

## Phase 4: User Story 2 — Revue & validation (Priority: P1) 🎯 MVP

**Goal**: file À valider, revue éditable, acceptation tout-ou-rien, refus, correction, périmée, annulation

**Independent Test**: fixture « 2e écran » → décocher, corriger un montant, accepter → arbre ; annuler → état initial

### Tests ⚠️
- [ ] T019 [P] [US2] Purs : `buildReviewItems` (add/update/remove), `checkExclusions` (dépendantes → `DEPENDENCY_EXCLUDED` + `blockedRefs`), `applySelection` (éditions validées) dans `tests/unit/review/review-domain.test.ts`
- [ ] T020 [P] [US2] Intégration `ProposalApplier` : création nœuds/dépendances/liens, ref→uuid, statuts recalculés, `change_log` par lot, version idée +1, exemple positif enregistré ; **erreur injectée à chaque étape → aucune donnée modifiée** (SC-004) ; `STALE` si version changée dans `tests/integration/review/apply.test.ts`
- [ ] T021 [P] [US2] Intégration refus (raison → exemple négatif via `ExampleStore.record`), correction (`superseded` + nouvelle proposition), nouvelle proposition sur même idée → ancienne `superseded`, archivage > 14 j dans `tests/integration/review/lifecycle.test.ts`
- [ ] T022 [P] [US2] Intégration annulation par lot : restauration exacte (SC-005), conflit après édition manuelle → `UNDO_CONFLICT` avec liste, annulation elle-même annulable ; **annulation d'une acceptation** → idée revenue à son statut et sa version d'avant, proposition → `pending` (ou `stale` si l'idée a changé depuis), exemple positif retiré dans `tests/integration/history/undo.test.ts` *(analyse I2)*
- [ ] T051 [P] [US2] Intégration `revise` : correction d'une **première** décomposition (idée non structurée) → nouvelle proposition validée (K1–K7), ancienne `superseded`, tours d'origine réutilisés + consigne ; correction d'une restructuration idem dans `tests/integration/review/revise.test.ts` *(analyse I1)*

### Implementation
- [ ] T023 [P] [US2] Domaine revue (`buildReviewItems`, `checkExclusions`, `applySelection`) dans `src/main/domain/review/`
- [ ] T024 [US2] `ProposalApplier` (transaction unique, R6) dans `src/main/application/review/ProposalApplier.ts`
- [ ] T052 [US2] Ajouter `StructuringService.revise(proposalId, instruction)` (feature 002) : reprend les tours de la session d'origine + la consigne, appelle `decomposer`/`restructurer` selon l'origine, applique K1–K7 et la provenance, crée la nouvelle proposition et passe l'ancienne à `superseded` — `src/main/application/structuring/StructuringService.ts` *(analyse I1)*
- [ ] T025 [US2] `ReviewService` (list, get, accept, reject, correct **via `StructuringService.revise`** (T052), supersede) dans `src/main/application/review/ReviewService.ts`
- [ ] T026 [US2] `HistoryService` (list paginée, undo par lot avec contrôle de conflit, R7 ; pour un lot `accept` : restaurer statut/version de l'idée, remettre la proposition `pending`/`stale`, retirer l'exemple positif) dans `src/main/application/history/HistoryService.ts`
- [ ] T027 [P] [US2] `PeriodicJobs` (archivage 14 j, filet « périmée », au démarrage + toutes les 6 h) dans `src/main/application/maintenance/PeriodicJobs.ts`
- [ ] T028 [US2] Handlers `review:*` et `history:*` + événement `review:countChanged` (badge nav + tray) dans `src/main/ipc/reviewHandlers.ts`, `historyHandlers.ts`
- [ ] T029 [US2] `ReviewListPage` (E8) et `ReviewPage` (E5 : aperçu arbre + liste des changements, cases, édition RHF+Zod, avertissement dépendances, Refuser/Corriger/Accepter, indicateurs périmée/dégradée) dans `src/renderer/src/pages/review/`
- [ ] T030 [US2] Notification post-acceptation avec « Annuler » (10 s) et `HistoryPage` (E10) dans `src/renderer/src/pages/history/HistoryPage.tsx`
- [ ] T031 [P] [US2] Tests composants `ReviewPage` (clavier complet, axe, avertissement de dépendance) dans `tests/unit/renderer/review-page.test.tsx`

**Checkpoint**: MVP fonctionnel de bout en bout — idée → questions → proposition → validation → arbre

---

## Phase 5: User Story 3 — Organigramme (Priority: P1) 🎯 MVP

**Goal**: carte des idées, arbre déplié, statuts propagés, branches, déclencheurs, édition, filtres, détail

**Independent Test**: arbre « 2e écran » accepté → « Non » + « Mission payée » → « Réserver X € » prête, « Oui » grisé

### Tests ⚠️
- [ ] T032 [P] [US3] `computeStatuses` : dépendances `after_done`, déclencheurs, branches inactives, statuts fixés par l'utilisateur, cascade sur 3 niveaux dans `tests/unit/tree/statuses.test.ts`
- [ ] T033 [P] [US3] Intégration `TreeService` : setNodeStatus (transitions invalides refusées), chooseBranch, setTrigger, editNode, addTask (profondeur ≤ 5), savePositions ; chaque changement → `change_log` `manual_edit` + version idée +1 + événement `tree:changed` ; **`map:overview` : filtres catégorie et statut, recherche, focus + voisines directes** dans `tests/integration/tree/tree-service.test.ts` *(analyse C1)*

### Implementation
- [ ] T034 [P] [US3] `computeStatuses` + règles de branches/déclencheurs dans `src/main/domain/tree/`
- [ ] T035 [US3] `TreeService` + `map:overview` (filtres catégorie/statut, recherche FTS5, focus + voisines) dans `src/main/application/tree/TreeService.ts`
- [ ] T036 [US3] Handlers `map:*` et `tree:*` dans `src/main/ipc/treeHandlers.ts`
- [ ] T037 [P] [US3] Nœuds personnalisés React Flow (idée repliée/dépliée, tâche avec statut, condition en losange, opportunité €) avec couleurs de catégorie AA dans `src/renderer/src/pages/map/nodes/`
- [ ] T038 [US3] `MapPage` (E6, split 62/38) : React Flow, dagre à la première ouverture, positions mémorisées, MiniMap/Controls, filtres, recherche, focus, état vide, `onlyRenderVisibleElements` dans `src/renderer/src/pages/map/MapPage.tsx`
- [ ] T039 [US3] `DetailPanel` : idée d'origine, dépendances, montant, branche (choix), statut, déclencheur (atteint), édition RHF+Zod, « Ajouter une tâche » dans `src/renderer/src/pages/map/DetailPanel.tsx`
- [ ] T040 [US3] Navigation clavier dans la carte (Tab entre nœuds, Entrée ouvrir/déplier, flèches pour déplacer la vue) + test composant `tests/unit/renderer/map-keyboard.test.tsx`
- [ ] T041 [US3] Vérification de fluidité 50 idées / 300 nœuds (`npm run seed:demo`, quickstart #5) consignée dans `quickstart.md` § Résultats

**Checkpoint**: MVP-1 complet côté fonctionnalités (F1, F2, F3, F4, F9)

---

## Phase 6: User Story 4 — Navigation & réglages (Priority: P2)

- [ ] T042 [P] [US4] Test composant `SettingsPage` (raccourci validé/indisponible, démarrage Windows, thème, limite 3..15, lien réglages IA) dans `tests/unit/renderer/settings-page.test.tsx`
- [ ] T043 [US4] `SettingsPage` (E9) : raccourci (capture de la combinaison), démarrage avec Windows, thème, nombre max de questions, accès aux pages IA/Contexte de 001, relancer le premier lancement dans `src/renderer/src/pages/settings/SettingsPage.tsx`
- [ ] T044 [US4] Vérification manuelle démarrage Windows + icône (quickstart #6)

---

## Phase 7: User Story 5 — Premier lancement (Priority: P3)

- [ ] T045 [P] [US5] Test composant du parcours (étapes obligatoires/facultatives, ne réapparaît pas) dans `tests/unit/renderer/onboarding.test.tsx`
- [ ] T046 [US5] `OnboardingFlow` (E11) : Bienvenue → IA locale (statut 001 + guidage) → Raccourci (essai immédiat) → Claude (facultatif, page 001) → Profil (facultatif, import 001) → Fin (« capture ta première idée ») dans `src/renderer/src/pages/onboarding/OnboardingFlow.tsx`

---

## Phase 8: Polish & Cross-Cutting

- [ ] T047 [P] Revue sécurité : chaque preload n'expose que ses canaux ; CSP des 2 fenêtres ; aucune navigation externe ; checklist constitution I
- [ ] T048 [P] Passe accessibilité globale (contrastes des 6 couleurs de catégorie en clair/sombre, focus, libellés) — correctifs
- [ ] T049 [P] Packaging `electron-builder` (installeur NSIS, icônes tray, modules natifs) en **brouillon soumis à revue** (constitution : pas de modification de packaging sans revue)
- [ ] T053 Mesure SC-003 : relecture + acceptation de 5 propositions fixtures (≤ 15 éléments) chronométrées, objectif < 1 min chacune, consignée dans `quickstart.md` § Résultats *(analyse C2)*
- [ ] T050 Exécuter tout `quickstart.md` ; mettre à jour `docs/JOURNAL.md` et `CLAUDE.md` (commandes, état MVP-1)

---

## Dependencies & Execution Order

- **Prérequis** : 001 (AIGateway, LocalQueue, ExampleStore, réglages IA) et 002 (IdeaService, propositions, modèle central).
- Setup → Foundational → **US1 → US2 → US3** (MVP-1) → US4 → US5 → Polish.
- US3 dépend de US2 (arbres créés par l'acceptation) ; US2 réutilise `computeStatuses` (T034) → faire T032/T034 **avant** T024.
- US5 dépend de US4 (réglages) et de 001 (pages IA).

### Parallel Opportunities
- Foundational : T005, T006, T007, T009 en parallèle après T003/T004.
- US2 : T019–T022 en parallèle ; T023 et T027 en parallèle ; puis T024 → T025/T026 → T028 → T029/T030.
- US3 : T032/T033 ; T034 et T037 en parallèle ; puis T035 → T036 → T038 → T039 → T040.

## Parallel Example: User Story 2

```text
Tests : T019 domaine · T020 apply · T021 lifecycle · T022 undo
Impl. : T023 domaine revue ‖ T027 jobs → T024 applier → T025 service ‖ T026 history → T028 handlers → T029 écrans ‖ T030
```

## Implementation Strategy

1. **MVP-1** : Foundational + US1 + US2 + US3 → l'app complète du quotidien (capturer, structurer, valider, suivre).
2. Puis US4 (réglages), US5 (premier lancement), Polish (packaging en brouillon revu).
3. Chaque incrément : tests verts, JOURNAL, **commit uniquement après confirmation de mentalyas**.
