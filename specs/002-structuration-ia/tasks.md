---
description: "Task list — 002 Moteur de neurones (F2 v2)"
---

# Tasks: Moteur de neurones — croissance, jauge, fusion, réseau

**Input**: Design documents from `/specs/002-structuration-ia/` (révision « Brainstormer »)

**Prerequisites**: feature 001 (Setup, Foundational, US1, US2 au minimum) avec cadre v2 et TaskKind révisés

**Tests**: **Obligatoires** (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>` ; FakeProvider.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Créer `src/main/domain/neurons`, `src/main/application/neurons`, `tests/{unit,integration,fixtures}/neurons`
- [ ] T002 [P] Fixtures FICTIVES : arbres « 2e écran » (Action), « concept portfolio » (Réflexion), « mission mariage » ; 20 arbres pour la provenance ; sorties IA scriptées dans `tests/fixtures/neurons/`

---

## Phase 2: Foundational (modèle central)

**⚠️ CRITICAL**: requis par toutes les stories et par la spec 003

- [ ] T003 Schéma Drizzle : `categories`, `neurons`, `extensions`, `context_assessments`, `syntheses`, `plan_nodes`, `plan_dependencies`, `reflection_summaries`, `neuron_links`, `change_log`, `settings` dans `src/main/infrastructure/db/schema.ts` (data-model.md)
- [ ] T004 Migration avec `down` + seed catégories et `settings` (`neurons.max_ai_depth = 6`, `neurons.min_extensions = 3`) + FTS5 `neurons_fts` et triggers
- [ ] T005 [P] Schémas Zod de sortie IA (`CategoriserOut`, `EtendreOut`, `ActionPlanOut`, `ReflectionSummaryOut`, `SuggererLiensOut`) dans `src/shared/ai/neurons.ts`
- [ ] T006 [P] Schémas Zod IPC + vues (`RootView`, `TreeView`, `SynthesisView`, `LinkView`) dans `src/shared/ipc/neurons.ts`
- [ ] T007 [P] Repositories + test d'intégration CRUD (cascade de suppression incluse) dans `src/main/infrastructure/db/repositories/` et `tests/integration/neurons/repositories.test.ts`
- [ ] T008 [P] Tests puis `NeuronService` (création, liste filtrée/paginée, recherche FTS5, mise à jour qui incrémente `version`, archivage, catégorisation locale non bloquante qui n'écrase jamais un choix `user`) — `tests/unit/neurons/neuron-service.test.ts`, `src/main/application/neurons/NeuronService.ts` (FR-001/002)
- [ ] T009 Handlers `neuron:*` dans `src/main/ipc/neuronHandlers.ts`

**Checkpoint**: neurones créables, listables, catégorisés en arrière-plan

---

## Phase 3: User Story 1 — Croissance (Priority: P1) 🎯 MVP

### Tests ⚠️
- [ ] T010 [P] [US1] Garde-fous E1–E3 (≥ 3 au démarrage + retry + repli, doublons, profondeur 6), cascade, idempotence `from_extension_id` dans `tests/unit/neurons/growth.test.ts`
- [ ] T011 [P] [US1] Intégration : develop → answer ×2 → addBranch → dismiss → more ; persistance après redémarrage simulé ; `out_of_scope` → message et aucune extension ; `ALREADY_ANSWERED` ; **le sous-neurone est persisté et renvoyé (événement) avant l'appel IA** *(analyse C1)* dans `tests/integration/neurons/growth.test.ts`

### Implementation
- [ ] T012 [P] [US1] `domain/neurons/tree.ts` (`growthDepth` ≤ 6, distincte de `planDepth` ≤ 5 du plan ; chemin racine→cible, descendants) et `guards.ts` (E1–E3)
- [ ] T013 [P] [US1] `ContextBuilder` (nature, chemin complet, autres branches résumées, extensions écartées, borne ~3 000 tokens, alias `s1…sN`) dans `src/main/application/neurons/ContextBuilder.ts`
- [ ] T014 [US1] `GrowthService.develop/answer/more/dismiss/addBranch` : sous-neurone écrit **avant** l'appel IA (retour immédiat), appel `etendre`, création des extensions, événement `neuron:thinking` — `src/main/application/neurons/GrowthService.ts`
- [ ] T015 [US1] Handlers `growth:*` dans `src/main/ipc/growthHandlers.ts`

**Checkpoint**: un neurone pousse de bout en bout (sans interface : via tests d'intégration)

---

## Phase 4: User Story 2 — Jauge (Priority: P1) 🎯 MVP

- [ ] T016 [P] [US2] Tests jauge : plancher < 3 réponses, niveaux, manques, `ai_level` conservé dans `tests/unit/neurons/gauge.test.ts`
- [ ] T017 [US2] `domain/neurons/gauge.ts` + enregistrement `context_assessments` dans `GrowthService` (même appel `etendre`, FR-009)

---

## Phase 5: User Story 3 — Verrouillage, synthèse, éclosion (Priority: P1) 🎯 MVP

### Tests ⚠️
- [ ] T018 [P] [US3] Contrôles P1–P5 et S1 (refs, branches 2..4, profondeur plan ≤ 5, Kahn, `sourceRefs`) dans `tests/unit/neurons/plan-checks.test.ts`
- [ ] T019 [P] [US3] Provenance P6 : extraction FR des montants/dates, 0 valeur inventée sur 20 arbres, nœud « à trouver » ajouté dans `tests/unit/neurons/provenance.test.ts`
- [ ] T020 [P] [US3] Intégration fusion : `CONTEXT_INSUFFICIENT` sans `force`, verrouillage forcé, synthèse Action et Réflexion, rien d'écrit avant confirm, confirm tout-ou-rien (erreur injectée à chaque étape), `STALE` après modification de l'arbre, revise (`superseded`), reject, reopen (plan/synthèse « précédents » conservés), exemple positif enregistré dans `tests/integration/neurons/fusion.test.ts`

### Implementation
- [ ] T021 [P] [US3] `domain/neurons/planChecks.ts` (P1–P5 + Kahn) et `provenance.ts` + `extractValues.ts` (P6)
- [ ] T022 [US3] `FusionService.lock/revise/reject` (appels `synthetiser`/`reviser`, contrôles, une seule synthèse `proposed`) dans `src/main/application/neurons/FusionService.ts`
- [ ] T023 [US3] `SynthesisApplier` (transaction, `base_version`, écriture plan ou synthèse, état `hatched`, version +1, `change_log` avec `batch_id`, `ExampleStore.record`) et `reopen` dans `src/main/application/neurons/SynthesisApplier.ts`
- [ ] T024 [US3] Handlers `fusion:*` + événement `synthesis:stale` dans `src/main/ipc/fusionHandlers.ts`

**Checkpoint**: MVP du moteur — pousser, jauger, verrouiller, éclore (Action et Réflexion)

---

## Phase 6: User Story 4 — Liens (Priority: P2)

- [ ] T025 [P] [US4] Tests : candidats (≤ 10, alias N1–N10), alias inconnu retiré, empreinte des refus, paire ordonnée, doublon, création manuelle dans `tests/unit/neurons/links.test.ts` et `tests/integration/neurons/links.test.ts`
- [ ] T026 [US4] `CandidateFinder` + `LinkService` (appel `suggerer_liens` après confirmation, décisions, CRUD) + handlers `links:*` + événement `links:suggested`

---

## Phase 7: User Story 5 — Nature (Priority: P2)

- [ ] T027 [P] [US5] Tests : nature proposée/choisie, jamais écrasée ; changement en cours de développement → la liste de dimensions de référence transmise change ; les extensions dont la `dimension` sort de la liste de la nature sont signalées (FakeProvider) dans `tests/unit/neurons/nature.test.ts` *(analyse U1)*
- [ ] T028 [US5] Prise en compte de la nature dans `ContextBuilder` : **dimensions de référence** — Action : quand, combien, comment, source d'argent, lieu, dépendances ; Réflexion : pourquoi, options, critères, contraintes, risques, décision attendue — transmises à l'IA ; choix du schéma de synthèse selon la nature *(analyse U1)*

---

## Phase 8: Polish

- [ ] T029 [P] Mode dégradé : Claude indisponible/plafond → branches manuelles possibles, extensions et synthèse en attente, drapeau `degraded` si version locale acceptée
- [ ] T030 [P] Test d'injection (texte « ignore tes règles ») et de demande d'œuvre finie → `out_of_scope`
- [ ] T031 Validations manuelles SC-002, SC-004, SC-007 (quickstart) consignées dans `quickstart.md` § Résultats
- [ ] T032 [P] `docs/JOURNAL.md`

---

## Dependencies & Execution Order

- Prérequis : 001. Setup → Foundational → **US1 → US2 → US3** (MVP moteur) → US4 → US5 → Polish.
- US2 partage l'appel de US1 (T017 après T014). US4 dépend de US3 (éclosion). US5 enrichit T013/T022.
- **Consommateur** : spec 003 (écran Idées, plongée, animations, suivi du plan, annulation, export Markdown).

### Parallel Opportunities
- Foundational : T005–T008 en parallèle après T003/T004.
- US1 : T010/T011 ; T012/T013 ; puis T014 → T015.
- US3 : T018/T019/T020 ; T021 ; puis T022 → T023 → T024.

## Implementation Strategy

1. **MVP moteur** : Foundational + US1 + US2 + US3.
2. Puis US4, US5, Polish. Tests verts, JOURNAL, **commit après confirmation de mentalyas**.
