---
description: "Task list — 002 Structuration IA (F2)"
---

# Tasks: Structuration IA — questionnaire & décomposition (F2)

**Input**: Design documents from `/specs/002-structuration-ia/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ ; **feature 001 terminée** (au moins Setup, Foundational, US1, US2)

**Tests**: **Obligatoires** (constitution V) — écrits d'abord, en échec avant l'implémentation ; `should_<comportement>_when_<condition>` ; FakeProvider, aucun réseau.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Créer les dossiers `src/main/domain/{ideas,structuring}`, `src/main/application/structuring`, `src/main/infrastructure/db/repositories`, `tests/{unit,integration,fixtures}/structuring` (plan.md)
- [ ] T002 [P] Fixtures FICTIVES : exemple « 2e écran » (questionnaire + sorties IA attendues) et 20 questionnaires pour la provenance dans `tests/fixtures/structuring/`

---

## Phase 2: Foundational (modèle central)

**⚠️ CRITICAL**: requis par toutes les stories de cette feature et par F1, F3, F4, F5

- [ ] T003 Ajouter au schéma Drizzle les tables `categories`, `ideas` (+ `version`), `structuring_sessions` (index unique partiel, `previous_idea_status`), `session_turns`, `proposals`, `nodes`, `dependencies`, `idea_links`, `change_log`, `settings` (clé/valeur, seed `structuring.question_limit = 8`) dans `src/main/infrastructure/db/schema.ts` (data-model.md)
- [ ] T004 Migration avec `down` + seed des 6 catégories + table FTS5 `ideas_fts` et ses triggers dans `src/main/infrastructure/db/migrations/`
- [ ] T005 [P] Schémas Zod de sortie IA (`QuestionOut`, `DecompositionOut`, `RestructureOut`) dans `src/shared/ai/structuring.ts` (contracts/ai-outputs.md)
- [ ] T006 [P] Schémas Zod IPC + vues (`IdeaView`, `SessionView`, `QuestionView`, `ProposalView`) dans `src/shared/ipc/structuring.ts` (contracts/ipc-structuring.md)
- [ ] T007 [P] Repositories `IdeaRepository`, `SessionRepository`, `ProposalRepository` dans `src/main/infrastructure/db/repositories/` + test d'intégration CRUD `tests/integration/structuring/repositories.test.ts`
- [ ] T008 [P] Tests puis implémentation de `IdeaService` (création, liste paginée par curseur, filtres, recherche FTS5, mise à jour qui incrémente `version`) dans `tests/unit/ideas/idea-service.test.ts` et `src/main/application/structuring/IdeaService.ts` (FR-001)
- [ ] T009 Handlers `idea:create`, `idea:list`, `idea:get`, `idea:update` dans `src/main/ipc/ideaHandlers.ts`

**Checkpoint**: idées créables et listables — les stories peuvent démarrer

---

## Phase 3: User Story 1 — Répondre au questionnaire (Priority: P1) 🎯 MVP

**Goal**: questions une à une, réponses rapides, limite 8, reprise, abandon

**Independent Test**: idée → start → 3 réponses (FakeProvider) → enchaînement, persistance, arrêt à `ready`/limite

### Tests ⚠️
- [ ] T010 [P] [US1] Machine à états (toutes les transitions de data-model.md, limite lue depuis `settings`, abandon **qui restaure le statut d'avant la session** — `raw` pour décomposition, `structured` pour restructuration —, « Décompose maintenant ») dans `tests/unit/structuring/session-state.test.ts` *(analyse I1, C2)*
- [ ] T011 [P] [US1] Intégration : start → answer ×3 → ready ; idempotence (`ALREADY_ANSWERED`) ; 1 session ouverte par idée (`ALREADY_RUNNING`) ; reprise après redémarrage simulé (R7) ; **FakeProvider renvoie `out_of_scope` → message de recentrage renvoyé, compteur de questions inchangé** dans `tests/integration/structuring/questionnaire.test.ts` *(analyse C1)*

### Implementation
- [ ] T012 [P] [US1] `SessionStateMachine` pure dans `src/main/domain/structuring/SessionStateMachine.ts`
- [ ] T013 [P] [US1] `CandidateFinder` (≤ 5 idées candidates, alias I1–I5, FTS5 + catégorie, R9) dans `src/main/application/structuring/CandidateFinder.ts`
- [ ] T014 [P] [US1] `ContextBuilder` (idée + tours + candidates résumées, balisage données) dans `src/main/application/structuring/ContextBuilder.ts`
- [ ] T015 [US1] `StructuringService.start/answer/resume/abandon` (écriture du tour **avant** l'appel IA, `in_flight_since`, gestion `out_of_scope`, statut de l'idée) dans `src/main/application/structuring/StructuringService.ts`
- [ ] T016 [US1] Reprise au démarrage des sessions bloquées > 10 min (R7) dans `src/main/application/structuring/recoverSessions.ts` + appel dans `src/main/index.ts`
- [ ] T017 [US1] Handlers `structuring:start|resume|answer|abandon` + événement `structuring:thinking` dans `src/main/ipc/structuringHandlers.ts`
- [ ] T018 [P] [US1] Écran `IdeasPage` minimal (créer, filtrer, rechercher, « Structurer ») dans `src/renderer/src/pages/ideas/IdeasPage.tsx`
- [ ] T019 [US1] Écran `QuestionnairePage` (question, réponses rapides, texte, « Je ne sais pas », compteur Q n/8, « Décompose maintenant », indicateur « réfléchit… » immédiat, clavier complet, AA) dans `src/renderer/src/pages/structuring/QuestionnairePage.tsx`

**Checkpoint**: questionnaire complet utilisable

---

## Phase 4: User Story 2 — Décomposition en arbre conditionnel (Priority: P1) 🎯 MVP

**Goal**: proposition `pending` validée (K1–K4), idée inchangée

**Independent Test**: exemple « 2e écran » → proposition avec condition « argent ? » + 2 branches ; aucune écriture dans l'arbre

### Tests ⚠️
- [ ] T020 [P] [US2] Tri de Kahn + détection de boucle + profondeur dans `tests/unit/structuring/cycles.test.ts`
- [ ] T021 [P] [US2] Règles K1–K5 et K7 (références, branches 2..4, profondeur, alias candidats, nœuds existants) dans `tests/unit/structuring/consistency.test.ts`
- [ ] T022 [P] [US2] Intégration : decompose → proposition `pending` ; 1 retry puis `failed` ; `decompose` rejoué renvoie la même proposition ; **aucune ligne** dans `nodes`/`dependencies`/`idea_links` (SC-007) dans `tests/integration/structuring/decompose.test.ts`

### Implementation
- [ ] T023 [P] [US2] `topoSort` (Kahn) et `depthOf` dans `src/main/domain/structuring/graph.ts`
- [ ] T024 [P] [US2] `checkConsistency` (K1–K5, K7) dans `src/main/domain/structuring/consistency.ts`
- [ ] T025 [US2] `StructuringService.decompose` (appel `decomposer` effort haut, contrôles, 1 retry avec message d'erreur, création `proposals` avec `base_version`, statut idée `pending_review`, événement `proposal:created`)
- [ ] T026 [US2] Handler `structuring:decompose` dans `src/main/ipc/structuringHandlers.ts`
- [ ] T027 [US2] Aperçu lecture seule de la proposition en fin de questionnaire (liste arborescente simple ; la revue complète est F3) dans `src/renderer/src/pages/structuring/ProposalPreview.tsx`

**Checkpoint**: MVP de la feature — idée → questions → proposition

---

## Phase 5: User Story 3 — Ne jamais inventer (Priority: P1)

**Goal**: contrôle de provenance K6 déterministe

**Independent Test**: « je ne sais pas » au prix → tâche d'investigation, aucun montant ; montant non fourni retiré

### Tests ⚠️
- [ ] T028 [P] [US3] Extraction/normalisation des montants et dates (formats FR : `1250`, `1 250 €`, `1.250,00`, `15/11`, `15 novembre`) dans `tests/unit/structuring/extraction.test.ts`
- [ ] T029 [P] [US3] Provenance sur les 20 questionnaires fixtures : 0 valeur inventée conservée, tâche d'investigation ajoutée sous le bon parent dans `tests/unit/structuring/provenance.test.ts` (SC-002)

### Implementation
- [ ] T030 [P] [US3] Extracteur montants/dates dans `src/main/domain/structuring/extractValues.ts`
- [ ] T031 [US3] `enforceProvenance` (retrait + ajout d'investigation + compteur journalisé sans contenu) dans `src/main/domain/structuring/provenance.ts`, appelé par `decompose` (T025)

**Checkpoint**: garantie « ne jamais inventer » vérifiée

---

## Phase 6: User Story 4 — Opportunité liée (Priority: P2)

**Goal**: `detectedOpportunity` pendant le questionnaire → nœud `opportunity` + lien `finances` + déclencheur

### Tests ⚠️
- [ ] T032 [P] [US4] Intégration : réponse « mission mariage 1 250 € le 15/11 » → opportunité (montant, date) + dépendance `on_trigger` dans la proposition dans `tests/integration/structuring/opportunity.test.ts`

### Implementation
- [ ] T033 [US4] Mémoriser les `detectedOpportunity` des tours et les transmettre à `decomposer` ; accepter montant/date de l'opportunité comme provenance valide (ils viennent d'une réponse) dans `StructuringService.ts` et `provenance.ts`
- [ ] T034 [US4] Affichage de l'opportunité et du lien dans `ProposalPreview.tsx`

---

## Phase 7: User Story 5 — Restructurer (Priority: P3)

**Goal**: proposition de différences sur une idée structurée

### Tests ⚠️
- [ ] T035 [P] [US5] Intégration : idée structurée (arbre fixture) + changement → proposition `restructure` avec opérations add/update/remove, `existingNodeId` validés (K7) ; idée non structurée → `NOT_STRUCTURED` dans `tests/integration/structuring/restructure.test.ts`

### Implementation
- [ ] T036 [US5] `StructuringService.restructure` (contexte = arbre actuel + changement) + handler `structuring:restructure`
- [ ] T037 [US5] Bouton « Restructurer » + champ « Qu'est-ce qui a changé ? » dans `IdeasPage.tsx`

---

## Phase 8: Polish & Cross-Cutting

- [ ] T038 [P] Mode dégradé : handler `structuring:degraded`, indicateur `degraded` visible dans le questionnaire et l'aperçu (R8) + test `tests/integration/structuring/degraded.test.ts`
- [ ] T039 [P] Proposition périmée : événement `proposal:stale` quand `idea:update` change la version d'une idée ayant une proposition `pending` + test (FR-011)
- [ ] T040 [P] Test d'injection : texte d'idée « ignore tes règles… » → traité comme donnée (vérifier le balisage dans le contexte construit) dans `tests/unit/structuring/injection.test.ts`
- [ ] T041 Validation manuelle SC-001 (10 exécutions réelles de l'exemple « 2e écran ») et SC-004/SC-005 (chronométrage) ; consigner dans `specs/002-structuration-ia/quickstart.md` § Résultats
- [ ] T042 [P] Mettre à jour `docs/JOURNAL.md`

---

## Dependencies & Execution Order

- **Prérequis externe** : feature 001 (AIGateway, anonymisation, base chiffrée, IPC).
- Setup → Foundational → **US1 → US2 → US3** (MVP, US3 se branche dans `decompose`) → US4 → US5 → Polish.
- US4 dépend de US2 et US3 (provenance) ; US5 dépend de US2.
- **Coquille d'app** : la navigation latérale et le routage (L4) sont portés par la spec **003 « interface MVP-1 »** ; en attendant, `IdeasPage` et `QuestionnairePage` sont montées sur une route provisoire *(analyse U1)*. L'exposition de `structuring.question_limit` dans les réglages relève aussi de 003.
- **Consommateurs** : F3 appliquera les `proposals` (écrit `nodes`, `dependencies`, `idea_links`, `change_log`) ; F1 utilisera `IdeaService.create`.

### Parallel Opportunities
- Foundational : T005, T006, T007, T008 en parallèle après T003/T004.
- US1 : T010/T011 ; puis T012/T013/T014/T018 en parallèle ; T015 → T016/T017 → T019.
- US2 : T020/T021/T022 ; T023/T024 en parallèle ; puis T025 → T026 → T027.

## Parallel Example: User Story 2

```text
Tests : T020 cycles · T021 consistency · T022 decompose (intégration)
Impl. : T023 graph.ts · T024 consistency.ts   →   T025 decompose   →   T026 handler   →   T027 aperçu
```

## Implementation Strategy

1. **MVP** : Foundational + US1 + US2 + US3 → une idée devient une proposition fiable (sans valeur inventée).
2. Puis US4 (opportunités), US5 (restructuration), Polish.
3. Chaque incrément : tests verts, JOURNAL, **commit seulement après confirmation de mentalyas**.
