# Implementation Plan: Interface MVP-1 « Brainstormer » (v2)

**Branch**: `003-interface-mvp1` | **Date**: 2026-09-28 (révision) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-interface-mvp1/spec.md`

## Summary

Interface du Brainstormer sur les moteurs 001/002 : **coquille** (tray, démarrage, instance unique, 2 fenêtres
durcies, navigation Idées · À valider · Historique, réglages, premier lancement), **capture** pré-chargée,
**écran Idées** en React Flow (incubateur + réseau disposés par `d3-force`, nœuds circulaires à 3 aspects,
liens libellés/suggérés), **plongée** (disposition radiale, fil d'Ariane, panneau de questions, jauge),
**aperçu de synthèse** éditable puis **fusion/éclosion/migration** animées avec Motion (mode réduit
systématiquement respecté), **suivi** des neurones éclos (plan Action / synthèse Réflexion), **À valider**,
**historique** avec annulation par lot, **export Markdown**.

## Technical Context

**Language/Version**: TypeScript 6 (`strict`), React 19, Electron 44

**Primary Dependencies**: 001 + 002 ; nouvelles : `@xyflow/react`, `d3-force`, `motion`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` ; tests : `@testing-library/react`, `jsdom`, `axe-core` (research.md)

**Storage**: tables de 002 ; clés `settings` `app.*`

**Testing**: Vitest (jsdom pour les composants), axe-core ; tests manuels pour raccourci, focus, animations, démarrage Windows

**Target Platform**: Windows 11, un ou plusieurs écrans

**Project Type**: desktop-app (Electron, 2 fenêtres)

**Performance Goals**: capture perçue instantanée ; sous-neurone visible immédiatement ; 100 neurones / 50 liens fluides ; animations aux durées FR-025

**Constraints**: animations réduites respectées (système ou réglage) ; rien d'appliqué sans confirmation ; renderer sans accès disque (export via main) ; clavier complet + AA

**Scale/Scope**: ~12 vues/états (capture, Idées, plongée, aperçu, fusion, suivi Action, lecture Réflexion, À valider, Historique, Réglages, premier lancement)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|----------|--------------|--------|
| I. Sécurité | 2 fenêtres durcies, preloads distincts, IPC Zod, export écrit par le main après dialogue natif, nom de fichier assaini, rendu texte | ✅ |
| II. Humain dans la boucle | Aperçu éditable → Confirmer ; liens suggérés ✓/✗ ; annulation par lot ; édition de la synthèse proposée revalidée | ✅ |
| III. IA cadrée | Toute IA via 002/001 ; l'interface n'appelle jamais l'IA directement | ✅ |
| IV. Local d'abord | Capture sans IA ; branches manuelles hors ligne ; export local | ✅ |
| V. Tests | Layout, motion, markdown, undo testés ; composants au clavier + axe ; spike d'animation validé tôt | ✅ |
| VI. Simplicité | Navigation par état ; disposition radiale maison (pas de lib) ; React Flow plutôt qu'un moteur de rendu maison | ✅ |

**Nouvelles dépendances** : 7 + 3 de test, à valider avant installation (T001). **Re-check post-design** : ✅.

## Project Structure

### Documentation
```text
specs/003-interface-mvp1/  plan.md · research.md · data-model.md · quickstart.md · analysis-report.md · contracts/ipc-mvp1.md · checklists/ · tasks.md
```

### Source Code (ajouts)
```text
src/main/
├── shell/                    # WindowManager, TrayController, GlobalShortcut, lifecycle (instance unique, --hidden, login item)
├── application/
│   ├── capture/CaptureService.ts
│   ├── canvas/CanvasService.ts        # IdeasCanvasView, DiveView, positions
│   ├── plan/PlanService.ts            # statuts + propagation, branches, déclencheurs, édition
│   ├── history/HistoryService.ts      # undo par lot
│   └── export/MarkdownExporter.ts     # écrit le fichier (dialogue natif)
├── domain/
│   ├── plan/computeStatuses.ts
│   └── export/renderNeuronMarkdown.ts # pur
└── ipc/ appHandlers · captureHandlers · canvasHandlers · planHandlers · pendingHandlers · historyHandlers · exportHandlers
src/preload/ main.ts · capture.ts
src/renderer/src/
├── capture/CaptureApp.tsx
├── app/AppShell.tsx                   # navigation, ⚙, QueryClient, Zustand, MotionConfig
├── motion/useReducedMotionPreference.ts · durations.ts
├── canvas/                            # IdeasCanvas (React Flow), forceLayout.ts, nodes/{RawNode,DevelopingNode,HatchedNode,SubNeuron,ExtensionSlot}.tsx, edges/LabeledEdge.tsx
├── dive/                              # DiveView, radialLayout.ts, Breadcrumb, QuestionPanel, Gauge
├── fusion/                            # SynthesisPreview (Action/Réflexion), FusionAnimation
├── hatched/                           # PlanFollowUp, ReflectionReader
├── pages/ PendingPage · HistoryPage · SettingsPage · OnboardingFlow
tests/
├── unit/ui/ (layout, motion) · unit/markdown/ · unit/plan/ · unit/renderer/
├── integration/ capture/ · history/ · plan/
└── fixtures/ui/ (+ scripts/seed-demo.ts)
```

**Structure Decision**: même projet Electron ; logique pure (statuts, export, dispositions) testable hors UI ;
composants par zone fonctionnelle (canvas, dive, fusion, hatched) plutôt que par écran.

## Complexity Tracking

Aucune violation. Dérogation d'expérience déjà validée : fusion 600–800 ms (> 400 ms standard), neutralisée en mode réduit.
