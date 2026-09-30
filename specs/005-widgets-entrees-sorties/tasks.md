---
description: "Task list — 005 Widgets branchés : entrées, sorties et cadre résultat"
---

# Tasks: Widgets branchés — entrées, sorties et cadre résultat

**Input**: `specs/005-widgets-entrees-sorties/` (spec.md, plan.md) · **Prerequisites**: 004 (widgets isolés)

**Tests**: obligatoires (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>`.

## Phase 0 : Gouvernance

- [ ] T001 Validation de la spec et du plan par mentalyas (pas d'amendement de constitution : 1.2.0 couvre les capacités)

## Phase 1 : Lot 1 — Entrées (US1)

- [ ] T002 Migration 0013 (+ down) : `widget_inputs`, `widget_approvals`, `widget_results`, `neuron_data`, `widget_proposals`, `canvas_blocks.source_block_id`, `kind` `result`
- [ ] T003 [P] Tests : `InputAssembler` (chaque partie, parties décochées absentes, idée supprimée → entrée vide)
- [ ] T004 [P] Tests : `WidgetIoService` — branchement, empreinte, aucune donnée sans approbation, nouvelle version → revue, boucle refusée, suppression annulable
- [ ] T005 `InputAssembler`, `WidgetIoService` (connect, approve, inputs), `WidgetIoRepository`, canaux `widgetIo:connect|approve|inputs|disconnect`
- [ ] T006 [P] Tests : prélude `gi` (figé, `inputs`, `onInputs`), document inchangé côté CSP
- [ ] T007 Prélude `gi` dans `WidgetDocument` ; `WidgetFrame` décrit `gi.inputs` à Claude ; structure des entrées jointe aux demandes d'évolution (`shapeOf`)
- [ ] T008 [P] Tests renderer : lien idée → widget, revue (code, capacité, parties), refus, bandeau « À revoir », pont (source vérifiée, message hors contrat ignoré)
- [ ] T009 `IoEdge`, `WidgetReview`, `WidgetBridge`, intégration `WidgetNode` / `IdeasCanvas`
- [ ] T010 Test manuel guidé lot 1 — **validation mentalyas**

## Phase 2 : Lot 2 — Sorties (US2)

- [ ] T011 [P] Tests : bornes d'un résultat (taille, profondeur, clés, non-JSON), regroupement des émissions
- [ ] T012 [P] Tests : `emit` crée le cadre résultat une seule fois, le met à jour, le recrée après suppression
- [ ] T013 `resultLimits`, `WidgetIoService.emit`, `widgetIo:emit|result`, `gi.output` dans le prélude
- [ ] T014 [P] Tests : vue générique (valeur, liste, tableau, arbre, HTML affiché comme texte, 1 000 lignes)
- [ ] T015 `GenericResultView`, protocole `gi-widget://result/…`, `ResultNode`, lien widget → résultat
- [ ] T016 Test manuel guidé lot 2 — **validation mentalyas**

## Phase 3 : Lot 3 — Mise en forme par Claude (US3)

- [ ] T017 [P] Tests : `shapeOf` (aucune valeur, égalité hors tailles), demande envoyée sans valeur (SC-003)
- [ ] T018 [P] Tests : mise en forme réutilisée à structure égale, retour à la vue générique si la structure change, échec Claude → vue générique
- [ ] T019 `shape.ts`, `widgetIo:format`, versions et chatbox rattachées au cadre résultat
- [ ] T020 Test manuel guidé lot 3 + mesure du coût (`scripts/ai-usage.cjs`) — **validation mentalyas**

## Phase 4 : Lot 4 — Réinjection (US4)

- [ ] T021 [P] Tests : proposition résultat → idée (rien d'écrit avant validation, Historique, annulation, mise à jour = nouvelle proposition)
- [ ] T022 [P] Tests : chaînage résultat → widget (revue, boucle refusée), données attachées transmissibles, « Nouvelle idée depuis ce résultat »
- [ ] T023 `widgetIo:propose|accept|reject`, `neuron_data`, section « Données » de la fiche d'idée, « À valider »
- [ ] T024 Liens résultat → idée et résultat → widget sur la carte ; nouvelle idée depuis un résultat
- [ ] T025 [P] Tests d'évasion SC-002 (idée non branchée, partie décochée, version non approuvée, pont usurpé)
- [ ] T026 Test manuel guidé lot 4, JOURNAL, `quickstart.md` — **validation mentalyas**
