# Tasks: Widgets branchés sur les étapes de plan (spec 015)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>`.

## Phase 1 — Socle (bloquant)
- [x] T001 [P] Types partagés : `IDEA_PARTS` (identity, sheet, plan, annexes), `STEP_PARTS` (identity, sheet, path, subtree), libellés, `InputSourceKind` + `plan_step`, `WidgetInputData`, `WidgetInputView.label` dans `src/shared/ipc/widgetIo.ts` ; enum TypeScript de `source_kind` dans `schemaNeurons.ts`
- [x] T002 [P] Normalisation pure des anciennes parties d'idée (R1) dans `src/main/domain/widgets/inputParts.ts` + `tests/unit/widgets/input-parts.test.ts` ; appliquée à la lecture par `WidgetIoRepository`
- [x] T003 Assemblage pur : `assemblePlanStep`, `assembleIdea` (nouvelles parties), bornage 200 Ko avec ordre de troncature (R2) dans `InputAssembler.ts` + tests (parties cochées/décochées, vides, troncature)

## Phase 2 — US1/US2 Brancher une étape, transmettre son contexte (P1) 🎯
- [x] T004 [US1] `WidgetIoService` : faits d'une étape (étape, ancêtres, fiches, sous-arbre, documents, action finale, livrable), `connect`/`setParts`/`state`/`assemble` par nature de source, `step` non créable ; dépendances dans `bootstrap.ts` + tests d'intégration
- [x] T005 [US1] IPC `widgetIo:connect` / `widgetIo:setParts` : Zod par nature de source + tests
- [x] T006 [US1] Carte : poignée source de `PlanNode` vers un widget seulement, `onConnect` étape → `plan_step`, trait étape → widget dans `buildGraph` + tests renderer
- [x] T007 [US2] Revue : source « rang · titre », libellés des parties selon la nature, « ancienne source » + tests renderer/axe
- [x] T008 [US1/US2] Test guidé (quickstart §1, §2) — attendre le retour de mentalyas

## Phase 3 — US3 Idée actuelle et description pour Claude (P2)
- [x] T009 [US3] Description d'outil `widget_poser` et cadre widget : forme des entrées idée/étape (`src/shared/mcp/tools.ts`) + test
- [ ] T010 [US3] Test guidé (quickstart §3) — attendre le retour

## Phase 3 bis — US4/US5 Construire depuis le nœud, contexte préparé (D5–D7)
> 2026-10-10 : T012, T013 et T016 (partie US4) sont faites par la spec 026 (constructions Wireframe, Parcours, Adapter ;
> plus de construction automatique au branchement, 026 D6). US5 (contexte préparé) reste en pause.
- [x] T012 [US4] Cadre `WidgetFrame` : construction à partir d'un contexte de nœud (forme libre, résumé des sources), sortie facultative `extraction` (consigne) + `context` (JSON) ; schéma de sortie étendu + tests
- [x] T013 [US4] `WidgetService.build(blockId)` : contexte complet des sources (assemblage spec 015, valeurs), code existant si « Adapter », version « À revoir » ; `WidgetIoService.connect` → construction auto si widget vide + tests
- [ ] T014 [US5] Migration `0027_widget_contexts` (+ down), dépôt : consigne, données, empreinte source, date + tests
- [ ] T015 [US5] Contexte transmis dans `widgetIo:inputs` (autorisé seulement), état « à actualiser » (empreinte), `widgetIo:refreshContext` (tâche d'extraction, JSON validé 50 Ko) + tests
- [x] T016 [US4/US5] Interface : « Claude construit… », « Adapter au nœud » (revue et widget), « Le nœud a changé — Actualiser » + tests renderer/axe
- [ ] T017 [US4/US5] Test guidé (quickstart §4, §5) — attendre le retour

## Phase 4 — Finitions
- [ ] T011 `docs/JOURNAL.md`, `CLAUDE.md` ; profil démo : un widget branché sur une étape fictive (`src/main/infrastructure/db/demo/`)

## Dépendances
T001 → T002, T003 → T004 → T005 → T006, T007 → T008 → T009 → T010 → T012 → T013 → T014 → T015 → T016 → T017 → T011.
