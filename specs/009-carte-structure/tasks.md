# Tasks: Carte de structure (P1)

**Tests**: obligatoires, écrits d'abord.

- [x] T000 Vision L1e et conception L3 validées (2026-10-04)
- [x] T001 Migration `0020_project_elements` (+ down) ; `schemaNeurons.ts`
- [x] T002 [P] Tests purs : résolution d'un lot de structure (clés uniques, parent clé du lot / existante / absent = genesis, cycle, chemins interdits, bornes) — `tests/unit/structure/resolve.test.ts`
- [x] T003 `src/main/domain/structure/resolve.ts` ; schémas des 2 outils dans `src/shared/mcp/tools.ts`
- [x] T004 [P] Tests intégration : `structure_dessiner` (création, mise à jour par clé sans doublon, `retirer_absents`, liens typés, une opération d'Historique annulable, autre projet refusé), `structure_lire`, repli mémorisé, vue `elements` de la carte — `tests/integration/structure/structure.test.ts`
- [x] T005 `ElementRepository`, `StructureService`, routage des outils, canal `element:setCollapsed`, `CanvasService` (+ `elements`), garde « même projet » dans `NeuronTools`
- [x] T006 [P] Tests : contexte d'un élément (type, ancêtres, chemins, fiche du projet), dossier de travail = dossier du projet — `tests/unit/conversation/`
- [x] T007 Conversation d'un élément (`ConversationRepository` : projet du genesis, ancêtres ; `contextBlock` ; cadre)
- [x] T008 [P] Tests purs renderer : `structureGraph` (repli, positions sans recouvrement, liens regroupés vers l'ancêtre visible) — `tests/unit/renderer/structure-graph.test.ts`
- [x] T009 `structureGraph.ts`, `ElementNode.tsx`, `buildGraph.ts`, `IdeasCanvas.tsx` (clic → conversation), « Cartographier ce projet » dans le chat
- [x] T010 typecheck, lint, tests, build ; JOURNAL
- [ ] T011 Test guidé : cartographier `gestionnaire-idees` — **validation mentalyas**
