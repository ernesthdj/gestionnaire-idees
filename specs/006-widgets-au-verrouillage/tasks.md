---
description: "Task list — 006 Widgets proposés au verrouillage"
---

# Tasks: Widgets proposés au verrouillage

**Input**: `specs/006-widgets-au-verrouillage/` (spec.md, plan.md) · **Prerequisites**: 005 lots 1 et 2 (branchement, revue, cadre résultat)

**Tests**: obligatoires (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>`.

## Phase 0 : Gouvernance

- [x] T001 Spec validée par mentalyas (2026-09-30) ; pas d'amendement de constitution (plan § Constitution Check)

## Phase 1 : Lot 1 — Propositions (US1)

- [x] T002 [P] Tests : `tools` facultatif et tolérant dans les deux sorties de synthèse (absent, mal formé, élément fautif écarté seul, plus de 3, parties inconnues filtrées), synthèse jamais invalidée
- [x] T003 [P] Tests : dédoublonnage (titre déjà branché sur l'idée, doublons dans la réponse, casse et espaces), propositions ignorées en mode dégradé, outils déjà branchés présents dans la demande de synthèse
- [x] T004 `ToolProposal` + champ `tools` (`shared/ai/neurons.ts`), règles de proposition (`TaskInstructions`), outils déjà branchés dans `buildSynthesisInput`, `toolProposals.ts`, filtrage dans `FusionService` (dégradé, doublons)
- [x] T005 [P] Tests renderer : section « Outils proposés » (absente sans proposition, cases décochées, parties lues, « produit un résultat », compteur de générations)
- [x] T006 Section « Outils proposés » dans `SynthesisPreview` (état local des cases)
- [x] T007 Test manuel guidé lot 1 (`quickstart.md`) — validé par mentalyas (2026-09-30)

## Phase 2 : Lot 2 — Éclosion et génération (US2, US3, US4)

- [ ] T008 Migration 0016 (+ down) : `widget_requests`
- [ ] T009 [P] Tests : `fusion:confirm` avec outils — blocs, branchements (parties annoncées) et demandes créés dans la transaction et le lot ; index inconnu ou en double refusé ; coordonnées bornées ; rien créé sans outil ; outils ignorés si la synthèse est dégradée
- [ ] T010 [P] Tests : annuler l'éclosion retire widgets et branchements (SC-003) ; une génération terminée après l'annulation est ignorée
- [ ] T011 [P] Tests : génération séquentielle en arrière-plan ; échec de l'un sans effet sur l'autre ni sur l'éclosion (SC-005) ; « Réessayer » ; demande envoyée sans aucune valeur de l'idée (SC-006) ; demande supprimée au succès
- [ ] T012 `SynthesisApplier` / `FusionService.confirm` étendus, `WidgetRequestRepository`, `ToolGeneration`, canal `widget:generate`, `widget:get` avec `request`
- [ ] T013 [P] Tests : `placeTools` (autour de l'idée, ni sur l'idée, ni sur l'étape, ni sur un bloc)
- [ ] T014 [P] Tests renderer : confirmation avec outils cochés (places envoyées) ; widget en préparation ; widget en échec avec « Réessayer » ; outil généré « À revoir »
- [ ] T015 `placeTools`, confirmation étendue dans `useFusion`, états du `WidgetNode`
- [ ] T016 Test manuel guidé lot 2 + mesure du coût (`scripts/ai-usage.cjs`), JOURNAL — **validation mentalyas**
