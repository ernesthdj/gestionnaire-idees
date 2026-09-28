# Implementation Plan: Interface MVP-1 — coquille, capture, validation, organigramme (F1 · F3 · F4)

**Branch**: `003-interface-mvp1` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-interface-mvp1/spec.md`

## Summary

Boucler le MVP-1 : **coquille** (instance unique, zone de notification, démarrage avec Windows, navigation
latérale, réglages, premier lancement), **capture** (fenêtre pré-chargée ouverte par raccourci global,
catégorisation en arrière-plan via le moteur 001), **revue & validation** (application tout-ou-rien dans une
transaction, annulation par lot avec détection de conflits, exemples pour l'agent) et **organigramme**
(React Flow + mise en page dagre, propagation des statuts, branches, déclencheurs, édition directe,
filtres). Réutilise le modèle central de 002 et le moteur IA de 001.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`), Node.js LTS (Electron)

**Primary Dependencies**: 001 + 002 ; nouvelles : `@xyflow/react`, `@dagrejs/dagre`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` ; tests : `@testing-library/react`, `vitest-axe`, `jsdom` (research.md)

**Storage**: SQLite chiffré (001/002) ; compléments de schéma (data-model.md)

**Testing**: Vitest (unitaires, intégration, composants en jsdom), axe pour l'accessibilité ; tests manuels pour raccourci, focus, démarrage Windows

**Target Platform**: Windows 11, un ou plusieurs écrans

**Project Type**: desktop-app (Electron, 2 fenêtres : capture + app complète)

**Performance Goals**: fenêtre de capture perçue instantanée (pré-chargée) ; capture complète < 5 s ; organigramme fluide à 50 idées / 300 nœuds ; propagation des statuts perçue instantanée

**Constraints**: acceptation tout-ou-rien ; annulation sans écraser les éditions manuelles postérieures ; clavier complet + AA ; aucune écriture IA sans validation

**Scale/Scope**: ~1 000 idées ; ~10 écrans/états (E1, E3, E5, E6, E8, E9, E10, E11 + réglages IA de 001)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|----------|--------------|--------|
| I. Sécurité | 2 fenêtres durcies, API `contextBridge` distincte et minimale par fenêtre (la capture n'expose que `capture:*`) ; IPC Zod ; rendu texte ; instance unique | ✅ |
| II. Humain dans la boucle | Seul `review:accept` écrit un arbre issu de l'IA ; transaction tout-ou-rien ; annulation par lot ; éditions manuelles = actions de l'utilisateur, historisées | ✅ |
| III. IA cadrée | Catégorisation et corrections via AIGateway ; catégorie `user` jamais écrasée ; refus → exemple négatif | ✅ |
| IV. Local d'abord | Capture 100 % locale, jamais bloquée par l'IA ; catégorisation locale, file persistante (001) | ✅ |
| V. Qualité & tests | Logique pure (statuts, application, annulation) testée ; composants testés au clavier et à l'axe ; erreurs injectées pour le tout-ou-rien | ✅ |
| VI. Simplicité | Navigation par état (pas de routeur) ; recalcul complet des statuts d'une idée (≤ 60 nœuds) plutôt qu'incrémental ; annulation par rejeu du journal plutôt qu'un moteur de versions | ✅ |

**Dépendances nouvelles** : 6 bibliothèques + 3 de test, annoncées dans research.md, à valider avant installation (T001).

**Re-check post-design** : ✅ aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/003-interface-mvp1/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ipc-mvp1.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (ajouts)

```text
src/
├── main/
│   ├── shell/                      # Tray, LoginItem, SingleInstance, WindowManager (capture + main), GlobalShortcut
│   ├── domain/
│   │   ├── tree/                   # computeStatuses, branches, triggers (purs)
│   │   └── review/                 # buildReviewItems, checkExclusions (dépendances), applySelection (purs)
│   ├── application/
│   │   ├── capture/CaptureService.ts
│   │   ├── review/ProposalApplier.ts, ReviewService.ts
│   │   ├── tree/TreeService.ts
│   │   ├── history/HistoryService.ts (undo par lot)
│   │   └── maintenance/PeriodicJobs.ts (archivage 14 j, filet « périmée »)
│   └── ipc/ appHandlers.ts, captureHandlers.ts, reviewHandlers.ts, treeHandlers.ts, historyHandlers.ts
├── preload/
│   ├── main.ts                     # API de l'app complète
│   └── capture.ts                  # API restreinte de la fenêtre de capture
└── renderer/src/
    ├── capture/CaptureApp.tsx      # E1
    ├── app/AppShell.tsx            # navigation latérale + ⚙, Zustand, QueryClient
    ├── pages/ideas/ (002, intégré à la coquille)
    ├── pages/review/ReviewListPage.tsx, ReviewPage.tsx         # E8, E5
    ├── pages/map/MapPage.tsx, nodes/{IdeaNode,TaskNode,ConditionNode,OpportunityNode}.tsx, DetailPanel.tsx  # E6 (split 62/38)
    ├── pages/history/HistoryPage.tsx                            # E10
    ├── pages/settings/SettingsPage.tsx (+ réglages IA de 001)   # E9
    └── pages/onboarding/OnboardingFlow.tsx                      # E11

tests/
├── unit/tree/ · unit/review/ · unit/renderer/
├── integration/review/ · integration/history/ · integration/capture/
└── fixtures/mvp1/                  # propositions et arbres FICTIFS, générateur 50 idées / 300 nœuds
```

**Structure Decision**: même projet Electron ; nouveau module `main/shell` pour tout ce qui touche au
système (tray, raccourci, fenêtres) ; deux preloads distincts pour appliquer le moindre privilège par fenêtre.

## Complexity Tracking

Aucune violation à justifier.
