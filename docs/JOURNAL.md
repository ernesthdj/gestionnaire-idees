# Journal — Gestionnaire_idées

## Regles apprises

| # | Regle | Fichier(s) | Date |
|---|-------|-----------|------|
| 1 | Electron : si `node_modules/electron/path.txt` est absent après `npm install` (« Electron uninstall »), lancer `node node_modules/electron/install.js` | `package.json` | 2026-09-28 |
| 2 | Vérifier les dépendances croisées avant d'épingler des versions : typescript-eslint impose TS < 6.1, electron-vite 5 impose Vite ≤ 7 | `package.json` | 2026-09-28 |
| 3 | Preload Electron en sandbox = CommonJS (`.cjs`) quand le paquet est `"type": "module"` | `electron.vite.config.ts` | 2026-09-28 |
| 4 | Le preload en sandbox ne peut pas charger de dépendance npm (zod…) : n'y importer que du code local sans dépendance | `src/preload/`, `src/shared/ipc/channels.ts` | 2026-09-28 |
| 5 | Drizzle importe `better-sqlite3` : utiliser un alias npm vers la variante chiffrée plutôt que dupliquer le paquet | `package.json` | 2026-09-28 |
| 7 | Ne jamais trier une file par horodatage + identifiant aléatoire : deux insertions dans la même milliseconde donnent un ordre non déterministe → trier par `rowid` | `PendingRequestRepository.ts` | 2026-09-28 |
| 8 | Une tâche qui traite des données brutes (anonymisation) doit être « strictement locale » par construction, pas seulement par configuration | `routing.ts`, `AIGateway.ts` | 2026-09-28 |
| 9 | L'outil d'écriture transforme les échappements Unicode d'espaces insécables en caractères invisibles (rejetés par ESLint) : utiliser la classe `\s`, qui les couvre déjà | `anonymizationRules.ts` | 2026-09-28 |
| 10 | Coût Claude : compter aussi les tokens d'ÉCRITURE en cache (~1,25× l'entrée) et tarifer le modèle réellement servi (bascule serveur), sinon le budget sous-estime | `cost.ts`, `aiEngine.ts` | 2026-09-28 |
| 11 | Un petit modèle local classe mal sans définitions : toujours fournir des consignes de tâche (définitions + exemples) — 37 % → 90 % | `TaskInstructions.ts` | 2026-09-28 |
| 12 | Désactiver la réflexion (`think: false`) d'Ollama pour les tâches courtes et structurées | `OllamaProvider.ts` | 2026-09-28 |
| 13 | Le profil injecté dans le cadre système n'est PAS anonymisé : refuser à l'import tout profil contenant une donnée personnelle (mêmes règles que l'anonymisation) | `domain/context/bundle.ts` | 2026-09-28 |
| 14 | Tout contenu issu des idées réelles envoyé à Claude doit être anonymisé, pas seulement l'entrée : exemples compris (blocs système typés par rôle) | `AIGateway.ts`, `ContextAssembler.ts` | 2026-09-28 |
| 15 | Recherche FTS5 : ne jamais passer la saisie brute à MATCH ; extraire les mots et les citer (`"mot"*`) pour neutraliser les opérateurs | `NeuronRepository.ts` | 2026-09-28 |
| 6 | Zod 4 : un tableau de routes typées hétérogènes ne se typise pas proprement → encapsuler validation + handler (`run(payload: unknown)`) | `src/main/ipc/registry.ts` | 2026-09-28 |
| 16 | Une donnée anonymisée avant l'IA (montant → fourchette) ne peut pas revenir exacte dans sa réponse : la faire citer par sa source (`sourceRefs`) et restaurer la valeur exacte localement | `provenance.ts`, `TaskInstructions.ts` | 2026-09-28 |
| 17 | Nouvelle tentative après un contrôle échoué : renvoyer le défaut constaté à l'IA, sinon elle reproduit la même erreur | `FusionService.ts` | 2026-09-28 |
| 18 | Des alias courts (`s1`, `s2`…) ne valent que pour une version de l'arbre : les convertir en identifiants au moment d'enregistrer | `SynthesisApplier.ts` | 2026-09-28 |

## Historique

### SESSION 0 — 2026-09-28

### [2026-09-28 08:47] FEAT — init
**Fichiers :** `CLAUDE.md`, `docs/JOURNAL.md`, `src/`, `tests/`
**Resume :** Scaffolding initial via `/hub new`. Coquille vide creee — stack et dependances a definir apres brainstorm.

### [2026-09-28 09:50] DOCS — brainstorm niveaux 1 et 2
**Fichiers :** `CLAUDE.md`, `docs/academique/`, `docs/brainstorm/L1-fondation.md`, `docs/brainstorm/L2-*.md` (9 fichiers)
**Résumé :** Suivi académique activé. Niveau 1 terminé : vision « agenda organique / secrétaire personnel », IA hybride (Ollama local + Claude), validation humaine obligatoire, Outlook via Microsoft Graph (compte perso), compagnon tamagotchi pixel art à évolution RNG pondérée, stack Electron + React + TS. Livraison découpée MVP-1 (F1-F4, F9) / MVP-2 (F5-F8). Niveau 2 rédigé pour les 9 fonctionnalités ; niveau 3 recommandé pour F2, F6, F7, F8, F9.

### [2026-09-28 09:56] DOCS — brainstorm niveau 3
**Fichiers :** `docs/brainstorm/L3-structuration-ia.md`, `L3-moteur-ia.md`, `L3-synchro-outlook.md`, `L3-conseiller-proactif.md`, `L3-compagnon.md`
**Résumé :** Conception technique des 5 fonctionnalités flaguées : contrat IPC typé (pas d'API HTTP), schéma SQLite chiffré (Drizzle + better-sqlite3-multiple-ciphers, clé via safeStorage), contrat AIProvider + AIGateway (routage, anonymisation, budget, validation Zod), Claude via SDK TS (messages.parse + zodOutputFormat, claude-opus-5 par défaut configurable), MSAL Node autorité consumers + PKCE + Graph /me/events avec transactionId, résumé de situation anonymisé (alias + bandes de montants), tirage par roulette pondérée journalisé.

### [2026-09-28 10:04] DOCS — brainstorm niveau 4 + export
**Fichiers :** `docs/brainstorm/L4-parcours.md`, `docs/FOUNDATION.md`, `CLAUDE.md`
**Résumé :** Parcours UX (6 parcours, 11 écrans, maquettes ASCII, frictions). Export consolidé L1+L2+L3+L4 en `docs/FOUNDATION.md` (~1 800 lignes). Exceptions projet inscrites dans CLAUDE.md : Drizzle au lieu de Prisma, repo public sans données réelles, Opus 5 par défaut.

### [2026-09-28 10:15] CONFIG — Spec Kit initialisé
**Fichiers :** `.specify/`, `.claude/skills/speckit-*`, `.gitignore`, `CLAUDE.md`
**Résumé :** `specify init --here --integration claude --script ps` (Spec Kit 0.16.5). CLAUDE.md du projet non modifié par l'outil (vérifié). `.claude/settings.local.json` ajouté au .gitignore suite à l'avertissement de sécurité de Spec Kit.

### [2026-09-28 11:01] DOCS — Spec Kit : constitution + feature 001
**Fichiers :** `.specify/memory/constitution.md`, `specs/001-moteur-ia-hybride/` (spec, checklist, plan, research, data-model, contracts, quickstart, tasks, analysis-report)
**Résumé :** Constitution v1.0.0 (6 principes : sécurité, humain dans la boucle, IA cadrée, local d'abord, qualité/tests, simplicité). Feature 001 F9 : 5 user stories, 19 FR, 8 SC, 56 tâches. Analyse : 0 critique, 4 moyens (repli/rejeu file locale, vérif. coût réel, dépendance exemples→F3, parse+fallbacks à vérifier), 4 mineurs.

### [2026-09-28 11:23] DOCS — Spec Kit : remédiation 001 + feature 002
**Fichiers :** `specs/001-moteur-ia-hybride/{tasks,plan,data-model,analysis-report}.md`, `contracts/ipc-ai.md`, `specs/002-structuration-ia/` (complet)
**Résumé :** 001 : 7 correctifs d'analyse appliqués (file locale persistante T057/T058, vérif. coût réel T059, guidage Ollama T060, point d'intégration F3, unités de coût, arborescence, vérif. SDK) → couverture 27/27. 002 F2 : 5 user stories, 16 FR, 7 SC, 42 tâches, modèle de données central, garantie « ne jamais inventer » par contrôle de provenance déterministe. Analyse : 0 critique, 1 moyen (statut après abandon d'une restructuration), 4 mineurs.

### [2026-09-28 11:53] DOCS — Spec Kit : remédiation 002 + feature 003
**Fichiers :** `specs/002-structuration-ia/{spec,data-model,tasks,analysis-report}.md`, `specs/003-interface-mvp1/` (complet)
**Résumé :** 002 : 5 correctifs (statut restauré après abandon, table settings + limite configurable, test out_of_scope, dépendance coquille → 003, FR-007 reformulé) → 24/24. 003 Interface MVP-1 (coquille + F1 + F3 + F4) : 5 user stories, 28 FR, 8 SC, 50 tâches ; 6 nouvelles dépendances annoncées (React Flow, dagre, Zustand, TanStack Query, RHF) + 3 de test. Analyse : 0 critique, 2 moyens (correction d'une 1re décomposition impossible via restructure ; effet d'une annulation d'acceptation non défini), 3 mineurs. MVP-1 entièrement spécifié.

### [2026-09-28 12:07] FEAT — squelette Electron (spec 001, T001-T006)
**Fichiers :** `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `.env.example`, `src/main/index.ts`, `src/preload/`, `src/renderer/`, `src/shared/app-api.ts`, `tests/unit/smoke.test.ts`
**Résumé :** Dépendances validées puis installées en versions exactes (Electron 44, electron-vite 5 + Vite 7, React 19, Tailwind 4, SDK Anthropic 0.128, Zod 4, Drizzle 0.45, SQLite chiffré 13, TypeScript 6.0, Vitest 5, ESLint 10). Fenêtre durcie (contextIsolation, sandbox, CSP, navigation/permissions/webviews bloquées), preload CJS. Typecheck, lint, prettier, tests et build OK ; app lancée en dev. Base chiffrée vérifiée dans Electron (fichier illisible en clair, mauvaise clé refusée).
**Décisions :** TS 6.0 (typescript-eslint < 6.1), Vite 7 (electron-vite 5), plugin-react 5.2 ; audit esbuild/drizzle-kit accepté (dev only).

### [2026-09-28 12:37] DOCS — pivot « Brainstormer » : amendements + révision des specs
**Fichiers :** `docs/brainstorm/L1b-brainstormer.md`, `docs/brainstorm/L4b-neurones.md`, `docs/design/neurones-dispositions-2a-2b-2c.png`, `docs/FOUNDATION.md` (§0), `CLAUDE.md`, `specs/001-*` (révisée), `specs/002-*` (réécrite), `specs/003-*` (réécrite)
**Résumé :** Idée de mentalyas : l'écran de création devient une carte de neurones (brut → en développement → éclos), croissance par questions IA (≥ 3, sans maximum, branches utilisateur), jauge de contexte, fusion = synthèse IA + confirmation + animation, réseau de neurones reliés. Élargi en « Brainstormer » : un réseau, deux natures (Action / Réflexion), IA partenaire de réflexion sur tout sujet (pas d'œuvres finies), sorties synthèse + export Markdown (MVP-1), plan d'action (MVP-2), pont hub (v2). Disposition 2c + plongée 2b ; navigation Idées · À valider · Historique (+ Planning en MVP-2) ; organigramme fusionné dans le réseau.
**Specs :** 001 cadre v2 + TaskKind (etendre, synthetiser, reviser, suggerer_liens) ; 002 moteur de neurones (21 FR, 32 tâches) ; 003 interface (25 FR, 49 tâches ; React Flow + d3-force + Motion, mode animations réduites). Analyses : 0 critique ; correctifs appliqués. Ouvert : verrouillage forcé avant « suffisant » (hypothèse : autorisé avec avertissement).

### [2026-09-28 12:50] FEAT — fondations du processus principal (spec 001, T007-T016)
**Fichiers :** `src/main/{bootstrap,index}.ts`, `src/main/ipc/{registry,appHandlers}.ts`, `src/main/domain/{errors,ai/types}.ts`, `src/main/application/ai/AIProvider.ts`, `src/main/infrastructure/{secrets/SecretStore,db/client,db/schema,ai/SystemFrame,logging/logger}.ts`, migration `0000_init_ai` (+ down), `src/preload/index.ts`, `src/shared/{app-api,ipc/*}.ts`, `tests/**` (35 tests), `drizzle.config.ts`
**Résumé :** IPC : liste blanche côté preload, validation Zod + contrôle de l'expéditeur côté main, format `IpcResult`, erreurs internes masquées. Secrets chiffrés DPAPI (clé de base aléatoire 32 octets). SQLite chiffré ouvert au démarrage dans %APPDATA% avec migrations (vérifié : fichier illisible, mauvaise clé refusée). Journal à liste blanche. Contrat `AIProvider` + `FakeProvider`. Cadre système v2 « Brainstormer » + balisage anti-injection. Canal `app:ping` de bout en bout.
**Décisions :** alias npm `better-sqlite3` → variante chiffrée ; types via `paths` (pas de `@types` supplémentaire) ; clé de base au format hex strict (PRAGMA non paramétrable).

### [2026-09-28 13:40] FEAT — passerelle IA et moteurs (spec 001 US1 : T017-T026, T057, T058)
**Fichiers :** `src/main/domain/ai/routing.ts`, `src/main/application/ai/{AIGateway,ContextAssembler,LocalQueue,ports}.ts`, `src/main/infrastructure/ai/{OllamaProvider,ClaudeProvider}.ts`, `src/main/infrastructure/db/repositories/{AiCallRepository,PendingRequestRepository}.ts`, `src/shared/ai/schemas.ts`, `scripts/bench-local-model.ts`, `tests/**` (78 tests)
**Résumé :** AIGateway = seul point d'accès IA : routage configurable (local/Claude), anonymisation obligatoire avant Claude (échec → rien n'est envoyé), budget vérifié avant l'appel, validation Zod + 1 nouvel essai, refus distingué, idempotence 5 min, concurrence Ollama 1 / Claude 2, mode dégradé local, journal sans contenu. File locale persistante (rejeu FIFO, abandon après 5 échecs). OllamaProvider (127.0.0.1 imposé, format JSON Schema). ClaudeProvider : `beta.messages.parse` + `betaZodOutputFormat`, réflexion adaptative, cache de prompt sur le dernier bloc stable, fallbacks serveur `default` pour Opus 5 (vérifié T024), erreurs typées du SDK.
**Bug corrigé :** ordre FIFO non déterministe (tri par identifiant aléatoire) → tri par `rowid`.
**Reste :** T027 (banc d'essai) attend Ollama ; câblage de la passerelle au démarrage après US2 (anonymisation) et US3 (budget).

### [2026-09-28 14:30] SECURITY — anonymisation avant envoi à Claude (spec 001 US2 : T028-T033)
**Fichiers :** `src/main/domain/ai/anonymizationRules.ts`, `src/main/application/ai/Anonymizer.ts`, `src/main/domain/ai/routing.ts` (tâches strictement locales), `src/main/application/ai/AIGateway.ts`, `src/shared/ai/schemas.ts` (`PersonsOut`), `tests/fixtures/anonymizer/cases.json` (50 textes fictifs), 3 fichiers de tests (104 tests au total)
**Résumé :** Couche 1 déterministe (liens, e-mails, IBAN, téléphones BE/FR, montants → fourchettes <100 / 100-500 / 500-1000 / 1000-2500 / >2500 €), toujours appliquée. Couche 2 : l'IA locale LISTE les noms (elle ne réécrit pas le texte) et le code les remplace ; noms absents du texte ignorés. Repli sans IA : masquage des mots capitalisés hors liste de mots courants et sigles courts. La tâche `anonymiser` est strictement locale (routage forcé, aucun repli vers Claude). SC-002 vérifié : 0 fuite sur 50 textes, avec et sans IA locale.
**Limites connues :** dates conservées (utiles au raisonnement). *(Adresses et lieux : ajoutés juste après, voir entrée suivante.)*

### [2026-09-28 14:55] SECURITY — anonymisation des lieux et adresses (demande de mentalyas)
**Fichiers :** `src/main/domain/ai/anonymizationRules.ts`, `src/main/application/ai/Anonymizer.ts`, `src/shared/ai/schemas.ts` (`SensitiveOut`), tests (112 au total)
**Résumé :** Couche 1 : adresses postales (numéro optionnel + type de voie : rue, avenue, chaussée, boulevard… + nom propre + numéro optionnel) → `[adresse]` ; codes postaux BE (4 chiffres) / FR (5 chiffres) + localité → `[lieu]`. Couche 2 : l'IA locale liste aussi les lieux (villes, quartiers, établissements) → `[lieu]` ; remplacement générique du plus long au plus court (« Citadelle de Namur » avant « Namur »).

### [2026-09-28 15:15] FEAT — budget IA et assemblage du moteur (spec 001 US3 : T034-T038)
**Fichiers :** `src/main/domain/ai/cost.ts`, `src/main/application/ai/BudgetGuard.ts`, `src/main/infrastructure/db/repositories/{AiConfigRepository,AiCallRepository}.ts`, migration `0001_cache_write_tokens` (+ down), `src/main/composition/aiEngine.ts`, `src/main/bootstrap.ts`, `src/main/index.ts`, tests (138 au total)
**Résumé :** Coût réel en millicentimes d'euro (entrée, sortie, lecture ET écriture de cache ; taux USD→EUR configurable ; modèle de bascule tarifé). BudgetGuard : blocage si dépense du mois + majorant de l'appel > plafond (10 € par défaut), déblocage manuel valable pour le mois en cours seulement, alerte unique par mois dès 80 %. Passerelle réordonnée : journal puis budget (le total inclut l'appel). Configuration IA = document JSON validé Zod avec valeurs par défaut (plafond, seuil, modèles, routage, repli). Moteur IA complet assemblé au démarrage (Ollama, Claude, anonymiseur, budget, file locale sondée toutes les 30 s).


### [2026-09-28 16:20] FEAT — réglages IA (spec 001 US4 : T039-T042, T060)
**Fichiers :** `src/main/ipc/aiHandlers.ts`, `src/shared/ipc/{ai,channels}.ts`, `src/shared/app-api.ts`, `src/preload/index.ts` (événements en liste blanche), `src/main/{bootstrap,composition/aiEngine}.ts`, `AIProvider.ts` (codes de problème), `ClaudeProvider.ts` (`ping` sans tokens), `src/renderer/src/pages/settings/ai/*`, `components/{atoms/Button,molecules/Section}.tsx`, tests (163 au total)
**Résumé :** Canaux `ai:*` (état, clé masquée, config validée, test de connexion, déblocage du mois) + événement `ai:budgetAlert`. Clé API jamais en clair (fichiers, base, journal, réponses : testé). Écran Réglages › IA (tokens neutres provisoires) : statut Ollama + étapes d'installation, clé Claude, choix du modèle, repli vers Claude, jauge de budget accessible (`progressbar`), déblocage avec case de confirmation (pas de boîte de dialogue). Modèle local par défaut `qwen3.5:9b`.
**Essai réel :** qwen3.5:9b installé (gemma4:26b supprimé à la demande de mentalyas, trop lourd pour 8 Go de VRAM). Catégorisation structurée : 37 s au premier appel (chargement du modèle), 0,7 s ensuite.
**Reste :** T043 (vérification clavier/contraste à l'écran, manuelle).

### [2026-09-28 16:35] DOCS — idée « blocs et mini-widgets » (v2)
**Fichiers :** `docs/brainstorm/L4c-widgets.md`, `docs/FOUNDATION.md` (§0.3), `specs/003-interface-mvp1/{spec,tasks}.md` (FR-026, T050)
**Résumé :** Idée de mentalyas : blocs libres sur la toile où Claude génère des mini-widgets (HTML/CSS/TS) qui interagissent avec les idées. Décisions : livraison v2, toile préparée dès le MVP-1 (nœud « bloc » vide) ; sécurité : iframe sandbox sans same-origin ni réseau, capacités par widget via postMessage validé, écritures = propositions, code visible et figé avant exécution ; portée limitée aux données de l'app (pas d'Internet). Amendement du cadre IA et de la constitution à prévoir en v2.

### [2026-09-28 16:55] PERF — banc d'essai du modèle local et consignes de tâche (spec 001 T027)
**Fichiers :** `src/main/infrastructure/ai/TaskInstructions.ts`, `src/main/application/ai/ContextAssembler.ts`, `src/main/infrastructure/ai/OllamaProvider.ts` (`think: false`), `package.json` (`tsx`, script `bench:local`), `specs/001-moteur-ia-hybride/research.md` (R5)
**Résumé :** Banc d'essai qwen3.5:9b sur 30 cas fictifs : catégorie 37 % → 90 %, nature 73 % → 90 % après ajout de consignes par tâche (catégoriser, anonymiser) ; p90 889 ms. Réflexion Ollama désactivée pour les tâches locales. Nouvelle dépendance de dev : `tsx` (validée).

### [2026-09-28 17:15] FEAT — import de contexte depuis Claude Code (spec 001 US5 : T044-T052)
**Fichiers :** `src/main/domain/context/bundle.ts`, `src/main/application/ai/{ContextImportService,ExampleStore}.ts`, `src/main/infrastructure/context-inbox/{InboxFolder,InboxWatcher}.ts`, `src/main/infrastructure/db/repositories/ContextRepository.ts`, migration `0002_examples_context_version` (+ down), `src/main/ipc/contextHandlers.ts`, `src/shared/ipc/{context,channels}.ts`, `src/main/{bootstrap,composition/aiEngine,index}.ts`, `AIGateway.ts` (contexte par type de tâche), `src/renderer/src/pages/settings/ai/ContextPage.tsx`, `src/renderer/src/App.tsx` (onglets provisoires), `docs/context/{README,profile.example}.md`, tests (180 au total)
**Résumé :** Dossier d'import surveillé (manifeste écrit en dernier, anti-rebond 1 s) ; validation : manifeste, fichiers annoncés présents, ≤ 50 Ko, SHA-256, format des exemples, **refus de toute donnée personnelle dans profil/règles** (envoyés non anonymisés à Claude) ; import en attente avec aperçu avant/après, appliquer / refuser, versions et retour arrière (les exemples importés suivent leur version) ; version 1 « vide » créée au premier lancement. Exemples : 20 appris max par type, 3 plus récents du bon type injectés ; `ExampleStore.record` = point d'intégration pour la spec 002. Écran Contexte IA.
**Premier profil réel :** distillé du CLAUDE.md global (casquettes, façon de réfléchir, organisation ; aucune donnée d'identité), déposé dans `%APPDATA%` (hors dépôt), détecté et mis en attente par l'app — à valider par mentalyas dans Réglages › Contexte IA.
**Incident :** classifieur du mode auto indisponible → passage en mode manuel par mentalyas.

### [2026-09-28 17:40] SECURITY — revue sécurité de la spec 001 (T053)
**Fichiers :** `docs/SECURITY-REVIEW-001.md`, `src/main/application/ai/{AIGateway,AIProvider,ContextAssembler}.ts`, `src/main/domain/context/bundle.ts`, `src/main/infrastructure/ai/OllamaProvider.ts`, `src/main/ipc/registry.ts`, `src/main/{bootstrap,index}.ts`, tests (188 au total)
**Résumé :** 5 constats corrigés : F1 (élevée) exemples envoyés à Claude sans anonymisation → blocs typés par rôle, exemples anonymisés ; F2 exemples importés contrôlés (données personnelles) ; F3 `OLLAMA_URL` non locale → repli au lieu de plantage ; F4 expéditeur IPC limité aux fichiers de l'interface ; F5 vérifications de permission refusées. Points conformes et risques résiduels documentés.

### [2026-09-28 18:05] FEAT — fondations du moteur de neurones (spec 002 Phase 2 : T001, T003-T009)
**Fichiers :** `src/main/infrastructure/db/schemaNeurons.ts` (11 tables), migrations `0003_neurons_model` + `0004_neurons_seed_fts` (+ down), `db/client.ts`, `drizzle.config.ts`, `src/shared/ai/neurons.ts` (EtendreOut, ActionPlanOut, ReflectionSummaryOut, SuggererLiensOut), `src/shared/ipc/neurons.ts`, `NeuronRepository.ts`, `application/neurons/NeuronService.ts`, `ipc/neuronHandlers.ts`, `bootstrap.ts`, `composition/aiEngine.ts`, tests (206 au total)
**Résumé :** Modèle central : neurones (racines + sous-neurones), extensions, jauges, synthèses, plan d'action, synthèse de réflexion, liens, historique, réglages ; 6 catégories et réglages du moteur en base ; recherche plein texte insensible aux accents, synchronisée par déclencheurs. NeuronService : création (titre = 1re ligne, nature Réflexion par défaut), catégorisation locale non bloquante et rejouée depuis la file, choix de l'utilisateur jamais écrasé, liste filtrée et paginée, modification (version +1), archivage. Canaux `neuron:*` validés.

### [2026-09-28 18:40] FEAT — croissance des neurones et jauge de contexte (spec 002 US1 + US2 : T010-T017, T028)
**Fichiers :** `src/main/domain/neurons/{tree,guards}.ts`, `src/main/application/neurons/{GrowthService,GrowthContextBuilder}.ts`, `src/main/infrastructure/db/repositories/GrowthRepository.ts`, `src/main/infrastructure/ai/TaskInstructions.ts` (consignes `etendre`), `src/main/ipc/growthHandlers.ts`, `src/shared/ipc/channels.ts` (+ événements `neuron:created|thinking|thought`), `bootstrap.ts`, tests (227 au total)
**Résumé :** Un seul appel `etendre` par réponse → extensions + jauge. Garde-fous déterministes : ≥ 3 extensions au premier développement (1 nouvel essai puis repli signalé), doublons retirés (questions normalisées, y compris écartées), profondeur 6 (au-delà : jauge seule / refus `DEPTH_LIMIT` sans appel IA), plancher de jauge (< 3 réponses → insuffisant). Réponse → sous-neurone (réponse, condition, opportunité ou investigation « À trouver ») enregistré et annoncé AVANT l'appel IA ; idempotence par contrainte d'unicité ; réponse conservée même si l'IA est indisponible. Branches utilisateur, questions écartées, suppression en cascade. Contexte envoyé : nature + dimensions de référence, chemin complet, autres branches (titres), questions déjà posées — anonymisé par la passerelle.

### [2026-09-28 19:40] FEAT — verrouiller, synthétiser, éclore (spec 002 US3 : T018-T024)
**Fichiers :** `src/main/domain/neurons/{planChecks,provenance,extractValues}.ts`, `src/main/domain/ai/anonymizationRules.ts` (`amountsIn`, `numbersIn`), `src/main/application/neurons/{FusionService,SynthesisApplier,SynthesisContextBuilder}.ts`, `src/main/infrastructure/db/repositories/FusionRepository.ts`, `src/main/infrastructure/ai/TaskInstructions.ts` (consignes `synthetiser`/`reviser`), `src/main/ipc/fusionHandlers.ts`, `src/shared/ipc/{neurons,channels,result}.ts`, `src/main/domain/errors.ts` (`details`), `bootstrap.ts`, tests (270 au total)
**Résumé :** Verrouillage refusé si la jauge est « insuffisant » (`CONTEXT_INSUFFICIENT` + dimensions manquantes), sauf `force` (proposition marquée `forced`). Claude produit un plan d'action ou une synthèse de réflexion selon la nature ; contrôles P1–P5 (références, 2 à 4 branches libellées, profondeur ≤ 5, sans boucle par tri de Kahn, sources existantes) et S1, 1 nouvelle tentative qui signale le défaut. P6 : montant ou date jamais écrit par l'utilisateur → retiré, nœud marqué « à trouver » + manque listé ; un montant masqué en fourchette est restauré depuis l'unique réponse citée. Rien n'est écrit avant confirmation ; une seule proposition en cours par idée (double verrouillage = même proposition, sans nouvel appel). Confirmation en une transaction : plan (statuts `ready`/`blocked`) ou synthèse (sources converties en identifiants), idée éclose, version +1, historique par lot, exemple positif appris ; toute panne → `APPLY_FAILED` sans rien modifier (vérifié par panne injectée à chaque étape + test de mutation). Arbre modifié après la proposition → `STALE` + événement `synthesis:stale`. Correction (`superseded`), refus, réouverture (plan/synthèse précédents conservés, plus « en cours »).
**Choix :** « élément à trouver » = le nœud concerné passe en investigation (pas de nœud ajouté, qui aurait pu casser le nombre de branches ou la profondeur). Refus : pas d'exemple négatif appris (la raison n'est pas encore exploitée). `fusion:editProposed` reste pour la spec 003.

