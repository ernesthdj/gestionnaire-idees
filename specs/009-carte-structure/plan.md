# Implementation Plan: Carte de structure (P1)

**Spec**: [spec.md](./spec.md) · Conception : `docs/brainstorm/L3-carte-structure.md`

## Technical Context
TypeScript strict · Electron 44 · aucune dépendance nouvelle · migration `0020_project_elements` (+ down) · Vitest.

## Constitution Check (2.0.0) — PASS
I : chemins relatifs validés (Zod), jamais ouverts ; garde « même projet » côté main. II : `structure_dessiner` = une
opération d'Historique « par Claude », annulable. III : entrées des outils validées. V : logique pure testée (résolution
du lot, arbre visible, regroupement des liens). VI : les éléments réutilisent neurones (conversation, fiche), `map_links`,
l'Historique.

## Structure
```text
src/shared/mcp/tools.ts              # structure_dessiner, structure_lire (+ types, statuts, relations)
src/shared/ipc/canvas.ts             # ElementView, IdeasCanvasView.elements, MapLinkView.relation
src/main/domain/structure/resolve.ts # résolution d'un lot de structure (clés, parents, cycles, chemins) — pur
src/main/application/structure/StructureService.ts   # dessiner (upsert), lire, replier
src/main/infrastructure/db/repositories/ElementRepository.ts
src/main/application/mcp/toolHandler.ts · NeuronTools.ts (garde « même projet »)
src/main/application/conversation/ConversationService.ts · contextBlock.ts · frame.ts (éléments, cartographie)
src/renderer/src/canvas/structureGraph.ts  # arbre visible + positions + liens regroupés — pur
src/renderer/src/canvas/nodes/ElementNode.tsx · buildGraph.ts · IdeasCanvas.tsx
src/renderer/src/chat/ChatPanel.tsx  # « Cartographier ce projet », en-tête d'élément
```
