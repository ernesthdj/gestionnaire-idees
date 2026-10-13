# Tasks: Avancement fiable (spec 030)

## Lot 1 — C4 : MCP par identifiant ou clé (D1)
- [x] T001 `ElementAvancerInput` : `element` identifiant ou clé, `projet` optionnel ; description de l'outil
- [x] T002 `StructureService.advance` : résolution par identifiant puis par clé dans le projet visé ; `read` affiche les identifiants ; tests d'intégration

## Lot 2 — C2 : statut manuel (D2, D3)
- [x] T003 Domaine pur `src/main/domain/structure/status.ts` (`manualProgress`, D3) + tests unitaires
- [x] T004 `StructureService.setStatus` (un lot `user`, annulable) + résumé d'Historique + IPC `element:setStatus` + tests
- [x] T005 Renderer : `ElementStatusSelect` dans la carte de détails d'une feuille + test renderer/axe

## Lot 3 — C3 : statut affiché des parents (D4)
- [x] T006 `statusOf` pur dans `canvas/progress.ts` + tests ; branché dans `buildGraph.ts` (pastille, nom accessible) et la carte de détails

## Lot 4 — C1 : livrée au commit (D5, D6)
- [x] T007 Domaine pur `coveredElements` + `StructureService.covered` + IPC `structure:covered` + tests
- [x] T008 `ChangesTab` : proposition « Passer en livrée » après un commit + test renderer/axe

## Clôture
- [x] T009 Vérifications (typecheck, lint, prettier, tests), test e2e joué sur le profil démo, JOURNAL, `CLAUDE.md`
