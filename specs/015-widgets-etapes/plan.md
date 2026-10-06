# Implementation Plan: Widgets branchés sur les étapes de plan (spec 015)

**Branch**: `015-widgets-etapes` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

## Summary

Les entrées de widget (spec 005) acceptent une nouvelle source `plan_step` (étape de plan, action finale comprise) qui
transmet son contexte complet en 4 parties (identité, fiche, chemin, sous-étapes et annexes). Les parties d'une idée
passent au moteur actuel (identité, fiche, plan d'attaque, annexes) par une **normalisation à la lecture** des anciens
branchements — pas de migration : `source_kind` n'a pas de contrainte en base et l'empreinte d'autorisation change
d'elle-même (autorisation redemandée une fois). L'assemblage reste une fonction pure du main, bornée à 200 Ko.

## Technical Context

**Language/Version**: TypeScript 5 strict (main, preload, renderer)
**Primary Dependencies**: Electron, React, React Flow, Drizzle + better-sqlite3-multiple-ciphers, Zod — aucune nouvelle
**Storage**: table `widget_inputs` existante (`source_kind` texte libre en base, enum TypeScript élargi) ; aucune migration
**Testing**: Vitest (unitaires purs, intégration main avec base en mémoire, renderer + axe)
**Target Platform**: Windows 11 (Electron)
**Project Type**: Desktop App
**Performance Goals**: assemblage d'une entrée < 50 ms pour un plan de 40 étapes et 10 documents
**Constraints**: 200 Ko de texte par entrée ; aucune donnée transmise sans autorisation (spec 005 FR-002)
**Scale/Scope**: ~10 fichiers main/shared, ~4 fichiers renderer

## Constitution Check (3.0.0 en vigueur ; 4.0.0 proposée sans effet ici)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Entrées IPC validées par Zod (`sourceKind` élargi, parties par nature) ; le widget reste dans `gi-widget://` | ✅ |
| II Humain dans la boucle | Brancher = geste de mentalyas ; toute nouvelle source ou partie redemande l'autorisation | ✅ |
| III IA cadrée | Code de widget inchangé (bac à sable) ; le contexte transmis est une donnée ; description des entrées à Claude mise à jour | ✅ |
| IV Local, minimisation | Parties décochables ; livrable en chemins seulement ; borne 200 Ko | ✅ |
| V Qualité & tests | Assemblage pur testé (parties, troncature, conversion), intégration, renderer/axe | ✅ |
| VI Simplicité | Pas de migration ; réutilise fiches, documents, plan, livrable existants | ✅ |

## Project Structure

```text
src/shared/ipc/widgetIo.ts                         IDEA_PARTS, STEP_PARTS, InputSourceKind 'plan_step', WidgetInputData
src/main/domain/widgets/inputParts.ts               (nouveau) normalisation des anciennes parties, pur
src/main/application/widgets/InputAssembler.ts      assembleIdea (nouvelles parties), assemblePlanStep, bornage
src/main/application/widgets/WidgetIoService.ts     connect/state/assemble par nature de source ; titres et rangs
src/main/infrastructure/db/repositories/WidgetIoRepository.ts   lecture des parties normalisée
src/main/infrastructure/db/schemaNeurons.ts         enum source_kind élargi (TypeScript seulement)
src/main/ipc/widgetIoHandlers.ts                    Zod : sourceKind, parties selon la nature
src/main/bootstrap.ts                               dépendances : plan, fiches, documents, livrable
src/shared/mcp/tools.ts                             description des entrées pour widget_poser
src/renderer/src/canvas/IdeasCanvas.tsx             onConnect : étape → 'plan_step'
src/renderer/src/canvas/nodes/PlanNode.tsx          poignée source connectable vers un widget
src/renderer/src/canvas/buildGraph.ts               trait étape → widget
src/renderer/src/widgets/… (revue)                  libellés des parties selon la nature, rang + titre de la source
```

## Lots
1. **P1 — Socle** : types partagés, normalisation des anciennes parties, assemblage pur (étape, idée, bornage) + tests.
2. **P2 — US1/US2** : service (connect/state/assemble), IPC, dépendances ; carte (brancher une étape, trait), revue.
   Test guidé.
3. **P3 — US3** : parties d'idée actuelles, ancien « step » en archive (plus créable), description pour Claude.
   Test guidé.

## Complexity Tracking
Aucun écart.
