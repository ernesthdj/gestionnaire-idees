# Implementation Plan: Moteur de neurones — croissance, jauge, fusion, réseau (F2 v2)

**Branch**: `002-structuration-ia` | **Date**: 2026-09-28 (révision « Brainstormer ») | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-structuration-ia/spec.md`

## Summary

Moteur générique du Brainstormer côté processus principal : un `GrowthService` fait pousser l'arbre d'un
neurone (appel `etendre` unique par réponse → nouvelles extensions + jauge), avec des garde-fous
déterministes (≥ 3 extensions au démarrage, plancher de jauge, profondeur 6, doublons). Un `FusionService`
obtient la synthèse typée par nature (`ActionPlanOut` / `ReflectionSummaryOut`), la contrôle (refs, branches,
boucles, provenance), et l'applique en transaction à la confirmation (`SynthesisApplier`). Un `LinkService`
suggère des liens entre neurones éclos. Modèle de données central (`neurons`, `extensions`,
`context_assessments`, `syntheses`, `plan_*`, `reflection_summaries`, `neuron_links`, `change_log`, `settings`).

## Technical Context

**Language/Version**: TypeScript 6 (`strict`), Node.js (Electron 44)

**Primary Dependencies**: 001 uniquement (Drizzle, Zod, AIGateway) — **aucune nouvelle dépendance**

**Storage**: SQLite chiffré ; FTS5 pour les racines et les synthèses

**Testing**: Vitest ; FakeProvider scripté ; fixtures d'arbres fictifs

**Target Platform**: Windows 11 desktop

**Project Type**: desktop-app (Electron) — moteur côté `main`, sans interface (spec 003)

**Performance Goals**: sous-neurone créé et renvoyé avant l'appel IA (retour immédiat) ; extensions + jauge < 10 s p90 ; contrôles de plan < 50 ms pour 60 nœuds

**Constraints**: 1 appel IA par réponse ; aucune écriture de résultat sans confirmation ; données envoyées bornées (~3 000 tokens)

**Scale/Scope**: ~1 000 racines ; arbres jusqu'à ~100 sous-neurones

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|----------|--------------|--------|
| I. Sécurité | IPC Zod ; Drizzle paramétré ; FTS5 via requêtes liées ; texte balisé comme donnée | ✅ |
| II. Humain dans la boucle | Synthèse `proposed` → rien d'écrit avant `fusion:confirm` ; tout-ou-rien ; verrouillage forcé seulement après confirmation | ✅ |
| III. IA cadrée | Cadre v2 (001) ; garde-fous E1–E4, P1–P6, S1, L1 déterministes ; `out_of_scope` géré | ✅ |
| IV. Local d'abord | Catégorie/nature en local ; contexte borné et anonymisé (001) ; branches manuelles hors ligne | ✅ |
| V. Tests | Garde-fous et applier testés unitairement ; intégration complète sans réseau | ✅ |
| VI. Simplicité | Table `neurons` unique ; un appel pour extensions + jauge ; pas de nouvelle dépendance | ✅ |

**Re-check post-design** : ✅.

## Project Structure

### Documentation (this feature)
```text
specs/002-structuration-ia/
├── plan.md · research.md · data-model.md · quickstart.md · analysis-report.md
├── contracts/ai-outputs.md · contracts/ipc-neurons.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (ajouts)
```text
src/main/
├── domain/neurons/          # tree (profondeur, cascade), guards (E1–E4), gauge, planChecks (P1–P5, Kahn), provenance (P6), extractValues, fingerprint
├── application/neurons/     # NeuronService, GrowthService, ContextBuilder, FusionService, SynthesisApplier, LinkService, CandidateFinder
├── infrastructure/db/       # schema.ts (+ tables v2), repositories/{Neuron,Extension,Synthesis,Link}Repository.ts
└── ipc/                     # neuronHandlers.ts, growthHandlers.ts, fusionHandlers.ts, linkHandlers.ts
src/shared/
├── ai/neurons.ts            # schémas Zod de sortie IA
└── ipc/neurons.ts           # schémas Zod IPC + vues
tests/
├── unit/neurons/            # growth, gauge, plan-checks, provenance, fingerprint
├── integration/neurons/     # cycle complet, persistance, liens
└── fixtures/neurons/        # arbres FICTIFS (2e écran, portfolio, mission mariage…)
```

**Structure Decision**: logique pure dans `domain/neurons` ; orchestration dans `application/neurons` ; aucune
dépendance d'interface.

## Complexity Tracking

Aucune violation.
