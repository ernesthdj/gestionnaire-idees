# Implementation Plan: Moteur IA hybride & contexte (F9)

**Branch**: `001-moteur-ia-hybride` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-moteur-ia-hybride/spec.md`

## Summary

Construire le **socle IA** de l'app : une façade unique `AIGateway` (processus principal Electron) qui
route chaque demande typée vers l'IA locale (Ollama) ou Claude (SDK Anthropic, `claude-opus-5` par
défaut), anonymise avant tout envoi externe, assemble un contexte cadré (cadre figé → profil → exemples →
données balisées), valide chaque réponse par schéma Zod, journalise et plafonne le coût, et gère
l'import de contexte depuis Claude Code avec aperçu, validation, versions et retour arrière.
Première feature du projet : elle pose aussi le **squelette de l'app** (Electron + React, base chiffrée,
IPC typé) sur lequel s'appuieront F1-F4.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`), Node.js LTS (runtime Electron)

**Primary Dependencies**: Electron, electron-vite, electron-builder, React, Tailwind, Zod, `@anthropic-ai/sdk`, Drizzle ORM + `better-sqlite3-multiple-ciphers` (voir research.md)

**Storage**: SQLite chiffré dans `%APPDATA%/gestionnaire-idees/` ; secrets via `safeStorage` (DPAPI) hors base

**Testing**: Vitest (unitaires + intégration), moteurs IA simulés (`FakeProvider`), SQLite temporaire

**Target Platform**: Windows 11, desktop, GPU 8 Go (RTX 3070) pour l'IA locale

**Project Type**: desktop-app (Electron : main / preload / renderer)

**Performance Goals**: catégorisation locale < 3 s ; retour visuel < 200 ms à toute action ; contexte Claude < 8 000 tokens d'entrée hors cache

**Constraints**: hors ligne pour tout le local ; aucune donnée brute vers l'extérieur ; plafond de coût mensuel ; renderer sans accès Node

**Scale/Scope**: mono-utilisateur ; ~1 000 idées ; quelques dizaines d'appels Claude/jour au plus

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|----------|--------------|--------|
| I. Sécurité d'abord | Clé API via `safeStorage`, jamais au renderer/logs/base ; Electron durci ; IPC validé Zod ; repo sans données réelles (fixtures fictives) | ✅ |
| II. Humain dans la boucle | Import de contexte = aperçu + validation ; F9 n'écrit aucune donnée métier (les propositions relèvent de F3) | ✅ |
| III. IA cadrée & vérifiable | `AIGateway` unique ; schéma obligatoire ; cadre figé non remplaçable ; données balisées ; refus distingué | ✅ |
| IV. Local d'abord & minimisation | Routage local par défaut ; anonymisation double couche, jamais d'envoi brut ; budget plafonné | ✅ |
| V. Qualité & tests | TS strict ; tests unitaires déterministes sans réseau (FakeProvider) ; nommage `should_…_when_…` | ✅ |
| VI. Simplicité | Pas de SDK Ollama (HTTP direct) ; `fs.watch` plutôt que chokidar ; pas d'abstraction au-delà de `AIProvider` (2 implémentations réelles) | ✅ |

**Re-check post-design (Phase 1)** : ✅ aucune violation — data-model sans contenu dans le journal, contrats sans secret exposé.

## Project Structure

### Documentation (this feature)

```text
specs/001-moteur-ia-hybride/
├── plan.md              # Ce fichier
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── ai-gateway.md    # Contrat interne AIGateway / AIProvider
│   └── ipc-ai.md        # Contrat IPC + contrat fichier d'import de contexte
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Clean Architecture dans le processus principal (Domain → Application → Infrastructure, aucun import
d'Electron/SDK dans `domain/`).

```text
src/
├── main/                          # Processus principal Electron (Node)
│   ├── index.ts                   # Bootstrap : fenêtres, sécurité, IPC
│   ├── domain/
│   │   └── ai/                    # Types purs : TaskKind, routage, règles d'anonymisation, budget (calculs)
│   ├── application/
│   │   └── ai/                    # AIGateway, BudgetGuard, ContextAssembler, ContextImportService, ExampleStore
│   ├── infrastructure/
│   │   ├── ai/                    # OllamaProvider, ClaudeProvider, SystemFrame (cadre v1)
│   │   ├── secrets/               # SecretStore (safeStorage)
│   │   ├── context-inbox/         # Watcher fs.watch + vérif. manifeste/empreintes
│   │   └── db/                    # Drizzle : schema.ts, client chiffré, migrations/
│   └── ipc/                       # Handlers ai:* et context:* (validation Zod)
├── preload/
│   └── index.ts                   # contextBridge : API typée minimale
├── renderer/                      # React + Tailwind (Atomic Design)
│   └── src/
│       ├── components/{atoms,molecules,organisms}/
│       └── pages/settings/ai/     # Écran Réglages › IA & Contexte
└── shared/
    ├── ipc/                       # Contrats IPC : schémas Zod + types
    └── ai/                        # Schémas de sortie IA partagés

tests/
├── unit/ai/                       # routing, validation, anonymizer, budget, context-import, local-queue
├── integration/ai/                # gateway + DB temporaire + FakeProvider
├── support/                       # Doubles de test partagés (FakeProvider, safeStorage simulé)
└── fixtures/                      # Données FICTIVES uniquement (textes, inbox valide/altérée, bench)

scripts/
└── bench-local-model.ts           # Banc d'essai du modèle local (research R5)

docs/
└── context/
    └── profile.example.md         # Profil FICTIF d'exemple (le vrai profil vit dans %APPDATA%, jamais dans le repo)
```

**Structure Decision**: projet unique Electron (main / preload / renderer / shared). `src/main` suit la
Clean Architecture du standard backend ; `src/renderer` suit l'Atomic Design du standard frontend ;
`src/shared` porte les schémas Zod communs, source unique des contrats.

## Complexity Tracking

Aucune violation de la constitution à justifier. Écart au standard global (Drizzle au lieu de Prisma)
déjà validé et inscrit dans la constitution (Contraintes techniques).
