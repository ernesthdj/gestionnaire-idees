---
description: "Task list — 001 Moteur IA hybride & contexte (F9)"
---

# Tasks: Moteur IA hybride & contexte (F9)

**Input**: Design documents from `/specs/001-moteur-ia-hybride/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: **Obligatoires** (constitution, principe V) — écrits d'abord, ils doivent échouer avant l'implémentation. Nommage `should_<comportement>_when_<condition>`. Aucun appel réseau réel (FakeProvider).

**Organization**: Tâches groupées par user story ; chaque story est testable indépendamment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance)
- **[Story]**: US1…US5 (voir spec.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Squelette Electron + outillage (première feature du projet)

- [x] T001 Annoncer et faire valider la liste des dépendances (research.md § Dépendances annoncées) avant toute installation
- [x] T002 Initialiser le projet electron-vite (TypeScript, React) : `package.json`, `electron.vite.config.ts`, `tsconfig.json` (`strict: true`), arborescence `src/main`, `src/preload`, `src/renderer`, `src/shared` selon plan.md
- [x] T003 [P] Configurer ESLint + Prettier (règle `no-explicit-any` en erreur, interdiction de `console.log`) dans `eslint.config.js`, `.prettierrc`
- [x] T004 [P] Configurer Tailwind + tokens de design de base dans `src/renderer/src/styles/tokens.css` (dark/light via `[data-theme]`) — Tailwind v4 : configuration en CSS (`@theme`), pas de `tailwind.config.ts`
- [x] T005 [P] Configurer Vitest (`vitest.config.ts`, dossiers `tests/unit`, `tests/integration`, `tests/fixtures`)
- [x] T006 [P] Ajouter `.env.example` (valeurs fictives) et compléter `.gitignore` (`out/`, `dist/`, `release/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sécurité Electron, base chiffrée, IPC typé, secrets, contrat IA — requis par toutes les stories

**⚠️ CRITICAL**: aucune story ne commence avant la fin de cette phase

- [x] T007 Créer la fenêtre principale durcie dans `src/main/index.ts` (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP stricte, blocage de `window.open`/navigation externe)
- [x] T008 [P] Implémenter `SecretStore` (safeStorage, vérif. `isEncryptionAvailable`) dans `src/main/infrastructure/secrets/SecretStore.ts` + test `tests/unit/secrets/secret-store.test.ts` (safeStorage simulé)
- [x] T009 Implémenter le client Drizzle chiffré (clé 32 octets via SecretStore) dans `src/main/infrastructure/db/client.ts`
- [x] T010 Définir le schéma Drizzle des tables `ai_calls`, `ai_config`, `context_versions`, `context_imports`, `examples` dans `src/main/infrastructure/db/schema.ts` (data-model.md) + migration initiale avec `down` dans `src/main/infrastructure/db/migrations/`
- [x] T011 [P] Créer le socle IPC : format `{ success, data } | { success: false, error }`, registre de handlers avec validation Zod obligatoire dans `src/main/ipc/registry.ts` et types dans `src/shared/ipc/result.ts`
- [x] T012 [P] Exposer l'API `contextBridge` minimale typée dans `src/preload/index.ts`
- [x] T013 [P] Définir les types de domaine purs (`TaskKind`, `Engine`, `AIErrorCode`, `Result`) dans `src/main/domain/ai/types.ts`
- [x] T014 [P] Définir l'interface `AIProvider` et `FakeProvider` (réponses scriptées) dans `src/main/application/ai/AIProvider.ts` et `tests/support/FakeProvider.ts`
- [x] T015 [P] Écrire le cadre système **v2 « Brainstormer »** (texte figé, versionné) dans `src/main/infrastructure/ai/SystemFrame.ts` (contracts/ai-gateway.md § Cadre)
- [x] T016 [P] Créer le logger à liste blanche de champs (jamais de contenu, jeton, montant) dans `src/main/infrastructure/logging/logger.ts` + test `tests/unit/logging/logger.test.ts`

**Checkpoint**: squelette lancé (`npm run dev`), base chiffrée créée, IPC validé — stories démarrables

---

## Phase 3: User Story 1 — Réponse IA fiable par le bon moteur (Priority: P1) 🎯 MVP

**Goal**: `AIGateway` route, assemble le contexte, valide la sortie, gère refus/échecs, journalise

**Independent Test**: demandes `categoriser` et `synthetiser` avec FakeProvider → bon moteur ; sortie malformée → 1 nouvel essai puis `AI_INVALID_OUTPUT`

### Tests for User Story 1 ⚠️

- [x] T017 [P] [US1] Tests de routage (chaque TaskKind → moteur de la table ; changement de table sans toucher au code appelant) dans `tests/unit/ai/routing.test.ts`
- [x] T018 [P] [US1] Tests de validation (sortie invalide → 1 retry → `AI_INVALID_OUTPUT` ; refus → `AI_REFUSAL`) dans `tests/unit/ai/validation.test.ts`
- [x] T019 [P] [US1] Tests d'assemblage du contexte (ordre cadre → profil → exemples → données balisées ; cadre non remplaçable) dans `tests/unit/ai/context-assembler.test.ts`
- [x] T020 [P] [US1] Test d'intégration gateway + DB temporaire (journal `ai_calls` sans contenu, file Ollama concurrence 1 / Claude 2, `QUEUED` si Ollama indisponible) dans `tests/integration/ai/gateway.test.ts`

### Implementation for User Story 1

- [x] T021 [P] [US1] Table de routage par défaut + lecture depuis `ai_config` dans `src/main/domain/ai/routing.ts`
- [x] T022 [P] [US1] `ContextAssembler` (blocs système stables cachables puis variables, balises `<donnees_utilisateur>`) dans `src/main/application/ai/ContextAssembler.ts`
- [x] T023 [P] [US1] `OllamaProvider` (`/api/chat`, `format` JSON Schema, `/api/tags` pour la santé, 127.0.0.1 uniquement) dans `src/main/infrastructure/ai/OllamaProvider.ts`
- [x] T024 [P] [US1] `ClaudeProvider` (`messages.parse` + `zodOutputFormat`, `thinking: adaptive`, effort par kind, `cache_control`, gestion `stop_reason: refusal`, classes d'erreur typées du SDK) dans `src/main/infrastructure/ai/ClaudeProvider.ts` — **vérifier d'abord dans la doc du SDK** la compatibilité `parse` + fallbacks serveur (beta) ; si non supportée : pas de fallback serveur, refus → `AI_REFUSAL` propre, et consigner la décision dans research.md (R3) *(analyse B1)*
- [x] T025 [US1] `AIGateway` (routage, file par moteur, validation + 1 retry, idempotence `requestId` 5 min, journal) dans `src/main/application/ai/AIGateway.ts` (dépend de T021-T024)
- [x] T026 [US1] Schémas de sortie partagés initiaux (`CategoryOut`, `OutOfScope`) dans `src/shared/ai/schemas.ts`
- [x] T057 [P] [US1] Test de la file locale persistante (demande `QUEUED` conservée au redémarrage, rejouée au retour d'Ollama dans l'ordre d'arrivée, repli Claude **uniquement** si `allow_claude_fallback = true`, anonymisation appliquée au repli) dans `tests/unit/ai/local-queue.test.ts` *(analyse C1)*
- [x] T058 [US1] `LocalQueue` : table `ai_pending_requests` (data-model.md), sonde de santé Ollama toutes les 30 s, rejeu séquentiel FIFO, résultat livré au demandeur via l'événement `ai:requestCompleted { requestId }` ; branchement dans `AIGateway` — `src/main/application/ai/LocalQueue.ts` + migration dans `src/main/infrastructure/db/migrations/` *(analyse C1, dépend de T025)*
- [x] T027 [US1] Banc d'essai du modèle local (research R5) : script `scripts/bench-local-model.ts` + jeux fictifs `tests/fixtures/bench/` ; consigner le résultat dans `specs/001-moteur-ia-hybride/research.md` (R5)

**Checkpoint**: le moteur répond de façon fiable et vérifiée — base de F1 (catégorisation) et F2

---

## Phase 4: User Story 2 — Protéger mes données avant envoi (Priority: P1)

**Goal**: anonymisation double couche, jamais d'envoi brut

**Independent Test**: 50 textes fictifs → aucune donnée identifiante dans ce que reçoit le FakeProvider « claude »

### Tests for User Story 2 ⚠️

- [x] T028 [P] [US2] Jeu de 50 textes fictifs (montants, noms, e-mails, téléphones, IBAN) dans `tests/fixtures/anonymizer/cases.json`
- [x] T029 [P] [US2] Tests des règles déterministes (fourchettes de montants, retrait e-mail/téléphone/IBAN) dans `tests/unit/ai/anonymizer-rules.test.ts`
- [x] T030 [P] [US2] Tests du pipeline (IA locale OK → noms retirés ; IA locale KO → repli règles + heuristique ; échec total → `ANONYMIZATION_FAILED`, rien envoyé) dans `tests/unit/ai/anonymizer.test.ts`

### Implementation for User Story 2

- [x] T031 [P] [US2] Règles déterministes pures dans `src/main/domain/ai/anonymizationRules.ts`
- [x] T032 [US2] `Anonymizer` (règles + IA locale pour les noms + heuristique de repli) dans `src/main/application/ai/Anonymizer.ts`
- [x] T033 [US2] Brancher l'anonymisation obligatoire sur tout appel `engine = claude` dans `src/main/application/ai/AIGateway.ts`

**Checkpoint**: SC-002 vérifié — aucun envoi brut possible

---

## Phase 5: User Story 3 — Maîtriser le coût (Priority: P2)

**Goal**: coût journalisé, alerte 80 %, blocage 100 %, déblocage, remise à zéro mensuelle

**Independent Test**: série d'appels simulés franchissant 80 % puis 100 % du plafond

### Tests for User Story 3 ⚠️

- [x] T034 [P] [US3] Tests de calcul de coût (grille par modèle, lecture de cache, taux USD→EUR, millicentimes) dans `tests/unit/ai/cost.test.ts`
- [x] T035 [P] [US3] Tests `BudgetGuard` (états normal/alerte/bloqué/débloqué, nouveau mois, coût réel > estimation) dans `tests/unit/ai/budget.test.ts`

### Implementation for User Story 3

- [x] T036 [P] [US3] Calcul de coût pur dans `src/main/domain/ai/cost.ts`
- [x] T037 [US3] `BudgetGuard` (estimation pré-appel, imputation post-appel, événement `ai:budgetAlert`) dans `src/main/application/ai/BudgetGuard.ts`
- [x] T038 [US3] Intégrer `BudgetGuard` et la version locale dégradée (`allowDegraded`, drapeau `degraded`) dans `src/main/application/ai/AIGateway.ts`

**Checkpoint**: SC-004/SC-005 vérifiables

---

## Phase 6: User Story 4 — Configurer les moteurs (Priority: P2)

**Goal**: clé API masquée, choix des modèles, tests de connexion, guidage d'installation Ollama

**Independent Test**: saisir la clé, redémarrer, vérifier l'absence de clé en clair partout ; test de connexion simulé

### Tests for User Story 4 ⚠️

- [x] T039 [P] [US4] Tests des handlers IPC `ai:*` (validation Zod, clé jamais renvoyée en clair, `ENCRYPTION_UNAVAILABLE`) dans `tests/unit/ipc/ai-handlers.test.ts`
- [x] T040 [P] [US4] Test d'intégration « clé jamais en clair » (recherche de la clé fictive dans le dossier de données de test, logs, base) dans `tests/integration/ai/secret-leak.test.ts`

### Implementation for User Story 4

- [x] T060 [P] [US4] Test du guidage Ollama : service absent → message avec les 3 étapes (installer Ollama, télécharger le modèle retenu, revérifier) ; modèle absent → étapes 2-3 ; « Revérifier » relance la sonde et met le statut à jour — `tests/unit/ipc/ollama-guidance.test.ts` *(analyse U1)*
- [x] T041 [US4] Handlers `ai:status`, `ai:setClaudeKey`, `ai:clearClaudeKey`, `ai:getConfig`, `ai:setConfig`, `ai:test`, `ai:unlockBudget` dans `src/main/ipc/aiHandlers.ts` (contracts/ipc-ai.md)
- [x] T042 [P] [US4] Écran Réglages › IA (statut moteurs, saisie masquée, modèles, plafond, jauge, tests, guide Ollama) dans `src/renderer/src/pages/settings/ai/AiSettingsPage.tsx` + composants atoms/molecules
- [ ] T043 [US4] Accessibilité de l'écran (clavier complet, focus visible, contraste AA, libellés) — vérification et correctifs dans les composants de T042

**Checkpoint**: Claude activable par l'utilisateur ; SC-006 vérifié

---

## Phase 7: User Story 5 — Mettre à jour le contexte depuis Claude Code (Priority: P3)

**Goal**: inbox surveillée, validation manifeste/empreintes, aperçu, application, versions, rollback, exemples

**Independent Test**: inbox valide → aperçu → appliquer → rollback ; inbox altérée → refusée

### Tests for User Story 5 ⚠️

- [x] T044 [P] [US5] Fixtures fictives `tests/fixtures/context-inbox-valid/` et `tests/fixtures/context-inbox-tampered/`
- [x] T045 [P] [US5] Tests `ContextImportService` (manifeste invalide, empreinte fausse, taille > 50 Ko, fichiers hors liste ignorés, diff, apply, reject, rollback, une seule version active) dans `tests/unit/ai/context-import.test.ts`
- [x] T046 [P] [US5] Tests `ExampleStore` (plafond 20 par kind, positifs/négatifs, sélection des ≤ 3 pertinents) dans `tests/unit/ai/example-store.test.ts`

### Implementation for User Story 5

- [x] T047 [P] [US5] Watcher `fs.watch` + anti-rebond + archivage dans `src/main/infrastructure/context-inbox/InboxWatcher.ts`
- [x] T048 [US5] `ContextImportService` (validation, diff, versions, rollback) dans `src/main/application/ai/ContextImportService.ts`
- [x] T049 [P] [US5] `ExampleStore` dans `src/main/application/ai/ExampleStore.ts` et branchement dans `ContextAssembler` ; exposer `ExampleStore.record({ polarity, taskKind, input, output, reason? })` comme **point d'intégration pour F3** (propositions acceptées/refusées). Tant que F3 n'existe pas, les exemples proviennent uniquement de l'import de contexte *(analyse C3)*
- [x] T050 [US5] Handlers `context:*` + événement `context:newImport` dans `src/main/ipc/contextHandlers.ts`
- [x] T051 [US5] Écran Réglages › Contexte IA (aperçu avant/après, appliquer/refuser, historique, restaurer) dans `src/renderer/src/pages/settings/ai/ContextPage.tsx`
- [x] T052 [US5] Profil initial : `docs/context/profile.example.md` (fictif, versionné) + procédure documentée pour que Claude Code produise le vrai profil dans l'inbox (jamais dans le repo)

**Checkpoint**: SC-008 vérifié

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T053 [P] Revue sécurité Electron + IPC (checklist constitution I) et correction des écarts
- [ ] T054 [P] Vérifier `usage.cache_read_input_tokens` > 0 sur des appels Claude répétés (test manuel, clé de test) et documenter dans research.md (R3)
- [ ] T059 Vérifier l'écart de coût ≤ 5 % (SC-004) : série de 20 appels Claude de test (clé de test, données fictives), comparer le cumul `ai_calls` au coût affiché par la console Anthropic sur la même période ; ajuster la grille/le taux si besoin et consigner le résultat dans research.md (R9) *(analyse C2)*
- [ ] T055 [P] Mettre à jour `docs/JOURNAL.md` et `CLAUDE.md` (stack réelle, commandes `npm run dev/test/build`)
- [ ] T056 Exécuter tous les scénarios de `quickstart.md` et consigner le résultat

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (1)** → **Foundational (2)** → stories.
- **US1 (P1)** est prérequis de **US2** (branchement dans `AIGateway`) et de **US3** (intégration budget).
- **Dépendance externe** : l'alimentation automatique des exemples (FR-017) viendra de **F3** (feature ultérieure) via `ExampleStore.record()` (T049).
- **US4** dépend de US1 (statut/test des moteurs) et US3 (jauge budget).
- **US5** dépend de US1 (`ContextAssembler`).
- **Polish (8)** après les stories retenues.

### Ordre recommandé
Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Polish.
MVP minimal de la feature : **US1 + US2** (moteur fiable et sûr), suffisant pour démarrer F1 et F2.

### Parallel Opportunities
- Phase 2 : T008, T011, T012, T013, T014, T015, T016 en parallèle après T007/T009/T010.
- US1 : tests T017-T020 en parallèle ; puis T021-T024 en parallèle ; T025 ensuite.
- US2 : T028-T030 en parallèle ; T031 en parallèle de T032 (fichiers distincts).

## Parallel Example: User Story 1

```text
Tests : T017 routing · T018 validation · T019 context-assembler · T020 gateway (intégration)
Impl. : T021 routing.ts · T022 ContextAssembler.ts · T023 OllamaProvider.ts · T024 ClaudeProvider.ts
Puis  : T025 AIGateway.ts
```

## Implementation Strategy

1. **MVP d'abord** : Setup + Foundational + US1 + US2 → démontrer une catégorisation locale et une décomposition Claude anonymisée (FakeProvider en test, vrais moteurs en manuel).
2. **Incréments** : US3 (budget) → US4 (réglages) → US5 (contexte).
3. Chaque incrément : tests verts, entrée JOURNAL, **commit uniquement après confirmation de mentalyas**.
