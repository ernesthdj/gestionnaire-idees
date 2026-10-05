# Implementation Plan: Plan d'attaque (spec 011)

**Branch**: `011-plan-attaque` (travail sur `main`, comme les specs précédentes) · **Date**: 2026-10-05 ·
**Spec**: [spec.md](spec.md)

## Summary
Une étape est un neurone `kind = 'step'` (rang, statut, verrou) : conversation, fiche et Historique existants
s'appliquent tels quels. Claude propose une couche par l'outil MCP `plan_proposer` (stockée hors des données de
mentalyas, affichée en fantômes) ; `plan:decide` verrouille le parent (D6) et fait naître les étapes en un lot
annulable. Une garde unique de verrou protège tous les chemins d'écriture. La disposition est une fonction pure,
déterministe et incrémentale (arbre gauche → droite, rang, dépendances), animée en 250 ms ; un nouveau nœud `plan`
porte l'identité visuelle des étapes. Détail : [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md).

## Technical Context
**Language/Version**: TypeScript strict (Electron, Node du main, React 19 renderer)
**Primary Dependencies**: existantes uniquement — React Flow, Zod, Drizzle + better-sqlite3-multiple-ciphers, MCP SDK
**Storage**: SQLite chiffré ; migration `0022_plan_attaque` (+ down)
**Testing**: Vitest (unit, intégration sur base réelle temporaire, renderer jsdom + axe)
**Target Platform**: Windows, desktop mono-utilisateur
**Project Type**: desktop app (main / preload / renderer / shared / mcp-relay)
**Performance Goals**: disposition d'un plan de 100 nœuds < 16 ms (une image) ; naissance d'une couche < 100 ms
**Constraints**: aucune écriture avant acceptation (constitution II) ; verrou infranchissable par l'interface comme par
le pont ; déterminisme de la disposition
**Scale/Scope**: ≤ 12 étapes par couche, ≤ 4 niveaux, quelques dizaines de plans

## Constitution Check
| Principe | Respect |
|---|---|
| I Sécurité | Entrées IPC et MCP validées par Zod ; requêtes paramétrées (Drizzle) ; aucun contenu dans les logs. ✅ |
| II Humain dans la boucle | Couche et verrou = **propositions** de Claude, appliquées seulement par `plan:decide` / `lock:decide`, en un lot atomique annulable. `etape_modifier` (statut, dépendances) passe par l'exception MCP : marqué « par Claude », annulable. ✅ |
| III IA cadrée | Pas d'appel IA lancé par l'app ; Claude agit par le pont (outils bornés, refus motivés). ✅ |
| IV Local d'abord | Tout reste en base locale. ✅ |
| V Tests | Logique pure testée (cycles, rangs, disposition, garde de verrou, D6) ; tests d'intégration sur base réelle. ✅ |
| VI Simplicité | Réutilise neurones, conversation, fiche, Historique ; aucune dépendance nouvelle ; disposition maison < 150 lignes. ✅ |

Re-vérifiée après la phase 1 : aucun écart.

## Project Structure
```
specs/011-plan-attaque/        spec, plan, research, data-model, contracts/, quickstart, tasks (à venir)
src/main/
  domain/plan/                 dependencies.ts (cycles, ordre), lock.ts (assertUnlocked) — purs
  application/plan/            PlanService.ts (proposer, décider, réordonner, statut, verrou)
  application/mcp/             NeuronTools / MapService : garde de verrou ; nouveaux outils branchés
  application/conversation/    ConversationService : rôle « étape », chemin de fiches, modèle des éléments
  application/history/         HistoryService : kind `plan`, entités step*, neuron_lock, garde D6
  infrastructure/db/           schemaNeurons (colonnes, 3 tables), PlanRepository, migration 0022 + down
  ipc/planHandlers.ts          plan:decide, plan:reorder, plan:setStatus, lock:decide
src/shared/                    ipc/canvas (StepView, ProposalView), ipc/plan, mcp/tools (3 outils)
src/renderer/src/canvas/
  planLayout.ts                disposition pure (tidy tree gauche → droite, fantômes, décalage structure)
  nodes/PlanNode.tsx           étape / sous-étape / fantôme (✓ ✗) / cadenas, a11y
  nodes/NeuronNode.tsx         cadenas et proposition de verrou sur le genesis
  buildGraph, useCanvasPhysics plan = corps unique attaché au genesis ; flèches de dépendance
tests/                         unit (domain/plan, planLayout, PlanNode) + intégration (PlanService, MCP, historique)
```

## Lots (chacun testable)
1. **P1 — Données et règles** : migration, dépôt, `domain/plan`, `PlanService`, IPC, Historique (D6), garde de verrou
   sur tous les chemins ; tests.
2. **P2 — Claude** : outils `plan_proposer`, `verrou_proposer`, `etape_modifier`, contexte hérité, instructions ;
   tests. Test guidé avec un vrai Claude.
3. **P3 — Carte** : `planLayout`, `PlanNode`, fantômes, glisser pour réordonner, flèches, animation, cadenas ; tests
   renderer. Test guidé visuel.

## Complexity Tracking
Aucun écart à justifier.
