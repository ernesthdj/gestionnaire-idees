# Implementation Plan: Structuration IA — questionnaire & décomposition (F2)

**Branch**: `002-structuration-ia` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-structuration-ia/spec.md`

## Summary

Transformer une idée brute en **proposition d'arbre de tâches** : un `StructuringService` pilote une
machine à états (questions une à une, limite 8, reprise), interroge le moteur IA de la feature 001
(`questionner` effort bas, `decomposer`/`restructurer` effort haut), puis valide la sortie par schéma
**et** par des contrôles métier déterministes (références, branches, profondeur ≤ 5, absence de boucle
par tri de Kahn, provenance des montants/dates, liens limités aux idées candidates). Le résultat est
une proposition `pending` — rien n'est appliqué (F3). La feature crée aussi le **modèle de données
central** (idées, catégories, sessions, propositions, nœuds, dépendances, liens, historique) et un
écran minimal de liste d'idées + questionnaire.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`), Node.js LTS (Electron)

**Primary Dependencies**: celles de la feature 001 (Electron, React, Tailwind, Zod, Drizzle, `@anthropic-ai/sdk` via AIGateway) — **aucune nouvelle dépendance**

**Storage**: SQLite chiffré (001) ; nouvelles tables + FTS5 pour la recherche d'idées

**Testing**: Vitest ; FakeProvider scripté ; fixtures de questionnaires fictifs

**Target Platform**: Windows 11 desktop

**Project Type**: desktop-app (Electron)

**Performance Goals**: retour visuel immédiat à chaque action ; nouvelle question < 10 s (p90) ; contrôles métier < 50 ms pour 60 nœuds

**Constraints**: aucune écriture dans l'arbre d'une idée (F3) ; 0 valeur inventée ; 1 session ouverte par idée

**Scale/Scope**: ~1 000 idées, ≤ 60 nœuds par proposition

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|----------|--------------|--------|
| I. Sécurité | Payloads IPC Zod ; Drizzle paramétré (FTS5 via requêtes liées) ; rendu React en texte (pas de HTML injecté) ; texte d'idée balisé comme donnée | ✅ |
| II. Humain dans la boucle | Propositions `pending` uniquement ; aucune écriture dans `nodes`/`dependencies`/`idea_links` (test SC-007) | ✅ |
| III. IA cadrée & vérifiable | Tout passe par AIGateway ; schémas + règles K1–K7 ; provenance R5 déterministe ; `out_of_scope` géré | ✅ |
| IV. Local d'abord | Contexte borné (≤ 5 idées candidates résumées) ; anonymisation par 001 ; mode dégradé local signalé | ✅ |
| V. Qualité & tests | Machine à états, Kahn, provenance, cohérence testés unitairement ; intégration sans réseau | ✅ |
| VI. Simplicité | Pas de nouvelle dépendance ; références temporaires plutôt qu'écritures anticipées ; FTS5 natif plutôt qu'un moteur de recherche | ✅ |

**Re-check post-design** : ✅ aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/002-structuration-ia/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/
│   ├── ipc-structuring.md   # Canaux idea:* et structuring:*
│   └── ai-outputs.md        # QuestionOut, DecompositionOut, RestructureOut + règles K1–K7
├── checklists/requirements.md
└── tasks.md
```

### Source Code (ajouts à la structure de la feature 001)

```text
src/
├── main/
│   ├── domain/
│   │   ├── ideas/                 # Idea, Category, statuts, règles de version
│   │   └── structuring/           # SessionStateMachine, topoSort (Kahn), depth, provenance, consistency (K1–K7)
│   ├── application/
│   │   └── structuring/           # StructuringService, IdeaService, CandidateFinder, ContextBuilder
│   ├── infrastructure/db/
│   │   ├── schema.ts              # + tables data-model.md
│   │   └── repositories/          # IdeaRepository, SessionRepository, ProposalRepository
│   └── ipc/
│       ├── ideaHandlers.ts
│       └── structuringHandlers.ts
├── shared/
│   ├── ai/structuring.ts          # Schémas Zod de sortie IA
│   └── ipc/structuring.ts         # Schémas Zod IPC + vues
└── renderer/src/pages/
    ├── ideas/IdeasPage.tsx        # Liste minimale (créer, filtrer, « Structurer »)
    └── structuring/QuestionnairePage.tsx

tests/
├── unit/structuring/              # session-state, cycles, provenance, consistency
├── integration/structuring/       # flux complet, reprise, périmée, idempotence
└── fixtures/structuring/          # questionnaires et sorties IA FICTIFS (dont « 2e écran »)
```

**Structure Decision**: même projet Electron ; logique pure (machine à états, graphe, provenance) dans
`domain/structuring` sans dépendance externe, orchestrée par `application/structuring`.

## Complexity Tracking

Aucune violation à justifier.
