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
| 19 | Ajouter une valeur à une énumération utilisée comme clés d'un `z.record` (Zod 4, exhaustif) invalide les documents déjà enregistrés : compléter avec les valeurs par défaut avant validation | `AiConfigRepository.ts` | 2026-09-28 |
| 20 | Recherche web Claude = citations toujours actives, incompatibles avec la sortie structurée : appel séparé en texte libre, jamais dans l'appel JSON | `ClaudeProvider.ts` | 2026-09-28 |
| 21 | Scripts Python d'édition via heredoc bash : `\n` devient un vrai retour à la ligne dans le fichier ; écrire le script avec l'outil Write ou utiliser l'outil Edit | outillage | 2026-09-28 |
| 22 | Réduire les tokens d'une comparaison IA : présélection locale déterministe (mots-clés partagés, catégorie), fiches courtes, et aucun appel quand rien n'est proche | `domain/neurons/links.ts` | 2026-09-28 |
| 23 | Une balise de délimitation des données utilisateur se neutralise dans TOUTES ses variantes (casse, espaces), pas seulement sous sa forme exacte | `SystemFrame.ts` | 2026-09-28 |
| 24 | Sous Windows, un script Python qui réécrit un fichier du dépôt l'ouvre avec `newline=''` (lecture et écriture), sinon tout le fichier passe en CRLF | outillage | 2026-10-11 |

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

### [2026-09-28 20:30] FEAT — montants exacts, suggestions (neurones fantômes) et recherche web (spec 002 US6 : T033-T037)
**Fichiers :** `.specify/memory/constitution.md` (v1.1.0), `specs/001-moteur-ia-hybride/spec.md` (FR-006), `specs/002-structuration-ia/{spec,tasks}.md` + contrats, `specs/003-interface-mvp1/{spec,tasks}.md` (FR-027, T051), `src/main/domain/ai/{anonymizationRules,cost,routing,types}.ts`, `src/main/application/ai/{Anonymizer,AIGateway,AIProvider}.ts`, `src/main/infrastructure/ai/{ClaudeProvider,TaskInstructions}.ts`, `src/main/infrastructure/db/{schemaNeurons.ts,migrations/0005_suggestions.sql,migrations/down/0005_suggestions.down.sql}`, repositories `{AiConfig,Growth,Neuron}Repository.ts`, `src/main/application/neurons/{GrowthService,GrowthContextBuilder}.ts`, `src/main/domain/neurons/guards.ts`, `src/main/ipc/{aiHandlers,growthHandlers}.ts`, `src/shared/{ai/neurons,ipc/ai,ipc/neurons,ipc/channels}.ts`, `AiSettingsPage.tsx`, tests (286 au total)
**Résumé :** (1) Montants transmis exacts à Claude par défaut (calculs) ; case « Masquer les montants » dans Réglages IA, relue à chaque appel ; noms, lieux, adresses, e-mails, téléphones, IBAN toujours anonymisés. (2) Suggestions : l'appel `etendre` renvoie aussi 0 à 2 pistes rattachées à un neurone (fantômes) ; contrôle S2 (neurone existant, pas de doublon, une seule vérification web par appel) ; accepter = sous-neurone d'origine IA + croissance relancée, ignorer = retrait sans toucher à l'arbre ; les valeurs d'une suggestion acceptée comptent pour la provenance P6. (3) Recherche web : appel séparé `rechercher` (Claude uniquement, `web_search_20260209` avec filtrage dynamique, 2 recherches max, localisation BE), reprise sur `pause_turn`, sources dédupliquées ; via la passerelle (budget vérifié avant, entrée anonymisée, journal, coût des recherches 0,01 $ chacune compté) ; en arrière-plan avec événement `suggestion:updated`. Bug latent corrigé : ajouter un type de tâche IA aurait réinitialisé toute la configuration IA enregistrée.
**Choix :** constitution v1.1.0 validée par mentalyas (montants exacts ; l'IA peut PROPOSER une valeur, jamais l'écrire sans acceptation). Non vérifié en réel : combinaison recherche web + sources avec la vraie clé et coût moyen (T038).

### [2026-09-28 21:10] FEAT — liens entre idées écloses (spec 002 US4 : T025-T026)
**Fichiers :** `src/main/domain/neurons/links.ts`, `src/main/application/neurons/{LinkService,FusionService}.ts`, `src/main/infrastructure/db/repositories/{LinkRepository,changeLog,FusionRepository}.ts`, `src/main/infrastructure/ai/TaskInstructions.ts` (consignes `suggerer_liens`), `src/main/ipc/linkHandlers.ts`, `src/shared/ipc/{neurons,channels}.ts` (+ `links:*`, événement `links:suggested`), `bootstrap.ts`, `specs/002-structuration-ia/{research,tasks}.md`, tests (296 au total)
**Résumé :** À chaque éclosion (en arrière-plan, sans bloquer la confirmation), un graphe local de mots-clés — idée de mentalyas inspirée de Graphify — choisit au plus 10 idées écloses proches ; Claude ne reçoit que leurs fiches courtes (alias N1…N10) et propose 0 à 3 liens libellés et justifiés ; aucun appel si rien n'est proche. Alias inconnu retiré ; empreinte (paire ordonnée + libellé normalisé) : un lien refusé, accepté ou déjà proposé n'est jamais reproposé. Décisions (accepter/refuser, exemple appris), création manuelle (origine utilisateur, doublon refusé), renommage, suppression ; historique `change_log` de type `link`. Écriture de l'historique mutualisée (`changeLog.ts`).
**Choix :** Graphify n'est pas embarqué dans l'app (Python, extraction elle-même payante en tokens) ; son principe (graphe de proximité avant l'IA) est repris en TypeScript pur.

### [2026-09-28 21:45] FEAT — nature des neurones, mode dégradé, injection (spec 002 US5 + Polish : T027, T029, T030, T032)
**Fichiers :** `src/main/domain/neurons/nature.ts` (dimensions de référence, `isOutsideNature`), `src/main/application/neurons/{NeuronService,GrowthContextBuilder}.ts`, `src/main/infrastructure/db/repositories/NeuronRepository.ts`, `src/main/infrastructure/ai/{SystemFrame,TaskInstructions}.ts`, `src/shared/ipc/neurons.ts` (`ExtensionView.outsideNature`), tests `nature.test.ts`, `degraded.test.ts`, `system-frame.test.ts` (305 au total)
**Résumé :** US5 : changer la nature en cours de développement réoriente les questions suivantes (dimensions de référence transmises) ; une question dont la dimension sort de la nature actuelle est signalée (`outsideNature`), jamais retirée ; l'IA est invitée à nommer ses dimensions avec les noms de référence. Mode dégradé vérifié : sans IA, réponses conservées, branches manuelles possibles, verrouillage refusé sans rien écrire ; synthèse produite par l'IA locale marquée `degraded`. Injection : toute variante de la balise fermante `</donnees_utilisateur>` (casse, espaces) est neutralisée. Cadre système v3 aligné sur la constitution 1.1.0 (suggestion explicite autorisée, recherche web quand la tâche le demande).
**Reste (spec 002) :** T031 validations manuelles et T038 recherche web réelle, avec la clé Claude.

### [2026-09-28 16:05] SESSION — End
**Resume :** Session inaugurale. /hub new (repo public), brainstorm niveaux 1 à 4 + export FOUNDATION.md, pivot « Brainstormer » (neurones Action/Réflexion), Spec Kit (constitution + specs 001/002/003). Spec 001 livrée : Electron durci, SQLite chiffré, passerelle IA hybride (Ollama qwen3.5:9b + Claude Opus 5), anonymisation, budget, réglages, import de contexte, revue sécurité. Spec 002 livrée (sauf validations réelles T031/T038) : croissance + jauge, verrouillage/synthèse/éclosion, montants exacts (constitution 1.1.0), neurones fantômes + recherche web, liens par présélection locale, nature, mode dégradé, anti-injection. 305 tests. Prochaine étape : validations réelles avec la clé Claude, puis spec 003 (interface).
**Branche :** main
**Commits pushes :** 21 (27 commits sur la journée)


### [2026-09-28 → 29, session du soir] CONFIG — spec 003 : dépendances de l'interface et jeu de démonstration (T001-T002)
**Fichiers :** `package.json` (+7 dépendances, +5 de dev, versions exactes), `vitest.config.ts` (projets `node` / `renderer` en jsdom), `tsconfig.{web,node}.json`, `tests/support/{axe,renderer-setup}.ts`, `tests/unit/renderer/button.test.tsx`, `src/main/infrastructure/db/demo/seedDemo.ts`, `src/main/index.ts` (profil `--demo`), `tests/integration/db/seed-demo.test.ts`, `specs/003-interface-mvp1/tasks.md` (311 tests)
**Résumé :** Dépendances validées par mentalyas : `@xyflow/react`, `d3-force`, `motion`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` ; dev : `@types/d3-force`, `@testing-library/react` (+ `@testing-library/dom`, requis), `jsdom`, `axe-core`. `npm audit` inchangé (4 alertes connues de drizzle-kit). Tests de composants en jsdom avec assertion `expectNoAxeViolations` (contraste exclu : jsdom ne calcule pas les couleurs rendues, vérifié à la main en T046). Jeu fictif déterministe : 100 idées (30 brutes, 30 en développement avec arbre + jauge, 40 écloses avec plan ou synthèse) et 50 liens (40 acceptés, 10 suggérés), inséré une seule fois.
**Choix :** `npm run seed:demo` lance l'app sur un **profil démo séparé** (`%APPDATA%/gestionnaire-idees-demo`, développement uniquement) au lieu d'un script `tsx` : la clé de la base est protégée par `safeStorage`, accessible seulement depuis Electron. Les fixtures de vues UI sont reportées à la création de ces vues (T018/T024).

### [2026-09-28 → 29, session du soir] FEAT — coquille de l'app (spec 003 Phase 2 : T003-T010)
**Fichiers :** `src/shared/ipc/{app,channels}.ts`, `src/shared/app/accelerator.ts`, `src/shared/app-api.ts`, `src/main/infrastructure/db/repositories/AppSettingsRepository.ts`, `src/main/shell/{WindowManager,TrayController,GlobalShortcut,hardening,placement,lifecycle,trayIcon}.ts`, `src/main/ipc/{appHandlers,registry}.ts`, `src/main/{bootstrap,index}.ts`, `src/preload/index.ts` (+ `index.d.ts`), `electron.vite.config.ts` (2 pages), `src/renderer/capture.html`, `src/renderer/src/{App.tsx,app/*,motion/*,lib/ipc.ts,pages/{SettingsPage,SectionPlaceholder}.tsx,capture/*}`, tests (367 au total), `package.json` (+ `@testing-library/user-event`, validé)
**Résumé :** L'app vit dans la zone de notification (Capturer / Ouvrir / À valider / Quitter), une seule instance, démarrage avec Windows en `--hidden` (installée seulement) ; fermer la fenêtre la cache. Fenêtre de capture pré-chargée, cachée, placée sur l'écran du curseur, fermée par `blur()` + `hide()` pour rendre le focus. Raccourci global : essayé avant d'être enregistré (`SHORTCUT_UNAVAILABLE`, l'ancien reste actif) ; au démarrage, échec → notification, l'app reste utilisable. Réglages `app.*` validés un par un (valeur corrompue → défaut). Canaux autorisés **par page** (principale / capture) côté main. Interface : navigation Idées · À valider · Historique à gauche, ⚙ en haut à droite, thème sur `data-theme`, TanStack Query (invalidation sur les événements de 002), Zustand, `MotionConfig` ; animations réduites si Windows OU le réglage le demande (mouvements supprimés, fondus ≤ 150 ms).
**Choix :** un seul preload qui n'expose que l'API de sa fenêtre (`--gi-window=`) : un preload en sandbox ne peut rien charger d'autre, et l'option `isolatedEntries` d'electron-vite (expérimentale) plantait hors terminal. Pas de migration pour les réglages (table existante, défauts dans le code). `app:openMain` non exposé (navigation poussée par le main).
**Reste à vérifier à la main :** démarrage réel (`npm run dev`) : icône, raccourci `Ctrl+Alt+Espace` qui ouvre la capture (squelette), fermeture qui cache, 2e lancement qui ramène la fenêtre.

### [2026-09-28 → 29, session du soir] FEAT — capture rapide (spec 003 US1 : T011-T016)
**Fichiers :** `src/main/application/capture/CaptureService.ts`, `src/main/ipc/captureHandlers.ts`, `src/main/{bootstrap,index}.ts` (`hideCapture`, `openDive`), `src/renderer/src/capture/CaptureApp.tsx`, `src/main/shell/TrayController.ts` (icône 16 + 32 px), `tests/integration/capture/capture.test.ts`, `tests/unit/renderer/capture-app.test.tsx` (386 tests)
**Résumé :** Fenêtre de capture E1 : `Entrée` note (confirmation « ✓ Idée notée » 600 ms puis fermeture), `Maj+Entrée` à la ligne, `Ctrl+Entrée` note et ouvre la fenêtre principale sur le neurone, `Échap`/clic extérieur ferment en gardant le brouillon, compteur /2000, texte vide ignoré. Neurone créé sans attendre l'IA ; nature/catégorie appliquées ensuite par l'IA locale, jamais par-dessus un choix de l'utilisateur. Canaux `capture:*` réservés à la page de capture.
**Bug évité :** brouillon enregistré aussi à la perte de focus (clic extérieur < 300 ms après la frappe), mais pas pendant l'envoi — sinon l'idée envoyée serait revenue comme brouillon (la fenêtre perd le focus avant la réponse du main). Champ en lecture seule (et non désactivé) pendant l'envoi.
**Vérifié en réel :** profil démo, touches simulées + captures d'écran (Entrée, Échap, Ctrl+Entrée). Icône de la zone de notification : présente, rangée par Windows 11 dans les icônes masquées (^) comme toute nouvelle app.

### [2026-09-28 → 29, session du soir] FEAT — écran Idées : incubateur, réseau, liens sans croisement (spec 003 US2 : T017-T022, T050)
**Fichiers :** `src/shared/ipc/{canvas,channels}.ts`, `src/main/application/canvas/CanvasService.ts`, `src/main/ipc/canvasHandlers.ts`, `src/main/infrastructure/db/repositories/{NeuronRepository,BlockRepository}.ts`, `schemaNeurons.ts` + migration `0006_canvas_blocks` (+ down), `src/main/infrastructure/db/demo/seedDemo.ts` (identifiants UUID, liens en groupes), `src/renderer/src/canvas/{forceLayout,crossings,buildGraph,IdeasCanvas,CanvasToolbar,NeuronMenu,canvas.css}`, `canvas/nodes/{NeuronNode,ZoneNode,BlockNode}.tsx`, `canvas/edges/LinkEdge.tsx`, `pages/IdeasPage.tsx`, `app/uiStore.ts`, tests (430 au total)
**Résumé :** Carte React Flow en deux zones (incubateur à gauche, réseau à droite) disposée par `d3-force` (fonction pure, déterministe), trois aspects (brute pointillée qui dérive, en développement avec satellites, éclose double anneau + halo), couleurs de catégorie adaptées au thème sombre, compteurs, « + Une idée ? », filtres nature/catégorie et recherche (mise en évidence, les autres restent visibles), recentrer, état vide, zoom en français. Clavier : Tab d'idée en idée, Entrée = plonger, flèches = déplacer la vue, Maj+F10 = menu (nature/catégorie proposées par l'IA ✦ changées en un geste). Liens libellés ; suggérés en pointillés avec ✓/✗. Positions mémorisées sans changer la version de l'idée ; glisser une idée la garde en place. Blocs libres (T050) : placer, déplacer, redimensionner, supprimer, aucun code exécuté.
**Exigence de mentalyas :** les liens ne doivent pas se croiser. Passe `crossings.ts` après la physique : échanges d'idées de même taille puis déplacement vers des cases libres tant que le nombre de croisements (et de traits passant sous une idée) baisse ; jusqu'à 2 départs supplémentaires si ce n'est pas zéro. Résultat : 0 croisement sur arbres, groupes d'idées et même 50 liens aléatoires entre 40 idées. Zéro est impossible pour un réseau non planaire (vérifié avec networkx sur l'ancien jeu démo) : on y atteint alors le minimum trouvé. Spec FR-010 complétée.
**Bugs corrigés en route :** liens invisibles (React Flow exige des poignées : poignées invisibles au centre) ; boutons de zoom blancs (mode sombre non transmis) ; cadrage faux (nœuds hors écran non mesurés → cadrage sur les zones calculées, une fois la taille du conteneur connue) ; carte qui bougeait à la réouverture (plus de simulation quand toutes les positions sont connues) ; identifiants démo refusés par les canaux (UUID exigés).
**Performance :** 0,2 s de disposition pour 100 idées / 50 liens réalistes, seulement quand une idée ou un lien change (pas au déplacement ni au zoom). Web Worker non nécessaire pour l'instant.

### [2026-09-28 → 29, session du soir] FEAT — plongée : couronne de sous-neurones, questions de l'IA, jauge, fantômes (spec 003 US3 : T023-T028, T051)
**Fichiers :** `src/main/application/neurons/GrowthService.ts` (`editBranch`), `GrowthRepository.ts` (`updateSubNeuron`), `src/main/ipc/growthHandlers.ts` (`growth:editBranch`), `src/shared/ipc/{neurons,channels}.ts`, `src/renderer/src/dive/{diveModel,radialLayout,useDive,DiveView,DiveStage,QuestionPanel,Gauge,Breadcrumb,dive.css}`, `pages/IdeasPage.tsx`, tests `tests/unit/ui/radial.test.ts`, `tests/unit/renderer/dive.test.tsx`, fixtures `tests/fixtures/ui/dive.ts` (451 tests)
**Résumé :** Plongée en deux panneaux (62/38) : neurone ciblé au centre, sous-neurones, fantômes de l'IA et emplacements « + » (questions) en couronne sur 300°, parent estompé à gauche pour remonter ; fil d'Ariane cliquable, badge de profondeur /6. Panneau : jauge (3 crans + ce qui manque), question choisie avec réponses rapides, texte libre, « Je ne sais pas », « Écarter », autres questions, « Plus de questions » (désactivé à la profondeur 6), « Ajouter ma branche », modifier/supprimer le neurone (confirmation s'il a des descendants). Une idée brute se développe dès l'ouverture. Le sous-neurone apparaît tout de suite (optimiste), puis « L'IA réfléchit… » jusqu'à `neuron:thought`. Fantômes : Entrée = accepter, Échap/× = ignorer, vérification web signalée, sources au survol/focus. IA indisponible : message clair, les branches manuelles restent possibles. Pousse 250 ms et transition de plongée 400 ms, fondus courts en mode réduit.
**Choix :** vue de plongée calculée côté interface depuis `neuron:getTree` (pas de `dive:get`) ; nouveau canal `growth:editBranch` (le moteur ne savait pas renommer un sous-neurone).
**Incident :** lors d'un essai réel automatisé (touches simulées), mentalyas jouait en plein écran : les touches sont parties dans le jeu. Règle : plus aucune touche simulée sans demander d'abord.
**Reste à vérifier à la main :** plongée réelle depuis la carte (double-clic) avec l'IA locale et Claude.

### [2026-09-28 → 29, session du soir] FEAT — verrouiller, aperçu éditable, fusion et éclosion (spec 003 US4 : T029-T033)
**Fichiers :** `src/main/domain/neurons/synthesisPatch.ts`, `src/main/application/neurons/FusionService.ts` (`proposed`, `editProposed`), `FusionRepository.ts` (`updatePayload`), `src/main/ipc/fusionHandlers.ts` (`fusion:getProposed`, `fusion:editProposed`), `src/shared/ipc/{neurons,channels}.ts`, `src/renderer/src/fusion/{useFusion,SynthesisPreview}.tsx`, `dive/{QuestionPanel,DiveView,DiveStage,dive.css}`, `canvas/{IdeasCanvas,buildGraph,canvas.css}`, `app/{uiStore,Toast,AppShell}`, `specs/003-interface-mvp1/research.md` (R3), tests `tests/integration/fusion/edit-proposed.test.ts`, `tests/unit/renderer/preview.test.tsx`, support `tests/support/fusion.ts` (469 tests)
**Résumé :** « Verrouiller 🔒 » : si le contexte est insuffisant, le moteur refuse sans appel à l'IA et le panneau liste les manques (« Verrouiller quand même » / « Continuer à répondre »). Aperçu adapté à la nature : plan en arbre (conditions ◆ et branches, dépendances, montants, dates, « à trouver ») ou synthèse (points clés, décisions, pour/contre, questions ouvertes) ; chaque élément corrigeable (revalidé côté main), Réviser avec consigne, Refuser, Confirmer ; bandeaux « forcé », « IA locale », « périmé » (non confirmable, « Régénérer »). Un aperçu ouvert est retrouvé au retour dans la plongée. Confirmer : les sous-neurones se résorbent vers le centre (700 ms), l'idée prend l'aspect éclos (600 ms), retour à la carte où elle glisse de l'incubateur vers le réseau, notification 10 s. Mode réduit : fondus courts.
**Choix :** P6 (provenance des montants/dates) ne s'applique pas à une correction : c'est l'utilisateur qui écrit la valeur. Données de test de fusion mutualisées (`tests/support/fusion.ts`).
**Reste :** bouton « Annuler » de la notification → historique (T040/T041), à faire ensuite.

### [2026-09-28 → 29, session du soir] FEAT — historique et annulation par lot (spec 003 US6 : T040-T041, fin de T033)
**Fichiers :** `src/main/infrastructure/db/repositories/HistoryRepository.ts`, `src/main/application/history/HistoryService.ts`, `src/main/ipc/historyHandlers.ts`, `src/shared/ipc/{history,channels}.ts`, `src/main/application/neurons/SynthesisApplier.ts` (exemple consigné), `src/main/application/ai/ExampleStore.ts` + `ContextRepository.ts` (identifiant renvoyé), `src/renderer/src/app/{useUndo,Toast,uiStore,useMainEvents,AppShell}`, `pages/HistoryPage.tsx`, tests `tests/integration/history/undo.test.ts`, `tests/unit/renderer/history.test.tsx` (482 tests)
**Résumé :** Annulation d'un lot de `change_log` dans une seule transaction : chaque élément (idée, synthèse, tâches du plan, synthèse de réflexion, exemple appris, lien) revient à son état « avant ». Éclosion annulée → idée en développement avec sa version d'avant (l'aperçu redevient confirmable tel quel, sans appel à l'IA), plan/synthèse retirés des résultats en cours mais conservés, exemple retiré, suggestions de liens nées de l'éclosion supprimées. Conflit (état actuel ≠ « après » du lot, ex. idée rouverte puis complétée) → `UNDO_CONFLICT` expliqué, rien ne change. Un lot inverse (état réel capturé avant restauration) est écrit : l'annulation se rétablit. Page Historique (résumés lisibles, date, « annulé », Annuler/Rétablir, Ouvrir l'idée, pagination) et « Annuler » dans la notification d'éclosion (10 s).
**Choix :** la réouverture reste non annulable pour l'instant (elle retire les résultats en cours sans les consigner).

### [2026-09-28 → 29, session du soir] FIX — « La réponse de l'IA ne respectait pas le format attendu » avec l'IA locale (retour de test de mentalyas)
**Fichiers :** `src/shared/ai/neurons.ts` (tolérance), `src/main/application/neurons/GrowthService.ts`, tests `tests/unit/ai/lenient-outputs.test.ts`, `tests/integration/neurons/{growth,degraded}.test.ts` (498 tests)
**Cause (diagnostic réel, qwen3.5:9b) :** sans clé Claude (profil démo), la tâche `etendre` passe en repli sur l'IA locale. Ollama impose la structure JSON mais pas les motifs : `"neuronRef": "[s2]"`, `"expectedDate": "2023-11"` → toute la réponse rejetée (1 essai sur 3 accepté). Et le modèle local déclare « hors sujet » des idées ordinaires (3 fois sur 5).
**Correction :** schémas tolérants (sans changer le schéma JSON envoyé au modèle) — crochets retirés des références, éléments fautifs d'une liste écartés un par un, opportunité ou date facultative mal formée ignorée ; « hors sujet » ignoré s'il y a des questions, et jamais retenu du modèle local de repli. Mesuré : 5 réponses sur 5 acceptées.
**Règle apprise :** une sortie d'IA imparfaite doit être réparée ou élaguée élément par élément quand c'est sans risque, pas rejetée en bloc ; mesurer sur le vrai modèle avant de conclure.

### [2026-09-28 → 29, session du soir] FEAT — liens discrets et évolution « graines » décidée (spec 003 FR-010)
**Fichiers :** `src/renderer/src/canvas/{hoverStore.ts,edges/LinkEdge.tsx,IdeasCanvas.tsx}`, `tests/unit/renderer/canvas-keyboard.test.tsx` (500 tests)
**Résumé :** Lien accepté = trait fin et pâle ; son libellé n'apparaît qu'au survol du lien ou de l'une de ses idées, ou quand l'une d'elles a le focus clavier. Liens suggérés toujours visibles avec ✓ / ✗. Validé par mentalyas en test manuel.
**Décision de mentalyas (à implémenter, étapes G2/G3) :** un lien intéressant doit faire **germer une nouvelle idée** entre les deux idées reliées. L'IA propose une graine (titre + pourquoi) sur le lien, à chaque éclosion et quand l'utilisateur relie lui-même deux idées ; acceptée, la graine devient une idée « née de A × B » placée entre ses parents dans le réseau, développable comme les autres. Rien ne se crée sans acceptation.

### [2026-09-29 00:30] SESSION — End
**Resume :** Spec 003 (interface MVP-1) : dépendances + jeu de démo (profil `--demo`, `seed:demo:reset`), coquille (zone de notification, instance unique, fenêtres, raccourci, navigation), capture rapide, écran Idées (React Flow, disposition d3-force, liens sans croisement quand c'est possible, blocs, liens discrets), plongée (couronne, questions, jauge, fantômes, édition de branche), verrouillage + aperçu éditable + fusion/éclosion animée, historique avec annulation par lot (« Annuler » 10 s), lecture et réouverture d'une idée éclose. IA locale rendue tolérante (5/5 réponses acceptées). Tests manuels de mentalyas à chaque étape depuis la phase 7. 500 tests. Décidé pour la suite : graines d'idées sur les liens (G2/G3), puis suivi de plan (7.2) et export Markdown (7.3).
**Branche :** main
**Commits pushes :** 10

### [2026-09-29 00:45] DOCS — parcours académique (spec 003, /hub end 7bis, mode auto)
**Fichiers :** `docs/academique/` — créées : `Coquille de bureau — zone de notification, instance unique et fenêtres cachées.md`, `Carte des idées — simulation de forces et croisements de liens.md`, `Plongée radiale — couronne sur un arc et affichage optimiste.md`, `Annuler par lot — journal avant-après, conflit et lot inverse.md`, `TanStack Query et Zustand ↔ cache de données et état d'interface.md` (pont), `Glossaire — Générateur pseudo-aléatoire à graine (PRNG).md`, `Glossaire — Mise à jour optimiste.md` ; étendues (bloc « Évolution du 29/09 ») : `Architecture Electron…`, `Éclosion atomique…`, `Liens entre idées…`, `Zod ↔ type guards…` ; MOC et canvas mis à jour (parcours 14 → 18) ; `CLAUDE.md` (dernière mise à jour).
**Résumé :** Notes tirées du code lu (non exécuté) de la session du soir. Points ⚠️ : réduction des croisements gloutonne (minimum local possible) ; réouverture non encore annulable.

### [2026-09-29 10:25] FEAT — graines d'idées sur les liens, moteur (spec 003 FR-028, G2 : T052-T054)
**Fichiers :** `specs/003-interface-mvp1/{spec,tasks}.md` (FR-028, phase 6b), `schemaNeurons.ts` + migration `0007_link_seeds` (+ down), `src/shared/ai/neurons.ts` (`SeedOut`, `GermerOut`, graine facultative sur `SuggererLiensOut`), `src/main/domain/ai/{types,routing}.ts` (type `germer`), `TaskInstructions.ts`, `src/main/application/neurons/{SeedService,LinkService,NeuronService}.ts`, `LinkRepository.ts`, `NeuronRepository.ts` (position à la création), `HistoryRepository.ts` + `HistoryService.ts` (lot `seed`), `src/main/ipc/seedHandlers.ts`, `src/shared/ipc/{channels,history,neurons}.ts`, `bootstrap.ts`, `useMainEvents.ts`, tests `tests/integration/seeds/seeds.test.ts`, `tests/unit/ai/seeds-output.test.ts`, support `tests/support/neurons.ts` (514 tests)
**Résumé :** Table `link_seeds` : une graine par lien (index unique, jamais reproposée une fois refusée), supprimée avec son lien. À l'éclosion, la graine arrive dans la même réponse que le lien suggéré (aucun appel en plus) ; mal formée, elle est ignorée et le lien gardé. Lien créé à la main → `germer` en arrière-plan (Claude, repli local ; 0 ou 1 graine ; fiches courtes anonymisées). `seeds:list` ne montre une graine en attente que si son lien est accepté. `seeds:accept` : idée brute « titre + pourquoi », placée au milieu des positions de ses parents, catégorisée ensuite, dans une transaction consignée (lot `seed`) ; `seeds:reject`. Exemples appris `germer` (positif/négatif).
**Choix :** annuler une graine acceptée **archive** l'idée née (jamais de suppression) : l'annulation se rétablit ; conflit si l'idée a poussé depuis (état ≠ brute). `NeuronService.insert` (synchrone) séparé de la catégorisation pour tenir dans la transaction. `.optional().catch(undefined)` comme pour l'opportunité d'`etendre`.
**Reste (G3, T055) :** pastille 🌱 sur les liens, idée née placée dans le réseau, « née de A × B » dans la plongée.

### [2026-09-29 10:35] FEAT — graines d'idées sur la carte (spec 003 FR-028, G3 : T055)
**Fichiers :** `src/shared/ipc/canvas.ts` (`seeds`), `src/main/application/canvas/CanvasService.ts`, `SeedService.ts` (`batchId` renvoyé), `src/renderer/src/canvas/{buildGraph.ts,IdeasCanvas.tsx,canvas.css,edges/LinkEdge.tsx,edges/SeedBadge.tsx}`, `src/renderer/src/app/{uiStore.ts,Toast.tsx}`, `src/renderer/src/dive/DiveView.tsx`, `seedDemo.ts` (3 graines fictives), tests `tests/unit/renderer/seeds.test.tsx`, `tests/integration/seeds/seeds.test.ts`, `tests/integration/db/seed-demo.test.ts`, fixtures (522 tests)
**Résumé :** Pastille 🌱 (28 px) au milieu d'un lien accepté qui porte une graine ; le libellé du lien passe au-dessus. Clic ou `Entrée` → carte (titre, pourquoi, « Refuser » / « Faire naître », focus sur l'action principale) ; clic ailleurs ou `Échap` la referme. **Corrigé après test de mentalyas :** la carte s'ouvrait au survol et se refermait en traversant l'espace entre pastille et carte, boutons inatteignables → ouverture au clic (bulle classique, `aria-expanded`). L'idée née vit dans le **réseau** (quel que soit son état), attirée entre ses parents par des fils de disposition invisibles, pousse en 250 ms (fondu 150 ms en mode réduit), lecteur d'écran « née de A × B ». Notification 10 s avec « Annuler » (annulation par l'historique ; message adapté). Plongée : « 🌱 Née de A × B », parents cliquables. Jeu démo : 3 graines fictives en attente (`seed:demo:reset` pour les voir).
**Choix :** graines servies avec la carte (`canvas:get`) plutôt que par une requête à part (la plongée lit déjà ce cache). La notification porte son propre message d'annulation (`undoneText`) au lieu d'un texte figé « Éclosion annulée ». Pas encore de bouton pour relier deux idées à la main (`links:create` n'a pas d'interface) : `germer` ne se déclenche donc qu'avec les liens créés hors carte pour l'instant.

### [2026-09-29 11:15] FEAT — carte unique : taille selon le contexte, idée au double-clic, lien tiré (spec 003 FR-029 à FR-031, T056-T060)
**Fichiers :** `specs/003-interface-mvp1/{spec,tasks}.md` (US2, FR-009/010/011/019/028 révisées ; FR-029 à FR-031), `src/main/application/{canvas/CanvasService,neurons/SeedService,neurons/NeuronService}.ts`, `NeuronRepository.ts` (`latestGaugeLevels`), `src/main/ipc/{neuron,canvas}Handlers.ts` (position à la création), `seedDemo.ts`, `src/shared/ipc/canvas.ts` (`ideas`, `contextLevel`), `src/renderer/src/canvas/{forceLayout,buildGraph,IdeasCanvas,NeuronMenu,CanvasToolbar,InlinePrompt,useCreateLink,canvas.css,nodes/NeuronNode}` (`ZoneNode` supprimé), `app/uiStore.ts`, tests `tests/unit/renderer/canvas-create.test.tsx` + tests adaptés (530 tests)
**Décision de mentalyas (retour de test) :** séparer incubateur et réseau n'a pas de sens — on part d'une carte vide, on crée une idée et on la travaille sur place. Toutes les idées cohabitent, reliées ou non ; la taille dit le niveau de contexte ; démo moins chaotique ; créer soi-même ses idées et ses liens. Et l'idée née d'une graine doit être reliée à ses parents.
**Résumé :** Idée née d'une graine reliée à ses deux parents par des liens acceptés « née de » (même lot, annulés et rétablis avec elle). Vue de carte : une seule liste `ideas` avec le dernier niveau de contexte ; disposition physique dans un seul espace au nombre d'or, agrandi pour garder les idées posées à la main. Taille en 5 paliers (40/56/72/88/104 px) : brute, insuffisant, suffisant, complet, éclose ; aspects d'état conservés ; croissance animée 600 ms (éclosion sur place, plus de migration). Double-clic dans le vide → champ à cet endroit → idée créée là (pousse 250 ms) ; « + Une idée ? » retiré. Point d'accroche au survol/sélection → tirer vers une autre idée → libellé → `links:create` (et `germer` en arrière-plan) ; au clavier : menu → « Relier à une autre idée… ». Démo : 12 idées (2 brutes, 7 en développement sur 3 niveaux, 3 écloses), 8 liens entre états mêlés, 2 graines.
**Choix :** cadrage sur les positions réelles (idées + blocs) au lieu des zones. Les tests de disposition gardent 100 idées / 50 liens (fluidité SC-004) indépendamment de la démo.

### [2026-09-29 12:30] FEAT — une idée s'ouvre sur la carte : volet latéral et arbre déployé (spec 003 FR-013 révisée, T061)
**Fichiers :** `specs/003-interface-mvp1/{spec,tasks}.md` (US3, FR-013), `src/renderer/src/dive/{OpenIdea,IdeaPanel}.tsx` (nouveaux), `src/renderer/src/canvas/{IdeaTree.tsx,ideaTreeLayout.ts}` (nouveaux), `canvas/{IdeasCanvas,buildGraph,NeuronMenu,canvas.css}`, `dive/dive.css`, `app/uiStore.ts` (`openRootId`, `focusId`), `pages/{IdeasPage,HistoryPage}.tsx` ; supprimés : `dive/{DiveView,DiveStage,radialLayout}.ts(x)`, `tests/unit/ui/radial.test.ts` ; tests `tests/unit/ui/idea-tree.test.ts`, aide `tests/unit/renderer/support/openIdea.tsx`, tests de plongée/aperçu/éclosion passés sur la carte (528 tests)
**Décision de mentalyas (retour de test) :** plus d'écran de plongée séparé — tout se passe sur la même carte, comme le graphe d'Obsidian ; un clic ouvre le volet sur le côté ; le double-clic est gardé pour une future vue « deep » d'une seule idée. Sous-neurones affichés sur la carte pour l'idée ouverte seulement (choix validé).
**Résumé :** Clic (ou `Entrée`) sur une idée : volet à droite (38 %) avec fil d'Ariane, nature/catégorie, « née de », puis questions et jauge, aperçu de synthèse ou lecture de l'idée éclose ; sur la carte, l'arbre de l'idée se déploie autour d'elle (disposition radiale, un anneau par niveau, secteurs proportionnels aux feuilles), suggestions en pointillés et « + » autour du neurone ciblé, autres idées estompées, vue recentrée. Clic sur un sous-neurone = le cibler ; Échap remonte puis referme ; clic dans le vide ou × referme. Éclosion : les sous-neurones se résorbent vers l'idée (700 ms), qui grandit sur place ; le volet reste ouvert sur la lecture.
**Choix :** l'idée ouverte est un composant monté **dans** React Flow (clé = idée) : l'arbre est dessiné dans la carte par `ViewportPortal` (suit zoom et déplacement, sans toucher à la disposition physique), le volet est rendu dans la colonne de droite par un portail React — la carte n'est jamais remontée (zoom et position conservés), l'état d'une idée repart de zéro à chaque ouverture. Recentrage deux images après l'apparition du volet (largeur de carte à jour) et sans garde « déjà fait » (compatible mode strict).

### [2026-09-29 15:45] FIX — lot A des retours de test : réponse, zone de saisie, arbre qui suit l'idée
**Fichiers :** `src/renderer/src/dive/{QuestionPanel,OpenIdea}.tsx`, `src/renderer/src/canvas/{IdeaTree.tsx,IdeasCanvas.tsx,useSpringFollow.ts}`, tests `tests/unit/renderer/{dive,spring}.test.tsx` (533 tests)
**Retours de mentalyas (captures documentées) :** (1) le champ de réponse gardait le texte d'une question à l'autre ; (2) en glissant une idée, son arbre ne suivait pas — il doit rester attaché, avec un effet de physique flottant ; (4) zone de réponse trop petite.
**Corrections :** champ vidé à chaque changement de question ; zone de texte de 3 lignes qui grandit avec le texte jusqu'à 160 px puis défile (`field-sizing: content`), Entrée envoie, Maj+Entrée va à la ligne. L'arbre se place sur la position **en direct** de l'idée (nœuds React Flow pendant le glisser) et la suit avec un ressort amorti (retard flottant, immédiat en mode réduit) ; les traits partent de la position réelle de l'idée, ils restent accrochés pendant que l'arbre la rattrape. Le recentrage ne se fait plus qu'à l'ouverture (plus pendant un glisser).
**Plan des lots suivants (validé) :** B nœuds « idée » (forme/couleur, fiche en carte flottante au double-clic, texte complet en bloc sur le lien) ; C cycle 2 après éclosion (anciens sous-nœuds gardés en données seulement, nouvelles questions depuis la synthèse, synthèse en document lisible) ; D index de tags (IA à l'éclosion + mots-clés locaux) pour relier les idées.

### [2026-09-29 16:00] FIX — le champ de réponse se vidait tout seul pendant la frappe (retour de test de mentalyas)
**Fichiers :** `src/renderer/src/dive/{OpenIdea,QuestionPanel}.tsx`, test `tests/unit/renderer/dive.test.tsx` (534 tests)
**Cause (reproduite par un test qui échoue sur l'ancien code) :** sans choix explicite, le volet affichait la **première** question de la liste. Après une réponse, l'IA termine en arrière-plan et la liste rafraîchie commence par une nouvelle question : la question affichée changeait sous les doigts, et la correction du lot A (vider le champ quand la question affichée change) effaçait le texte en cours.
**Correction :** la question affichée est retenue explicitement ; elle ne change que sur un choix de l'utilisateur ou si elle disparaît (répondue, écartée). Le champ ne se vide que sur un choix explicite, jamais sur un rafraîchissement.
**Règle apprise :** un état d'interface dérivé d'une liste qui se rafraîchit en arrière-plan (« le premier élément ») ne doit pas piloter une action destructive (vider une saisie) ; retenir la sélection explicitement.

### [2026-09-29 16:10] FIX — « Répondre » grisé sans explication ; « l'IA réfléchit » toujours terminé
**Fichiers :** `src/renderer/src/dive/QuestionPanel.tsx`, `src/main/application/neurons/GrowthService.ts`, tests `tests/unit/renderer/dive.test.tsx`, `tests/integration/neurons/growth.test.ts` (536 tests)
**Retour de mentalyas :** « parfois j'ai une question mais le bouton Répondre est grisé, je ne sais pas répondre ». Sur la capture, le champ était vide : le bouton était désactivé tant qu'aucun texte n'était saisi, sans dire pourquoi.
**Corrections :** « Répondre » reste actif (sauf pendant que l'IA réfléchit) ; cliqué sans texte, il place le curseur dans le champ et affiche « Écris ta réponse ou choisis une réponse rapide ci-dessus ». Côté moteur, une erreur imprévue pendant le développement émet quand même `neuron:thought` : l'indicateur « l'IA réfléchit » (qui désactive les boutons) ne peut plus rester bloqué.
**Règle apprise :** ne pas griser une action sans dire pourquoi ; préférer un bouton actif qui explique ce qui manque.

### [2026-09-29 17:00] FEAT — lot B : liens sans libellé, graine qui remplace le lien, nœuds « idée » (spec 003 FR-032, FR-033)
**Fichiers :** `specs/003-interface-mvp1/{spec,tasks}.md`, `src/shared/ipc/neurons.ts` (type `idea`, statut de lien `superseded`, `sources`), `schemaNeurons.ts` (enums, sans migration : pas de contrainte CHECK), `src/main/application/neurons/{GrowthService,SeedService,LinkService,SynthesisContextBuilder}.ts`, `src/main/ipc/linkHandlers.ts`, `NeuronRepository.ts` (sources jointes), `HistoryRepository.ts`/`HistoryService.ts`, `src/renderer/src/canvas/{IdeaTree,ideaTreeLayout,IdeasCanvas,NeuronMenu,useCreateLink,buildGraph,edges/LinkEdge}`, `dive/dive.css`, `styles/tokens.css` (`--color-idea`), tests (538)
**Retours de mentalyas :** relier deux idées ne doit pas demander de libellé ; faire naître la graine ne doit pas laisser un deuxième lien — l'idée née écrase le lien d'origine ; la suggestion d'idée doit avoir une forme et une animation différentes et intrigantes, son texte complet posé sur le lien et gardé après acceptation, une fiche au double-clic.
**Résumé :** Lien tiré = créé tout de suite, sans libellé (facultatif aussi au clavier) ; un lien sans libellé reste un simple trait. Graine acceptée : le lien A–B passe à « remplacé » (masqué, rétabli par « Annuler ») et l'idée née est reliée à A et à B par des liens sans libellé. Suggestion acceptée → sous-neurone de type `idea` (plus « answer »), ses sources web retrouvées par la suggestion d'origine. Sur la carte : losange ambre (dégradé, halo qui scintille), en attente losange en pointillés qui respire avec une étincelle ✦ en orbite ; lien teinté ambre ; texte de l'idée posé sur son lien (4 lignes, en entier au clic) ; double-clic → fiche flottante (conseils, sources), Échap la referme sans fermer l'idée. Mode réduit : immobile.
**Choix :** le lien remplacé n'est pas supprimé (la graine y est rattachée par une clé étrangère en cascade) : nouvel état `superseded`. Couleur `--color-idea` : ambre 700 en clair / 400 en sombre (contraste ≥ 4,5:1). Les suggestions acceptées avant ce changement restent de type « réponse ».

### [2026-09-29 18:30] FEAT — physique de toute la carte, épinglage, suppression d'une idée (spec 003 FR-034, FR-035)
**Fichiers :** `specs/003-interface-mvp1/{spec,tasks}.md`, migration `0008_neuron_pinned` (+ down), `schemaNeurons.ts`, `src/shared/ipc/{neurons,canvas,history,channels}.ts` (`pinned`, positions de sous-neurones, `neuronId`, lot `delete`, `neuron:remove`), `NeuronRepository.ts`, `NeuronService.ts` (`remove`), `canvasHandlers.ts`, `neuronHandlers.ts`, `HistoryService.ts`, `src/renderer/src/canvas/{physics,useCanvasPhysics,treeGraph,treeStore,useRemoveIdea}.ts`, `canvas/nodes/TreeNodes.tsx`, `canvas/edges/BranchEdge.tsx`, `canvas/{IdeasCanvas,NeuronMenu,ideaTreeLayout,buildGraph,edges/LinkEdge}`, `dive/{OpenIdea,dive.css}` ; supprimés : `canvas/{IdeaTree.tsx,useSpringFollow.ts}`, `tests/unit/renderer/spring.test.tsx` ; tests `tests/unit/ui/physics.test.ts`, `tests/integration/{canvas,history}`, `tests/unit/renderer/{dive,canvas-create}.test.tsx` (544 tests)
**Retours de mentalyas :** les sous-nœuds ne se glissaient pas et se chevauchaient (texte d'idée sur des sous-nœuds) — « chaque objet doit repousser les autres, une physique dominante dans la carte » ; choix validés : physique sur toute la carte, objet lâché = épinglé. Puis : pouvoir supprimer les nœuds et tout leur contenu, avec avertissement.
**Résumé :** Un seul moteur physique (d3-force) pour tous les objets : répulsion, collision sur un rayon qui englobe le titre (idée ≥ 80 px, sous-neurone 76, texte 108, question 24, bloc = demi-diagonale), ressorts (branches de l'arbre, texte accroché à son idée, liens entre idées souples), légère gravité vers le centre pour les idées. Stabilisation synchrone et déterministe à chaque changement de contenu ; pendant un glisser, simulation en direct (les voisins s'écartent), l'objet lâché reste épinglé (mémorisé en base, sous-neurones compris), « Libérer » dans le menu. L'arbre de l'idée ouverte n'est plus un calque : ses éléments sont de vrais nœuds React Flow (glissables, rôle bouton ou groupe, `aria-pressed`), ses traits de vrais liens. Suppression d'une idée : menu → avertissement (tout son contenu, nombre de liens) → archivée dans un lot `delete` annulable (notification, Historique « Idée restaurée »).
**Choix :** la disposition de départ (sans croisement) sert de point de départ ; la physique ne fait ensuite que séparer ce qui se chevauche (énergie 0,3 à l'ouverture), les liens entre idées sont des ressorts souples pour ne pas défaire ce travail. Un épinglage fait pendant la session est retenu par le moteur même avant le rechargement des données. La suppression archive (rien n'est effacé) : c'est ce qui la rend annulable.
**Limite connue :** les croisements ne sont plus garantis à zéro une fois que la physique a déplacé des objets (arbitrage validé).

### [2026-09-29 18:45] FIX — un double-clic sur un objet de la carte créait une idée (retour de test de mentalyas)
**Fichiers :** `src/renderer/src/canvas/IdeasCanvas.tsx`, test `tests/unit/renderer/canvas-create.test.tsx` (545 tests)
**Cause :** dans React Flow, nœuds, liens et pastilles sont des descendants du fond de carte (`.react-flow__pane`) ; le test « double-clic sur le fond » était donc vrai aussi sur un objet.
**Correction :** le double-clic ne crée une idée que sur le fond lui-même, jamais sur un nœud, un lien, un texte, une graine, une fiche, le zoom, une poignée ou un contrôle. Test qui échoue sur l'ancienne condition et passe avec la nouvelle.
**Règle apprise :** dans React Flow, « est dans le fond de carte » ne veut pas dire « est dans le vide » : exclure explicitement les objets posés dessus.

### [2026-09-29 19:15] FEAT — faire éclore une idée suggérée en idée à part entière ; « Verrouiller » nomme l'idée (spec 003 FR-036)
**Fichiers :** `specs/003-interface-mvp1/{spec,tasks}.md`, `src/main/infrastructure/db/repositories/{placement.ts (nouveau),GrowthRepository,HistoryRepository,changeLog}.ts`, `schemaNeurons.ts` (lot `promote`), `src/main/application/{neurons/GrowthService,history/HistoryService}.ts`, `src/main/ipc/growthHandlers.ts` + `channels.ts` (`growth:promoteIdea`), `src/shared/ipc/history.ts`, `src/renderer/src/dive/{QuestionPanel,IdeaPanel,OpenIdea}.tsx`, tests `tests/integration/neurons/suggestions.test.ts`, `tests/unit/renderer/{dive,preview}.test.tsx` (548 tests)
**Question de mentalyas :** « comment je fais pour faire éclore la suggestion d'idée ? » — ce n'était pas possible : « Verrouiller » portait (sans le dire) sur l'idée principale.
**Résumé :** quand un losange est ciblé, le volet propose « Faire éclore cette idée » : le neurone lui-même devient une idée de la carte (racine, brute, nature et catégorie de son idée d'origine), ses sous-neurones le suivent (profondeurs recalculées), ses questions et suggestions aussi ; il garde titre, conseils et place, est relié à son idée d'origine (lien sans libellé), et s'ouvre aussitôt ; l'idée d'origine change de version (un aperçu en cours devient périmé). Lot `promote` annulable : chaque neurone déplacé reprend sa place d'avant (« Idée remise dans son arbre »), rétablissable. « Verrouiller « titre » 🔒 » nomme toujours l'idée qui éclôt.
**Choix :** transformation sur place (le losange devient la racine) plutôt qu'une copie : rien n'est dupliqué, les sources web et l'historique suivent, et l'annulation n'a qu'à rétablir la « place » de chaque neurone (module `placement.ts` partagé entre l'action et l'historique).

### [2026-09-29 20:00] DOCS — enquête sur la consommation API (T069) : constat mesuré
**Fichiers :** `scripts/ai-usage.cjs` (outil de développement, lecture seule : `npx electron scripts/ai-usage.cjs [--demo]`)
**Mesure (table `ai_calls`, profil principal, 29/09 de 13 h à 15 h UTC, tests manuels) :** 107 appels Claude = **4,56 €** (tous sur `claude-opus-5`) ; 119 appels locaux gratuits (anonymiser, catégoriser).
| Tâche | Appels | Coût | Part | Coût moyen |
|---|---|---|---|---|
| `rechercher` (vérification web des suggestions) | 44 | 2,90 € | 64 % | 0,066 € |
| `etendre` (questions suivantes) | 53 | 1,47 € | 32 % | 0,028 € |
| `synthetiser` | 2 | 0,15 € | 3 % | 0,077 € |
| `germer` | 4 | 0,04 € | 1 % | 0,009 € |
Profil démo (sans clé Claude) : 24 appels **tous en local** (`etendre` 19/19, `germer`, `suggerer_liens`, `synthetiser`) acceptés, 0 €.
**Causes :** chaque suggestion d'idée portant une requête web déclenche automatiquement une vérification (2 recherches + lecture des pages ≈ 1 M de tokens lus au total), même si l'utilisateur ne la regarde pas ; `etendre` part après chaque réponse sur le modèle le plus cher.
**Tarifs vérifiés (doc API, 2026-09-25) :** Opus 5 5/25 $ par MTok, Opus 5.5 4/20 $, Sonnet 5.5 2/10 $, Haiku 4.5 1/5 $ ; recherche web 0,01 $.
**Délégable à l'IA locale :** `etendre`, `germer`, `suggerer_liens` (déjà prouvés en démo, qualité des questions à juger) ; à garder sur Claude : `synthetiser`/`reviser` (qualité du plan, coût faible) ; impossible en local : `rechercher` (outil web de Claude) → à rendre « à la demande ». Décisions à prendre par mentalyas.

### [2026-09-29 20:30] PERF — économies de crédits API appliquées (T069, décisions de mentalyas)
**Fichiers :** `src/main/domain/ai/{routing,cost}.ts`, `AiConfigRepository.ts` (révision 2), `src/shared/ipc/{ai,neurons,channels}.ts`, `ClaudeProvider.ts`, `GrowthService.ts` + `GrowthRepository.ts` + `growthHandlers.ts` (`growth:researchSuggestion`), `schemaNeurons.ts`, `src/renderer/src/{canvas/{nodes/TreeNodes,treeGraph,treeStore}.ts(x),dive/{OpenIdea.tsx,dive.css},pages/settings/ai/AiSettingsPage.tsx}`, `scripts/ai-usage.cjs`, tests (551)
**Décisions (sur la mesure du 29/09 : 4,56 € dont 64 % de vérification web automatique et 32 % de questions sur Opus 5) :**
1. **Vérification web à la demande** : une suggestion qui porte une requête web est « vérifiable » (nouvel état `available`), plus rien n'est lancé automatiquement ; bouton 🔍 « Vérifier sur le web » sur l'idée suggérée (`growth:researchSuggestion`), qui n'accepte pas l'idée.
2. **Questions suivantes, graines et liens sur l'IA locale** par défaut (`etendre`, `germer`, `suggerer_liens` → Ollama) ; Claude garde synthèse, révision, suggestions et recherche web.
3. **`claude-opus-5-5` par défaut** (4/20 $ au lieu de 5/25 $, tarifs vérifiés dans la doc API) ; Réglages › IA proposent Opus 5.5, Sonnet 5.5, Haiku 4.5 (et Opus 5 pour l'existant) ; repli serveur en cas de refus étendu à Opus 5.5 et Sonnet 5.5. Compatibilité vérifiée : réflexion adaptative, effort explicite, pas de choix d'outil forcé ni de pré-remplissage.
4. **Révision des réglages enregistrés** (une seule fois) : questions/graines/liens en local et Opus 5 → 5.5 ; un choix fait ensuite dans Réglages › IA est respecté.
**Tests :** le harnais du moteur garde un routage « tout Claude » explicite (`TEST_ROUTING`, réponses scénarisées) ; le routage réel et la révision sont testés à part.
**Point d'attention :** si Ollama n'est pas lancé, les questions échouent avec un message clair ; le repli vers Claude n'est actif que si « Autoriser Claude en secours » est coché dans Réglages › IA (désactivé par défaut, confidentialité).
**Suivi :** refaire le bilan (`npx electron scripts/ai-usage.cjs`) après la prochaine séance de tests pour mesurer le gain réel.

### [2026-09-29 21:05] FEAT — « l'IA réfléchit » animé + étiquette du moteur qui travaille (demande de mentalyas)
**Fichiers :** `AIGateway.ts` (`onEngine`), `AIProvider.ts` + `ClaudeProvider.ts`/`OllamaProvider.ts` (`currentModel`), `GrowthService.ts`, `FusionService.ts`, `useDive.ts` (`worker`), `dive/AiThinking.tsx` (nouveau), `QuestionPanel.tsx`, `dive.css`, tests (`gateway`, `dive`, `ai-thinking`).
**Quoi :** pendant les questions-réponses et la synthèse, trois neurones s'allument tour à tour le long d'une synapse, avec à côté une pastille « Claude Opus 5.5 » (orange) ou « Ollama · qwen3.5:9b » (verte).
**Pourquoi ainsi :** c'est la passerelle qui annonce le moteur **au moment où l'appel part**, repli compris : si Claude est indisponible ou le budget atteint et que l'IA locale prend le relais, la pastille dit « Ollama » et pas ce que le routage prévoyait. Une demande mise en file n'annonce rien. Le texte de la pastille reste en couleur de contenu (contraste AA) ; l'animation s'arrête avec « réduire les animations ».
**Note :** `npm run lint` échoue sur `.kilo/worktrees/` (worktree de l'extension Kilo Code, hors projet) : deux racines tsconfig candidates. `npx eslint src tests` passe.

### [2026-09-29 22:00] FEAT — cycle 2 après éclosion : sous-neurones absorbés, « Approfondir », document lisible (spec 003 T064)
**Fichiers :** migration `0009_neuron_absorbed` (+ down), `schemaNeurons.ts`, `GrowthRepository.ts` (`absorb`, `nodesWithHistory`), `NeuronRepository.ts`, `FusionRepository.ts`, `HistoryRepository.ts`, `HistoryService.ts`, `SynthesisApplier.ts`, `FusionService.ts`, `GrowthContextBuilder.ts` (`documentText`), `GrowthService.ts`, `bootstrap.ts`, `HatchedPanel.tsx`, `QuestionPanel.tsx`, `IdeaPanel.tsx`, `useDive.ts`, tests.
**Quoi :** à l'éclosion, les sous-neurones du cycle sont **absorbés** (`absorbed_in` = synthèse) : ils quittent la carte et les questions mais restent en base. Les questions encore ouvertes sont closes. « Rouvrir l'idée » devient **« Approfondir »** : l'idée repart en développement **sans perdre son document**, qui nourrit les nouvelles questions (« Nouveau cycle… va au-delà du document ») et reste dépliable en haut du volet. Le document se lit comme un texte : listes propres, réponses d'origine repliées sous « D'où ça vient ».
**Pourquoi ainsi :** la synthèse suivante lit **tout l'historique** (`nodesWithHistory`) : chaque point du document reste sourcé, sans devoir inventer des références vers l'ancien document. Les questions, elles, ne voient que le cycle en cours + le document (entrée plus courte). Tout est annulable : l'annulation d'une éclosion fait revenir les sous-neurones, les questions closes et l'ancien document retiré (désormais journalisé).
**Migration :** rattrapage des idées déjà écloses (sous-neurones rangés dans leur dernière synthèse confirmée).

### [2026-09-29 22:20] FIX — « Approfondir » reprend les questions ouvertes du document (retour de test de mentalyas)
**Fichiers :** `GrowthContextBuilder.ts` (`carriedQuestions`, `dimensionOf`), `GrowthService.ts` (`carryOpenQuestions`), tests.
**Constat :** au nouveau cycle, Ollama inventait de nouvelles questions alors que le document en laissait déjà 8 ouvertes.
**Correction :** au début d'un cycle (aucun sous-neurone actif), les questions ouvertes de la synthèse (ou les points « à trouver » d'un plan) deviennent directement les questions du cycle, **sans appel à l'IA** ; l'étiquette du sous-neurone est la question coupée à un mot (≤ 40 caractères). L'IA ne reprend la main que pour les relances après chaque réponse, ou si le document ne laisse rien d'ouvert.

### [2026-09-29 22:50] FIX — champ figé pendant l'IA, animation d'éclosion rétablie, idées dorées au nouveau cycle (retours de test)
**Fichiers :** `QuestionPanel.tsx`, `OpenIdea.tsx`, `IdeaPanel.tsx`, `SynthesisPreview.tsx`, `useDive.ts`, `AiThinking.tsx`, `GrowthService.ts`, `GrowthContextBuilder.ts`, tests.
- **Texte effacé :** pendant que l'IA prépare les questions suivantes, la question affichée va être remplacée ; le champ de réponse est désormais en lecture seule (curseur d'attente, message « tu pourras répondre dans un instant »).
- **Animation d'éclosion disparue :** depuis l'absorption (T064), l'arbre rechargé après « Confirmer » n'avait plus de sous-neurones à résorber. L'arbre affiché est figé de « Confirmer » jusqu'à la fin de l'animation (test de régression vérifié : échoue sans le correctif).
- **Plus d'idées dorées :** mesuré sur le profil principal — Claude Opus 5 en propose à 98 % des appels `etendre`, qwen3.5:9b à 34 % ; et « Approfondir » n'appelait plus l'IA. Désormais, après la reprise des questions ouvertes, un appel **de fond** (mode `new_cycle`, IA locale) ne demande que 1 à 2 idées suggérées + la jauge du nouveau cycle ; la consigne du premier développement demande aussi explicitement 1 à 2 suggestions. Cet appel de fond affiche « L'IA cherche des idées… » **sans figer** la saisie (événement `background`).

### [2026-09-29 23:20] FEAT — synthèse en fiche éditoriale (retour de test : « trop robotique »)
**Fichiers :** `shared/ai/neurons.ts` (`overview`, `headline`, `nextStep` facultatifs et tolérants), `TaskInstructions.ts` (consigne de synthèse), migration `0010_reflection_editorial` (+ down), `schemaNeurons.ts`, `SynthesisApplier.ts`, `HatchedRepository.ts`, `shared/ipc/neurons.ts`, `GrowthContextBuilder.ts`, `HatchedPanel.tsx`, `SynthesisPreview.tsx`, `tokens.css` (`--color-pro` / `--color-con`, clair et sombre), tests.
**Quoi :** Claude écrit en plus un « En bref » (2-3 phrases), un titre court par point et LA prochaine étape conseillée. La fiche : En bref (filet d'accent) → points clés numérotés (titre en gras + phrase) → Pour / Contre côte à côte (vert / rouge, empilés si le volet est étroit, requête de conteneur) → décisions ✓ → questions ouvertes en encadré pointillé → prochaine étape en carte d'accent. Origines toujours repliées sous « D'où ça vient ».
**Pourquoi ainsi :** champs facultatifs avec `.catch(undefined)` : un titre mal formé n'invalide jamais la synthèse, et les anciennes fiches restent lisibles (texte seul). Coût : ~150 jetons de sortie en plus par synthèse (≈ 0,3 centime sur Opus 5.5). Le « En bref » et la prochaine étape nourrissent aussi les questions du cycle suivant.

### [2026-09-29 23:40] FIX — une idée dorée adoptée se développe aussitôt à partir de son texte (retour de test)
**Fichiers :** `GrowthContextBuilder.ts` (mode `adopted`, `minimumExtensions`), `GrowthService.ts`, `tests/integration/neurons/suggestions.test.ts`.
**Constat :** l'adoption relançait bien l'IA, mais en mode « relance » (0 à 3 questions facultatives) : le modèle local répondait souvent 0 question → « Pas de question en attente », il fallait cliquer « Plus de questions ».
**Correction :** mode `adopted` : consigne « propose AU MOINS 2 questions qui développent l'idée à partir de son texte (+ 1 suggestion si une piste en découle) », avec une nouvelle tentative si l'IA en donne moins, comme au premier développement (minimum par mode centralisé dans `minimumExtensions`).

### [2026-09-30 00:30] FEAT — spec 004 lot 1 : boîte à outils au clic droit, notes sur la carte (T001–T007)
**Fichiers :** `specs/004-widgets/` (spec, plan, tâches), constitution **1.2.0** (principe III : exception `widget`, bac à sable), migration `0011_widgets` (+ down), `schemaNeurons.ts`, `shared/ipc/canvas.ts` (`BlockKind`, `BLOCK_LIMITS`, `BLOCK_DEFAULT_SIZES`), `BlockRepository.ts`, `CanvasService.ts`, `canvasHandlers.ts`, `HistoryRepository.ts` / `HistoryService.ts` (entité `canvas_block`), `ToolMenu.tsx`, `useBlockActions.ts`, `nodes/LabelNode.tsx`, `nodes/WidgetNode.tsx` (cadre seul), `nodes/BlockNode.tsx`, `buildGraph.ts`, `IdeasCanvas.tsx`, tests.
**Quoi :** clic droit dans le vide → menu « Outils de la carte » (Nouvelle idée · Note · Widget IA), créé au point du clic ; clavier (flèches, Début/Fin, Échap), fermeture au clic ailleurs ; jamais sur un objet. Notes : texte libre, édition au double-clic ou ✎, enregistrement à Échap / Ctrl+Entrée / perte du focus, une note neuve s'ouvre en écriture. Widgets : cadre déplaçable par sa barre de titre. Suppression d'un bloc **annulable** (suppression douce, notification « Annuler », Historique).
**Pourquoi ainsi :** notes et widgets réutilisent la table `canvas_blocks` prévue pour eux en 003 (colonne `kind`) ; bornes de taille par type **vérifiées par le main** (l'interface les applique aussi) ; type React Flow « label » car « note » désigne déjà le texte d'un sous-neurone.

### [2026-09-30 12:00] FEAT — spec 004 lots 2 et 3 : widget isolé généré par Claude (T008–T018)
**Fichiers :** `application/widgets/` (`WidgetDocument`, `transpile`, `widgetUrl`, `WidgetService`), `infrastructure/ai/WidgetFrame.ts`, `WidgetRepository.ts`, `ipc/widgetHandlers.ts`, `shell/widgetProtocol.ts`, `shell/hardening.ts`, `renderer/index.html` (CSP `frame-src gi-widget:`), `shared/ai/widgets.ts`, `shared/ipc/widgets.ts`, `domain/ai/routing.ts` / `types.ts`, `AIGateway.ts` (`verbatim`, `onEngine`), `AiConfigRepository.ts` / `aiHandlers.ts` / `AiSettingsPage.tsx` (`widgetModel`), `nodes/WidgetNode.tsx`, `widgets/useWidget.ts`, `widgets/widgetFrame.ts`, tests (`widget-document`, `widget-escape`, `widgets` intégration, `widget-node`), `specs/004-widgets/quickstart.md`, `eslint.config.js`.
**Quoi :** la chatbox d'un widget envoie la demande à Claude (tâche `widget`, Claude seul, modèle réglable, défaut Sonnet 5.5) ; la réponse (HTML + CSS + TypeScript) est validée, transpilée localement, enregistrée comme version N+1 et affichée dans un cadre isolé `gi-widget://`. Versions restaurables, onglet Code en texte, indicateur IA + moteur, thème de l'app injecté, bouton Relancer. Un échec (réponse invalide, TypeScript non transpilable, Claude indisponible) s'explique dans la chatbox et laisse la version affichée intacte.
**Pourquoi ainsi :** isolement en couches indépendantes du modèle — `sandbox="allow-scripts"` sans même origine, CSP `default-src 'none'` en en-tête et en `<meta>`, filtre `webRequest` (`leavesWidgetSandbox`, extrait pour être testé), navigation des cadres limitée à `gi-widget:`, WebRTC neutralisé. Transpilation par `stripTypeScriptTypes` en mode `transform` (un `enum` est converti au lieu d'échouer : moins de générations perdues). Le code courant part en `verbatim` (sortie de Claude, l'anonymiseur le casserait) ; seule la demande est anonymisée.
**Session reprise le 30/09 :** travail interrompu le 29/09 au soir (quota) avec le code écrit mais ni coché ni journalisé. Ajouts à la reprise : cadre inerte aussi pendant le déplacement, tests d'évasion SC-002, checklist de test manuel. ESLint réparé : un worktree git imbriqué (`.kilo/`) rendait la racine TypeScript ambiguë (391 erreurs de parsing) → `tsconfigRootDir` explicite, `.kilo/`, `docs/` et `scripts/*.cjs` ignorés.

### [2026-09-30 12:05] SESSION — End
**Resume :** Session du 29/09 (08:10), interrompue le soir par un quota épuisé et finalisée le 30/09. Économies de crédits API (T069), animation « l'IA réfléchit » + moteur, cycle 2 après éclosion (T064 : sous-neurones absorbés, « Approfondir », fiche éditoriale, idées dorées), puis spec 004 complète : boîte à outils au clic droit, notes, widgets générés par Claude dans un bac à sable `gi-widget://` (T001–T018). ESLint réparé. 634 tests, test manuel validé par mentalyas (widgets générés et fonctionnels).
**Branche :** main
**Commits pushes :** 14

### [2026-09-30 13:45] FEAT — idée de départ : hexagone, fiche, verrouillage réservé ; sélecteur de thème ; spec 005 rédigée
**Fichiers :** `GrowthService.ts`, `GrowthRepository.ts`, `growthHandlers.ts`, `channels.ts`, `QuestionPanel.tsx`, `IdeaPanel.tsx`, `OpenIdea.tsx` (retrait de la promotion) ; `NeuronNode.tsx`, `canvas.css`, `tokens.css` (`--color-seed`) ; `IdeaSummaryService.ts`, `summaryHandlers.ts`, `SeedCard.tsx`, `schemas.ts` (`SummaryOut`), `TaskInstructions.ts` (`resumer`), `schemaNeurons.ts`, migration `0012_idea_summary` (+ down), `bootstrap.ts` ; `ThemeSwitch.tsx`, `AppShell.tsx` ; `specs/005-widgets-entrees-sorties/` ; tests (`idea-summary`, `seed-card`, `theme-switch`, `dive`, `suggestions`, `app-shell`).
**Quoi :** (1) « Faire éclore cette idée » est retiré : une idée suggérée ne peut plus devenir une idée à part entière, donc plus de verrouillage sur un nœud généré. (2) L'idée de départ est un hexagone à couleur réservée, liseré à la couleur de sa catégorie ; ses états (brute, en développement, éclose) sont conservés. (3) Le volet affiche une fiche « Idée de départ » : texte d'origine, puis résumé par l'IA locale, mémorisé et recalculé seulement quand l'idée change. (4) Sélecteur de thème (système / clair / sombre) dans l'en-tête. (5) Spec 005 (widgets branchés : entrées, sorties, cadre résultat) rédigée et validée par mentalyas.
**Pourquoi ainsi :** décision de mentalyas — seule l'idée de départ porte l'identité d'un brainstorming ; une nouvelle idée de départ ne naît que d'une graine validée entre deux idées reliées, et n'absorbe que son propre arbre (déjà le cas : l'absorption filtre sur `root_id`). Le résumé reste local (tâche `resumer`, jamais mise en file, aucun crédit Claude) ; une idée brute n'appelle pas l'IA. Les lots `promote` existants restent annulables depuis l'Historique. Interface : « Idée de départ » plutôt que « graine », mot déjà pris par les graines de liens.

### [2026-09-30 14:00] FIX — pas d'idée suggérée avant trois réponses (retour de test de mentalyas)
**Fichiers :** `domain/neurons/guards.ts` (`MIN_ANSWERS_FOR_SUGGESTIONS`, `suggestionsAllowed`), `GrowthContextBuilder.ts`, `GrowthService.ts`, `tests/integration/neurons/suggestions.test.ts`.
**Quoi :** au premier développement d'une idée, l'IA ne pose que des questions. Les idées suggérées n'arrivent qu'à partir de la troisième réponse (consigne explicite à ce moment-là), puis au fil des réponses si elles ouvrent une piste. Une idée qui a déjà éclos (document) garde ses suggestions dès le début d'un nouveau cycle.
**Pourquoi ainsi :** « trop prématuré : sans contexte, les idées proposées sont faibles ». Double verrou : la consigne le demande à l'IA, et l'application écarte toute suggestion reçue avant le seuil (garde-fou déterministe, comme le plancher de la jauge — même seuil de 3 réponses).

### [2026-09-30 16:15] FEAT — la « prochaine étape » d'une idée devient un objet de la carte (spec 003 FR-037, T071)
**Fichiers :** `domain/neurons/nextStep.ts`, `CanvasService.ts`, `canvasHandlers.ts`, `HatchedRepository.ts`, `schemaNeurons.ts` (`idea_steps`), migration `0013_idea_steps` (+ down), `shared/ipc/canvas.ts` (`StepView`), `channels.ts`, `bootstrap.ts` ; `nodes/StepNode.tsx`, `buildGraph.ts`, `useCanvasPhysics.ts`, `edges/BranchEdge.tsx`, `IdeasCanvas.tsx`, `canvas.css` ; `SeedCard.tsx` (hexagone dessiné) ; tests (`next-step`, `canvas`, `step-node`).
**Quoi :** chaque idée qui a un document affiche sa prochaine étape sur la carte : étiquette bleue en flèche, reliée à l'idée par un trait pointillé, toujours visible, déplaçable. Texte non modifiable. « Brainstormer cette étape » crée une nouvelle idée de départ avec ce texte, reliée à l'idée d'origine (lien « prochaine étape »). Idée de nature Action : première tâche faisable du plan (en cours, sinon prête, branche active).
**Pourquoi ainsi :** l'étape n'est PAS stockée : elle se lit dans le document en cours (`nextStepOf`). Elle suit donc d'elle-même un nouveau verrouillage ou l'annulation d'une éclosion, et ne peut pas diverger du document — c'est ce qui la rend non modifiable. Seule sa place est mémorisée, et seulement si elle a été glissée (`idea_steps`). La nouvelle idée passe par les canaux existants (`neuron:create`, `links:create`) : aucune écriture nouvelle côté moteur, la graine entre les deux idées peut germer comme pour tout lien.
**Reporté :** garder en grisé une étape « remplacée » quand quelque chose y est branché — sans objet tant que le branchement vers un widget n'existe pas (spec 005 FR-014, tâche T009b).

### [2026-09-30 16:30] FIX — le verrouillage synthétise toute l'arborescence de l'idée (demande de mentalyas, T072)
**Fichiers :** `SynthesisContextBuilder.ts`, `GrowthRepository.ts` (`GrowthNode.question`), `tests/unit/neurons/synthesis-tree.test.ts`.
**Quoi :** l'arbre envoyé à Claude au verrouillage est maintenant écrit branche par branche (chaque nœud sous son parent), avec la question à laquelle chaque réponse répond ; la borne passe de 12 000 à 40 000 caractères ; la consigne demande de parcourir tout l'arbre jusqu'aux feuilles.
**Pourquoi ainsi :** tous les nœuds étaient déjà envoyés, mais dans l'ordre de création, indentés par leur seule profondeur : un enfant créé tard apparaissait loin de son parent, donc rattaché à la mauvaise branche à la lecture ; et au-delà de 12 000 caractères, la FIN de l'arbre — les réponses les plus récentes — était coupée. Les alias `[sN]` restent ceux de l'ordre de création (contrôle de provenance inchangé). Coût : l'entrée d'une synthèse peut tripler sur une grosse idée (à re-mesurer avec `scripts/ai-usage.cjs`).

### [2026-09-30 16:35] FEAT — spec 005 lot 1 : brancher une idée ou une prochaine étape sur un widget (T002–T009b)
**Fichiers :** `shared/ipc/widgetIo.ts`, `domain/widgets/shape.ts`, `application/widgets/` (`InputAssembler`, `WidgetIoService`, `WidgetDocument`, `WidgetService`), `WidgetIoRepository.ts`, `widgetIoHandlers.ts`, `WidgetFrame.ts` (v2), `schemaNeurons.ts`, migration `0014_widget_inputs` (+ down), `CanvasService.ts` (`io`), `HistoryRepository.ts` / `HistoryService.ts` (entité `widget_input`), `bootstrap.ts` ; `widgets/` (`useWidgetIo`, `useWidgetBridge`, `WidgetReview`, `CodeView`), `nodes/WidgetNode.tsx`, `nodes/StepNode.tsx`, `buildGraph.ts`, `edges/BranchEdge.tsx`, `IdeasCanvas.tsx`, `useUndo.ts`, `canvas.css` ; tests (`widget-io` intégration et renderer, `widget-inputs`) ; `specs/005-…/quickstart.md`.
**Quoi :** un lien tiré d'une idée (ou d'une prochaine étape) vers un widget crée une entrée ; la revue montre ce que le widget lira (parties décochables) et son code ; tant que la version affichée n'est pas autorisée, le widget ne reçoit rien (bandeau « À revoir »). Autorisé, il lit ses données par `gi.onInputs`. Débranchement annulable. Claude connaît la structure des entrées (`shapeOf`), jamais leurs valeurs.
**Pourquoi ainsi :** la décision de ce qu'un widget reçoit est dans le main (`WidgetIoService.inputs`) : sans empreinte approuvée — code de la version + liste exacte des sources et parties — la réponse est vide. Le renderer ne fait que relayer vers LE cadre du widget, reconnu par sa fenêtre (`event.source`), l'origine d'un cadre isolé étant opaque. Le prélude `gi` du document n'est pas une barrière. Une idée supprimée (archivée) ne transmet plus rien. Une migration par lot plutôt qu'une seule pour toute la spec : pas de table créée avant d'être utilisée.

### [2026-09-30 19:10] DOCS — spec 006 rédigée : widgets proposés au verrouillage (à valider)
**Fichiers :** `specs/006-widgets-au-verrouillage/spec.md`, `checklists/requirements.md`, `.specify/feature.json` ; `specs/005-widgets-entrees-sorties/tasks.md` (T010 validé).
**Quoi :** idée de mentalyas — au verrouillage, Claude propose dans la synthèse 0 à 3 outils associés à l'idée ; l'utilisateur coche ceux qu'il veut dans l'aperçu ; l'éclosion pose les cadres déjà reliés à l'idée, puis Claude les génère en arrière-plan.
**Pourquoi ainsi :** deux décisions de mentalyas — la revue de la spec 005 reste entière (l'outil arrive « À revoir », cocher ne vaut pas autorisation, le code n'existant pas encore à ce moment-là) ; livraison après le lot 2 de la spec 005 (cadre résultat). Cadres et liens créés dans l'opération d'éclosion (annulables avec elle), génération hors de cette opération : un échec de Claude ne remet jamais l'éclosion en cause.

### [2026-09-30 19:30] FEAT — spec 005 lot 2 : un widget publie un résultat dans un cadre résultat (T011–T015)
**Fichiers :** `domain/widgets/resultLimits.ts`, `WidgetIoService.ts` (`emit`, `result`), `WidgetIoRepository.ts`, `BlockRepository.ts` (`resultBlockOf`, `sourceBlockId`), `WidgetRepository.ts` (`isResultFrame`), `widgetIoHandlers.ts`, `canvasHandlers.ts`, `CanvasService.ts`, `HistoryService.ts`, `WidgetDocument.ts` (prélude : `gi.output`, refus), `GenericResultView.ts`, `shared/widgets/genericResultView.ts`, `widgetUrl.ts` (`parseResultUrl`), `shell/widgetProtocol.ts`, `WidgetFrame.ts` (v3), `schemaNeurons.ts`, migration `0015_widget_results` (+ down), `shared/ipc/canvas.ts` / `widgetIo.ts` / `channels.ts`, `bootstrap.ts` ; `widgets/emitThrottle.ts`, `useWidgetBridge.ts` (`useFrameChannel`), `widgetFrame.ts`, `nodes/ResultNode.tsx`, `buildGraph.ts`, `IdeasCanvas.tsx`, `useBlockActions.ts` ; tests (`result-limits`, `widget-output` intégration et renderer, `widget-output-document`, `generic-result-view`) ; `specs/005-…/quickstart.md`, `plan.md`, `tasks.md`.
**Quoi :** un widget appelle `gi.output(données)` ; à la première émission, un cadre résultat apparaît à sa droite, relié à lui, et affiche les données dans une vue générique (valeur, liste, tableau, arbre). Chaque émission le met à jour ; le dernier résultat survit au redémarrage. Un résultat hors bornes (JSON seul, 200 Ko, 8 niveaux, clés ≤ 100 et textes ≤ 20 000 caractères) est refusé : le précédent reste, un bandeau l'explique dans le widget. Cadre supprimable (annulable), recréé à l'émission suivante ; il suit son widget (masqué s'il est supprimé). Claude connaît `gi.output` (cadre système v3). 753 tests.
**Pourquoi ainsi :** les bornes sont vérifiées dans le main — le prélude et l'interface ne font que relayer. La vue générique est du code figé de l'application, servi dans le même bac à sable qu'un widget (`gi-widget://result/<bloc>`), et n'écrit que par `textContent` : un résultat contenant du HTML reste du texte. Elle vit dans `shared/` parce qu'elle est testée dans un vrai DOM (projet de tests de l'interface) tout en étant servie par le main. Un cadre résultat n'a qu'une capacité : lire le résultat de son widget (`widgetIo:result` refuse tout autre bloc). Le regroupement des rafales (une écriture par 500 ms, la dernière valeur) est côté interface : la menace est un widget bavard, pas l'interface. `widget_results` n'a pas de `result_block_id` : le cadre se retrouve par `canvas_blocks.source_block_id` ; un bloc `result` ne peut pas être créé par `canvas:createBlock`.
**Reste :** T016, test manuel guidé (en attente de mentalyas). Spec 006 : plan et tâches à produire après cette validation.

### [2026-09-30 19:20] FIX — l'idée née d'une prochaine étape est reliée à l'étape, pas à l'idée (retour de test de mentalyas)
**Fichiers :** `buildGraph.ts` (`STEP_LINK_LABEL` déplacé ici), `nodes/StepNode.tsx`, `tests/unit/renderer/step-node.test.tsx`.
**Constat :** après « Brainstormer cette étape », le trait vers la nouvelle idée partait de l'idée principale, alors que la nouvelle idée sort de l'étape.
**Correction :** un lien « prochaine étape » est dessiné depuis l'étiquette de l'étape tant qu'elle est sur la carte ; l'idée d'origine est la plus ancienne des deux (la nouvelle peut avoir sa propre étape plus tard). Sans étape affichée (idée rouverte), le trait revient à l'idée d'origine. Affichage seulement : le lien en base reste entre les deux idées (graines, Historique inchangés).

### [2026-09-30 20:35] FEAT — spec 006 : plan, tâches, lot 1 (Claude propose des outils dans l'aperçu de synthèse, T002–T006)
**Fichiers :** `specs/006-widgets-au-verrouillage/` (`plan.md`, `tasks.md`, `quickstart.md`) ; `shared/ai/neurons.ts` (`ToolProposal`, champ `tools`), `TaskInstructions.ts` (règles des outils), `SynthesisContextBuilder.ts` (outils déjà branchés), `domain/widgets/toolProposals.ts`, `FusionService.ts`, `WidgetIoRepository.ts` (`toolsOf`), `bootstrap.ts` ; `fusion/ToolChoices.tsx`, `fusion/SynthesisPreview.tsx` ; tests (`tool-proposals` intégration, `preview` renderer), `tests/support/neurons.ts`.
**Quoi :** la réponse de synthèse (plan ou fiche) peut porter 0 à 3 outils proposés (titre, description, parties lues, résultat produit). L'aperçu les affiche dans « Outils proposés », décochés, avec le nombre de générations qu'entraînerait la sélection. Lot 1 : les cases n'ont pas encore d'effet à la confirmation.
**Pourquoi ainsi :** champ facultatif et tolérant dans la sortie existante (aucun appel en plus ; une proposition fautive est écartée seule, jamais la synthèse). Les outils déjà branchés sont rappelés à Claude ET filtrés par l'application (double verrou, titres comparés sans casse ni espaces). Aucune proposition quand la synthèse vient de l'IA locale (la génération exige Claude). Les cases sont un état local de l'aperçu : rien n'est écrit avant « Confirmer » (plan R2). 769 tests.

### [2026-09-30 20:45] FEAT — spec 006 lot 2 : les outils cochés naissent avec l'éclosion, Claude les génère en arrière-plan (T008–T015)
**Fichiers :** migration `0016_widget_requests` (+ down), `schemaNeurons.ts`, `WidgetRequestRepository.ts`, `SynthesisApplier.ts` (`chosenTools`, `writeTools`), `FusionService.ts` (`confirm(synthesisId, tools)`, `onToolsCreated`), `fusionHandlers.ts`, `domain/widgets/placeTools.ts`, `application/widgets/toolSurroundings.ts`, `application/widgets/ToolGeneration.ts`, `domain/widgets/toolProposals.ts` (`toolRequestText`), `WidgetService.ts` (`request`, widget retiré pendant la génération), `widgetHandlers.ts` (`widget:generate`), `WidgetIoRepository.ts` (`toolsOf` inclut les outils pas encore générés), `shared/ipc/*` (`ConfirmView.toolBlockIds`, `WidgetView.request`, `STEP_START_OFFSET`), `bootstrap.ts` ; `useFusion.ts`, `SynthesisPreview.tsx`, `useWidget.ts` (`retry`, rafraîchi par les événements), `WidgetNode.tsx`, `buildGraph.ts` ; tests (`tool-hatching` intégration, `widget-node` et `preview` renderer).
**Quoi :** « Confirmer » envoie les outils cochés. Dans la transaction de l'éclosion : un widget vide par outil, placé autour de l'idée sans recouvrement, branché sur elle avec les parties annoncées, et sa demande de génération ; le tout dans le lot de l'éclosion (l'annuler les retire). Ensuite, une génération `widget` par outil, l'une après l'autre, en arrière-plan. Le cadre dit « Claude prépare cet outil… », puis montre l'outil « À revoir » ; en cas d'échec (ou après un redémarrage), « Réessayer ». 785 tests.
**Pourquoi ainsi :** la revue 005 reste la seule porte vers les données (cocher ≠ autoriser, le code n'existant pas encore). La génération passe par `WidgetService.prompt` (validation, transpilation, versions, conversation, structure des entrées jointe) : la demande est la proposition seule, sans valeur de l'idée (SC-006, testé). Plan R3 révisé : le main place les outils lui-même, l'écran Idées enregistrant déjà la place de chaque idée — contrat plus simple (`tools: number[]`). Les entrées « outil » sont écrites en fin de lot : l'Historique résume un lot par sa première entrée (« Éclosion de … »). Un widget retiré pendant sa génération (éclosion annulée) ignore la réponse.

### [2026-09-30 21:35] FIX — Claude ne proposait jamais d'outil ; verdict « Outils suggérés » toujours affiché (retour de test de mentalyas)
**Fichiers :** `shared/ai/neurons.ts` (`tools` et `toolsNote` obligatoires dans le format, tolérants à la lecture), `TaskInstructions.ts`, `domain/widgets/toolProposals.ts` (`settleTools`), `FusionService.ts`, `SynthesisApplier.ts`, `fusion/ToolChoices.tsx`, `SynthesisPreview.tsx` ; tests (`tool-proposals`, `preview`, fixtures).
**Constat :** après verrouillage, aucune proposition d'outil, sans savoir si c'était voulu. Cause mesurée sur le format de sortie envoyé à Claude (`betaZodOutputFormat`) : `tools` n'était pas dans `required` — avec les sorties structurées, Claude omet volontiers un champ facultatif.
**Correction :** `tools` (liste, vide permise) et `toolsNote` (une phrase) sont désormais obligatoires dans le format imposé ; à la lecture, `.catch([])` / `.catch('')` gardent la tolérance (IA locale, anciennes synthèses). La consigne demande, si la liste est vide, de dire pourquoi (contexte insuffisant et ce qui manque, ou idée qui n'appelle pas d'outil). L'aperçu affiche toujours « Outils suggérés : … » — la liste, ou « aucun — » + le verdict ; si l'application a retiré toutes les propositions (déjà branchées), ou si la synthèse vient de l'IA locale, la ligne le dit. Un test vérifie que les deux champs restent obligatoires dans le format. 788 tests.


### [2026-09-30 22:10] SESSION — End
**Resume :** Reprise l'après-midi de la session ouverte le 30/09 à 12:20. Idée de départ en hexagone avec fiche et résumé local (T070), prochaine étape posée sur la carte et « Brainstormer cette étape » (T071), sélecteur de thème, verrouillage sur toute l'arborescence (T072). Spec 005 widgets branchés : lot 1 (entrées, revue avant autorisation) et lot 2 (`gi.output`, cadre résultat, vue générique) validés en test manuel. Correctif : l'idée née d'une étape est reliée à l'étape. Spec 006 (idée de mentalyas : outils proposés au verrouillage) rédigée, planifiée, lot 1 validé ; lot 2 (outils créés à l'éclosion, génération en arrière-plan, « Réessayer ») commité mais **test manuel T016 encore à faire**, avec le correctif du verdict « Outils suggérés » (champ `tools` rendu obligatoire dans le format de Claude, qui l'omettait). 788 tests.
**Branche :** main
**Commits pushes :** 11

### [2026-10-04 09:30] DOCS — amendement L1c « Pont Claude Code » : niveaux 1, 2 et 3 (à valider en bloc)
**Fichiers :** `docs/brainstorm/L1c-pont-claude-code.md`, `L2-pont-mcp.md`, `L2-moteur-cli.md`, `L2-terminal-espaces.md`, `L3-pont-mcp.md`, `L3-moteur-cli.md`, `L3-terminal-espaces.md` ; `docs/Sans titre.canvas` supprimé (fichier non suivi, inutile).
**Quoi :** constat de mentalyas — neurones et widgets fonctionnent mais aucun cas d'usage concret. Nouvelle vision : le Brainstormer devient l'interface visuelle de Claude Code. Serveur MCP local exposant la carte (F10), fonctions IA via `claude -p` au lieu de l'API (F11), terminal intégré lançant `claude` dans des espaces liés à un dossier (F12), skill `brainstormer` pour le CLI externe (F13), recettes et bibliothèque de widgets plus tard (F14). Arbitrages : Claude écrit directement (marqué « par Claude », annulable), plus d'anonymisation ni de cadre IA, plus d'API Anthropic.
**Pourquoi ainsi :** transport MCP par relais stdio + canal nommé plutôt qu'HTTP — aucun port ouvert, jeton jamais écrit dans la config de Claude Code, message clair quand l'app est fermée. Essai réel sur Claude Code 2.1.289 : `claude -p --json-schema --tools ""` renvoie `structured_output` conforme en 2,6 s (Haiku), ~6 000 jetons fixes par appel ; `--bare` est à proscrire (il force la clé API). Primitives génériques ajoutées aux blocs (`note`, `frame`, `map_links`) et non aux neurones, propres à la recette Brainstorm.

### [2026-10-04 12:50] FEAT — spec 007 Pont MCP : Claude Code lit et dessine la carte (T001–T036)
**Fichiers :** `src/shared/mcp/` (`tools.ts`, `protocol.ts`), `src/mcp-relay/relay.ts`, `src/main/infrastructure/mcp/` (`PipeServer`, `token`, `endpoint`, `lineSplitter`), `src/main/domain/mcp/` (`batch`, `layout`, `errors`), `src/main/application/mcp/` (`MapService`, `SelectionStore`), `src/main/ipc/mcpHandlers.ts`, migration `0017_map_primitives` (+ down), `schemaNeurons.ts`, `BlockRepository`, `MapLinkRepository`, `NeuronRepository`, `HistoryRepository`/`HistoryService`/`changeLog` (`mcp_write`, `actor`), `WidgetService.createFromCode`, `CanvasService` (`mapLinks`, cadre supprimé avec son contenu), `bootstrap.ts`, `electron.vite.config.ts` (2e entrée), `tsconfig.node.json` ; interface : `MapNoteNode`, `FrameNode`, `ClaudeBadge`, `MapLinkEdge`, `buildGraph.ts`, `IdeasCanvas.tsx`, `useSelectionSync.ts`, `useMainEvents.ts` (`map:changed` + Annuler), Réglages › Claude Code ; dépendance `@modelcontextprotocol/sdk` 1.32.0 ; tests (`tests/unit/mcp/`, `tests/integration/mcp/`, `map-primitives` renderer). 845 tests.
**Quoi :** un relais lancé par Claude Code (electron.exe en mode Node) déclare 9 outils (`etat`, `carte_lire`, `selection_lire`, `noeud_lire`, `dessiner`, `noeud_modifier`, `relier`, `retirer`, `widget_poser`) et les transmet au main par un canal nommé propre au profil, authentifié par un secret. Claude dessine des lots tout-ou-rien (notes titrées, idées, liens libellés, cadre), placés par l'app sans chevauchement ; chaque appel = une opération d'Historique « par Claude », annulable d'un coup (toast « Annuler »). Un widget posé par Claude arrive « À revoir ». Réglages › Claude Code : état, commande à copier, régénération du secret.
**Pourquoi ainsi :** le protocole MCP vit dans le relais (research R1, révision de L3) : app fermée, chaque outil répond « pas lancé » et la session de Claude Code survit puis se reconnecte. Aucun port réseau ; le secret reste dans le profil (le relais le relit à chaque connexion, donc une rotation ne casse pas un relais légitime). Le main revalide tout (le relais n'est pas de confiance). Les primitives sont des blocs (déjà positionnés, supprimables, annulables) ; un nœud `idee` crée une vraie idée brute épinglée. Le placement est une fonction pure (colonnes par profondeur, parents centrés, zone libre), testée sur 200 nœuds. Vérifié sans interface : sonde stdio → relais compilé → canal → serveur. Reste : T020 (test automatisé de la synchro de sélection) et T038 (test manuel guidé).

### [2026-10-04 13:55] FEAT — spec 008 lot A : chaque neurone a sa conversation Claude Code (T001–T013)
**Fichiers :** `docs/brainstorm/L2-` et `L3-neurone-conversationnel.md` ; `specs/008-neurone-conversationnel/` ; migration `0018_neuron_conversations` (+ down), `schemaNeurons.ts` (`session_id`, `session_started`, `sheet_json`, `neuron_messages`) ; `domain/conversation/` (`streamEvents`, `sheet`, `contextBlock`), `infrastructure/claude/` (`claudePath`, `CliConversation`), `application/conversation/` (`ConversationService`, `frame`), `application/mcp/` (`NeuronTools`, `toolHandler`), `domain/mcp/caller.ts`, `ConversationRepository`, `chatHandlers.ts`, `shared/ipc/chat.ts`, `shared/mcp/tools.ts` (+3 outils), `protocol.ts` (`hello.neuron`), relais (`GI_NEURON_ID`), `PipeServer` (appelant), `HistoryRepository`/`HistoryService` (`neuron_sheet`), `CanvasService` (`sheetSummary`), `bootstrap.ts` ; interface : `chat/` (`ChatPanel`, `useChat`), `IdeasCanvas` (double-clic), `uiStore` (`chatNeuronId`), `NeuronNode` (résumé de fiche) ; tests (`tests/unit/conversation/`, `tests/integration/conversation/`, `chat-panel`). 879 tests.
**Quoi :** double-clic sur une idée → panneau de chat = vraie conversation `claude -p` en flux `stream-json`, session reprise d'une ouverture à l'autre (`--session-id` puis `--resume`), historique gardé dans la base chiffrée. Claude tient la **fiche** du neurone (`fiche_ecrire`) et sa **maturité** (`maturite_evaluer`, qui réutilise la jauge : la taille du neurone suit) ; le résumé de la fiche s'affiche sous le neurone. Arrêter un tour, bandeau de quota, messages d'aide (Claude absent, non connecté, limite, reprise impossible).
**Pourquoi ainsi :** vérifié sur le CLI 2.1.289 : abonnement (`apiKeySource: none`), `--setting-sources project` coupe les hooks personnels de mentalyas, `rate_limit_event` donne le quota. Outils restreints à deux niveaux (`--tools` retire Bash/Edit, `--allowedTools` + `--permission-prompts none` refusent le reste). Le cadre est stable (le CLI le fige par session) ; la fiche, qui change, est jointe au premier message de chaque ouverture. Le neurone de la conversation est transmis au pont par l'environnement du relais, et le main refuse qu'une conversation écrive dans un autre arbre. Un processus par conversation ouverte (≤ 3, arrêt après 10 min). Reste : T014, test manuel guidé ; lots B (entonnoir) et C (bascule).

### [2026-10-04 14:40] FEAT/FIX — spec 008 lot A, retours de mentalyas : plus d'Ollama, consommation, dossier de projet (T015–T018)
**Fichiers :** `IdeasCanvas.tsx`, `NeuronMenu.tsx`, `dive/useDive.ts` ; `domain/conversation/streamEvents.ts` (fenêtres d'abonnement, jetons du tour), `ConversationService.ts` (consommation, dossier lié, modèle et durée du tour), `ConversationRepository.ts` (`recordTurn`, `usageSince`, relevé d'abonnement, `setProjectDir`), `contextBlock.ts`, `chatHandlers.ts` (`chat:linkFolder`), `bootstrap.ts` (sélecteur natif), migration `0019_neuron_project_dir` (+ down), `shared/ipc/chat.ts`, `channels.ts` ; `chat/UsageMeter.tsx`, `ChatPanel.tsx`, `useChat.ts` ; `infrastructure/mcp/endpoint.ts` ; tests. 885 tests.
**Constat :** les questions venaient encore d'Ollama/Qwen — le premier clic d'un double-clic ouvrait l'ancien panneau, qui lançait `growth:develop` sur une idée brute.
**Quoi :** clic, double-clic ou Entrée sur une idée → conversation Claude Code ; l'ancien panneau ne s'ouvre plus que par le menu et ne déclenche plus rien. Le chat affiche l'abonnement (session 5 h, semaine, remise à zéro) et ce que le Brainstormer a consommé (semaine, total, neurone). Un neurone peut être lié à un dossier de projet : sa conversation s'y ouvre et Claude y lit CLAUDE.md, docs et code. Correctif : le canal du pont ne dépend plus de la forme du chemin du profil.
**Pourquoi ainsi :** consommation tirée du CLI lui-même (`rate_limit_event.unifiedWindows`, `result.usage`), sans API ; échanges rangés dans `ai_calls` avec un coût nul (le budget en euros n'est pas touché). Le chemin d'un dossier vient uniquement du sélecteur natif du main ; l'interface ne reçoit que son nom. Changer de dossier ouvre une nouvelle session (le CLI range ses sessions par dossier), la fiche reste. `--setting-sources project` : les réglages « local » d'un projet (autorisations Bash) ne sont pas chargés, et Bash est absent des outils.

### [2026-10-04 15:40] FEAT — spec 009 P1 : carte de structure d'un projet (outil de chirurgie, T001–T010)
**Fichiers :** `docs/brainstorm/L1e-chirurgie-projet.md`, `L3-carte-structure.md`, `specs/009-carte-structure/` ; migration `0020_project_elements` (+ down), `schemaNeurons.ts` (`kind = 'element'`, `genesis_id`, `element_type`, `element_key`, `element_status`, `paths_json`, `collapsed` ; `map_links.relation`) ; `domain/structure/resolve.ts`, `application/structure/StructureService.ts`, `ElementRepository.ts`, `structureHandlers.ts` (`element:setCollapsed`), `toolHandler.ts`, `shared/mcp/tools.ts` (`structure_dessiner`, `structure_lire`), `shared/ipc/canvas.ts` (`ElementView`, types, statuts, relations), `CanvasService` (`elements`), `HistoryRepository`/`HistoryService` (entité `element`), `NeuronTools` (garde « même projet »), `ConversationService`/`contextBlock`/`frame` (conversation d'un élément) ; interface : `structureGraph.ts`, `ElementNode.tsx`, `buildGraph.ts`, `MapLinkEdge` (style par relation), `IdeasCanvas` (clic → conversation), `ChatPanel` (« Cartographier ce projet », en-tête d'élément) ; tests (`tests/unit/structure/`, `tests/integration/structure/`, `structure-graph`, `chat-panel`). 904 tests.
**Quoi :** vision de mentalyas — le Brainstormer devient un outil de chirurgie de projet. Sur un genesis lié à un dossier, « Cartographier ce projet » fait lire le projet à Claude, qui dessine sa carte de structure : éléments typés (module, fonctionnalité, composant, donnée, interface, tâche, décision) à clé stable, chemins de fichiers, statuts, liens typés. Les éléments se déplient par niveaux autour du genesis ; un clic ouvre la conversation de l'élément, dans le dossier du projet, avec son type, ses fichiers, son chemin d'ancêtres et la fiche du projet.
**Pourquoi ainsi :** un élément est un neurone (`kind = 'element'`, sa propre racine pour rester hors de l'ancien moteur de croissance) : il hérite gratuitement de la conversation, de la fiche et de l'Historique. La clé stable permet de recartographier sans doublon (mise à jour par clé ; les absents ne partent que sur demande). Les positions sont calculées par l'interface (arbre en colonnes centré sur le genesis) : pas de coordonnées à stocker, le repli recompacte la carte ; un lien vers un élément replié se rattache à son ancêtre visible et se regroupe (« ×2 »). Chemins validés (relatifs, sans `..`), jamais ouverts par l'app. P1 reste en lecture côté projet ; l'écriture validée arrive en P2. Reste : T011, test guidé.

### [2026-10-04 15:55] FIX — le chat affichait le Markdown de Claude brut (retour de test de mentalyas)
**Fichiers :** `chat/Markdown.tsx` (nouveau), `chat/ChatPanel.tsx`, `tests/unit/renderer/chat-panel.test.tsx` ; dépendances `react-markdown` 10.1.0 et `remark-gfm` 4.0.1 (validées par mentalyas). 905 tests.
**Quoi :** les réponses de Claude (et le texte en cours d'écriture) sont mises en forme : titres, gras, listes, cases à cocher, tableaux, code, citations, liens. Les messages de mentalyas restent du texte.
**Pourquoi ainsi :** rendu sûr par construction — `skipHtml` (aucun HTML brut interprété), filtre d'URL par défaut de react-markdown (`javascript:` neutralisé), liens ouverts hors de l'app (seuls les https passent, `guardNavigation`), images jamais chargées (texte alternatif). Testé avec un `<script>`, un `<b>` et un lien `javascript:`.

### [2026-10-04 16:15] SECURITY — un dossier de projet lié ne peut plus exécuter ses hooks
**Fichiers :** `ConversationService.ts` (`--setting-sources ""`), `contextBlock.ts`, `frame.ts`, `conversation-service.test.ts`, `CLAUDE.md`.
**Constat (vérifié sur Claude Code 2.1.289, faux projet) :** avec `--setting-sources project`, un hook `SessionStart` déclaré dans le `.claude/settings.json` du dossier lié s'exécutait à l'ouverture de la conversation — un dépôt non fiable pouvait donc lancer des commandes sans que mentalyas le voie.
**Correction :** aucune source de réglages (`--setting-sources ""`) : ni hooks ni réglages de l'utilisateur, ni ceux d'un projet lié. Conséquence vérifiée : le `CLAUDE.md` du projet n'est plus chargé d'office ; Claude le lit lui-même (outil Read) en premier, comme une donnée — la consigne et le contexte joint le demandent. Essai réel par `spawn` Node sans shell : hook non exécuté, `CLAUDE.md` lu.

### [2026-10-04 17:00] FEAT — spec 010 C1 : plus d'API Anthropic, Claude passe par `claude -p` (T001–T004)
**Fichiers :** `specs/010-bascule/` ; `infrastructure/ai/ClaudeCliProvider.ts` (nouveau), `composition/aiEngine.ts` (réécrit), `application/ai/AIGateway.ts` (budget, anonymisation et coût facultatifs), `ipc/aiHandlers.ts` (réécrit), `shared/ipc/ai.ts`, `AiConfigRepository` (`elementModel`), `ConversationService` (modèle par usage + `setModel`), `ConversationRepository` (`chat_model`), `chatHandlers` (`chat:setModel`), migration `0021_neuron_chat_model` (+ down), `bootstrap.ts` (ancien secret effacé, `cli-sandbox`) ; interface : `AiSettingsPage` (réécrite), `ChatPanel` / `useChat` (choix du modèle) ; retirés : `@anthropic-ai/sdk`, `ClaudeProvider`, `BudgetGuard`, `domain/ai/cost`, `Anonymizer`, canaux `ai:setClaudeKey` / `ai:clearClaudeKey` / `ai:unlockBudget`, événement `ai:budgetAlert`, et leurs tests ; tests (`claude-cli-provider`, `ai-handlers`, `ai-settings`, `conversation-service`). 870 tests.
**Quoi :** la génération de widgets (seule tâche Claude encore vivante) passe par le CLI de mentalyas. Réglages › IA : état de Claude Code, modèles par usage (genesis Opus 5.5, éléments et widgets Sonnet 5.5), Ollama ; plus de clé ni de budget. Le chat permet de choisir le modèle de la conversation (« Défaut (…) » ou un modèle) : le processus s'arrête et l'échange suivant reprend la session avec le nouveau modèle.
**Pourquoi ainsi :** `claude -p --output-format json --json-schema <z.toJSONSchema(schéma)>` donne une sortie structurée validée par le même Zod qu'avant ; sans outil, sans MCP, sans réglage (`--setting-sources ""`), dans un dossier vide (`cli-sandbox`) ; données par stdin, consignes en argument (ou par stdin au-delà de 20 000 caractères, limite de ligne de commande Windows). Vérifié en réel : widget « Compteur simple » généré et validé en 14,6 s (Haiku). L'anonymisation et le budget restent des ports facultatifs de la passerelle le temps que l'ancien moteur (qui les teste encore) soit retiré en C2.

### [2026-10-05] TEST — spec 010 C1 validé par mentalyas (T005)
**Quoi :** test guidé C1 entièrement vert : démarrage sans trace de clé ni de budget, Réglages › IA (état Claude Code, modèles par usage conservés, Ollama), choix du modèle dans le chat (session reprise avec contexte), génération d'un widget par `claude -p`.

### [2026-10-05 10:45] FEAT — spec 010 C2 : les anciennes idées reçoivent une fiche au démarrage (T006–T007)
**Fichiers :** `domain/conversation/legacySheet.ts` (nouveau, pur), `infrastructure/db/repositories/LegacyRepository.ts` (nouveau), `application/conversation/LegacyConversion.ts` (nouveau), `bootstrap.ts` (appel au démarrage), Historique : type de lot `convert` (`changeLog`, `schemaNeurons`, `HistoryRepository`, `shared/ipc/history`, `HistoryService` : annulable, résumés « Conversion de l'ancien moteur : N fiches » / « … annulée ») ; tests `unit/conversation/legacy-sheet`, `integration/conversation/legacy-conversion`. 888 tests.
**Quoi :** au premier démarrage, chaque idée sans fiche en reçoit une, assemblée sans IA : résumé = « En bref » ; points clés = prochaine étape, points / pour / contre de la synthèse ou tâches du plan en cours (branches retenues), puis réponses « question → réponse » ; décisions ; questions ouvertes ; manques = pistes « à trouver ». Un seul lot d'Historique, annulable (refusé si une fiche a été modifiée depuis).
**Pourquoi ainsi :** `LegacyRepository` lit directement les anciennes tables (gardées, D1) sans dépendre des services de l'ancien moteur, pour survivre à leur retrait (T008). Idempotence double : marqueur `migration.legacySheets` (posé même sans rien à convertir, et non effacé par l'annulation) et aucune idée ayant déjà une fiche n'est touchée. Fiche trop longue : on retire le dernier point de la section la plus fournie (pertes réparties) — le premier essai vidait tous les points clés, attrapé par le test des bornes.

### [2026-10-05 11:45] FEAT — spec 010 C2 : l'ancien moteur de neurones est retiré (T008)
**Fichiers :** retirés côté main : services `Fusion`, `Growth*`, `IdeaSummary`, `Link`, `Seed`, `Synthesis*`, `ToolGeneration`, `toolSurroundings` ; dépôts `Fusion`, `Growth`, `Link`, `WidgetRequest` ; canaux `growth:*`, `fusion:*`, `links:*`, `seeds:*`, `hatched:get`, `neuron:summary`, `canvas:saveStepPosition`, `widget:generate` et leurs événements ; domaine `guards`, `provenance`, `synthesisPatch`, `tree`, `extractValues`, `planChecks`, `placeTools`, `toolProposals`, schémas `shared/ai/neurons`. Interface : `dive/`, `fusion/`, `hatched/`, arbre, étape, graines, `LinkEdge`, `hoverStore`. Passerelle IA : deux tâches (`categoriser` local, `widget` par `claude -p`), plus de recherche web, budget, anonymisation ni routage configurable ; `ai_config` réduit (les anciennes clés sont ignorées à la lecture). Ajouts : `canvas:createLink` (lien libre entre deux idées, annulable), la conversion reprend aussi les liens acceptés et les branchements « prochaine étape → widget ». Tests de l'ancien moteur retirés avec lui ; 614 tests. **≈ 13 400 lignes retirées**, 870 ajoutées (SC-002 : ≥ 4 000).
**Quoi :** un clic ou un double-clic sur une idée (ou une idée capturée, ou « Ouvrir » dans l'Historique) ouvre sa conversation ; la carte n'affiche plus que les idées, les éléments, les blocs et les liens libres. Lier deux idées (tirer un lien ou par le menu) crée un lien libre, libellé toujours visible.
**Pourquoi ainsi :** les anciennes tables restent (D1) et sont encore lues là où c'est utile : document et réponses pour les widgets branchés (`HatchedRepository`, `NeuronService.getTree`), annulation des anciens lots par l'Historique. Choix de mentalyas (05/10) : liens acceptés → liens libres, branchements d'étape → l'idée elle-même. Limite connue : un lien libre ne se renomme ni ne se supprime encore à la main (seulement par l'annulation ou par Claude) — à prévoir.

### [2026-10-05] TEST — spec 010 C2 validé par mentalyas (T009)
**Quoi :** test guidé C2 vert : conversion au démarrage (fiches, liens, branchements) et son annulation, plus aucune trace de l'ancien moteur, liens libres entre idées, chat, widgets et capture inchangés.

### [2026-10-05 12:30] DOCS — spec 011 « Plan d'attaque » rédigée (à valider)
**Fichiers :** `specs/011-plan-attaque/spec.md`, `checklists/requirements.md`, `.specify/feature.json`.
**Quoi :** reprise du lot B de la spec 008 : couche suivante proposée par Claude en fantômes (validation en bloc ou un par un), rang ①②③ + dépendances, auto-layout déterministe et incrémental en arbre gauche → droite, différenciation visuelle genesis / étape / sous-étape / fantôme / verrouillé, statut d'avancement, verrouillage proposé par Claude.
**Pourquoi ainsi :** décisions de mentalyas (D1–D6), dont D5 (nœud verrouillé : dialogue sans écriture) et D6 (verrou obligatoire avant la couche suivante : modifier un parent après ses enfants casse la logique en cascade). Hors périmètre : type d'entonnoir, remontée, export `/brainstorm`.

### [2026-10-05 12:50] DOCS — spec 011 : plan technique (Spec Kit)
**Fichiers :** `specs/011-plan-attaque/plan.md`, `research.md`, `data-model.md`, `contracts/mcp-tools.md`, `contracts/ipc.md`, `quickstart.md`.
**Quoi :** étape = neurone `kind = 'step'` (rang, statut, verrou) ; propositions de couche et de verrou stockées hors des données de mentalyas ; dépendances entre sœurs sans cycle ; disposition pure déterministe et incrémentale (arbre tidy gauche → droite, plan au-dessus de la carte de structure, corps physique unique attaché au genesis) ; garde de verrou unique sur tous les chemins d'écriture ; 3 outils MCP (`plan_proposer`, `verrou_proposer`, `etape_modifier`) et 4 canaux IPC. Trois lots : données et règles, Claude, carte.
**Pourquoi ainsi :** réutiliser conversation, fiche et Historique des neurones (aucune duplication) ; `genesis_id` ne désigne plus seulement un élément de structure : l'élément se reconnaît désormais à `kind = 'element'`.

### [2026-10-05 13:05] DOCS — spec 011 : tâches (Spec Kit)
**Fichiers :** `specs/011-plan-attaque/tasks.md`.
**Quoi :** 35 tâches : setup (migration), fondations (schéma, élément = `kind element`, domaine pur des dépendances et du verrou, dépôt, Historique + garde D6), puis US1 (MVP : proposition, décision, contexte hérité, fantômes), US4 (verrou), US2 (disposition, physique, flèches, réordonnancement), US3 (identité visuelle), finitions. Un test guidé validé par mentalyas à la fin de chaque user story.

### [2026-10-05 13:40] DOCS/FEAT — spec 010 C3 : démo, constitution 3.0.0, FOUNDATION (T010–T012) — spec 010 terminée
**Fichiers :** `infrastructure/db/demo/seedDemo.ts` (réécrit), tests `db/seed-demo`, `hatched/result` (archive insérée par le test), `canvas` ; `.specify/memory/constitution.md` (3.0.0) ; `docs/FOUNDATION.md` (« État actuel » en tête) ; `CLAUDE.md`.
**Quoi :** profil démo du nouveau modèle : 12 genesis fictifs aux trois maturités avec leur fiche, 8 liens libres, une carte de structure (6 éléments, 2 liens typés) ; plus rien dans les tables de l'ancien moteur. Constitution : plus de clé API, de recherche web, de SDK Anthropic ; logique à tester = conversion, verrous, dépendances, disposition ; une couche ou un verrou proposés par Claude restent des propositions (II). 615 tests ; typecheck, lint, build verts.
**Pourquoi ainsi :** la FOUNDATION (≈ 2 000 lignes, historique utile) est résumée par une section « État actuel » plutôt que réécrite.

### [2026-10-05 14:20] FEAT — spec 011 phases 1–2 : données et règles du plan d'attaque (T001–T009)
**Fichiers :** migration `0022_plan_attaque` (+ down, test aller-retour) ; `schemaNeurons` (`kind step`, `rank`, `step_status`, `locked_at`, `lock_proposed_at`, tables `step_dependencies`, `plan_proposals`, `plan_proposal_items`, kind d'Historique `plan`) ; `domain/plan/dependencies.ts` (cycles, hors fratrie, ordre, renumérotation, déplacement) et `lock.ts` (`assertUnlocked`) ; `PlanRepository` ; `HistoryRepository` (entités `step`, `step_rank`, `step_status`, `step_dependency`, `neuron_lock`) ; `HistoryService` (lot `plan` annulable, résumés, garde D6) ; `ConversationService` (un élément = `kind element`). 628 tests.
**Pourquoi ainsi :** la garde D6 vit dans l'annulation elle-même : un lot qui déverrouillerait un nœud est refusé tant que des sous-nœuds nés hors de ce lot existent ; les naissances du même lot, elles, sont retirées avec lui.

### [2026-10-05 16:00] FEAT — spec 011 US1 (MVP) : Claude propose le plan d'attaque, mentalyas valide (T010–T016)
**Fichiers :** `application/plan/PlanService.ts` (proposer, décider, retirer) ; `ipc/planHandlers.ts` (`plan:decide`) ; `neuron:remove` accepte une étape ; `CanvasService` (étapes, propositions, verrous) ; `application/mcp/PlanTools.ts` + `target.ts` (vérification d'arbre factorisée) ; outil `plan_proposer`, ligne d'instructions MCP ; `domain/mcp/errors.toMcpError` (erreurs métier → codes MCP, dans `PipeServer`) ; contexte hérité d'une étape (`contextBlock` : chemin et fiches, verrou, troncature des fiches intermédiaires d'abord), rôle « étape » et libellé de rang dans le chat, `neurone_contexte` (verrou, plan) ; `shared/plan/rankLabel.ts` ; interface : `planLayout.ts` (arbre gauche → droite, pur), `PlanNode` / `PlanBarNode`, `usePlanDecide`, styles. 664 tests.
**Quoi :** sur un nœud mûr, Claude propose une couche (fantômes pointillés numérotés à leur futur rang, barre « Tout valider / Tout refuser ») ; valider verrouille le parent et fait naître les étapes en un lot annulable (« Annuler » dans la notification) ; un refus est mémorisé ; clic sur une étape = sa conversation, qui connaît les fiches du genesis et de son chemin.
**Erreurs corrigées :** (1) la maturité était rangée sous la racine de l'arbre : évaluer une étape aurait écrasé celle du genesis → rangée sous le nœud lui-même. (2) Régression de C2 : les styles des traits d'arbre vivaient dans `dive.css` supprimé → rétablis dans `canvas.css` (`branch-line`), styles d'étape orphelins retirés. (3) Cartes non déplaçables : un clic remontait au zoom de la carte → classe `nopan`.

### [2026-10-05 16:40] FIX/FEAT — spec 011 US1, retours de test de mentalyas
**Fichiers :** `canvas/nodes/PlanNode.tsx` (poignées invisibles), `styles/tokens.css` (fenêtre sans défilement), `app/uiStore.ts` (`ghostId`), `canvas/GhostPanel.tsx` (nouveau), `IdeasCanvas.tsx` (clic sur un fantôme → détail), test `plan-ghosts`. 666 tests.
**Quoi :** (1) aucun trait genesis → étapes : React Flow n'affiche une arête que vers un nœud muni de poignées — ajoutées (vérifié : le test échoue sans elles). (2) Un fantôme se consulte avant décision : volet « Étape proposée par Claude » (rang à la naissance, parent, pourquoi, ce qu'elle attend, Valider / Refuser). (3) Double barre de défilement : la fenêtre pouvait défiler quand un contenu ou un focus sortait du champ → `html, body, #root` en `overflow: hidden`, seuls les volets internes défilent.

### [2026-10-05 17:00] FIX — spec 011 : Claude dessinait des notes et des idées détachées au lieu du plan (retour de mentalyas)
**Fichiers :** `application/conversation/frame.ts` (section PLAN D'ATTAQUE), `shared/mcp/tools.ts` (description de `dessiner`, `MCP_INSTRUCTIONS`), `application/mcp/MapService.ts` (ancre sur une étape), test `mcp/map-service`. 667 tests.
**Quoi :** demander « les étapes suivantes » dans une étape produisait un cadre de notes libres, ou des nœuds `idee` qui deviennent des genesis détachés. Le cadre et les instructions disaient « DESSINE les plans » et ne parlaient pas de `plan_proposer` → plan, étapes, séquence, découpage = `plan_proposer` sur le neurone de la conversation, jamais `dessiner` ; un nœud `idee` est réservé à une idée vraiment distincte. Ancrer un dessin sur une étape renvoie une erreur qui oriente vers `plan_proposer` au lieu d'un « introuvable ».
**Règle apprise :** une capacité ajoutée au pont MCP ne sert à rien tant que le cadre des conversations et les instructions ne disent pas QUAND l'utiliser plutôt que l'outil générique voisin.

### [2026-10-05 17:30] FIX — spec 011 : plan d'attaque fiable depuis le chat (2e retour de mentalyas)
**Fichiers :** `chat/ChatPanel.tsx` (bouton « Proposer un plan d'attaque », `PLAN_MESSAGE`), `application/mcp/MapService.ts` (`dessiner` reçoit l'appelant), `toolHandler.ts`, tests `chat-panel`, `mcp/map-service`. 669 tests.
**Quoi :** malgré les consignes, Claude (session reprise, habitudes de la conversation) redessinait des notes et des idées détachées. Deux garde-fous concrets plutôt que du texte : (1) un bouton dans le chat d'un genesis ou d'une étape envoie une demande qui nomme l'outil `plan_proposer` et interdit `dessiner` ; (2) depuis la conversation d'un neurone, `dessiner` refuse les nœuds `idee` (genesis détachés) et oriente vers `plan_proposer` ou des notes — mentalyas garde la création d'idées à la main.
**Règle apprise :** quand un modèle confond deux outils voisins, un déclencheur explicite (bouton) et un refus motivé dans l'outil générique valent mieux qu'une consigne de plus.

### [2026-10-05 18:00] DOCS — spec 012 « Documents » rédigée (à valider)
**Fichiers :** `specs/012-documents/spec.md`, `checklists/requirements.md`, `.specify/feature.json`.
**Quoi :** nœud fichier Markdown sur la carte, comme un `.canvas` d'Obsidian : Claude rédige, en prolongement d'un neurone, un document qui le détaille ; vrai fichier `.md` (D1 : `docs/brainstormer/` du projet lié, sinon `documents` du profil) ; lecture rendue et défilante dans le nœud (D3) ; édition Markdown brute par mentalyas, versions et annulation (D2). Chemin toujours choisi par l'app ; aucun HTML brut interprété ; aucun fichier effacé définitivement.

### [2026-10-05 18:20] DOCS — spec 012 : plan technique (Spec Kit)
**Fichiers :** `specs/012-documents/plan.md`, `research.md`, `data-model.md`, `contracts/interfaces.md`, `quickstart.md`.
**Quoi :** tables `documents` + `document_versions` ; fichier source de vérité (relu, surveillé par `fs.watch`, version `externe` si modifié ailleurs, conflit d'édition) ; chemin résolu par le main (slug, noms réservés, collisions, `realpath` sous le projet, écriture atomique, corbeille) ; outils `document_ecrire` / `document_lire` ; nœud `document` placé dans la colonne des enfants de son neurone (disposition du plan) ; rendu Markdown sûr du chat réutilisé.
**Pourquoi ainsi :** le main ne connaît pas la place des étapes : rattacher le document à l'arbre de son neurone garde une seule source de vérité pour la disposition. Écart IV (fichier en clair) documenté : décision D1.

### [2026-10-05 18:30] DOCS — spec 012 : tâches (Spec Kit)
**Fichiers :** `specs/012-documents/tasks.md`.
**Quoi :** 27 tâches : schéma et migration ; fondations (nommage sûr, fichiers, dépôt, Historique) ; US1 MVP (service, outils MCP, IPC, bouton du chat, nœud placé dans la colonne des enfants) ; US2 (lecture, redimension, version externe, surveillance) ; US3 (édition, conflit, retrait) ; finitions. Un test guidé par user story.

### [2026-10-05 19:30] FEAT — spec 012 phases 1–3 (MVP) : Claude rédige le document d'un nœud (T001–T014)
**Fichiers :** migration `0023_documents` (+ down) ; `domain/documents/fileName.ts` ; `infrastructure/documents/DocumentFiles.ts` ; `DocumentRepository` ; `application/documents/DocumentService.ts` (créer, réécrire, ajouter, lire avec version `externe`, recréer, retirer, gestionnaires d'Historique) ; `HistoryService` (gestionnaires d'entités externes, kind `document`, résumés) ; `application/mcp/DocumentTools.ts` (`document_ecrire`, `document_lire`), `neurone_contexte`, cadre et instructions ; `ipc/documentHandlers.ts` (`document:get/remove/recreate/reveal`) ; `CanvasService` (documents) ; interface : `planLayout` (documents en tête de la colonne des enfants, colonnes à largeur variable), `DocumentNode`, bouton « Rédiger un document », cases à cocher étiquetées. 734 tests.
**Quoi :** depuis le chat d'un genesis ou d'une étape, Claude écrit un vrai `.md` (`docs/brainstormer/` du projet lié, sinon `documents/` du profil) qui apparaît en nœud fichier relié, rendu Markdown, défilant ; « Ouvrir le dossier » ; fichier disparu → dernière version + « Recréer ». Chaque écriture est annulable (création annulée → corbeille du profil).
**Pourquoi ainsi :** l'Historique accepte désormais des gestionnaires d'entités externes : un document se restaure dans la base ET sur le disque, sans mettre d'accès fichier dans `HistoryRepository`. Défaut a11y corrigé au passage : les cases à cocher du rendu Markdown (chat compris) n'avaient pas d'étiquette.

### [2026-10-05 20:30] FEAT — spec 011 D7 / spec 012 D4 : annexes sous le nœud, tout se glisse (retour de mentalyas)
**Fichiers :** migration `0024_document_offsets` (+ down) ; `PlanRepository` (décalage d'une étape dans ses colonnes de position), `DocumentRepository` / `DocumentService` (décalage, taille bornée) ; canaux `plan:move`, `document:move`, `document:resize` ; `planLayout` réécrit (bloc = carte + annexes empilées dessous, annexes du genesis sous lui calées avant la colonne des étapes, décalage glissé cumulé sur la branche) ; `PlanNode` / `DocumentNode` (connectiques haut et bas, `NodeResizer`) ; `IdeasCanvas` (glisser une étape ou un document → décalage enregistré) ; tests de disposition, IPC, interface. 738 tests.
**Quoi :** un document n'est plus dans la colonne des enfants mais en annexe sous son neurone ; il se redimensionne ; étapes et documents se glissent, une étape entraîne sa branche ; places et tailles gardées.
**Pourquoi ainsi :** la disposition reste déterministe (place de base) et le geste de mentalyas devient un décalage relatif : la carte reste stable et les branches restent cohérentes. Les tests d'interface cliquent les nœuds glissables avec `fireEvent.click` (d3-drag ne supporte pas l'événement complet de jsdom).

### [2026-10-06 09:30] DOCS — spec 013 amendée : visionneuse (D4) et tests du livrable (D5, US4)
**Fichiers :** `specs/013-actions-finales/` (`spec.md`, `research.md` R10–R11, `contracts/interfaces.md`, `data-model.md`, `plan.md`, `tasks.md` T030–T038, `quickstart.md` §6–7).
**Quoi :** T017 validé par mentalyas. D4 : clic sur un fichier du livrable → volet en lecture seule (Différences / Fichier coloré par `highlight.js`), « Ouvrir dans l'éditeur » (commande réglée, sans shell). D5 : depuis une action finale qui a un livrable, hors exécution, « Lancer les tests » passe les fichiers de test du livrable au script `test` approuvé ; échec → « Faire corriger » (correction avec la sortie) ; aucun test → « Demander les tests à Claude ».
**Pourquoi ainsi :** pas d'IDE intégré (Monaco lourd, conflit avec le retour arrière). `shell.openPath` exécute `.js` / `.cmd` / `.ps1` sous Windows → liste blanche. npm transmet les arguments du script à l'interpréteur de commandes → chemins limités à `^[A-Za-z0-9_./@-]{1,200}$`.

### [2026-10-06 10:30] DOCS — spec 014 « Claude libre » rédigée et constitution 4.0.0 proposée (à valider)
**Fichiers :** `specs/014-claude-libre/spec.md`, `checklists/requirements.md`, `.specify/feature.json`, `.specify/memory/constitution.md` (4.0.0 proposée), `CLAUDE.md`.
**Quoi :** retour du test de la spec 013 : après une exécution, « corrige ça » dans le chat était impossible (écriture réservée à l'exécution) et le fil affichait « fichier modifié » pour une écriture refusée. mentalyas veut dans l'app la liberté du terminal, jusqu'à l'automodification de l'app. Spec 014 : outils natifs de Claude Code à tout moment, modes Demander (défaut) / Accepter les modifications / Libre, demandes de permission relayées en cartes dans le chat, dossiers supplémentaires, réglages utilisateur et dépôts de confiance sur option, fil fidèle, livrable des actions finales reconstitué depuis les modifications réelles.
**Essai CLI 2.1.291 :** `--permission-mode manual` sans hôte → la demande est refusée d'office (`system/permission_denied`). Relais vers l'app par `--permission-prompt-tool stdio` à confirmer (essai bloqué par la sécurité de la session, à lancer par mentalyas).
**Commit :** `dd09025` (spec 013 US1, US2, US2b).

### [2026-10-06 10:45] FIX — carte : glisser une idée ne déplace plus les autres (retour de mentalyas)
**Fichiers :** `canvas/physics.ts` (objets libérés, regel au repos), `canvas/useCanvasPhysics.ts` (idée à place mémorisée = fixe), `canvas/IdeasCanvas.tsx` (plus de physique en direct pendant un glisser ; « Libérer » relance le placement de la seule idée libérée), test `ui/physics`. 907 tests.
**Quoi :** la « physique dominante » (2026-09-29) repoussait toutes les idées pendant et après un glisser. Nouvelle règle : une idée déjà posée ne bouge plus d'elle-même ; la physique place seulement les nouvelles idées et celle que mentalyas libère, qui se fige de nouveau une fois au repos.
**Règle apprise :** une physique « vivante » plaît pour explorer et gêne pour ranger ; la carte de mentalyas sert à organiser, la place choisie à la main prime.

### [2026-10-06 11:30] FEAT — spec 013 D4 : visionneuse des fichiers du livrable et « Ouvrir dans l'éditeur » (T030–T032)
**Fichiers :** `application/finals/DeliverableReader.ts`, `EditorService.ts` ; `domain/finals/editor.ts` ; `infrastructure/editor/EditorLauncher.ts` ; `AppSettingsRepository` (`editor.program`) ; canaux `deliverable:file`, `deliverable:openInEditor`, `editor:get/choose/clear` ; `shared/files/language.ts` ; interface : `lib/highlight.ts`, `canvas/FileViewer.tsx`, `DeliverableNode` (fichiers cliquables), `uiStore` (`viewer`), Réglages › Éditeur, styles `hljs-*` sur les jetons du thème ; tests (reader, éditeur, coloration, interface/axe). Dépendance ajoutée : `highlight.js` 11.12.0 (BSD-3, sans dépendance). 935 tests.
**Quoi :** clic sur un fichier du livrable → volet en lecture seule : onglet Différences (depuis l'état d'avant l'exécution, sur le contenu actuel, « modifié depuis » signalé), onglet Fichier (coloré, numéros de ligne). « Ouvrir dans l'éditeur » à la première ligne changée.
**Pourquoi ainsi :** seuls les chemins du livrable sont lisibles (jamais un chemin venu du renderer) ; éditeur = programme détecté ou choisi au dialogue natif, lancé sans shell, fichier en argument séparé ; sans éditeur, l'application de Windows seulement pour des extensions non exécutables ; coloration rendue sans `innerHTML` (analyseur à grammaire fermée).
**Sécurité signalée :** `npm audit` passe de 4 à 14 alertes (12 modérées, 2 élevées : `source-map-js`, `http-cache-semantics`) — nouveaux avis sur la chaîne de build (electron-builder, drizzle-kit), pas sur `highlight.js` ; à traiter à part.

### [2026-10-06 12:30] FEAT — spec 015 : widgets branchés sur les étapes de plan (T001–T007, T009)
**Fichiers :** `shared/ipc/widgetIo.ts` (parties d'idée et d'étape, `plan_step`, forme des entrées) ; `domain/widgets/inputParts.ts` (conversion des anciennes parties à la lecture) ; `application/widgets/InputAssembler.ts` (assemblage pur, borne 200 Ko), `PlanFacts.ts` (contexte d'une étape : chemin, fiches, sous-arbre, documents, livrable), `WidgetIoService.ts` ; `PlanRepository` (`sheetJson`, `whyOf`) ; `WidgetIoRepository` ; IPC `widgetIo:connect/setParts` ; `MapService`/`widget_poser` (source = étape) ; `WidgetFrame` (forme des entrées décrite à Claude) ; interface : point d'accroche des étapes, `canvas/connection.ts`, trait étape → widget, revue (rang, parties d'étape, « ancienne source »). Tests : assemblage, conversion, intégration (plan réel), MCP, interface/axe. 946 tests.
**Quoi :** tirer une étape (ou une action finale) vers un widget en fait une entrée ; après autorisation, le widget reçoit son contexte complet : identité (rang « 1.2 », statut, raison, action finale), fiche, chemin depuis le genesis (titres et fiches), sous-étapes, documents annexés, fichiers du livrable. Une idée transmet désormais identité, fiche, plan d'attaque, annexes.
**Pourquoi ainsi :** pas de migration — `source_kind` est un texte libre et les anciennes parties sont converties à la lecture, ce qui change l'empreinte d'autorisation (réautorisation une fois) sans toucher la base. Rang en chiffres simples pour le widget (exploitable dans son code), au style de la carte (①.2) dans la revue.
**Erreur corrigée :** `identity` existe dans les deux vocabulaires : un branchement récent réduit à l'identité recevait aussi la fiche → seule une partie propre à l'ancien moteur déclenche la conversion (test de régression).

### [2026-10-06 13:00] FEAT — consommation Claude visible en permanence dans l'en-tête (retour de mentalyas)
**Fichiers :** `app/HeaderUsage.tsx` (nouveau), `app/AppShell.tsx`, `chat/UsageMeter.tsx` (`resetLabel` exporté), canal `usage:get` (`chatHandlers`, `channels`), `ConversationService.usage(neuronId?)`, test `header-usage`. 949 tests.
**Quoi :** à gauche des boutons de thème, « Claude · 5 h · 7 j » avec deux mini-jauges (orange à 75 %, rouge à 90 %, cadre rouge à la limite) ; mise à jour à chaque relevé `chat:usage` de n'importe quelle conversation, relecture locale chaque minute ; infobulle : remises à zéro, âge du relevé, consommation du Brainstormer.

### [2026-10-06 13:10] DOCS — spec 015 amendée : le lien construit le widget (D5–D7, US4–US5)
**Fichiers :** `specs/015-widgets-etapes/` (`spec.md`, `research.md` R5–R6, `tasks.md` T012–T017, `quickstart.md` §4–5).
**Quoi :** retour de mentalyas : le lien sert à ce que Claude construise le widget le plus utile au contexte du nœud, pas seulement à faire passer des données brutes. Widget vide + branchement → construction automatique depuis le contexte complet (valeurs comprises) ; widget déjà écrit → « Adapter au nœud » ; sans données brutes utiles, un contexte préparé par Claude (consigne d'extraction + JSON), actualisé sur demande (« Actualiser »), jamais automatiquement.
**Pourquoi ainsi :** la règle « Claude ne voit que la structure des entrées » (spec 005) venait de l'anonymisation retirée en constitution 3.0 ; l'actualisation sur demande évite une consommation continue de l'abonnement.

### [2026-10-06 14:30] FEAT — spec 014 T007 : cartes de permission et statut réel des outils dans le chat
**Fichiers :** `chat/ChatPanel.tsx` (`PermissionCard`, `PermissionDetail`, `ToolMessage`), test `renderer/chat-panel` (+5, axe). 975 tests.
**Quoi :** une demande de Claude apparaît en carte au-dessus de la saisie, une à la fois dans l'ordre d'arrivée (« N autres demandes en attente ») : écriture → chemin + aperçu ; commande → texte exact + dossier ; boutons Autoriser / Toujours pour ce projet / Refuser. Le fil marque chaque outil « en cours », « fait », « refusé » ou « échoué » avec la raison courte ; le résultat remplace la pastille « en cours ».
**Pourquoi ainsi :** aperçu et commande rendus en texte brut (`<pre>`, jamais interprétés) ; la carte est dans un `section` titré pour être annoncée par les lecteurs d'écran ; un ancien fil sans statut garde sa pastille neutre.
**Commit :** `9f2b4cd` (spec 014 T001–T006).

### [2026-10-06 16:30] FEAT — spec 016 « Genesis → projet » : dossier de projet après le brainstorm, git à la demande (T001–T005)
**Fichiers :** `specs/016-genesis-projet/` (spec, plan, tasks) ; `shared/ipc/projects.ts`, `shared/projects/slug.ts` ; `domain/projects/project.ts` (types de `pm.bat`, gabarits, registre) ; `infrastructure/projects/` (`ProjectFolder`, `HubRegistry`, `GitCli`) ; `application/projects/ProjectService.ts` ; `AppSettingsRepository` (`projects.root`) ; IPC `project:settings/chooseRoot/create/initGit` ; `ConversationService.attach`, `ChatView.git` ; cadre (suggestion « Faire de ce genesis un projet ») ; interface : `chat/ProjectForm.tsx`, en-tête du chat du genesis, Réglages › Projets. Tests : domaine, service (dossier temporaire, registre, git simulé), `resolveGit`, renderer/axe. 994 tests.
**Quoi :** retour de mentalyas avant le test de la spec 014 : un genesis devient un projet depuis l'app, après son brainstorm (bouton mis en avant à la maturité « suffisant »), sans passer par un dossier préparé à la main. Dossier `<racine>/<slug>/` : CLAUDE.md, docs/JOURNAL.md, README.md (+ src/, tests/ pour un type logiciel). git facultatif : « Initialiser git » à tout moment (.gitignore, `git init -b main`, premier commit). Racine = dossier `projects/` de ProjectMaster → projet inscrit au registre au format de `/hub new`, visible dans `pm.bat` (prépare le futur tableau de bord). « Délier » retiré, « Lier un dossier existant » gardé.
**Pourquoi ainsi :** chemins construits par le main (racine du sélecteur natif + slug validé, contrôle sous la racine) ; création sans écrasement (`wx`) ; registre vérifié AVANT d'écrire le dossier, réécrit de façon atomique, jamais sur un JSON illisible ; texte assaini (le lanceur lit le registre au `grep`/`sed` : un guillemet couperait la valeur).
**Sécurité :** git lancé par son chemin ABSOLU résolu dans le PATH — sous Windows, `spawn('git')` cherche d'abord dans le dossier courant (celui du projet, où un `git.exe` piégé pourrait attendre).
**Erreur corrigée :** variable `append` inutilisée laissée par le commit `9f2b4cd` (lint non relancé avant ce commit) → `npm run lint` fait désormais partie des vérifications avant commit.

### [2026-10-06 17:00] DOCS — dépôt prêt pour un collègue : README, règles de travail de Claude, skills
**Fichiers :** `README.md` (nouveau : prérequis, installation, première mise en route, développer avec Claude Code) ; `docs/claude/` (`regles-dev.md`, `methode-travail.md`, `frontend-workflow.md`, `ergonomie-ui.md`) ; `.claude/skills/journal/`, `.claude/skills/selfdoubt/` ; `CLAUDE.md` (imports `@docs/claude/…`).
**Quoi :** mentalyas partage l'app avec un collègue qui veut s'en servir et la faire évoluer avec son propre Claude Code. Les règles globales de mentalyas (`~/.claude/`), qui n'existent pas chez lui, sont publiées dans le dépôt, réduites à ce qui sert ce projet : sécurité, git, standards TypeScript/SQL/Tailwind, tests, méthode (spec d'abord, test manuel guidé à chaque étape, jamais de touches simulées, vérifications avant commit), journal et audit d'incertitude.
**Pourquoi ainsi :** dépôt public → relu ligne à ligne, sans profil personnel ni chemin local. Règles de dev et méthode importées dans `CLAUDE.md` (chargées d'office) ; guides d'interface, longs, lus à la demande. Skill `/journal` réécrit au format réel de ce JOURNAL (entrées en fin de fichier, « Quoi / Pourquoi ainsi »).

### [2026-10-06 17:30] DOCS — tests guidés validés : spec 016 T006 et spec 014 T008
**Quoi :** mentalyas valide le test de « Faire de ce genesis un projet » / « Initialiser git » (spec 016, livrée) et celui des cartes de permission (spec 014 §1, §3). Suite : spec 014 Phase 2 (modes, T009).

### [2026-10-06 17:15] SESSION — End
**Resume :** session ouverte le 2026-10-04. Specs 007 à 013 livrées ou avancées (pont MCP, chat des neurones, carte de structure, bascule sur Claude Code, plan d'attaque, documents, actions finales), spec 015 US1–US2 (widgets branchés sur les étapes), consommation Claude dans l'en-tête ; spec 014 « Claude libre » T001–T008 (permissions relayées en cartes, fil fidèle) ; spec 016 « Genesis → projet » livrée (dossier de projet après le brainstorm, git à la demande, inscription au registre ProjectMaster) ; dépôt préparé pour un collègue (README, `docs/claude/`, skills `/journal` `/selfdoubt`) ; graphe graphify mis à jour (3 907 nœuds). Suite : spec 014 Phase 2 (modes de permission, T009).
**Branche :** main
**Commits pushes :** 21

### [2026-10-06 18:40] FEAT — spec 014 T009 : mode de permission par conversation, défaut réglable, avertissement Libre
**Fichiers :** `ConversationService` (`setPermissionMode`, `permissionModeOf`, `endTurn`, `restartAfterTurn`, `BYPASS_WARNING`) ; `PermissionService.modeChanged` ; `PermissionRepository` + `schemaNeurons` (décision `mode`) ; `AppSettingsRepository` (`chat.defaultPermissionMode`) ; `shared/ipc/app.ts`, `shared/ipc/chat.ts` (`DEFAULT_PERMISSION_MODES`, `ChatView.permissionMode`) ; IPC `chat:setPermissionMode`, `app:setSettings` ; `bootstrap.ts` ; spec 014 D8, contrat. Tests : service (+4), permissions (+1), réglages (+1), `app-handlers` (+1 cas), `chat-handlers` (nouveau). 1006 tests.
**Quoi :** chaque conversation garde son mode (Demander, Accepter les modifications, Libre) ; sans choix, elle suit le défaut réglé (Demander). Passer en Libre renvoie `CONFIRM_REQUIRED` avec l'avertissement tant qu'il n'a pas été confirmé pour cette conversation ; la confirmation est datée (`chat_bypass_confirmed_at`). Un changement pendant un tour est enregistré aussitôt et le processus repart à la fin du tour (session reprise, nouveaux arguments) ; hors tour, il repart tout de suite. Chaque changement de mode est tracé dans `permission_log`.
**Pourquoi ainsi :** le défaut ne peut pas être Libre (D8) : sinon chaque nouvelle conversation contournerait l'avertissement exigé par FR-006. Pas de refus `BUSY` pendant un tour (US2 #4 : « au plus tard au message suivant ») : on réutilise le circuit du changement de modèle (arrêt puis `--resume`) au lieu d'un contrôle non documenté du flux. Le réglage par défaut passe par les réglages de l'app (même canal validé par Zod) plutôt que par un canal de plus.
**À noter :** `prettier --check` signale `canvas/nodes/PlanNode.tsx`, déjà commité ainsi (hors T009, non touché).

### [2026-10-06 19:30] DOCS — brainstorm « Reprendre un projet existant » (niveaux 1 à 4) et export
**Fichiers :** `docs/brainstorm/L1f-reprise-projet.md`, `L2-reprise-{import, analyse, explorateur, guide, diagnostic, pont-carte}.md`, `L3-reprise-{import, analyse, explorateur, diagnostic}.md`, `L4d-reprise.md` ; `docs/FOUNDATION.md` (§000) ; `CLAUDE.md` (ligne d'évolution).
**Quoi :** le chemin inverse de l'entonnoir : importer un projet écrit par d'autres (dossier ou `git clone`), l'analyser sans l'exécuter (TS, C#, PHP), le parcourir dans un explorateur à 4 niveaux (modules → code), lire un guide de reprise écrit pour un dev junior (analogies), puis juger chaque partie (solide, intouchable, fragile, améliorable, point d'extension, sans signal) et l'envoyer vers la carte de structure pour y travailler. Neuf arbitrages (A1–A9) ; découpage MVP 1 Voir → MVP 2 Juger → v2 Suivre → v3 Observer.
**Pourquoi ainsi :** statique d'abord (faisable sur un projet qu'on ne sait pas encore lancer) ; une seule mécanique d'analyse (`web-tree-sitter`, WASM) pour trois langages ; confidentialité choisie par projet (code d'un employeur) avec une garde unique avant tout envoi à Claude ; React Flow conservé grâce à l'agrégation dans le main (≤ 150 nœuds affichés) ; noms d'auteurs git jamais stockés. Le brainstorm Gemini « AuraTrace » et son image ont servi d'inspiration (catégories d'appels, zoom à 4 niveaux, direction visuelle en v3).

### [2026-10-06 19:20] FEAT — spec 014 T010 : sélecteur de mode dans le chat, réglage du mode par défaut
**Fichiers :** `chat/ChatPanel.tsx` (`MODE_LABELS`, sélecteur de mode, `BypassWarning`, annonce « appliqué au prochain message ») ; `chat/useChat.ts` (`permissionMode`, `confirmingBypass`, `modeAppliesNext`, `setPermissionMode`, `cancelBypass`) ; `pages/settings/claude/ClaudeCodeSettings.tsx` (section « Mode des nouvelles conversations ») ; `shared/ipc/chat.ts` (`BYPASS_WARNING` partagé main / interface). Tests : `renderer/chat-panel` (+4, axe), `renderer/claude-code-settings` (nouveau, axe), `renderer/map-primitives` (fournisseur de requêtes). 1012 tests.
**Quoi :** l'en-tête du chat affiche en permanence le mode de la conversation (Demander, Accepter les modifications, ⚠ Libre) ; Libre se distingue par une bordure et un texte rouges et un pictogramme. Choisir Libre la première fois ouvre un avertissement dans le chat (« Passer en Libre » / « Annuler ») : rien ne change avant la confirmation. Un changement pendant que Claude répond est annoncé (« appliqué à partir de ton prochain message »). Réglages › Claude Code : choix du mode des nouvelles conversations, Demander ou Accepter les modifications (D8 : jamais Libre).
**Pourquoi ainsi :** le texte de l'avertissement est une constante partagée, affichée par l'interface (jamais le message d'erreur brut) ; le sélecteur reste un `<select>` étiqueté, comme celui du modèle (cohérence, clavier) ; l'avertissement est une section titrée dans le chat plutôt qu'une modale (même forme que les cartes de permission).
**Erreur corrigée :** le test existant de Réglages › Claude Code rendait la page sans `QueryClientProvider` ; la page lit désormais les réglages de l'app → test enveloppé comme dans l'app.

### [2026-10-06 19:40] DOCS — test guidé validé : spec 014 T011 (modes de permission)
**Quoi :** mentalyas valide le quickstart §2 : Accepter les modifications (écriture sans carte, commande avec carte), avertissement Libre (annuler / confirmer, une fois par conversation), changement pendant un tour appliqué au message suivant, mode retenu après redémarrage, mode par défaut des nouvelles conversations. Suite : spec 014 Phase 3 (T012, hook `PreToolUse` et livrable des actions finales).

### [2026-10-06 21:30] FEAT — spec 014 T012 : livrable reconstitué par un hook avant écriture
**Fichiers :** `domain/conversation/hookSettings.ts` (nouveau, `bashQuote`, `hookSettings`) ; `shared/mcp/hook.ts` (nouveau, `parseHookInput`, `WRITE_TOOLS`) ; `shared/mcp/tools.ts` (outil interne `ecriture_avant`, `MCP_PUBLIC_TOOL_NAMES`) ; `mcp-relay/relay.ts` (mode `--hook <neurone>`) ; `application/finals/DeliverableTracker.ts` (nouveau) ; `ExecutionService.recordWrite` (extrait de `apply`) ; `ConversationService` (`--settings`, `onToolResult`) ; `toolHandler`, `MapService`, `bootstrap.ts` ; `research.md` R5 (constat). Tests : `hook-settings` (nouveau), `deliverable-tracker` (nouveau, intégration sur dossier temporaire), `internal-tools` (nouveau), `conversation-service` (+ assertions). 1028 tests ; build OK.
**Quoi :** chaque conversation reçoit par `--settings` un hook `PreToolUse` (Write, Edit, MultiEdit, NotebookEdit) qui lance le relais de l'app en mode hook ; le relais annonce l'écriture au main (`ecriture_avant`), qui lit le contenu d'avant si la conversation est celle d'une action finale acceptée et le fichier sous le dossier du projet lié (hors secrets, binaires, liens qui sortent). Au résultat réussi de l'outil, le fichier est relu et rejoint le livrable (contenu d'avant la première écriture gardé), la trace de l'exécution en cours et l'Historique (annulable) — pendant l'exécution comme dans les échanges qui suivent (D6).
**Pourquoi ainsi :** deux sondes réelles du CLI (Haiku, dossier temporaire) avant de coder : hook chargé malgré `--setting-sources ""`, Git Bash, environnement hérité, `tool_use_id` présent. `ELECTRON_RUN_AS_NODE` posé en préfixe de la seule commande du hook : dans l'environnement de `claude`, toutes ses commandes Bash en hériteraient. Le hook ne bloque jamais (code 0, même app fermée) : le suivi est un constat, la permission reste au mode. L'outil interne n'est pas enregistré par le serveur MCP du relais : Claude ne peut pas fausser l'« avant » d'un fichier.
**Erreur corrigée :** un heredoc bash a mangé les antislashs d'un fichier TypeScript (`replace(/\/g…)`) → fichiers à antislashs écrits avec l'outil d'écriture, pas par le shell.

### [2026-10-06 21:45] REFACTOR — spec 014 T013 : fin de l'outillage confiné de la spec 013
**Fichiers supprimés :** `CommandService`, `CommandRunner`, `CommandRepository`, `domain/finals/commands.ts`, `canvas/CommandsSection.tsx` et leurs tests (`command-runner`, `command-service`, `commands`). **Modifiés :** `shared/mcp/tools.ts` (outils `fichier_ecrire`, `fichier_modifier`, `commande_lancer` retirés, consigne MCP réécrite) ; `FinalTools` (proposer seulement) ; `ExecutionService` (plus de `write` / `modify` / `apply` ni de scripts ; trace des outils une seule fois, écritures laissées au hook) ; `executionBrief` (outils natifs, « cette étape EST l'action finale », bornes réécrites, `EXECUTE_MESSAGE`) ; cadre `frame.ts` (ACTION FINALE) ; `contextBlock` (état de l'action finale et livrable dans le contexte d'une étape, FR-011) ; `ConversationService.finalOf` ; `finalHandlers`, `channels` (`commands:*` retirés) ; livrable sur la carte (`runs` retirés : `DeliverableView`, `CanvasService`, `DeliverableNode`) ; `FinalPanel` ; relais ; `bootstrap.ts`. Tests : `execution-service` réécrit autour de `recordWrite`, `step-context` (+1), `final-tools`, `plan-ghosts`, `plan-layout`. 987 tests ; build OK.
**Quoi :** Claude n'a plus d'outils d'écriture maison ni de scripts à faire approuver : pendant l'exécution d'une action finale comme dans son chat ensuite, il utilise ses outils natifs, selon le mode de permission de la conversation ; le livrable se reconstitue par le hook (T012). Le contexte d'une étape qui est déjà une action finale le dit à Claude (état, livrable actuel) et lui interdit d'en proposer une nouvelle ou de la découper.
**Pourquoi ainsi :** spec 014 D4, R7. Les tables `approved_commands` et `command_runs` restent en base (archive, `down` 0026 intact) ; l'affichage des résultats de scripts sur le livrable est retiré plutôt que laissé toujours vide (code mort). Le fil d'exécution ne trace un outil qu'à son apparition (avant : chaque mise à jour de statut aurait doublé la trace).
**Erreur corrigée :** en découpant `toolHandler.ts` entre deux bornes, le cas `permission_demander` placé entre elles avait été emporté → restauré avant les tests (le typecheck l'a signalé).

### [2026-10-06 22:05] FEAT — spec 017 : spec, plan, tâches ; T001 constitution 4.1.0 ; T002 moteur d'analyse syntaxique
**Fichiers :** `specs/017-reprise-voir/` (spec, plan, research, data-model, contracts, quickstart, tasks, checklist) ; `.specify/memory/constitution.md` (4.1.0) ; `package.json` / `package-lock.json` (`@vscode/tree-sitter-wasm` 0.3.1 épinglé) ; `electron.vite.config.ts` (3e point d'entrée `analysis-worker`, copie du moteur et de 5 grammaires vers `out/main/grammars/`) ; `src/analysis-worker/{engine, worker}.ts` (nouveaux) ; `tsconfig.node.json` ; test `reprise/engine` (nouveau) ; `CLAUDE.md` (spec en cours).
**Quoi :** la reprise de projet passe du brainstorm à Spec Kit (37 tâches, MVP = US1 + US3 + US2). `/speckit-analyze` a trouvé une fuite possible d'un projet « Local uniquement » par le pont MCP (un Claude externe peut lire documents et nœuds : `conversationTarget` ne restreint pas une session sans neurone) → T008 et T035 étendus aux outils de lecture du pont ; 7 précisions MEDIUM appliquées. Constitution 4.1.0 (validée) : git autorisé (régularise la spec 016), Ollama à la place de Claude pour un projet local, nouvelle dépendance. Le moteur charge les grammaires TS, TSX, JS, C#, PHP et retrouve les appels sur des extraits des trois langages.
**Pourquoi ainsi :** `@vscode/tree-sitter-wasm` (MIT, Microsoft) plutôt que les paquets de grammaires séparés : ceux-ci compilent du code natif à l'installation (`node-gyp-build`) et leurs WASM ne sont pas garantis compatibles avec le moteur ; un seul paquet, sans dépendance ni script d'installation. Le moteur UMD est chargé depuis son dossier (`createRequire`), pas embarqué dans le bundle ; seuls 7 fichiers (≈ 9 Mo) sont copiés dans le build.
**À noter :** `npm audit` signale désormais 14 alertes (12 modérées, 2 élevées) au lieu des 4 connues — aucune ne vient du nouveau paquet (sans dépendance ; +7 lignes au lockfile) : nouveaux avis sur la chaîne de build et de dev existante (`electron-builder`, `@electron/get`, `drizzle-kit`/`esbuild`, `source-map-js`, `http-cache-semantics`). À traiter à part.

### [2026-10-06 22:20] TEST — spec 017 T003 : projets de démonstration fictifs
**Fichiers :** `tests/fixtures/reprise/{README.md, ts-app, cs-app, laravel-app, hostile-app}` (30 fichiers) ; exclusions dans `tsconfig.node.json`, `eslint.config`, `.prettierignore`.
**Quoi :** quatre petits projets fictifs pour tester l'analyse : TypeScript (alias `@core/*`, contrôleur / service / dépôt / logger, fichier volontairement cassé), C# (interface injectée par `AddScoped`, appel `Save()` ambigu entre trois classes), Laravel (PSR-4, routes → contrôleur, modèle Eloquent, service), et un projet piégé (script `postinstall` qui laisserait un témoin, sous-module `ext::`, README et commentaire porteurs de consignes, faux secret dans `appsettings.Production.json`).
**Pourquoi ainsi :** les fichiers que le dépôt public ne peut pas porter (`.env`, hooks, `node_modules`) seront créés par les tests dans une copie temporaire ; les fixtures sont exclues du typecheck, du lint et de Prettier, car elles doivent rester telles quelles (le fichier cassé compris).

### [2026-10-06 22:45] FEAT — spec 017 phase 2 (T004–T008) : base, dépôts, contrats, filtre des fichiers, garde de confidentialité
**Fichiers :** `db/schemaReprise.ts` (nouveau, 10 tables `code_*`), migration `0028_reprise_projet` + `down` écrit à la main, `client.ts`, `drizzle.config.ts` ; `RepriseRepository`, `CodeGraphRepository` (nouveaux) ; `shared/ipc/reprise.ts` (nouveau) ; `domain/reprise/fileFilter.ts`, `domain/reprise/maskLocal.ts` (nouveaux) ; `domain/finals/projectPath.ts` (`isSecretFileName`, `isBinaryFileName` exportés) ; `application/reprise/ConfidentialityGuard.ts` (nouveau) ; `ConversationService` (`claudeAllowed`) ; `bootstrap.ts`. Tests : `migrations` (+1), `reprise/repositories` (8), `reprise/file-filter`, `reprise/confidentiality`, `conversation-service` (+1).
**Quoi :** le socle de la reprise de projet. Le graphe du code s'écrit par lots en transaction (un fichier réécrit remplace ses symboles ; 450 fichiers d'un coup testés). Le filtre classe chaque fichier : sensible (`.env`, clés, `appsettings.*.json`, `web.config`… jamais lu), ignoré (dépendances, compilation, binaires, `.gitignore` simple), trop gros, ou retenu avec son langage. La garde de confidentialité refuse toute conversation avec Claude sur un projet « Local uniquement » (genesis, éléments, étapes) et, sur le pont MCP, refuse les outils qui visent ce projet — y compris pour une session Claude Code externe — et masque le projet dans les vues de la carte (titre neutre, ni description, ni fiche, ni éléments, étapes, documents, livrables).
**Pourquoi ainsi :** le pont était le trou trouvé par `/speckit-analyze` : `conversationTarget` ne restreint pas une session sans neurone. Plutôt que de modifier chaque outil, deux points uniques : l'enveloppe `guardTools` (cibles `id`, `projet`, `document` et appelant) et le masquage de la vue de la carte, d'où partent `etat`, `carte_lire`, `selection_lire` et `noeud_lire`. Les canaux IPC de la reprise rejoindront `channels.ts` avec leurs gestionnaires (règle du fichier).
**Erreur corrigée :** le test aller-retour découpe le `down` sur les `;` — un point-virgule dans le commentaire de tête cassait l'annulation → commentaire reformulé (à retenir pour les prochains `down`).

### [2026-10-06 23:00] CHORE — `npm audit` : 14 alertes → 0, sans rétrogradation
**Fichiers :** `package.json` (`overrides`), `package-lock.json`, `CLAUDE.md` (note `npm audit`).
**Quoi :** un agent, dans une copie isolée du dépôt, a analysé les 14 alertes : aucune ne touchait le code livré (packaging `electron-builder`, dev `drizzle-kit`, build et tests `vite` / `tailwind` / `jsdom`). Correctifs : `http-cache-semantics` 4.3.0 et `source-map-js` 1.2.2 dans leurs plages ; `overrides` `@esbuild-kit/core-utils > esbuild ^0.25.12` (ancien esbuild d'une dépendance morte de drizzle-kit, 23 paquets en moins) et `global-agent ^4.1.3` (version majeure, utilisée seulement au packaging derrière un proxy). Vérifié : typecheck, lint, 1017 tests, build, `drizzle-kit check`, relais du pont en mode hook.
**Pourquoi ainsi :** jamais `npm audit fix --force`, qui rétrograderait drizzle-kit 0.31 → 0.18. L'override `global-agent` se retire d'une ligne si un packaging derrière un proxy échoue (8 alertes modérées de packaging reviendraient).
**Erreur corrigée :** `npm ci` a échoué sur `electron.exe` verrouillé (relais MCP ou app en cours) après avoir vidé `node_modules` → reconstruit par `npm install` puis `node node_modules/electron/install.js` (règle notée dans `CLAUDE.md`).

### [2026-10-06 23:30] FEAT — spec 017 US1 (T009–T011) : reprendre un projet depuis un dossier, confidentialité
**Fichiers :** `infrastructure/reprise/ProjectScanner.ts` (nouveau, parcours itératif sans suivre les liens) ; `application/reprise/RepriseService.ts` (nouveau) ; `ConfidentialityGuard.projectOf` ; `ConversationRepository.linkedFolders` ; `domain/reprise/fileFilter.ts` (`.gitignore` : dossiers) ; IPC `src/main/ipc/repriseHandlers.ts` (`reprise:previewFolder`, `create`, `get`, `setConfidentiality`) + `channels.ts` ; `ChatView.reprise`, `ConversationService.repriseOf` ; interface : `reprise/ImportWizard.tsx`, `reprise/ConfidentialityBadge.tsx` (nouveaux), bouton « Reprendre un projet existant » (`CanvasToolbar`), `IdeasCanvas`, `ChatPanel` / `useChat` (badge, conversation bloquée en local). Tests : `reprise-service` (9, copie du projet Laravel avec `.env`, `vendor/`, `.gitignore`), `reprise-handlers`, `import-wizard` (4, axe), `chat-panel` (+3, axe). 1041 tests ; build OK.
**Quoi :** « Reprendre un projet existant » ouvre un assistant : dossier au sélecteur natif → aperçu (langages, fichiers retenus / ignorés / sensibles, git) → confidentialité sans valeur présélectionnée → « Importer ». Un genesis portant le nom du dossier est créé et lié à son dossier source. Le chat du genesis montre le badge 🔒 « Local uniquement » / ☁ « Claude autorisé » : passer à Claude demande confirmation, revenir en local est immédiat avec un rappel. En local, la saisie et les boutons qui écrivent à Claude sont remplacés par l'explication.
**Pourquoi ainsi :** le chemin reste dans le main (`previewId` éphémère de 15 min) ; dossier de données de l'app refusé dans les deux sens (parent ou enfant) ; un dossier déjà lié à **n'importe quel** neurone est détecté par chemin réel, casse ignorée (FR-007) ; projet de plus de 20 000 fichiers retenus refusé (choisir un sous-dossier). Le toast dit seulement « Projet importé » : l'analyse arrive en T017.

### [2026-10-06 23:45] DOCS — test guidé validé : spec 017 T012 (import d'un dossier, confidentialité)
**Quoi :** mentalyas valide le quickstart §1 : aperçu du projet Laravel fictif (fichier sensible ignoré), « Importer » grisé sans choix de confidentialité, genesis lié à son dossier, badge et conversation bloquée en « Local uniquement », passage à Claude confirmé, retour en local immédiat, dossier déjà lié et dossier de données refusés. Suite : US3, l'analyse (T013–T018).

### [2026-10-07 00:00] FEAT — spec 017 US3 (T013–T018) : analyse statique d'un projet repris
**Fichiers :** `src/analysis-worker/{extract, protocol, process, worker}.ts` (processus d'analyse : extraction par langage, protocole Zod, lots asynchrones annulables) ; `domain/reprise/{modules, resolve, categories, manifests}.ts` (purs) ; `application/reprise/AnalysisService.ts` ; `infrastructure/reprise/AnalysisWorker.ts` (`utilityProcess`) ; `CodeGraphRepository` (`symbol`, `edge`) ; `RepriseService.onCreated` ; IPC `reprise:analyze`, `cancelAnalysis`, `setCategory`, `setTarget` + événements `reprise:analysisProgress`, `analysisDone`, `changed` ; `electron.vite.config.ts` (`package.json` CommonJS dans `grammars/`) ; `bootstrap.ts`. Tests : `extract` (6), `worker-process` (8), `modules` (4), `resolve` (3, listes fermées des liens sûrs des 3 projets), `categories` (13), `analysis-service` (6, vraie base), `reprise-handlers` (+1) ; `tests/support/reprise.ts`. 1082 tests ; build OK ; processus réel vérifié dans Electron.
**Quoi :** à l'import (et sur demande), le projet est lu sans être exécuté : un processus séparé extrait de chaque fichier TS / JS, C# ou PHP ses symboles, imports, appels, routes Laravel et injections C# ; le main détecte les modules, résout les liens (sûr quand le code le dit sans ambiguïté — import, même classe, champ typé, interface à une seule implémentation, appel statique —, incertain sinon, avec ses candidats), range chaque élément (métier, orchestration, infrastructure, plomberie) et écrit le graphe d'un bloc. Identifiants stables (positions et corrections survivent aux réanalyses) ; seules les extractions des fichiers modifiés sont refaites dans la session ; corrections de mentalyas réappliquées ; analyse annulée ou en échec → graphe précédent intact.
**Pourquoi ainsi :** listes fermées des liens sûrs attendus sur les projets de démonstration (SC-006) : aucune déduction présentée comme sûre (`store.Save()` reste incertain entre 4 candidats). Un appel sans candidat dans le projet (bibliothèque, framework) n'est pas retenu, pour ne pas noyer la carte. Le traitement des lots rend la main entre deux fichiers, sinon l'annulation n'arriverait jamais.
**Erreur corrigée :** le vrai processus Electron échouait au chargement (`initError`) alors que les tests passaient : le dépôt est en `"type": "module"`, donc `grammars/tree-sitter.js` (CommonJS / UMD) était lu comme ESM ; les tests le lisaient depuis `node_modules` (sans ce type) → le build dépose `{ "type": "commonjs" }` dans `grammars/`. Règle : tester le processus compilé dans Electron, pas seulement le code sous Node.

### [2026-10-07 00:25] FEAT — spec 017 US2 (T019–T022) : l'explorateur à 4 niveaux
**Fichiers :** `domain/reprise/{aggregate, layout}.ts` (purs : arbre modules → dossiers → fichiers → symboles, appels regroupés sur l'enfant visible, filtres, isolement, plafond de 150, colonnes par catégorie ordonnées par barycentre) ; `application/reprise/ExplorerService.ts` (cache vidé à chaque analyse ou correction, détail appelants / appelés, extrait sous la racine hors fichiers sensibles, recherche, positions, état retenu) ; IPC `src/main/ipc/explorerHandlers.ts` (`explorer:*`) + `channels.ts` ; `bootstrap.ts` ; interface : `explorer/{ExplorerPage, NodePanel, CodeExcerpt, ExplorerList, useExplorer, labels}`, `lib/Highlighted.tsx` (sorti de `FileViewer`), `uiStore` (`explorerGenesisId`), `AppShell`, « Ouvrir l'explorateur » dans le chat d'un projet repris. Tests : `aggregate` (7), `explorer-service` (5, dont 5 000 fichiers / 50 000 liens < 1 s), `explorer-handlers` (7), `explorer-page` (5, axe). 1106 tests ; build OK.
**Quoi :** l'explorateur s'ouvre en plein écran depuis le chat du genesis : carte (62 %) et panneau de l'élément choisi (38 %). Fil d'Ariane, indicateur « Zoom 1 Modules · 2 Dossiers · 3 Fichiers · 4 Code », double-clic ou zoom très près pour entrer, zoom très loin pour remonter. Flèches dont l'épaisseur dit le nombre d'appels et le trait la fiabilité (plein / tirets / pointillés). Plomberie masquée par défaut avec compteur ; filtres par catégorie, langage, liens incertains ; recherche ; « Isoler » ; vue liste équivalente au clavier. Panneau : catégorie et son origine (corrigeable), qui l'appelle, ce qu'il appelle, code en lecture seule coloré. Analyse lancée / annulée depuis l'en-tête, avec sa progression.
**Pourquoi ainsi :** React Flow gardé (le regroupement dans le main limite l'affichage à 150 nœuds) ; mesure de volume sous la seconde, plan B WebGL inutile. Le module « (racine) » qui ne contient que du code de premier niveau (`Program.cs`) prend la catégorie de ses fichiers (sinon il passait pour « métier »).
**Erreur corrigée :** un test d'interface instable (1 échec sur 3) cherchait la ligne des compteurs avant son rendu → attente explicite (`findByText`), 6 lancements sur 6 réussis.

### [2026-10-07 00:40] FIX — spec 017 (test T023) : dézoom qui ne remontait pas ; suppression d'une idée qui gardait son dossier
**Fichiers :** `spec.md` (D9, D10) ; `explorer/semanticZoom.ts` (nouveau, pur) ; `ExplorerPage` (une carte par niveau, cadrage au montage, zoom d'arrivée relevé au premier geste, bouton « ↑ Niveau au-dessus ») ; `NeuronRepository` (`projectDir`) ; `NeuronService.remove` ; `HistoryRepository` (lien remis à l'annulation, retiré au rétablissement) ; `RepriseRepository.deleteProject` ; `RepriseService` (`isArchived`, ancien projet effacé au ré-import) ; `bootstrap.ts`. Tests : `ui/semantic-zoom` (7), `reprise/removal` (2). 1115 tests.
**Quoi :** (1) dézoomer d'environ 40 % par rapport au cadrage d'arrivée d'un niveau remonte d'un niveau ; zoomer au double ouvre l'élément au centre ; seuls les gestes de mentalyas comptent. (2) Supprimer une idée retire le lien de l'app vers son dossier (« Annuler » le remet) ; un projet repris dont le genesis a été supprimé ne bloque plus un nouvel import du même dossier : ses données d'analyse sont effacées à ce moment-là.
**Erreur corrigée :** seuils de zoom absolus (remonter sous 0,4, ouvrir au-delà de 1,8) alors que chaque niveau est recadré automatiquement, souvent entre 1 et 2,5 : il fallait dézoomer sans fin, et un recadrage pouvait passer pour un geste. Règle : un seuil d'interaction se mesure par rapport à l'état d'arrivée, pas en valeur absolue.


### [2026-10-07 01:10] FEAT — spec 017 US7 (T038–T042) : la carte de Claude, nourrie par l'analyse
**Fichiers :** `application/reprise/ElementFilesService.ts` (nouveau) ; `application/reprise/CodeGraphTools.ts` (nouveau) ; `domain/reprise/measured.ts` (nouveau, pur) ; `ExplorerService.fileCalls` ; `CanvasService` (`measuredLinks`) ; `shared/ipc/{canvas, reprise}.ts` (`MeasuredLinkView`, `ElementFilesView`, `ElementFileView`, `weakestProvenance`) ; `shared/mcp/tools.ts` (`code_graphe_lire`) ; `toolHandler`, `MapService`, `streamEvents` (pastille « graphe du code lu ») ; `frame.ts` ; IPC `structure:files`, `structure:file` (`structureHandlers.ts`, `channels.ts`) ; `bootstrap.ts` ; interface : `chat/ElementFiles.tsx` (nouveau), `lib/CodeLines.tsx` (nouveau, sorti de `CodeExcerpt`), `ChatPanel` (section « Fichiers », lecteur, `MAP_MESSAGE`, explorateur discret), `canvas/{structureGraph, buildGraph, edges/MapLinkEdge, canvas.css}`. Tests : `element-files` (7), `code-graph-tools` (3), `measured` (3), `explorer-service` (+1), `structure-graph` (+1), `explorer-handlers` (+8), `chat-panel` (+3, axe). 1141 tests.
**Quoi :** (A) dans le chat d'un élément de la carte de structure, la section « Fichiers » liste les fichiers couverts par ses chemins (un dossier → ses fichiers, 200 au plus) ; un clic ouvre le fichier en lecture seule, coloré, avec ses symboles et le nombre d'appels venus d'autres fichiers (projet repris analysé) ; un clic sur un symbole y place la vue. (B) Sur la carte, entre deux éléments dont les fichiers s'appellent, un trait gris épais « N appels mesurés · sûr / déduit / incertain », distinct des liens dessinés par Claude, rattaché à l'ancêtre visible. (C) Outil du pont `code_graphe_lire` : modules, points d'entrée, appels sûrs entre fichiers (bornés à 60 / 60 / 300), sur lesquels « Cartographier ce projet » demande à Claude de fonder ses liens. L'explorateur passe en second plan : lien discret, mis en avant seulement en « Local uniquement ».
**Pourquoi ainsi :** retour du test T023 : la carte de Claude est la plus lisible, il lui manquait les fichiers et des liens fondés sur des faits. Un fichier revient à l'élément le plus profond qui le couvre (à égalité, le chemin le plus précis) ; un lien agrégé prend la fiabilité la plus faible de ses appels. Lecture d'un fichier : chemin relatif validé à la frontière (IPC), puis appartenance à l'élément, chemin réel sous la racine, jamais un fichier sensible, 1 Mo au plus. `code_graphe_lire` passe par la garde de confidentialité comme les autres outils (refusé en local, session externe comprise) et ne donne que le nom du dossier, jamais son chemin.
**Erreur corrigée :** deux heredocs bash avaient mangé les `\` (expression du chemin dans `structureHandlers`, données d'un test) : lint et test l'ont signalé → réécrits avec l'outil d'édition, cas de chemins Windows (`\serveur`, `src\..\..`) ajoutés aux tests. Règle déjà notée, rappelée : jamais de heredoc pour du code contenant des barres obliques inverses.

### [2026-10-07 01:30] DOCS — test guidé validé : spec 017 T043 (US7)
**Quoi :** mentalyas valide la carte combinée (fichiers des éléments, appels mesurés, `code_graphe_lire`). Retour suivant : la carte d'un gros projet est une longue colonne, les liens se croisent en tous sens → demande d'une disposition plus hiérarchisée et organisée.

### [2026-10-07 02:00] FEAT — spec 017 (T044–T046) : carte de structure aérée, liens selon le focus
**Fichiers :** `spec.md` (D14 révisée, D15, FR-035, FR-036, scénarios 5–6 d'US7) ; `tasks.md` (T044–T047) ; `canvas/structureGraph.ts` (espacement `SPACING`, `focusEdges`, liens au repos agrégés au niveau 1) ; `canvas/buildGraph.ts` (`structureFlowEdge`) ; `edges/{useCenter, BranchEdge, MapLinkEdge}` (un lien s'arrête au bord d'un élément) ; `IdeasCanvas` (focus survolé / ouvert) ; `canvas.css`. Tests : `structure-graph` (10). 
**Quoi :** retour du test T043 (carte d'un gros projet serrée, liens emmêlés). L'arbre en colonnes reste, aéré : colonnes espacées de 140 px (72 avant), 40 px entre nœuds (20 avant), et 120 px de plus entre les sous-arbres de deux modules de niveau 1. Au repos, seuls les liens entre modules de niveau 1 s'affichent, agrégés ; survoler ou ouvrir un élément montre ses propres liens et ceux de son contenu, épaissis, et estompe les autres.
**Erreur corrigée :** une première version en cadres imbriqués (grilles dans des cadres) a été écartée par mentalyas avant tout commit : il veut garder l'aspect d'arbre hiérarchique, seulement plus d'air. Règle : pour un retour visuel (« plus organisé »), proposer d'abord le changement minimal qui garde la forme connue, avant une refonte.

### [2026-10-07 02:30] DOCS — test guidé validé : spec 017 T047 ; réimport de PID vérifié
**Quoi :** mentalyas valide la carte aérée et les liens selon le focus. Diagnostic en lecture seule de son profil : le genesis « PID » supprimé avant le correctif D9 est archivé mais garde son lien vers le dossier et sa fiche de projet repris ; le code actuel les ignore (test de non-régression ajouté dans `removal.test.ts`). Traces laissées en place : les effacer casserait l'annulation de l'ancienne suppression.

### [2026-10-07 09:20] FEAT — spec 017 US4 (T024) : tâche `reprise_guide` de la passerelle IA
**Fichiers :** `domain/ai/{types, routing}.ts` (`reprise_guide`, `timeoutFor`, `contextTokensFor`) ; `application/ai/AIProvider.ts` (`timeoutMs`, `contextTokens`) ; `application/ai/AIGateway.ts` (`localOnly`) ; `application/ai/ContextAssembler.ts` (cadres propres : widget, guide) ; `application/ai/RepriseGuideTask.ts` (nouveau : `buildGuideInput`, `runRepriseGuide`) ; `infrastructure/ai/RepriseGuideFrame.ts` (nouveau) ; `infrastructure/ai/{OllamaProvider, ClaudeCliProvider}.ts` ; `shared/ai/schemas.ts` (`GuideOut`, `GUIDE_SECTION_IDS`, `GUIDE_SECTION_TITLES`) ; `contracts/interfaces.md`. Tests : `reprise-guide` (10), `providers` (+1), `claude-cli-provider` (+1). 1158 tests.
**Quoi :** la passerelle sait produire un guide de reprise : 9 sections fixes, chacune avec une `analogy` obligatoire (D6), son Markdown et ses sources, plus un résumé-analogie par module. Entrée bornée à 40 000 caractères, dans l'ordre d'utilité (modules, points d'entrée, README, configurations, puis l'arborescence dans la place restante, chemins omis comptés). Cadre figé propre, sans profil ni exemples ; le contenu du projet reste une donnée balisée (README piégé testé). Claude par défaut ; `localOnly` impose Ollama, sans repli vers Claude ni file d'attente : IA locale arrêtée → `AI_UNAVAILABLE`.
**Pourquoi ainsi :** le `SYSTEM_FRAME` du brainstorm refuse les longs textes rédigés : le guide a donc son propre cadre, comme les widgets. Les titres des sections viennent de l'app (pas du modèle) : l'interface (T026) et la vérification des sources (T025) s'appuient sur des `id` stables. Ollama tronque sans erreur une entrée qui dépasse sa fenêtre par défaut : `num_ctx` 32 768 demandé pour cette seule tâche ; délai de 10 min (au lieu de 2 min pour Ollama, 4 min pour Claude).
**Erreur corrigée :** des scripts Python (`write_text`) avaient réécrit des fichiers en CRLF : Prettier les a signalés → `prettier --write` sur les seuls fichiers touchés. Constat hors périmètre : le test de performance `explorer-service` (5 000 fichiers) dépasse 5 s quand toute la suite tourne en parallèle, il passe seul (3,4 s).

### [2026-10-07 09:33] FEAT — spec 017 US4 (T025) : `GuideService`, le guide de reprise devient un document du genesis
**Fichiers :** `application/reprise/GuideService.ts` (nouveau) ; `domain/reprise/guideSources.ts` (nouveau, pur) ; `infrastructure/reprise/projectText.ts` (nouveau) ; `schemaReprise.ts` + migration `0029_reprise_guide` (+ down) : `code_projects.guide_document_id` ; `RepriseRepository.setGuideDocument` ; IPC `reprise:guide` (`repriseHandlers`, `channels`) ; `bootstrap.ts` (service, guide après la première analyse, documents d'un projet repris dans le profil) ; `data-model.md`. Tests : `guide-service` (5, projets fictifs C# et « hostile »), `guide-sources` (3), `reprise-handlers` (+1), `migrations` (down 0029). 1167 tests.
**Quoi :** `reprise:guide` (et la fin de la première analyse) rédige le guide : contexte tiré du graphe (modules, points d'entrée, fichiers), du README le moins profond, des manifestes et de `docs/*.md`, jamais d'un fichier sensible ; Claude ou le modèle local selon la garde de confidentialité ; chaque source citée est vérifiée contre le projet analysé (fichier, dossier, clé de module, `fichier#symbole`), les autres sont retirées et signalées dans la section ; une section vide dit « Non trouvé dans le projet » ; bandeau « rédigé par le modèle local, qualité moindre » ; résumés-analogies des modules connus enregistrés ; document « Guide de reprise » créé puis versionné à chaque régénération (annulable, annoncé sur la carte) ; run `guide` journalisé avec des nombres seulement.
**Pourquoi ainsi :** un lien `guide_document_id` plutôt qu'une recherche par titre (mentalyas peut renommer le document). Lecture d'un fichier du projet : chemin réel sous la racine réelle, 256 Ko au plus, pas de binaire. Le guide est un document de l'app, signé « par Claude » comme les écritures du pont (l'auteur des versions n'a pas de valeur « modèle local » : le bandeau le dit dans le texte).
**Erreur corrigée :** (1) faille FR-030 trouvée en lisant `DocumentFiles` : le genesis d'un projet repris est lié à son dossier, donc tout document (guide, ou `document_ecrire` de Claude) s'écrivait dans `<projet>/docs/brainstormer/` — dans le projet de l'employeur. Corrigé à la composition : pas de dossier de documents pour un projet repris, tout va dans le profil. (2) Un `;` dans le commentaire du script `down` coupait la requête (le test des migrations découpe sur `;`) → reformulé. Règle : jamais de `;` dans les commentaires d'un `down.sql`.

### [2026-10-07 10:05] FEAT — spec 017 US4 (T026) : le guide dans l'explorateur, noms cités cliquables
**Fichiers :** `explorer/GuidePanel.tsx` (nouveau) ; `explorer/ExplorerPage.tsx` (onglets « Élément » / « Guide de reprise » du panneau de droite, cadrage d'un élément cité) ; `chat/Markdown.tsx` (`inlineCode` : rendu propre d'un code en ligne) ; `ExplorerService.locate` + IPC `explorer:locate` ; `domain/reprise/guideSources.ts` (`parseSource`, partagé avec la vérification des sources) ; `RepriseProjectView.guide` (`RepriseService`, `bootstrap`) ; `GuideService` (annonce le début et la fin de la rédaction). Tests : `explorer-page` (+2, axe), `explorer-service` (+1), `explorer-handlers` (+1). 1171 tests.
**Quoi :** dans l'explorateur d'un projet repris, l'onglet « Guide de reprise » affiche le document du genesis ; il s'ouvre de lui-même quand le guide vient d'exister (après la première analyse). Chaque code en ligne du guide qui désigne un élément du projet (fichier, dossier, module, `fichier#symbole`, nom de fonction) devient un lien : l'explorateur ouvre son niveau, le sélectionne et le cadre. Les commandes (`npm start`) et les sources signalées introuvables restent du texte. « Rédiger le guide » / « Régénérer » (désactivé tant que le projet n'est pas analysé), « Rédaction en cours… » pendant la tâche. L'analogie d'un module, produite par le guide, était déjà montrée par `NodePanel` (« En une image ») : test ajouté.
**Pourquoi ainsi :** les liens sont décidés par le main (`explorer:locate`, 100 noms au plus, 300 caractères chacun) avec la même lecture des chemins que la vérification des sources : l'interface ne devine rien, un nom inventé n'est jamais cliquable. Le cadrage (`fitView` sur l'élément) n'a lieu qu'une fois par clic dans le guide, pas à chaque sélection sur la carte.
**Erreur corrigée :** deux heredocs bash ont encore mangé des `\` (expression `/\/g` de `guideSources`, `join('\n')` d'un test) : typecheck et tests l'ont signalé, réécrits avec l'outil d'édition. Règle renforcée : tout texte de code contenant `\` passe par l'outil d'édition, jamais par un script en heredoc.

### [2026-10-07 10:15] DOCS — test guidé validé : spec 017 T027 (US4, guide de reprise)
**Quoi :** mentalyas valide le guide (9 sections avec analogies, liens vers l'explorateur, régénération versionnée, aucun dossier `docs/` créé dans le projet repris). Retour suivant sur l'explorateur : un nœud propre aux modules, les dossiers d'un module avec un onglet « Fichiers » dans le nœud, le code complet d'un fichier dans le volet de droite avec, pour chaque bloc, qui l'appelle et ce qu'il appelle — tout sur un seul écran, sans fenêtres multiples ; le niveau « fonctions » de la carte disparaît (décision D16 à écrire, tâches T048–T053).

### [2026-10-07 10:35] FEAT — spec 017 D16 (T048–T052) : l'explorateur sur un seul écran, du module au code
**Fichiers :** `spec.md` (D16, FR-020 révisée, FR-037, scénario 8 d'US2) ; `tasks.md` (Phase 5 quater) ; `domain/reprise/aggregate.ts` (deux niveaux, nœud « Racine » `r:`, fichiers et sous-dossiers dans chaque nœud, `openableKey`, `placeOf`) ; `domain/reprise/layout.ts` (`FOLDER_ROW_HEIGHT`) ; `ExplorerService` (`file`, lecture sûre factorisée `readLines`, recherche et `locate` qui rendent la place d'un élément, détail d'une « Racine ») ; IPC `explorer:file` (chemin relatif validé), clés `r:` admises ; `shared/ipc/reprise.ts` (`ExplorerFileEntryView`, `ExplorerPlaceView`, `FileCodeView`, `CodeBlockView`, `CodeBlockLinkView`, `ExplorerLinkView.path`) ; interface : `explorer/ExplorerNodes.tsx` (nouveau : nœud module, nœud dossier à onglets), `explorer/FilePanel.tsx` (nouveau : volet de code), `lib/CodeLines.tsx` (en-têtes de bloc, lignes marquées), `ExplorerPage` (onglets Élément / Code / Guide, volet élargi à 50 % pour le code), `ExplorerList` (fichiers par nœud), `NodePanel`, `GuidePanel`, `labels`. Tests : `aggregate` (réécrits + `placeOf`), `explorer-service` (+1 fichier complet, adaptés), `explorer-handlers` (+1), `explorer-page` (réécrits, +1 nœud dossier sur la carte, axe). 1175 tests.
**Quoi :** retour de mentalyas après T027. Niveau 1 : un nœud propre à chaque module. Zoomer dans un module montre ses dossiers ; chaque nœud dossier a deux onglets, « Fichiers » (un clic ouvre le code dans le volet de droite) et « Sous-dossiers » (un clic zoome dedans) ; les fichiers posés directement dans un module ou un dossier ouvert ont un nœud « Racine ». Le volet montre le fichier entier, chaque bloc (classe, fonction, méthode, code de premier niveau) précédé de « ← appelé par » / « → appelle / importe / implémente… » avec la fiabilité, les appels hors du projet comptés, et les lignes d'appel marquées ◀ ; un clic sur un lien ouvre l'autre fichier au bon bloc dans le même volet, et la carte montre son dossier. Le niveau « fonctions » quitte la carte. La correction de catégorie (FR-018), qui passait par un nœud fonction, est dans l'en-tête de chaque bloc. Recherche, guide et liens du panneau mènent au fichier et au bon bloc.
**Pourquoi ainsi :** la carte garde les éléments que l'œil compare (modules, dossiers) et le volet porte la lecture (code) : un seul écran, comme demandé. Les lignes d'appel sont approchées (nom de l'appelé cherché dans le bloc) car la base garde le nombre d'appels, pas leurs lignes — limite écrite dans D16. Le fichier est lu par le main seulement s'il est connu de l'analyse, sous la racine réelle, 1 Mo au plus, jamais sensible ni binaire.
**Erreur corrigée :** le test de performance `explorer-service` (5 000 fichiers) dépassait le délai de 5 s de Vitest pendant sa préparation quand toute la suite tourne : délai du test porté à 20 s, ses mesures restent bornées à 1 s.

### [2026-10-07 10:42] DOCS — test guidé validé : spec 017 T053 (D16, explorateur sur un seul écran)
**Quoi :** mentalyas valide la nouvelle organisation : nœuds de module, dossiers à onglets « Fichiers » / « Sous-dossiers », code complet dans le volet avec appelants et appelés par bloc, navigation d'un fichier à l'autre dans le même volet.

### [2026-10-07 10:52] DOCS — parcours académique (spec 017 US4 et D16, /hub end 7bis, mode auto)
**Fichiers :** `docs/academique/` — créées : `Guide de reprise — contexte borné, sections fixes et sources vérifiées.md`, `Explorateur de code — du module au bloc, appelants et appelés.md`, `Glossaire — Fenêtre de contexte (IA).md`, `Glossaire — Graphe d'appels (appelants et appelés).md` ; étendues (bloc « Évolution du 07/10 ») : `Passerelle IA hybride…`, `Synthèse vérifiée…`, `Fichiers écrits par l'app…` (faille FR-030), `Injection de prompt…` ; MOC (parcours 30 → 31, questions de révision) et canvas (2 nœuds, 2 flèches) mis à jour ; `CLAUDE.md` (dernière mise à jour).
**Points ⚠️ :** code lu, non exécuté. Coût du volet de code ≈ blocs × liens du projet (`ExplorerService.file` parcourt tous les liens pour chaque bloc), noté « Probable ». Les travaux de la nuit (spec 017 US1, US3, US7, D14–D15 : import, analyse tree-sitter, confidentialité, carte de Claude) n'ont pas de note dédiée : aucune trace d'une passe académique précédente dans `docs/academique/` ; résumés dans les introductions des deux nouvelles notes.

### [2026-10-07 10:55] SESSION — End
**Resume :** session ouverte le 2026-10-06 16:30 (fermeture du 07/10 02:40 restée incomplète, reprise le matin). Spec 014 T009–T013 (mode de permission par conversation, hook qui reconstruit le livrable). Brainstorm « Reprendre un projet existant » puis spec 017 « Reprise — Voir » : import d'un dossier avec sa confidentialité, analyse statique tree-sitter (TS/JS, C#, PHP) dans un processus séparé, explorateur, carte combinée et outil `code_graphe_lire`, carte de structure aérée (D14–D15) ; guide de reprise (US4 : tâche `reprise_guide`, `GuideService`, sources vérifiées, document du genesis versionné, liens vers l'explorateur, faille FR-030 corrigée : les documents d'un projet repris vivent dans le profil) ; explorateur sur un seul écran (D16 : nœuds de module, dossiers à onglets, code complet avec appelants / appelés par bloc). Tests guidés T027 et T053 validés. Graphe du projet remis à jour. 1175 tests. Suite : spec 017 US5 (clone git, T028).
**Branche :** main
**Commits pushes :** 20

### [2026-10-07 11:38] FEAT — spec 017 D17 (T054–T058) : carte de structure en disposition alternée, ordre de progression ; FIX compte de fichiers d'un élément
**Fichiers :** `spec.md` (D17, FR-035 révisée, FR-038) ; `tasks.md` (Phase 5 quinquies) ; `shared/mcp/tools.ts` (`ordre` de `structure_dessiner`, description) ; `domain/structure/resolve.ts` (`order`) ; `StructureService` (rang écrit, instantané d'Historique) ; `ElementRepository` (`rank` lu, écrit, `ElementView.order`) ; `HistoryRepository` (rang relu et rétabli) ; `shared/ipc/canvas.ts` (`ElementView.order`) ; `canvas/structureOrder.ts` (nouveau, pur : ordre des frères et numéros) ; `canvas/structureGraph.ts` (disposition alternée, hiérarchie en chemin) ; `buildGraph.ts` + `nodes/ElementNode.tsx` (pastille du numéro, « Étape N » dans le libellé accessible, « N chemins ») ; `chat/ElementFiles.tsx` ; `chat/ChatPanel.tsx` (`MAP_MESSAGE`). Tests : `structure-order` (3), `structure-graph` (réécrits D17), `structure` (+1), `chat-panel` (+3 assertions). 1179 tests.
**Quoi :** demande de mentalyas. Les modules descendent en colonne sous le genesis ; les enfants d'un niveau impair partent en ligne à droite, ceux d'un niveau pair en colonne dessous, chaque sous-arbre dans sa boîte (aucun chevauchement). Entre frères, l'ordre de progression : celui de Claude (`ordre`, demandé par la consigne de cartographie : fondations, données, configuration, puis métier, puis interface), sinon les dépendances (liens `depend_de` / `appelle` / `lit_ecrit` / `implemente` / `teste`, appels mesurés ; `bloque` à l'envers), remontées sur les frères qui les contiennent, sinon l'ordre du dessin. La hiérarchie se lit comme un chemin (parent → premier enfant → frère suivant) et chaque nœud porte son numéro (1, 1.2, 1.2.1). Un rang donné reste quand Claude redessine l'élément sans ordre ; il s'annule avec son lot.
**Erreur corrigée :** (1) bug signalé par mentalyas : un nœud de la carte affichait « 3 fichiers » alors que son volet en listait 37 — le nœud comptait les chemins donnés par Claude (un dossier en couvre beaucoup), le volet les fichiers. Le nœud dit maintenant « N chemins » (liste au survol) et le volet « Fichiers (37) dans N chemins de la carte » ; « · 0 l. » n'apparaît plus pour un fichier sans lignes analysées. (2) Un test annulait un lot plus ancien qu'un autre touchant le même élément : refus de l'Historique, conforme ; le test annule dans l'ordre.

### [2026-10-07 14:59] DOCS — test guidé validé : spec 017 T059 (D17, carte de structure en disposition alternée)
**Quoi :** mentalyas valide la disposition alternée sans chevauchement, les numéros de progression et la lecture en chemin, « N chemins » sur le nœud (liste au survol) et le compte de fichiers du volet.

### [2026-10-07 15:08] DOCS — spec 017 : US5 (clone git) mise en pause
**Quoi :** décision de mentalyas, US5 non prioritaire pour le moment. Note datée dans `tasks.md`, `CLAUDE.md` (Workflows actifs) à jour : reste US6 et les finitions T035–T037.

### [2026-10-07 15:41] DOCS — brainstorm « Analyste interne » (niveaux 1 à 4)
**Fichiers :** `docs/brainstorm/L1g-analyste-interne.md`, `L2-analyste-{sonde,analyse,appliquer,rythme}.md`, `L3-analyste-{sonde,analyse,appliquer}.md`, `L4e-analyste.md`.
**Quoi :** idée de mentalyas : une sonde interne et Claude « Analyste » observent l'app en fonctionnement et l'usage, puis proposent (bugs, tâches IA → code, parcours, code mort, évolutivité) ; une proposition acceptée est codée sur une branche `analyste/*` dans un worktree, vérifiée, puis gardée (fusion, sans push) ou jetée, et annulable (`git revert`). Arbitrages A1–A9 : Brainstormer seul, sonde sans contenu (empreintes HMAC), analyse en lecture seule, carte + boîte, dépôt source seulement, rythme manuel + auto réglable. Amendements de la constitution à écrire : II (commit sur `analyste/*`), IV (tâche avec outils de lecture), I (`npm` pour les vérifications).
**Règle apprise :** une sortie IA n'est fiable que revérifiée par le code (chemins dans le dépôt, clés de preuve existantes) ; le schéma seul ne suffit pas.

### [2026-10-07 15:43] DOCS — export du brainstorm « Analyste interne » (FOUNDATION §0000)
**Fichiers :** `docs/FOUNDATION.md` (§0000, en-tête), `CLAUDE.md` (évolution du 2026-10-07).
**Quoi :** résumé de L1g–L4e (vision, arbitrages A1–A9, lots AN-A à AN-D, spec prévue 019 à confirmer) ; préalable : amendements de la constitution.

### [2026-10-07 15:48] DOCS — constitution 4.1.0 → 4.2.0 (Analyste interne)
**Fichiers :** `.specify/memory/constitution.md`.
**Quoi :** trois ajouts (L1g A9) : I (`npm` limité aux scripts de vérification dans un worktree `analyste/*`), II (branche `analyste/*` créée, commitée, fusionnée sur « Garder » et révocable après acceptation explicite ; jamais de push ni de réécriture), IV (tâche `analyste` : seule tâche automatique avec outils, lecture et recherche dans le dépôt désigné). Aucun retrait.

### [2026-10-07 15:51] DOCS — spec 019 « Analyste interne » (/speckit-specify)
**Fichiers :** `specs/019-analyste-interne/spec.md`, `checklists/requirements.md`, `.specify/feature.json` (spec en cours : 019).
**Quoi :** 9 décisions (D1–D9), 6 user stories (P1 : sonde, analyse, tri ; P2 : appliquer, annuler ; P3 : rythme), 43 exigences, 9 critères de succès ; checklist de qualité validée, aucune clarification ouverte.

### [2026-10-07 15:54] DOCS — spec 019 : plan (/speckit-plan)
**Fichiers :** `specs/019-analyste-interne/{plan,research,data-model,quickstart}.md`, `contracts/interfaces.md`.
**Quoi :** constitution 4.2.0 vérifiée (I–VI ✅, IV sous réserve de la preuve R1) ; aucune dépendance nouvelle ; migration 0030 (4 tables + empreintes sur `ai_calls`) ; 7 lots ; 10 points de recherche (R1 lecture seule bloquante, R5 neurone de mise à jour, R6 worktree + jonction `node_modules`, R7 npm sans shell via `npm-cli.js`, R8 fusion et rechargement à chaud).

### [2026-10-07 15:58] DOCS — spec 019 : tâches (/speckit-tasks)
**Fichiers :** `specs/019-analyste-interne/tasks.md`.
**Quoi :** 43 tâches en 9 phases (T001 constitution déjà faite) ; MVP = US1 + US2 + US3 (observer, analyser, trier) ; T017 preuve R1 bloquante (lecture de %APPDATA% refusée) avec retour de mentalyas ; un test guidé par histoire.

### [2026-10-07 16:08] DOCS — spec 019 : /speckit-analyze et remédiation ; constitution 4.2.1
**Fichiers :** `specs/019-analyste-interne/{analysis-report,spec,research,data-model,quickstart,tasks}.md`, `contracts/interfaces.md`, `.specify/memory/constitution.md`.
**Quoi :** 13 constats (1 CRITICAL, 2 HIGH, 6 MEDIUM, 4 LOW), corrigés après validation : C1 constitution 4.2.1 (npm = programme Node lancé par `node` + `npm-cli.js`, sans shell) ; I1 profil d'essai distinct pour « Essayer » (verrou d'instance unique de `src/main/index.ts`, research R11) ; I2 analyse du dépôt via le genesis qui le lie déjà (pas de réimport `ALREADY_LINKED`) ; U1 écritures sous `node_modules` refusées ; U2 `neurons.hidden` ; G1 `ia_vers_code` exige une preuve de répétition ; G2 revérification du dépôt (R12) ; G3 mesure SC-009 ; refus réversible.
**Règle apprise :** une analyse croisée qui lit aussi le code (verrou d'instance, refus de réimport) trouve des conflits qu'aucun document ne montre seul.

### [2026-10-07 16:09] SESSION — End
**Resume :** spec 017 D17 validée au test guidé (T059) et commitée ; US5 (clone git) mise en pause ; brainstorm complet « Analyste interne » (L1g, L2 ×4, L3 ×3, L4e) exporté en FOUNDATION §0000 ; constitution 4.2.0 puis 4.2.1 (branche `analyste/*`, tâche `analyste` en lecture, npm de vérification) ; spec 019 rédigée, planifiée (10+2 points de recherche, migration 0030), découpée en 43 tâches et analysée (13 constats corrigés).
**Branche :** main
**Commits pushes :** 4

### [2026-10-07 16:48] FEAT — spec 019 lots 1–2 et US1 (T002, T004–T015) : la sonde sans contenu de l’Analyste interne
**Fichiers :** migration `0030_analyste` (+ down) et `schemaAnalyste.ts` (`observations`, `analyses`, `proposals`, `analyst_updates` ; `ai_calls.input_fp/output_fp` ; `neurons.hidden`) ; `shared/analyste/events.ts` (catalogue fermé Zod) ; `shared/ipc/analyste.ts` ; `domain/analyste/fingerprint.ts` (JSON canonique, HMAC-SHA256) ; `application/analyste/RepoGuard.ts` (dépôt source désigné, revérifié chaque heure) et `ProbeService.ts` (file, pseudonymes, rafales, purge) ; `ObservationRepository`, `AnalysteRepository` ; `logger.ts` (`teeSink`) ; `ipc/registry.ts` (mesure de chaque canal) ; `ipc/analysteHandlers.ts` (8 canaux) ; `bootstrap.ts` ; renderer : `analyste/probe.ts` (lots, navigation, erreurs sans message), `useAnalysteStatus.ts`, `labels.ts`, `pages/settings/AnalysteSettings.tsx` + `ObservationsPage.tsx`, entrée Analyste de `AppShell`, 6 actions instrumentées ; exclusions `.analyste/`. Tests : +53 (1232).
**Quoi :** la sonde n’existe que si l’app tourne depuis le dépôt désigné (rien dans l’app installée) ; elle garde écran, action, type d’objet par pseudonyme, type et emplacement d’erreur, durée des canaux ; jamais un texte ni un identifiant réel (test SC-001 sur le profil démo, textes piégés compris). Réglages › Analyste : désigner le dépôt, ce qui est gardé ou jamais gardé, conservation, observations (voir, exporter, effacer avec confirmation).
**Erreur corrigée :** (1) un point-virgule dans un commentaire de la migration d’annulation coupait l’instruction (le test découpe sur `;`) ; (2) `DROP COLUMN` exige de retirer l’index de la colonne d’abord.
**Règle apprise :** une donnée « sans contenu » se prouve par un test qui cherche les vrais textes du profil démo dans tout ce qui est stocké, pas par la relecture du schéma.

### [2026-10-07 16:59] FIX — spec 019 US1 : Réglages › Analyste chargeait sans fin (retour du test T016)
**Erreur corrigée :** les canaux sans paramètre de l'Analyste exigeaient un objet vide alors que l'interface n'envoie rien (convention de l'app : `z.undefined()`) ; la réponse « Données invalides » laissait la page sur « Chargement… ». Canaux alignés, page qui affiche l'erreur au lieu de charger sans fin, tests des canaux appelés comme l'interface les appelle.
**Règle apprise :** tester un canal IPC avec la charge utile exacte qu'envoie l'interface (ici `undefined`), pas avec une valeur « raisonnable » ; et toute vue qui attend une requête doit avoir un état d'erreur.

### [2026-10-07 17:09] DOCS — test guidé validé : spec 019 T016 (US1, sonde)
**Quoi :** après correction, mentalyas confirme que la sonde s'active sur le dépôt désigné et récupère les observations.

### [2026-10-07 17:16] FEAT — spec 017 D18 (T060–T063) : nœuds de la carte de structure selon leur contenu
**Fichiers :** `specs/017-reprise-voir/spec.md` (D18, FR-039), `tasks.md` (Phase 5 sexies) ; `domain/reprise/content.ts` (pur : doc / code) ; `infrastructure/reprise/ProjectFileIndex.ts` (inventaire du dossier gardé 30 s) ; `CanvasService` (`ElementView.content`) ; `bootstrap.ts` ; `shared/ipc/canvas.ts` (`ElementContentView`) ; renderer `canvas/elementContent.ts`, `nodes/ElementNode.tsx` (aspects), `buildGraph.ts` (libellé accessible). Tests : +14 (1247).
**Quoi :** demande de mentalyas, choix validés : aspect « page » + badge « 📄 Doc » pour un élément qui ne couvre que de la documentation (.md, .mdx, .markdown, .txt, .rst, .adoc) ; aspect « éditeur » + badge « </> Code » dès un seul autre fichier, configuration comprise, avec « + N doc » ; calculé par l'app depuis les fichiers du dossier lié (jamais par Claude), fichiers sensibles exclus ; libellé accessible « contient de la documentation / du code ».
**Règle apprise :** pas de nombre de fichiers sur le nœud : le volet compte depuis le graphe analysé, l'inventaire compte aussi la doc ; afficher deux comptes différents recréerait la confusion « 3 fichiers / 37 » corrigée en D17.

### [2026-10-07 17:24] FEAT — spec 017 D18 (lisibilité) et D19 (T065–T066) : nœuds lisibles, état visuel du statut
**Fichiers :** `spec.md` (D18 complétée, D19, FR-040), `tasks.md` (Phase 5 septies) ; `canvas/structureGraph.ts` (`ELEMENT_SIZE` 304 × 144) ; `nodes/ElementNode.tsx` (en-tête sur une ligne, titre et résumé sur deux lignes entières avec texte complet au survol, pied chemins + repli ; pastille, bande et contour du statut) ; `buildGraph.ts` (statut dans le libellé accessible). Tests : +4 (1251).
**Quoi :** retours de mentalyas sur capture : le badge « </> Code » et « 1 chemin » passaient à la ligne, titre et résumé coupés. Puis : distinguer en cours / livrée / bloquée. Statut : pastille couleur + icône + libellé (◐ bleu en cours, ✓ vert livrée/faite, ⛔ rouge bloquée, ○/◇ gris sinon), bande de 4 px à gauche, contour pointillé rouge si bloquée. Titre sans police à chasse fixe (illisible sur les titres longs) ; l’aspect éditeur reste porté par le fond et le badge.
**Règle apprise :** sur un nœud de taille fixe, chaque zone a une hauteur réservée (en-tête, 2 lignes, 2 lignes, pied) et rien ne passe à la ligne sans limite ; le texte complet reste accessible au survol.

### [2026-10-07 18:23] DOCS — test guidé validé : spec 017 T064 et T067 (D18 nœuds selon leur contenu, lisibilité, D19 statut)
**Quoi :** mentalyas : « tout ce qu'on a mis en place sur les nœuds c'est parfait ».

### [2026-10-07 18:45] FEAT — spec 017 D20 (T068–T073) : vue « Architecture » de la carte de structure
**Fichiers :** `spec.md` (D20, FR-041), `tasks.md` (Phase 5 octies) ; `shared/structure/architecture.ts` (pur : Clean, hexagonale, MVVM, MVC, en couches ; profondeurs, déduction par dossiers, violations) ; migration `0031_architecture` (+ down : `neurons.layer`, `layer_source`, `architecture`, `architecture_reason`, `architecture_source`) ; `shared/mcp/tools.ts` (`architecture`, `couche` de `structure_dessiner`) ; `domain/structure/resolve.ts` ; `StructureService` (écriture, priorité de mentalyas, `setArchitecture`, `setLayer`) ; `ElementRepository` (couche affichée ou déduite, architectures) ; `HistoryRepository` / `HistoryService` (entités `element_layer`, `structure_architecture`, type de lot `structure`) ; `structureHandlers.ts` (2 canaux) ; renderer : `structureGraph.ts` (`architectureGraph`, bandes), `buildGraph.ts` (bascule par carte, bandes, barre, libellé « couche … »), `nodes/LayerBandNode.tsx`, `nodes/StructureBarNode.tsx`, `ElementNode.tsx` (puce de couche corrigeable), `MapLinkEdge.tsx` + `canvas.css` (violation rouge), `uiStore.ts`, `ChatPanel.tsx` (consigne de cartographie). Tests : +22 (1273).
**Quoi :** demande de mentalyas : faire ressortir l'architecture du projet sans rien casser. Une bascule « Progression | Architecture » par carte : la vue Progression est intacte ; la vue Architecture range les mêmes nœuds en bandes (de l'extérieur vers le cœur, plus « Non classés ») ; une dépendance d'une couche plus profonde vers une moins profonde est tracée en rouge, libellée « ⚠ sens interdit ». Claude nomme l'architecture et les couches à la cartographie ; l'app déduit les couches manquantes (« déduite ») ; mentalyas corrige l'architecture (barre de la carte) et la couche (puce du nœud), sa correction prime sur Claude et s'annule.
**Erreur corrigée :** (1) les couches de Claude étaient vérifiées contre son architecture même quand mentalyas en avait choisi une autre ; (2) les corrections de mentalyas étaient des lots « modification manuelle », non annulables : nouveau type de lot `structure`.
**Règle apprise :** deux lectures d'une même carte = deux dispositions pures côte à côte, choisies à l'affichage ; ne jamais faire porter deux sens (progression et couches) aux mêmes positions.

### [2026-10-07 19:08] FIX — spec 017 D20 : consigne de cartographie et position de la barre (retour du test T074)
**Erreur corrigée :** (1) la consigne demandait la « couche » de chaque élément sans dire que c'est un simple attribut : Claude a vraisemblablement réorganisé sa carte par couches (éléments à plat, sans statuts ni chemins), d'où la perte de l'alternance, des statuts et des aspects doc/code en vue Progression ; consigne et description de `structure_dessiner` précisent maintenant de garder la hiérarchie par modules, les statuts et les chemins, et de ne jamais créer d'élément par couche. Récupération : annuler le lot de Claude dans l'Historique. (2) La barre de la carte, centrée à 224 px du genesis alors qu'elle fait ~480 px de large, recouvrait le genesis : elle est centrée au-dessus de lui.
**Règle apprise :** une consigne à l'IA qui ajoute une notion doit dire ce qu'elle ne change pas ; sinon l'IA réorganise autour de la nouvelle notion.

### [2026-10-07 19:20] FIX — spec 017 D20 : Claude cartographiait avec `dessiner` au lieu de `structure_dessiner` (retour du test T074, capture)
**Erreur corrigée :** sur le profil normal, Claude (modèle Haiku) a répondu à « Cartographier ce projet » par un cadre « Architecture Clean » rempli de notes (`dessiner`), sans aucun élément de structure : ni vue Progression, ni barre, ni statuts, ni aspects. Cause : la consigne demandait de « reconnaître l'architecture » et les instructions du pont disent de « dessiner les structures dans un cadre titré ». Les instructions du pont (`MCP_INSTRUCTIONS`) et la consigne de cartographie imposent maintenant `structure_dessiner` pour toute cartographie, jamais `dessiner` ni `cadre`, et disent que l'app construit elle-même les deux vues et la bascule.
**Règle apprise :** quand deux consignes de l'IA se recoupent (instructions générales du pont, consigne d'une action), la plus précise doit nommer l'outil à utiliser ET celui à ne pas utiliser.

### [2026-10-07 21:00] FEAT — spec 017 D21 (T075–T078) : avancement vivant des éléments de carte
**Fichiers :** `spec.md` (D21, FR-042), `tasks.md` (Phase 5 nonies) ; migration `0032_element_progress` (+ down : `neurons.progress`, `progress_note`) ; `shared/mcp/tools.ts` (outil `element_avancer`, instructions du pont) ; `toolHandler.ts`, `MapService.ts` ; `StructureService.advance` ; `ElementRepository` (`setProgress`, vues) ; `HistoryRepository` (`element_progress`) ; `conversation/frame.ts` (consigne des conversations d'élément) ; renderer `canvas/progress.ts` (pur), `buildGraph.ts`, `nodes/ElementNode.tsx` (barre + %). Tests : +11 (1284).
**Quoi :** retour de mentalyas (capture) : Claude a fini une tâche dans l'élément 2.2 (tests, commit) mais le nœud restait « en cours ». Claude tient maintenant l'élément de sa conversation à jour avec `element_avancer` (statut, %, reste à faire) à chaque étape, et le passe « livrée, 100 % » une fois fini, sans recartographier ; écriture « par Claude », annulable. Avancement mixte : un parent affiche la moyenne de ses sous-éléments (livrée = 100 %, inconnu = 0), une feuille le % déclaré ; barre bleue (verte à 100 %) au pied du nœud, % dans le pied, reste à faire au survol.
**Règle apprise :** une donnée que l'IA doit tenir à jour a besoin de son propre outil léger et d'une consigne au bon endroit (la conversation de l'élément) ; redessiner toute la carte pour un statut n'arrive jamais.

### [2026-10-07 21:49] SESSION — End
**Resume :** spec 019 US1 (sonde sans contenu de l'Analyste interne) codée et validée ; carte de structure : D18 (nœuds selon leur contenu doc / code), lisibilité, D19 (état visuel du statut), D20 (vue Architecture : bascule, bandes par couche, violations en rouge, corrections annulables), D21 (avancement vivant : outil element_avancer, barre de progression) ; corrections des consignes de cartographie (structure_dessiner seulement, couche = attribut). Test guidé T079 (D21) encore à faire.
**Branche :** main
**Commits pushes :** 4

### [2026-10-07 22:17] FEAT — spec 013 T018 : revue du livrable (accepter, corriger, revenir en arrière)
**Fichiers :** `application/finals/DeliverableService.ts` (nouveau) ; `ipc/finalHandlers.ts` (`deliverable:get|accept|correct|revert`) ; `FinalRepository.ts` ; `HistoryService.ts` (libellés « Livrable accepté », « Livrable : retour en arrière ») ; `shared/ipc/finals.ts`, `channels.ts` ; `bootstrap.ts` ; `specs/013-actions-finales/{tasks.md, contracts/interfaces.md}`. Tests : `deliverable-service.test.ts` (13), `deliverable-ipc.test.ts`.
**Quoi :** codé par Claude dans une conversation du Brainstormer (essai de mentalyas : avancer une tâche depuis la carte), relu ensuite : conforme au contrat — accepter passe l'étape à « fait » (lot annulable) ; corriger relance une passe ; revenir en arrière restaure les fichiers modifiés, met les créés à la corbeille et épargne les fichiers retouchés à la main ; refus pendant une exécution, sans dossier lié, ou déjà accepté.
**Erreur corrigée :** l'entrée de journal manquait (ajoutée à la relecture).

### [2026-10-07 22:17] FEAT — spec 017 D22 (T080) : les fichiers écrits dans la conversation d'un élément rejoignent ses chemins
**Fichiers :** `spec.md` (D22), `tasks.md` (Phase 5 decies) ; `application/finals/DeliverableTracker.ts` (hook d'avant-écriture : chemin seul pour un élément) ; `ElementRepository.addPath` ; `bootstrap.ts` ; `useMainEvents.ts` (`final:changed` rafraîchit la carte). Tests : `element-add-path.test.ts`, `deliverable-tracker.test.ts`.
**Quoi :** codé par Claude dans le Brainstormer après T018, relu ensuite : pendant le travail dans un élément, chaque fichier écrit (dans le dossier lié, hors sensible) rejoint les chemins de l'élément s'il n'est pas déjà couvert, pour que l'aspect doc/code et le volet « Fichiers » suivent le travail. Ajout seulement, non historisé (choix noté dans D22). Décision ajoutée à la spec après coup ; 4 fichiers reformatés (Prettier).
**Règle apprise :** quand Claude code depuis le Brainstormer, la relecture doit vérifier les règles du dépôt qu'il ne voit pas d'office (journal, spec d'abord, Prettier) et séparer ses travaux successifs avant de commiter.

### [2026-10-07 22:38] DOCS — brainstorm « Arbre de skills » (niveaux 1 à 4) et export FOUNDATION §00000
**Fichiers :** `docs/brainstorm/L1h-arbre-de-skills.md`, `L2-skills-{voir,comprendre,evoluer,importer}.md`, `L3-skills-{voir,comprendre,evoluer,importer}.md`, `L4f-skills.md` ; `docs/FOUNDATION.md` (§00000, en-tête) ; `CLAUDE.md` (évolution).
**Quoi :** idée de mentalyas : une page Skills qui montre les skills de Claude en arbre de compétences (nœuds, étoiles, liens), une fiche technique par skill, et un espace pour brainstormer avec Claude sur les skills (modifier, créer, importer depuis GitHub). Arbitrages A1–A9 : trois familles ; qualité notée par Claude (grille) + usage mesuré sans lire les conversations ; liens détectés + proposés ; Claude n'écrit que des brouillons, mentalyas installe (versions, retour arrière) ; import en quarantaine avec audit (tâche sans outil + règles fixes), scripts exclus par défaut ; branches par domaine ; plugins en lecture seule. Spec prévue : 020, après amendement 4.3.0 du principe I.
**Règle apprise :** quand l'IA doit juger un contenu non fiable (skill importé), lui envoyer le texte comme donnée dans une tâche sans outil et doubler son verdict de règles fixes plus sévères : une consigne cachée ne peut ni agir ni adoucir le verdict.

### [2026-10-07 22:41] DOCS — constitution 4.2.1 → 4.3.0 (Arbre de skills)
**Fichiers :** `.specify/memory/constitution.md`.
**Quoi :** un ajout au principe I (L1h A9) : l'app peut écrire dans les dossiers de skills de Claude Code seulement sur « Installer » ou « Revenir », version remplacée sauvegardée ; jamais d'exécutable depuis un brouillon de Claude ; un script d'import seulement s'il est autorisé fichier par fichier, jamais exécuté. Aucun retrait.

### [2026-10-07 22:43] DOCS — spec 020 « Arbre de skills » (/speckit-specify)
**Fichiers :** `specs/020-arbre-de-skills/spec.md`, `checklists/requirements.md`, `.specify/feature.json` (spec en cours : 020).
**Quoi :** 9 décisions (D1–D9), 4 user stories (P1 : voir, comprendre ; P2 : faire évoluer ; P3 : importer), 29 exigences, 7 critères de succès ; checklist de qualité validée, aucune clarification ouverte.

### [2026-10-07 22:47] DOCS — spec 020 : plan et tâches (/speckit-plan, /speckit-tasks)
**Fichiers :** `specs/020-arbre-de-skills/{plan,research,data-model,quickstart,tasks}.md`, `contracts/interfaces.md`.
**Quoi :** constitution 4.3.0 vérifiée (I–VI ✅) ; aucune dépendance (en-tête YAML maison) ; migration 0033 (7 tables) ; 9 points de recherche (R1 : les skills de plugins sont espacés par leur plugin, pas de collision ; R4 usage en worker ; R7 contrôle d'URL et clone de la spec 017 US5 livrés ici ; R8 règles fixes d'audit) ; 34 tâches en 7 phases, MVP = US1 + US2.

### [2026-10-07 22:50] DOCS — spec 020 : /speckit-analyze et remédiation
**Fichiers :** `specs/020-arbre-de-skills/{analysis-report,spec,research,data-model,tasks}.md`.
**Quoi :** 5 constats (0 CRITICAL, 2 HIGH, 2 MEDIUM, 1 LOW), corrigés après validation : H1 conversations Skills sans outil d'écriture ni de commande (sinon le mode « Libre » contournait les brouillons) ; H2 un brouillon d'import retravaillé par Claude perd ses scripts autorisés ; M1 numéro de migration fixé au moment de coder ; M2 mesure SC-006 au test guidé ; L1 FR-008 précisée.
**Règle apprise :** une garantie « Claude ne fait que des brouillons » doit tenir quel que soit le mode de permission : on retire l'outil, on ne compte pas sur le réglage.

### [2026-10-07 23:04] FEAT — spec 019 US2 (T003, T017 code, T018–T023) : l'Analyste analyse et propose
**Fichiers :** fixture fictive `tests/fixtures/analyste/observations-semaine.json` ; domaine pur `domain/analyste/{aggregate,dossier,codeSummary,proposalCheck}.ts` ; `shared/analyste/proposals.ts` (schéma fermé `AnalysteOut`) ; `domain/ai/{types,routing}.ts` (tâche `analyste`, 15 min) ; `infrastructure/ai/AnalysteFrame.ts` (consigne figée) ; `ContextAssembler.ts` (`frameVersionOf`) ; `AIProvider.ts` + `ClaudeCliProvider.ts` (`tools: 'read-only'` + `cwd`, `--max-turns 40`, annulation) ; `AIGateway.ts` (empreintes `input_fp` / `output_fp`, `readOnlyRepo` refusé hors `analyste`) ; `ports.ts`, `AiCallRepository.ts` (empreintes écrites et relues par fenêtre) ; `application/ai/AnalysteTask.ts` ; `application/analyste/{AnalysteService,repoCode}.ts` ; `ObservationRepository` (`between`, `countBetween`), `AnalysteRepository` (analyses, propositions, mémoire, réglages `maxProposals` / `repeatThreshold` / `minEvents`) ; `ipc/analysteHandlers.ts` + `channels.ts` (`analyste:analyze|cancel|analyses|proposals`, événement `analyste:progress`) ; `composition/aiEngine.ts`, `bootstrap.ts` ; renderer `analyste/AnalystePage.tsx`, `labels.ts`, `AppShell.tsx` ; `research.md` R1 (procédure de preuve manuelle), `tasks.md`. Tests : +64 (1376).
**Quoi :** « Analyser maintenant » produit de vraies propositions justifiées. Fenêtre = depuis la dernière analyse réussie ; peu d'observations → `NOT_ENOUGH_DATA` et « Analyser quand même ». Les observations deviennent des agrégats citables (`obs:err:1`, `obs:ia:1`…) avec une phrase lisible et une signature stable ; le dossier balisé et borné (40 000 car., priorité erreurs > lenteurs > IA > parcours > inutilisés) part par la passerelle vers `claude -p` avec `Read Glob Grep` dans le dépôt seulement ; la sortie au schéma fermé est revérifiée (chemins réels dans le dépôt, clés envoyées, preuve obligatoire sauf évolutivité, `ia_vers_code` exige `obs:ia:*`, doublons fusionnés, refus sans fait nouveau écarté, plafond par gravité), puis enregistrée en une transaction. Échec ou annulation : seul le statut est écrit, la même période reste à analyser ; une analyse restée « en cours » est marquée interrompue au démarrage. Page Analyste minimale : bouton, progression, annulation, fiches en lecture (texte jamais interprété).
**Erreur corrigée :** `npx prettier --write src tests` dans un worktree Windows (`core.autocrlf=true`) réécrit en LF les 487 fichiers extraits en CRLF : ils apparaissent modifiés sans aucun changement de contenu. Restaurés (`git restore` sur les fichiers sans différence réelle) ; vérification du format faite avec `--end-of-line auto`.
**Règle apprise :** dans un worktree fraîchement extrait sous Windows, ne lancer Prettier en écriture que sur les fichiers modifiés ; un `prettier --check` qui signale tout le dépôt y vient des fins de ligne, pas du style.

### [2026-10-07 23:12] DOCS — brainstorm « Git et GitHub » : niveaux 2 à 4
**Fichiers :** `docs/brainstorm/L2-git-{depot-local,publier,cloner,historique,conflits,pr-issues,extraire}.md`, `L3-git-{depot-local,publier,cloner,conflits,pr-issues}.md`, `L4g-git.md` ; `L1i-git-github.md` (statut, §8 tranchée, §9 index).
**Quoi :** suite du niveau 1 validé (D1–D7, lots A–G). Niveau 2 pour les 7 lots ; niveau 3 pour A (socle `GitRunner` : profil d'arguments sûrs, verrou par dépôt, configuration locale à risque, tables `git_repos` / `git_operations`), B (publier, tirer, pousser ; contrôle des fichiers sensibles sur toute la plage poussée ; liste blanche `gh` ; **amendement proposé 4.3.0 → 4.4.0** des principes I et II), C (un seul `CloneService` à deux profils, `historique` partiel et `superficiel` de la spec 020 R7), E (blocs depuis l'index, tâche `git_conflict` sans outil, reprise) et F (PR, issues reliées aux nœuds, fork sans `gh pr checkout`) ; niveau 4 : badge du genesis, volet Dépôt à 5 onglets, modales Publier / Pousser, assistant « lien », rediffusion, résolution 62/38. Questions §8 tranchées (proposé) : hooks seulement dans un dépôt de confiance ; clone partiel `--filter=blob:none` sans plafond dur ; dossier parent au sélecteur natif, jamais le profil. MVP A + B + C confirmé, suite réordonnée E, D, F, G. Aucun code, aucune spec modifiée.
**Règle apprise :** quand l'app lance git dans un dépôt qu'elle n'a pas créé, les hooks ne sont pas le seul risque : la configuration locale (`core.fsmonitor`, `core.sshCommand`, filtres, diff externe) peut aussi lancer un programme ; on la neutralise par `-c` et on refuse d'écrire tant qu'elle contient une clé à risque.

### [2026-10-07 23:30] SECURITY — spec 019 T017 : preuve R1 avec le vrai CLI, repli `--disallowedTools`
**Fichiers :** `src/main/infrastructure/ai/ClaudeCliProvider.ts` (`deniedReadDirs`, `denyPattern`, `denyRules`, dépôt dans un dossier protégé refusé) ; `src/main/composition/aiEngine.ts` ; `src/main/bootstrap.ts` (`protectedDirs`) ; tests `tests/unit/analyste/cli-args.test.ts` (+3), `tests/unit/ai/claude-cli-provider.test.ts`, `tests/integration/analyste/analyste-service.test.ts` ; `specs/019-analyste-interne/{research,tasks}.md`.
**Quoi :** la preuve R1 (CLI 2.1.293, fichier canari dans le profil démo) a ÉCHOUÉ : `Read` et `Grep` lisent hors du dossier de travail malgré `--tools "Read Glob Grep"`. Repli appliqué : chaque dossier protégé (profil, `%APPDATA%`, `%LOCALAPPDATA%`, dossiers de secrets du dossier personnel) est interdit aux trois outils par `--disallowedTools` (`Read(//c/…/**)`). Preuve refaite avec les règles produites par le code : lecture du dépôt OK, canari et `~/.claude` refusés par Read, Grep et Glob.
**Erreur corrigée :** deux premiers essais du repli faussés par mon script de test (règles mal construites en shell : `Read(/**)`, puis aucune règle) ; on ne conclut que sur des règles produites par le code de l'app lui-même, et on compte la fuite sur la valeur secrète, pas sur le mot recherché que Claude répète.
**Règle apprise :** pour Claude Code, `--tools` choisit les outils mais ne borne pas les chemins : le dossier de travail n'est pas un bac à sable. Seules les règles de refus (`--disallowedTools` avec chemin absolu `//lecteur/…`) bloquent la lecture, et une preuve doit être faite avec le vrai CLI.

### [2026-10-07 23:31] DOCS — brainstorm « Git et GitHub » : 18 hypothèses validées
**Fichiers :** `docs/brainstorm/L1i-git-github.md` (§8 validée, §10 tableau des hypothèses), `docs/brainstorm/L3-git-publier.md` (liste blanche `gh` et amendement : commentaire de PR).
**Quoi :** mentalyas valide les 18 hypothèses des niveaux 2–4 telles que proposées ; précision H12 (commenter une PR depuis l'app, sur clic) ; ordre après le MVP A + B + C : E, D, F, G.
**Règle apprise :** une hypothèse « voir mais pas écrire » change de nature dès qu'on ajoute « commenter » : toute écriture sur GitHub doit apparaître dans la liste blanche et dans l'amendement, même petite.

### [2026-10-07 23:49] FIX — les 5 premières propositions de l'Analyste, corrigées à la main (spec 019 T024)
**Fichiers :** `domain/reprise/modules.ts` ; `domain/analyste/codeSummary.ts` ; `infrastructure/reprise/ProjectScanner.ts`, `.gitignore` ; `renderer/src/analyste/probe.ts` ; `application/neurons/NeuronService.ts` (`removeMany`), `ipc/neuronHandlers.ts` + `channels.ts` (`neuron:removeMany`), `application/history/HistoryService.ts` (résumés), renderer `canvas/RemoveIdeasDialog.tsx`, `useRemoveIdea.ts` (`useRemoveIdeas`), `IdeasCanvas.tsx` ; `specs/019-analyste-interne/tasks.md` (T024). Tests : +9 (1388).
**Quoi :** test guidé US2 validé ; les 5 propositions de la première vraie analyse, vérifiées exactes, sont corrigées : (1) manifestes de `tests/` / `fixtures/` ignorés par la détection des modules ; (2) le constructeur d'une classe instanciée (`new X`) n'est plus candidat au code mort ; (3) le parcours d'un projet saute tout sous-dossier qui a son propre `.git` (worktree, dépôt imbriqué) et `.claude/worktrees/`, `.kilo/` sont ignorés par git ; (4) la sonde localise un `ErrorEvent` sans objet `error` (`ErrorEvent` + fichier:ligne) et nomme un rejet qui n'est pas une `Error` (`NonError.<type>`), toujours sans message ; (5) sélection multiple (Ctrl / Maj + clic, Maj + glisser) et touche Suppr : une seule confirmation (« Garder » a le focus), un seul lot d'historique (« Suppression de N idées », un seul « Annuler »), une étape refusée dans une suppression groupée.
**Règle apprise :** la première analyse a surtout trouvé du bruit dans ses propres entrées (copie du dépôt, fixtures, constructeurs) : avant de juger un outil d'analyse, nettoyer ce qu'il lit — sinon il analyse ses artefacts.

### [2026-10-07 23:59] FIX — sélection multiple : Ctrl + clic qui ouvrait la conversation, rectangle Ctrl + glisser
**Fichiers :** `src/renderer/src/canvas/IdeasCanvas.tsx`.
**Quoi :** retour de mentalyas « la sélection multiple ne marche pas » : chaque Ctrl + clic ouvrait aussi la conversation de l'idée, ce qui reconstruisait la carte (`setNodes(graph.nodes)`) et effaçait la sélection. Un clic avec Ctrl / Cmd / Maj ne fait plus que sélectionner, et la sélection survit aux reconstructions. Demande de mentalyas : rectangle de sélection « comme sur un bureau » avec Ctrl + glisser dans le vide (`selectionKeyCode`, mode partiel : une idée touchée est prise) ; glisser sans touche déplace toujours la carte.
**Règle apprise :** avec React Flow en nœuds contrôlés, tout `setNodes` qui remplace la liste efface l'état d'interface (`selected`) : le reporter, ou il disparaît à la première reconstruction.

### [2026-10-08 00:20] FIX — Analyste : « jamais utilisé » jugé sur toute la rétention, durées réelles
**Fichiers :** `src/main/domain/analyste/aggregate.ts` (`duration`, `UNUSED_MIN_SPAN_MS`, option `history`) ; `src/main/application/analyste/AnalysteService.ts` ; `tests/unit/analyste/aggregate.test.ts` (+3).
**Quoi :** 6ᵉ proposition de l'Analyste, vérifiée exacte : la fenêtre d'une analyse part de la fin de la précédente (23 minutes ici), mais les faits « jamais ouvert / jamais faite » s'y calculaient et `days()` l'annonçait « sur 1 jour » (plancher). Réglages, Historique, envoi de message… étaient déclarés inutilisés. Désormais ces faits se jugent sur toute la période de rétention, seulement si elle couvre au moins 3 jours d'observations, et toute durée s'écrit dans son unité réelle (minutes, heures, jours).
**Règle apprise :** un fait d'absence (« jamais ») n'a de sens que sur une durée d'observation suffisante et annoncée honnêtement ; un plancher d'arrondi dans une phrase peut transformer un constat en contre-vérité.

### [2026-10-08 00:25] DOCS — export « Git et GitHub » (FOUNDATION §000000) et constitution 4.4.0
**Fichiers :** `docs/FOUNDATION.md` (§000000, en-tête), `CLAUDE.md` (évolution), `.specify/memory/constitution.md` (4.3.0 → 4.4.0), `docs/brainstorm/L3-git-publier.md` (§7 marqué appliqué).
**Quoi :** brainstorm L1i–L4g exporté (vision, décisions D1–D10, lots et ordre MVP A + B + C puis E, D, F, G). Amendement validé : principe I (`gh` en liste blanche, identifiants jamais touchés, hooks seulement dans un dépôt de confiance, configuration d'un dépôt cloné neutralisée) ; principe II (commit, fusion, push, dépôt, fork, PR, commentaire, issue sur clic de mentalyas après affichage ; ni réécriture d'historique, ni forçage, ni `--no-verify`, ni co-auteur, ni push vers la branche par défaut d'autrui ; contrôle bloquant des fichiers sensibles ; données GitHub non fiables). Spec 021 rédigée (plan, tâches et analyse en cours par un agent).
**Règle apprise :** un amendement se limite à ce qu'exige la fonctionnalité et liste explicitement ce qui reste interdit ; c'est la liste des interdits qui protège, pas celle des permissions.

### [2026-10-08 00:40] FIX — spec 017 D21 : un parent livré suit l'avancement de ses sous-éléments
**Fichiers :** `specs/017-reprise-voir/spec.md` (D21 amendée) ; `src/renderer/src/canvas/progress.ts` ; `tests/unit/renderer/element-progress.test.ts` (+2).
**Quoi :** test guidé T079 : passer un élément à 40 % marchait, mais son parent restait à 100 % parce qu'il était marqué livré et que le statut primait sur la moyenne. Désormais un élément qui a des sous-éléments affiche toujours leur moyenne (un sous-élément rouvert fait baisser le parent) ; un parent livré sans information chez ses enfants garde 100 %.
**Règle apprise :** dans un calcul agrégé, la donnée la plus fine (les enfants) doit primer sur l'étiquette posée plus haut, sinon une étiquette périmée masque le travail rouvert.

### [2026-10-08 00:31] FEAT — spec 020 US1 « Voir sa toile de skills » (T003–T010)
**Fichiers :** `src/shared/skills/{model,frontMatter}.ts`, `src/shared/ipc/skills.ts` ; `src/main/domain/skills/{paths,links}.ts` ; `src/main/application/skills/SkillInventory.ts` ; `src/main/ipc/skillsHandlers.ts`, `channels.ts` (`skills:list`, `skills:get`, événement `skills:changed`), `bootstrap.ts`, `NeuronRepository.linkedProjects` ; renderer `skills/{SkillsPage,SkillNodes,SkillPanel,skillTree}`, `AppShell` (entrée Skills), `useMainEvents` ; sonde : écran `skills` ajouté au catalogue ; fixtures fictives `tests/fixtures/skills/` ; tests : front-matter, paths, links, skill-tree, inventaire (dont lien symbolique hostile), canaux, page (axe), navigation clavier. 1416 tests.
**Quoi :** page Skills en lecture seule : inventaire des skills personnels (`~/.claude/skills`), de projet (genesis liés) et de plugins (dernière version de chaque plugin), `SKILL.md` borné à 200 Ko, liens symboliques sortants ignorés, en-tête lu par un analyseur maison sans exécution (abîmé sinon), repère ⚠ scripts, mention « même nom ». Liens « appelle » détectés (`/nom`, « skill nom », hors URL et chemins). Arbre : tronc « Toi », une branche par famille, rangées de 3, grappe des plugins dépliable, filtres et recherche ; fiche (description, repères, appelle / appelé par), `SKILL.md` rendu sans HTML, fichiers. Surveillance des dossiers perso et projets (regroupée 1 s) ; plugins relus à l'ouverture.
**Erreur corrigée :** des barres obliques inverses écrites par un heredoc bash ont été simplifiées (`\` → `\`) et l'outil d'écriture a converti `﻿` en vrai caractère BOM : fichiers avec échappements écrits ou vérifiés via Python. Clics dans React Flow en test : `fireEvent`, pas `userEvent` (d3-zoom lit `event.view`).
**Règle apprise :** une disposition « sans chevauchement » se prouve par un test sur tous les couples de nœuds et plusieurs nombres de branches, pas à l'œil : le pas le long d'une branche horizontale doit dépasser la largeur d'un nœud.

### [2026-10-08 01:30] DOCS — spec 021 : plan, tâches, analyse et remédiation ; constitution 4.4.1
**Fichiers :** `specs/021-git-github/{spec,plan,research,data-model,quickstart,tasks,analysis-report}.md`, `contracts/interfaces.md`, `checklists/requirements.md` ; `.specify/memory/constitution.md` (4.4.0 → 4.4.1) ; `.specify/feature.json`.
**Quoi :** plan et 58 tâches de la spec 021 produits par un agent (MVP T001–T033 : dépôt local, publier / tirer / pousser, cloner) ; /speckit-analyze : 1 CRITICAL (message de `initGit` en argument → stdin), 4 HIGH (configuration à risque bloque aussi la lecture, aucun hook sur une branche `pr/*`, droits d'organisation, auteur principal en clone partiel), 7 MEDIUM, 6 LOW ; décisions de mentalyas : D11 push direct permis avec `admin` / `maintain`, D12 auteur principal compté en commits dans un clone partiel ; remédiation appliquée. Constitution 4.4.1 : « dépôt tiers » défini (ni au compte connecté, ni avec `admin` / `maintain`).
**Règle apprise :** une décision prise en analyse qui touche un mot de la constitution (« tiers ») se reporte dans la constitution par une clarification versionnée, sinon le plan s'appuie sur une lecture implicite.

### [2026-10-08 01:01] FEAT — spec 020 US3 « Améliorer, créer, supprimer des skills avec Claude » (+ T026–T028 par un agent)
**Fichiers :** spec 020 (D10 supprimer, D11 ordre, FR-030, T022b) ; constitution 4.4.1 → **4.5.0** (« Supprimer » ajouté aux gestes qui écrivent dans les dossiers de skills) ; migration `0033_skills` (+ down) et `schemaSkills.ts` ; `SkillRepository`, `SkillStore`, `SkillService`, `skillsFrame.ts`, `mcp/SkillTools.ts`, `toolHandler.ts` (`skills_lire`, `skill_brouillon`, garde des conversations Skills), `ConversationService` (profil `skills`), `HistoryService` (lot `skills`, résumés), `skillsHandlers.ts` (+8 canaux) ; renderer `DraftPanel`, `SkillPanel` (onglets Conversation / Brouillon prêt, gestes), `SkillsPage` (nœuds fantômes, conversation générale), `ChatPanel` (rôle `skills`) ; par un agent : `gitUrl.ts`, `CloneService.ts`, `GitProcess.ts`, `auditRules.ts` ; tests : 1484 (+68).
**Quoi :** dans la page Skills, une conversation générale et une par skill : Claude lit la toile et dépose des brouillons, sans aucun outil d'écriture ni de commande (H1), quel que soit le mode. mentalyas voit les différences, installe (version remplacée sauvegardée par empreinte, écriture atomique, conflit disque détecté), revient à la version précédente, supprime (dossier sauvegardé, annulable) ou duplique un skill de plugin. Chaque geste est un lot annulable de l'Historique. Nouveaux skills en nœuds fantômes jusqu'à l'installation.
**Erreur corrigée :** l'outil d'écriture convertit encore `﻿` en vrai caractère BOM : corrigé par Python ; le test « pas de Write » échouait sur le filtre `Write|Edit` du hook de l'app : on ne vérifie que les outils donnés à Claude.
**Règle apprise :** pour une garantie « Claude ne fait que des brouillons », trois verrous valent mieux qu'un : outils du CLI restreints, outils du pont filtrés par conversation, et écriture disque seulement derrière un canal qui exige `confirm: true`.

### [2026-10-08 01:16] FEAT — spec 020 US4 « Importer des skills depuis GitHub » (T029–T031)
**Fichiers :** `src/shared/skills/audit.ts` (`SkillAuditOut`) ; `domain/ai/{types,routing}.ts`, `ContextAssembler.ts` (tâche `skill_audit`) ; `infrastructure/ai/SkillAuditFrame.ts` ; `application/ai/SkillAuditTask.ts` ; `application/skills/SkillImportService.ts` ; `SkillService.writeDraft` (origine `import`, scripts autorisés un par un) ; `SkillRepository` (imports, candidats) ; `skillsHandlers.ts` + `channels.ts` (`skills:import|importView|importChoose|importCancel`, événement `skills:importProgress`) ; `bootstrap.ts` (`CloneService` superficiel en `<profil>/skill-quarantine`, dossier de hooks vide, nettoyage au démarrage) ; renderer `ImportDialog.tsx`, bouton dans `SkillsPage` ; fixture fictive `tests/fixtures/skills/demo-repo/` ; tests (1488).
**Quoi :** adresse contrôlée, clone superficiel en quarantaine sans hooks ni sous-modules, repérage des `SKILL.md` (profondeur 4, 30 skills, 2 000 fichiers), audit = règles fixes sur le SKILL.md et chaque script PUIS Claude sans outil, le plus sévère l'emporte ; écran de choix : verdict icône + libellé, raisons, « dangereux » verrouillé (case « je comprends le risque » puis case de garde), scripts décochés par défaut ; les skills gardés deviennent des brouillons d'origine `import` (source repo + commit + chemin), quarantaine supprimée.
**Erreur corrigée :** encore un heredoc qui avale `\` : la neutralisation des balises de l'audit ne neutralisait plus rien (`'<\/$1>'` devenu `'<\/$1>'` interprété `</`). Corrigé ; plus aucun code écrit par heredoc.
**Règle apprise :** un audit par IA se trompe exactement là où on l'attaque : le test le prouve (Claude simulé convaincu par « ce skill est sûr ») — des règles fixes indépendantes, qui ne peuvent qu'aggraver le verdict, sont le vrai garde-fou.

### [2026-10-08 03:00] FIX — build : chaîne « …import » coupée par le shim CommonJS d'electron-vite
**Fichiers :** `src/main/application/skills/SkillImportService.ts` (message reformulé) ; `tests/unit/build-shims.test.ts` (nouveau).
**Quoi :** `npm run dev` échouait (« Unterminated string literal ») : le shim CommonJS d'electron-vite cherche la dernière instruction d'import par motif et a pris `"Skill inconnu dans cet import");` pour l'une d'elles, insérant son code au milieu de la chaîne. Message reformulé ; un test refuse désormais toute ligne de code du main qui finit par une chaîne terminée par « import ».
**Règle apprise :** les tests et le typecheck ne passent pas par le bundler : après un changement du main, lancer aussi `npx electron-vite build` avant de proposer un test guidé.

### [2026-10-08 11:00] FEAT — spec 020 D12 « Bibliothèque de skills » (T031a–T031d), retour du test guidé T032
**Fichiers :** spec 020 (D12, US4 réécrite, FR-025/026/028/029, FR-031–033), `contracts/interfaces.md`, `quickstart.md` §4, `tasks.md` (T031a–d) ; `CloneService.ts` (garde-fou 1 Go sans borne de fichiers, 15 min, dossier temporaire `skill-library/.tmp`) ; migration `0034_skill_library` (+ down) et `schemaSkills.ts` ; `SkillRepository` (dépôts de la bibliothèque, audit de Claude par empreinte) ; `SkillImportService` (réécrit) ; `skillsHandlers.ts` + `channels.ts` (`skills:library|librarySkill|libraryInstall|libraryRemove` remplacent `importView|importChoose`) ; `bootstrap.ts` (`skill-library`, ancien `skill-quarantine` retiré) ; renderer `LibraryPanel.tsx` (nouveau), `SkillNodes.tsx` (`RepoNode`, `AvailableNode`, `VERDICTS`), `SkillsPage.tsx` (branche Bibliothèque), `ImportDialog.tsx` (réduit) ; tests (1498).
**Quoi :** mentalyas : « Dépôt trop gros (50 Mo, 2 000 fichiers) » sur un vrai dépôt de skills. L'import garde désormais une copie locale du dépôt entier dans `<profil>/skill-library/<hôte>/<auteur>/<dépôt>` (clone temporaire puis renommage ; mise à jour = nouveau clone puis échange, l'ancienne copie restaurée si l'échange échoue). Règles fixes à l'import pour tous les skills (300 au plus) ; audit de Claude au clic Installer, une fois par empreinte, et un verdict aggravé arrête tout jusqu'à un second clic (`seen`). Toile : branche Bibliothèque, une grappe par dépôt, nœuds « disponible » (verdict icône + libellé, « (règles) » tant que Claude n'a pas audité). Retirer = renommage dans `.tmp` puis suppression.
**Erreur corrigée :** borne de 2 000 fichiers pensée pour une quarantaine jetable, incompatible avec un vrai dépôt de skills (la plupart mélangent docs, exemples, images) ; heredoc bash qui casse sur un long script Python : script passé par un fichier du scratchpad.
**Règle apprise :** une borne de sécurité doit viser le risque (taille disque, durée), pas un proxy (nombre de fichiers) ; et un audit coûteux (Claude) se fait au moment de la décision qu'il éclaire (installer), pas sur tout ce qu'on regarde.

### [2026-10-08 11:40] FIX — spec 020 D12 : la bibliothèque montrait des skills en japonais (copies traduites)
**Fichiers :** `SkillImportService.ts` (`findSkills` : rang d'emplacement, un skill par nom, `skippedCopies`) ; migration `0035_skill_library_copies` (+ down) et `schemaSkills.ts` ; `shared/ipc/skills.ts` ; `LibraryPanel.tsx` (copies écartées) ; fixture `demo-repo` (`docs/ja-JP/skills/resume-reunion`, `.kiro/skills/nettoyage`) ; tests ; spec D12.
**Quoi :** mentalyas : « pourquoi les agents de ce dépôt sont écrits en japonais ? ». Le dépôt `affaan-m/ecc` contient 1 027 SKILL.md, dont 734 copies (traductions `docs/ja-JP`, `docs/zh-CN`… et dossiers d'autres outils `.kiro`, `.agents`, `.cursor`). Le repérage triait les chemins par ordre alphabétique et coupait à 300 : `.agents/`, `.cursor/`, `.kiro/` et `docs/` passaient avant `skills/`, qui n'était jamais atteint. Désormais : rang 0 `skills/` et `.claude/skills/`, rang 2 documentation et segments de langue (`ja-JP`), rang 1 le reste ; un skill par nom au meilleur rang ; limite appliquée après. Vérifié sur la copie réelle : 296 skills (293 de `skills/`), 731 copies écartées.
**Erreur corrigée :** limite appliquée avant tout tri de pertinence ; aucun test avec des copies traduites.
**Règle apprise :** tronquer une liste exige d'abord de la classer par pertinence et de dédoublonner ; l'ordre alphabétique des chemins favorise les dossiers cachés (`.x`) et `docs/`.

### [2026-10-08 12:30] FIX — spec 020 D12 : « Mettre à jour » échouait sans dire pourquoi
**Fichiers :** `SkillImportService.ts` (échange de dossiers avec essais répétés, étape suivie, `logFailure`, code `SWAP_FAILED`) ; `bootstrap.ts` (`skills.import_failed` dans le journal) ; `ImportDialog.tsx` (libellés de tous les codes, code affiché sinon) ; test d'intégration (verrou temporaire puis persistant).
**Quoi :** test guidé de mentalyas : « L'import a échoué » sans détail à la mise à jour de `affaan-m/ecc`. La bibliothèque est restée intacte (ancienne copie en place, `.tmp` vide), mais la cause était invisible : l'exception était avalée et son code n'avait pas de libellé. Reproduction hors de l'app (clone puis double renommage, chemin court) : réussie, donc cause non confirmée. Hypothèse la plus probable sous Windows : un dossier verrouillé quelques secondes (antivirus qui analyse les 4 000 fichiers, explorateur ouvert) pendant le renommage. Correctif : essais répétés (20 × 500 ms) sur `EPERM` / `EBUSY` / `EACCES`, message dédié, et une ligne de journal `skills.import_failed { stage, code }` (aucun chemin ni adresse) pour trancher au prochain échec.
**Erreur corrigée :** `catch {}` sans journal dans un traitement de fond ; codes d'échec sans libellé.
**Règle apprise :** un traitement de fond qui échoue doit toujours laisser une trace exploitable (étape + code système), et l'écran doit afficher le code quand il n'a pas de libellé.

### [2026-10-08 12:50] FIX — spec 020 D12 : plus aucun renommage de dossier dans la bibliothèque (EPERM)
**Fichiers :** `SkillImportService.ts` (copie par version `<dépôt>@<version>`, bascule en base puis suppression de l'ancienne copie, `sweep` au démarrage, plus de renommage ni d'essais répétés) ; `CloneService.ts` (profil `superficiel` avec cible explicite) ; `SkillRepository.ts` (`libraryRepoByFolder` retiré) ; `logger.ts` (champ `stage` autorisé) ; `ImportDialog.tsx` ; tests (1500) ; spec D12, FR-025/029/032, contrat, quickstart.
**Quoi :** journal de mentalyas : `skills.import_failed {"code":"EPERM"}`, même après 10 s d'essais : l'ancienne copie était tenue ouverte (« lu par l'app elle-même ») et Windows refuse de renommer un dossier dont un fichier est ouvert. Correctif de conception plutôt que d'attente : chaque version est clonée directement dans son propre dossier, la base bascule dessus (transaction), puis l'ancienne copie est supprimée si possible ; si elle est verrouillée, le nettoyage de démarrage la retire (seules les copies non référencées, jamais le contenu d'une copie référencée). La copie au format d'avant (`<dépôt>` sans `@`) est reprise telle quelle puis remplacée à la première mise à jour.
**Erreur corrigée :** l'échange de dossiers par renommage (et les essais répétés du correctif précédent) supposait un verrou bref ; le champ `stage` était filtré par la liste blanche du journal.
**Règle apprise :** sous Windows, ne jamais renommer un dossier que quelqu'un peut lire : écrire la nouvelle version à côté, basculer la référence, supprimer l'ancienne au mieux et rattraper au démarrage.

### [2026-10-08 15:30] FEAT — spec 020 US2 « Comprendre et évaluer chaque skill » (T014–T018)
**Fichiers :** `shared/skills/card.ts` (schéma `SkillCard`, `starsOf`, libellés) ; `domain/skills/cardCheck.ts` ; `application/ai/SkillCardTask.ts` + `infrastructure/ai/SkillCardFrame.ts` ; `domain/ai/{types,routing}.ts`, `ContextAssembler.ts`, `composition/aiEngine.ts` (tâche `skill_card`, `SKILL_CARD_MODEL` = Sonnet 5.5) ; `SkillRepository` (fiches, domaines, liens de sens) ; `application/skills/SkillCardService.ts`, `SkillUsageScanner.ts` ; `skillsHandlers.ts` + `channels.ts` (`skills:cards|analyze|setStars|setDomain|acceptDomain|link|unlink|usage`, événement `skills:analyzeProgress`) ; `HistoryService` (résumés) ; `bootstrap.ts` ; renderer `SkillCardSheet.tsx`, `SkillPanel`, `SkillNodes`, `SkillsPage` ; `CloneService.ts` (commentaire périmé signalé par le professeur) ; tests (1516) ; tasks, research R4, contrat.
**Quoi :** « Analyser les skills » : Claude, sans outil, rédige pour chaque skill sans fiche ou modifié (3 à la fois) une fiche fermée (résumé, quand l'utiliser / l'éviter, déclencheurs, entrées-sorties, exemples, grille en 4 critères justifiés, domaine, liens de sens). Contrôles purs : liens vers un skill inventorié seulement, domaine inconnu proposé en attente, étoiles = moyenne arrondie de la grille. La note et le domaine de mentalyas priment et survivent aux analyses ; un lien de Claude retiré n'est jamais reproposé ; chaque correction est un lot annulable. Usage sur 30 jours tiré des historiques de Claude Code (noms de skills et horodatages seulement). Toile rangée par domaine dès la première fiche, étoiles et appels sur les nœuds, liens de sens en pointillés.
**Erreur corrigée :** aucune en production ; test `ui/layout` (déterminisme) qui dépasse 5 s sous la charge de la suite complète, vert seul (préexistant).
**Règle apprise :** une sortie d'IA qui alimente un affichage chiffré (étoiles) se calcule à partir d'éléments justifiés (la grille), jamais d'une valeur déclarée : une consigne cachée ne peut alors agir qu'à travers des notes qu'il faut justifier, et que mentalyas corrige.

### [2026-10-08 17:00] PERF — spec 020 T033–T034 : mesure à 150 skills, liens 60× plus rapides ; spec 020 livrée
**Fichiers :** `src/main/domain/skills/links.ts` (pré-filtre) ; `tests/integration/skills/skills-scale.test.ts` (nouveau) ; `specs/020-arbre-de-skills/{research,tasks}.md` ; `docs/FOUNDATION.md` §00000.4 ; `CLAUDE.md`.
**Quoi :** mesure SC-007 : le calcul des liens « appelle » essayait chaque nom de skill sur chaque ligne de chaque skill (150 × 150 × ~85 lignes ≈ 1,9 million d'expressions régulières, ~1 s) ; un `includes` du nom sur le texte entier l'écarte d'abord : 17 ms. Inventaire réel 130–300 ms ; dans Electron, le dépliage des 296 skills de la bibliothèque est « rapide et fluide ». Spec 020 close (US1–US4 + D12 livrées et validées ; US5 « mes-skills » prévue).
**Erreur corrigée :** premières mesures à 2–3 s faussées par des fichiers tout juste écrits (antivirus à la première ouverture) : mesurer aussi sur des données réelles avant de conclure.
**Règle apprise :** un test de performance permanent ne chronomètre que du calcul pur ; les lectures disque se mesurent sur le poste réel, une fois, et se consignent.

### [2026-10-08 18:30] FEAT — spec 019 US3 (lot 1) : statut des propositions, tri et « Vider l'historique » (D10–D11)
**Fichiers :** spec 019 (D10 « Déjà appliquée », D11 « Vider l'historique », FR-024a/b), `data-model.md`, contrat, `tasks.md` (T024a, T025, T026–T027 partiels) ; `shared/ipc/analyste.ts` (statut `applied`, `PROPOSAL_DECISIONS`, `CLOSED_STATUSES`, onglet Installées) ; `schemaAnalyste.ts` ; `domain/analyste/transitions.ts` (nouveau) ; `AnalysteRepository` (`proposal`, `setStatus`, `counts`, `clearClosed`, mappeur `proposalView` extrait) ; `analysteHandlers.ts` + `channels.ts` (`analyste:decide`, `analyste:proposals:clear`, compteurs) ; renderer `AnalystePage.tsx`, `labels.ts` ; tests (1524).
**Quoi :** demande de mentalyas : voir sur chaque suggestion de l'Analyste si elle est installée, refusée ou en attente, et nettoyer l'historique. Boîte en 4 onglets avec compteurs (À trier, En cours, Installées, Écartées), étiquette de statut (icône + libellé) sur chaque fiche, gestes Accepter / Refuser (raisons prêtes ou sans raison) / Reporter / Reprendre / « Déjà appliquée » (statut `applied`, pour les suggestions appliquées avec Claude hors de l'app), « Vider l'historique » sur confirmation (propositions closes et leurs fiches de mise à jour, aucune commande git). Pas de migration : le statut est une colonne texte.
**Erreur corrigée :** j'avais d'abord fait d'une proposition installée une proposition « non reproposée sans fait nouveau » ; un test existant rappelait le choix d'origine (une gardée peut revenir si le problème persiste — sa signature d'erreur reste la même) : « Déjà appliquée » suit donc les gardées, D10 réécrite. Le groupe « Raison du refus » restait ouvert après le refus (trouvé par le test renderer).
**Règle apprise :** avant de changer la mémoire d'un système qui déduplique, lire les tests qui en fixent les cas : ils portent souvent une intention (laisser revenir un problème non résolu) que le code seul ne dit pas.

### [2026-10-08 21:00] FEAT — spec 019 US4 « Appliquer, essayer, garder ou jeter » (T030–T035)
**Fichiers :** spec 019 (D12 dépendances affichées, D13 profil d'essai), contrat ; `domain/analyste/branchName.ts` ; `infrastructure/analyste/NpmCli.ts` ; `application/analyste/UpdateService.ts` ; migration `0036_analyst_base_branch` (+ down), `schemaAnalyste.ts`, `schemaNeurons.ts` + `shared/ipc/neurons.ts` (genre `analyst_update`) ; `AnalysteRepository` (mises à jour, neurone de codage, `updateView`) ; `shared/ipc/analyste.ts` (`UpdateView`…) ; `shared/mcp/hook.ts` (`WRITE_REFUSED_PREFIX`), `toolHandler.ts` (garde d'écriture), `mcp-relay/relay.ts` (refus = code 2) ; `analysteHandlers.ts` + `channels.ts` (`analyste:update:*`) ; `bootstrap.ts` ; `index.ts` + `package.json` (`--essai`, `npm run essai`) ; renderer `UpdatePanel.tsx`, `AnalystePage.tsx` ; tests (1539).
**Quoi :** « Coder avec Claude » sur une proposition : dépôt propre sur sa branche de base exigé, branche `analyste/<id8>-<titre>` et copie de travail `.analyste/worktrees/<id8>` (jonction `node_modules`), conversation Claude cachée dans cette copie (« Accepter les modifications »), fiche envoyée comme premier message. Toute écriture hors de la copie ou dans `node_modules` / `.git` est refusée par le hook (le relais sort en code 2). « Terminer le codage » : `add -A` + commit avec `Analyste-Proposal: <id>` (sans co-auteur), puis typecheck, lint, prettier, tests par `node npm-cli.js` dans la copie. Changements (fichiers ±), « Essayer » (`npm run essai` : profil fictif recréé), « Garder » (`merge --no-ff`, copie et branche retirées, l'app se recharge), « Jeter » (copie et branche seulement). Réconciliation au démarrage (fusion interrompue, copie disparue, copie orpheline). Test d'inspection : aucun push, reset, rebase, amend, no-verify ni forçage de branche.
**Erreur corrigée :** la constitution limite npm à 4 scripts : `npm ci` (« installer les dépendances » du contrat) n'est pas exécuté par l'app, la commande est affichée (D12).
**Règle apprise :** relire la constitution au moment d'implémenter un contrat écrit plus tôt : un canal prévu (installDeps) peut dépasser ce qu'elle autorise, et la version conforme (afficher la commande) est souvent plus simple.

### [2026-10-08 22:00] FEAT — chat : indicateur « Claude réfléchit » (orbe de points, référence 21st.dev)
**Fichiers :** `src/renderer/src/chat/ThinkingOrb.tsx`, `ThinkingIndicator.tsx`, `thinkingPhase.ts`, `thinking.css` (nouveaux) ; `ChatPanel.tsx` ; `tests/unit/renderer/thinking-indicator.test.tsx` (1541).
**Quoi :** première finition à partir d'une référence visuelle 21st.dev choisie par mentalyas (« AI thinking orb and input », anark17r). Repris : la sphère de points en 3D dessinée sur canvas (anneaux, projection, motifs lumineux) et le libellé animé (glissement, reflet, trois points). Adapté : taille de bulle de chat, couleurs des jetons du thème (`--color-content-muted`, `--color-accent`), libellé tiré de l'**activité réelle** de Claude (réflexion, lecture, recherche, commande, écriture d'après ses dernières actions) au lieu de libellés au hasard, mode « animations réduites » (image fixe, fondu seul), texte stable pour les lecteurs d'écran. Écarté : la scène plein écran (pilule de saisie qui vole jusqu'au centre, carte de réponse), sans place dans un volet de conversation. Aucune dépendance ajoutée (`tw-animate-css` inutile).
**Erreur corrigée :** le prompt d'intégration ne contenait que les `@keyframes` (les règles `.mo-*` manquaient) et la fiche du registre exige une connexion à 21st.dev : seul le code TypeScript de l'orbe était exploitable tel quel.
**Règle apprise :** un composant de catalogue est une maquette : en garder la pièce maîtresse, la brancher sur les jetons et les règles du projet, et préférer une information vraie (l'activité réelle) à une animation qui fait semblant.

### [2026-10-08 22:40] FEAT — chat : morphing « la zone de saisie devient l'orbe » (référence 21st.dev)
**Fichiers :** `src/renderer/src/chat/ChatPanel.tsx`, `ThinkingIndicator.tsx`, `thinking.css`.
**Quoi :** à l'envoi d'un message, la zone de saisie s'efface et une bille lumineuse (dégradé de l'accent du thème) se rétracte de sa largeur à un cercle (380 ms), puis vole jusqu'à la bulle de réponse en grossissant (`layoutId` partagé de `motion`, courbe « fly » du composant d'origine) et se fond dans l'orbe de points. La zone de saisie revient aussitôt (« Arrêter » reste accessible). Animations réduites, ou zone non mesurable : aucun morphing, l'orbe apparaît directement.
**Règle apprise :** pour une transformation d'un élément en un autre à travers l'interface, une identité d'animation partagée (`layoutId`) fait le vol sans calcul de trajectoire à la main ; il suffit que l'un disparaisse et l'autre apparaisse dans le même rendu.

### [2026-10-08 22:55] FIX — spec 019 US4 : la copie de travail gardée laissait un dossier vide
**Fichiers :** `ConversationService.ts` (`end`), `UpdateService.ts` (`endConversation`, dossier vide retiré, aussi au démarrage), `bootstrap.ts`, test d'intégration.
**Quoi :** premier « Garder » réel (fusion `fa8a65b`, proposition « L'Analyste lit un graphe de code périmé… ») : branche supprimée, mais le dossier `.analyste/worktrees/bbd7c1e6` restait, vide. Le processus `claude` de la conversation de codage, dont c'était le dossier courant, le tenait ouvert (Windows). La conversation est désormais arrêtée avant de retirer la copie (Garder et Jeter), et un dossier resté vide est supprimé avec quelques essais, ou au démarrage suivant.
**Règle apprise :** sous Windows, avant de supprimer un dossier, arrêter les processus dont c'est le dossier courant — y compris ceux que l'app a elle-même lancés.

### [2026-10-08 23:15] FEAT — chat : l'orbe s'ouvre en bulle de réponse ; vol juste dans une page qui défile
**Fichiers :** `src/renderer/src/chat/LiveReply.tsx` (nouveau), `ChatPanel.tsx`, `analyste/AnalystePage.tsx`.
**Quoi :** quand Claude commence à écrire, l'orbe se condense (≈ 0,3 s, anneau de lumière), la bulle se déplie de la taille de l'orbe à celle de la réponse (`layout` de `motion`, courbe « card » du composant d'origine) et le texte sort d'un léger flou avant de s'écrire au fil de l'eau ; le texte reste disponible aux lecteurs d'écran pendant la condensation. Dans la boîte Analyste, la bille du morphing partait et atterrissait décalée : la page défile, et `motion` ne compte le défilement que des conteneurs marqués `layoutScroll` (page Analyste et liste des messages du chat).
**Règle apprise :** une animation partagée (`layoutId`) mesure des positions à l'écran : tout conteneur qui défile entre les deux éléments doit être marqué `layoutScroll`, sinon l'animation est juste dans un volet fixe et fausse dans une page défilée.

### [2026-10-08 23:35] FEAT — chat : la zone de saisie devient l'orbe et revient après la réponse
**Fichiers :** `src/renderer/src/chat/ChatPanel.tsx`, `LiveReply.tsx`, `tests/unit/renderer/chat-panel.test.tsx`.
**Quoi :** retour de mentalyas : l'animation se superposait à l'ancienne zone de saisie, restée affichée. Désormais la zone de saisie **est** l'orbe : à l'envoi elle se rétracte en bille et disparaît, la bille devient l'orbe, et la zone ne revient qu'à la fin de la réponse, en se reformant depuis une bille au centre (`clipPath`), avec le focus remis dans le champ. « Arrêter » vit dans la bulle de l'orbe pendant le tour, et Échap interrompt aussi (comme la référence 21st.dev). Les demandes de permission restent affichées. Animations réduites : la zone disparaît et revient en fondu.
**Règle apprise :** reprendre une animation de référence, c'est aussi reprendre sa logique d'interface (ici : un seul élément qui se transforme), pas seulement son dessin ; garder ce qui doit rester accessible (interrompre) en le déplaçant, jamais en le supprimant.
**Ajustement (23:50, retour visuel de mentalyas) :** sans zone de saisie, la bulle de l'orbe touchait le bas du volet et « Arrêter » était coupé : marge basse de la liste (`pb-8`), défilement jusqu'à la bulle quand elle apparaît, plus d'air au-dessus de la bulle (`mt-4`, `px-4 py-3`), « Arrêter » à droite de l'orbe pendant la réflexion (sous le texte ensuite).
**Ajustement (00:00, retour visuel) :** la bande du bas reste délimitée pendant le tour (même hauteur, séparation) : seul le champ disparaît en bille, qui se pose dans la bulle de réponse ; « Arrêter » prend la place de « Envoyer » dans la bande (plus dans la bulle) ; plus de saut de mise en page ni de bulle coupée au bord.
**Ajustement (00:10, retours visuels) :** la bulle de réponse est réservée dès l'envoi (place vide, défilement doux) : la bille vole jusqu'à sa place définitive et l'orbe s'y ouvre sans rien pousser. Retour du champ : le drapeau « on revient d'une réponse » était posé après la réapparition (effet), l'animation d'entrée ne jouait jamais ; il est posé à l'envoi, et une bille au centre de la bande s'étire pendant que la pilule se redessine (0,55 s).
**Règle apprise :** une valeur qui commande l'animation d'entrée d'un élément doit être connue avant son montage : un état posé dans un `useEffect` après le rendu arrive trop tard.


### [2026-10-09 00:20] FEAT — spec 019 US5 : annuler une mise à jour gardée de l'Analyste (T037)
**Fichiers :** `application/analyste/UpdateService.ts` (`revert`, `reconcile` enregistre la fusion), `ipc/analysteHandlers.ts` et `shared/ipc/channels.ts` (`analyste:update:revert`, `confirm: true`), `shared/ipc/analyste.ts` (étape `reverted`), `renderer/analyste/UpdatePanel.tsx` (volet « Gardée / Annulée »), `AnalystePage.tsx` ; tests `update-service.test.ts` (+3, git réel), `analyste-update-panel.test.tsx` (+1, axe). 1 609 tests verts.
**Quoi :** sur une proposition gardée, « Annuler cette mise à jour… » puis confirmation : un `git revert -m 1 --no-edit` de la fusion, sur la branche de base propre ; le code revient à l'état d'avant (SC-006 : `git diff <base>` vide) et l'historique garde la mise à jour et sa révocation. Conflit (le même code a changé depuis) → `revert --abort`, rien n'est changé, `REVERT_CONFLICT`. Jamais de reset ni de push.
**Erreur corrigée :** une garde interrompue puis réconciliée au démarrage passait « kept » sans enregistrer sa fusion : elle n'aurait pas pu être annulée. `reconcile` retrouve maintenant la première fusion qui contient la branche.
**Règle apprise :** les tests à git réel dépassent 5 s quand toute la suite tourne en parallèle : un délai propre au fichier (30 s) plutôt qu'un test « instable ». Et `NODE_ENV=production` hérité du poste casse les tests React (`React.act` absent) : lancer la suite avec `NODE_ENV=test`.

### [2026-10-09 00:30] DOCS — spec 022 « Nœuds vivants » : prototype validé, spec, inventaire, plan, tâches
**Fichiers :** `specs/022-noeuds-vivants/` (`spec.md` D1–D23, `inventory.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/interfaces.md`, `quickstart.md`, `tasks.md`).
**Quoi :** 23 versions d'un prototype HTML (artifact privé, données fictives) avec mentalyas : orbes et petits cercles à pictogramme, couleur par grande branche, taille par niveau, plans en sens alterné, cartes de détails multiples, déplaçables et zoomées avec la toile, fiche / discussion / lecteur par étirement, repli, Main et agents, zoom fluide, style carbone. Écartés après essai : parallaxe et lentille de zoom (« le chaos »), cadres colorés autour des groupes, verre aéré, canevas « tech ». Décision D23 : aucune fonctionnalité retirée — l'inventaire relève chaque geste, nœud, volet et menu actuels et leur place après la refonte.
**Erreur corrigée :** en retirant la parallaxe du prototype, une découpe de texte a effacé tout le bloc de la barre (dont `reduced()`) : la boucle d'affichage plantait à chaque image, le glisser semblait mort. Le prototype est maintenant exécuté dans jsdom (glisser simulé, carte ouverte) avant chaque publication.
**Règle apprise :** une vérification de syntaxe ne prouve pas qu'une page tourne : exécuter (même dans un DOM simulé) avant de livrer.

### [2026-10-09 01:15] FEAT — spec 022 lot 0 : fondations des nœuds vivants
**Fichiers :** `package.json` (`lucide-react` 1.53.0, ISC, validé D12) ; `src/shared/ipc/app.ts` (thème `carbon`, `colorSchemeOf`) ; `app/ThemeSwitch.tsx` ; `widgets/widgetFrame.ts`, `IdeasCanvas.tsx`, `ExplorerPage.tsx`, `SkillsPage.tsx` (React Flow et widgets en sombre pour Carbone) ; `styles/tokens.css` (thème Carbone, palette de branches, orbe, canevas) ; nouveaux : `canvas/layout/alternateLayout.ts`, `canvas/living/{rhythm,nodeVisual,icons}.ts`, `LivingNode.tsx`, `living.css`, `canvas/cards/cardsStore.ts`, `canvas/useSmoothZoom.ts`, `canvas/useGlide.ts` ; `structureGraph.ts` passe par `alternateLayout` ; tests (1581).
**Quoi :** briques sans changement visible des cartes, sauf le thème **Carbone** ajouté au sélecteur (en plus, aucun thème retiré) : disposition alternée partagée (structure inchangée, 15 tests verts ; plans au lot US1), rythme de flottaison stable par identifiant, aspect d'un nœud (profondeur, branche transmise, taille, pictogramme, statut), composant `LivingNode` (orbe ou cercle, pastilles, repli accessible), magasin des cartes multiples (règles pures testées), zoom amorti (point sous la souris fixe, bornes, convergence), glissements de 700 ms.
**Règle apprise :** extraire un algorithme existant vers un module partagé avant de l'étendre, avec les tests d'origine comme filet : si les positions changent, on le voit tout de suite.

### [2026-10-09 03:30] FEAT — spec 022 US1 : la carte des idées vivante
**Fichiers :** `canvas/planLayout.ts` (sens alterné), `layout/alternateLayout.ts` (enfants centrés sur leur parent), `buildGraph.ts` (aspect vivant, couleur de branche, repli, transposition, cartes ouvertes), `nodes/{NeuronNode,PlanNode,DocumentNode,DeliverableNode}.tsx` (orbe et petits cercles ; gestes d'action finale et ✓ / ✗ extraits), nouveaux `cards/{DetailCard,IdeaCards,cardContent}.tsx|ts`, `cards/cards.css`, `usePlanFold.ts` ; `IdeasCanvas.tsx` (clic = carte, double-clic = discussion, plus de volet, zoom amorti, glissements, « Réorganiser », « Fermer les cartes ») ; `app/uiStore.ts` (façade vers les cartes : `openChat`, `openFinal`, `openGhost`, `openViewer` ouvrent la bonne carte) ; `CanvasToolbar.tsx`, `edges/BranchEdge.tsx` ; main : colonne `plan_folded` (migration 0037 + down), `PlanRepository.setFolded/foldedRoots`, `PlanService.setFolded`, canal `plan:setCollapsed` ; démo : plan fictif à 3 niveaux ; spec 008 amendée ; tests (1595).
**Quoi :** les idées sont des orbes, leurs étapes de petits cercles colorés par grande branche, plus petits à chaque niveau, avec pictogramme, rang et pastille de statut ; les plans se déploient en sens alterné et se replient (▸ N, mémorisé) ; tout flotte. Un clic ouvre une carte de détails à droite du nœud (plusieurs à la fois, déplaçables par leur poignée, zoomées avec la toile) : fiche vers le bas, discussion (le chat habituel) ou lecteur (visionneuse de livrable, document) vers la droite ; les gestes des étapes (exécuter, arrêter, accepter, refuser, lire) et des fantômes y sont, avec les mêmes libellés. Les appels existants (menu, historique, exécution, import, capture) ouvrent la bonne carte.
**Erreur corrigée :** le cadrage initial ne comptait que les idées et les blocs : un plan placé sous son idée sortait du cadre et React Flow (qui ne dessine que les nœuds visibles) ne l'affichait jamais — le cadrage porte désormais sur tous les nœuds affichés. Et dans une ligne, une sous-étape (case plus petite) était calée en haut de la case de son étape : les enfants sont maintenant centrés sur l'axe de leur parent.
**Règle apprise :** quand une disposition change de direction, revérifier tout ce qui en dépend implicitement (cadrage, rendu des seuls éléments visibles) ; les tests de bout en bout l'ont vu avant l'utilisateur.
**Ajustements (retours de mentalyas au test guidé) :** démo réduite à 2 genesis éclos posés loin l'un de l'autre (plan d'un côté, carte de structure de l'autre) ; ✕ et glisser des cartes morts : la couche de React Flow où vivent les cartes est en `pointer-events: none`, la carte réactive la souris pour elle-même (test ajouté : jsdom ne charge pas la feuille de style de React Flow) ; en-tête de la discussion restructuré en trois lignes (titre et ×, actions, mode et modèle), discussion élargie à 460 px dans la carte.
**Règle apprise :** un élément interactif posé dans une couche d'une bibliothèque doit vérifier que cette couche ne coupe pas la souris ; un test sans CSS ne le voit pas, il faut l'affirmer explicitement.

### [2026-10-09 04:15] FIX — spec 022 : arbres voisins écartés, lecteur à la taille de son contenu
**Fichiers :** `canvas/treeReach.ts` (nouveau), `useCanvasPhysics.ts`, `cards/cards.css`, `specs/022-noeuds-vivants/spec.md` (D24–D26), test `tree-reach.test.ts` (1599).
**Quoi :** la physique compte la portée de l'arbre de chaque idée (distance au nœud le plus éloigné de son plan et de sa carte de structure, repli compris) : une idée nouvelle ou libérée ne pose plus son arbre sur celui d'une voisine ; une idée déjà posée ne bouge toujours pas d'elle-même (« Libérer » la replace). Le lecteur de la carte prend la taille de son contenu (360–720 px de large, 600 px de haut au plus, défilement au-delà) ; décision de mentalyas : pas de redimensionnement manuel, et plus d'estompage des autres idées quand une discussion est ouverte.

### [2026-10-09 05:00] FEAT — spec 022 : glissements fluides, cartographie visible, fond sans vignette
**Fichiers :** `IdeasCanvas.tsx` (positions interpolées image par image pendant un glissement), `nodes/stillNode.ts` (nouveau : un nœud ne se redessine que si son contenu change), `living/living.css`, nouveau `canvas/mapping/mappingStore.ts` (cartographie en cours / terminée / interrompue, suivie dans toute l'app), `chat/ChatPanel.tsx` (« Cartographier ce projet » la déclare), `app/AppShell.tsx`, `nodes/NeuronNode.tsx`, `canvas.css`, `styles/tokens.css` ; tests `mapping.test.tsx` (1602).
**Quoi :** retours de mentalyas : (1) « Réorganiser » ne déplaçait que les nœuds (transition CSS), les liens sautaient — les positions glissent maintenant dans la carte elle-même, liens, cartes et fils suivent ; (2) pas assez fluide — chaque type de nœud est mémoïsé (React Flow ne fait que le déplacer à chaque image) ; (3) un anneau qui balaie autour de l'orbe pendant la cartographie d'un projet par Claude, puis une coche verte « Cartographie terminée » (ou « interrompue ») et une notification, même carte de discussion fermée ; (4) la vignette sombre des bords du canevas est retirée.
**Règle apprise :** une animation de position doit passer par la source de vérité des positions (le store de la carte), sinon tout ce qui en dépend (liens, ancres) saute ; et mémoïser les nœuds avant d'animer à 60 images par seconde.

### [2026-10-09 06:00] FEAT — spec 022 US3 : la carte de structure vivante
**Fichiers :** `nodes/ElementNode.tsx` (petit cercle vivant ; `ElementLayerSelect`, `ELEMENT_ICONS`, `ELEMENT_NODE_STATUS` exportés), `structureGraph.ts` (cases et espacements pour des cercles), `buildGraph.ts` (aspect des éléments : couleur de leur module, taille par niveau), `living/{icons,nodeVisual}.ts` (fonctionnalité, interface, décision, opération), `edges/useCenter.ts` (les éléments sont ronds : liens au centre), `cards/{IdeaCards,cardContent,DetailCard}.tsx|ts` (carte d'un élément : type, statut, contenu, avancement et reste, couche, fichiers dans le lecteur, repli des sous-éléments), `IdeasCanvas.tsx` (glissement aussi au repli d'un élément et à la bascule Progression / Architecture), `living/living.css` ; spec 017 amendée ; tests réécrits (`element-node`, `element-progress-node`, `architecture-view`).
**Quoi :** les modules, composants, données et tâches d'une carte de structure deviennent de petits cercles colorés par module, avec pictogramme, numéro de progression, pastille de statut (pointillés si bloqué), trombone et badge Code / Doc ; tout ce que montrait le grand rectangle (résumé, avancement, reste à faire, couche, chemins) est dans sa carte de détails, avec les mêmes gestes et la même annulation ; les fichiers couverts s'y lisent dans le lecteur (`ElementFileReader`).
**Note :** trois tests sensibles à la charge (délai de 5 s, mesure < 1 s, dossier temporaire verrouillé par Windows) échouent dans la suite complète quand la machine est chargée et passent seuls ; non liés à l'US3.

### [2026-10-09 06:45] PERF — spec 022 : animations plus fluides et plus vives ; finitions de la carte de structure
**Fichiers :** `living/living.css`, `cards/cards.css`, `useGlide.ts`, `useSmoothZoom.ts`, `IdeasCanvas.tsx` (dépli : un nœud qui apparaît part de son parent, en fondu), `buildGraph.ts` (orbes plus gros, étiquettes de liens mesurés courtes, parent des annexes), `structureGraph.ts` (plus d'air), `nodes/ElementNode.tsx` et `living/LivingNode.tsx` (pastille </> / Doc à la place du trombone), `canvas.css` (étiquettes des liens agrégés cachées au repos) ; spec 022 D27.
**Quoi :** retours de mentalyas sur sa carte du Brainstormer (100+ éléments) : étiquettes de liens qui couvraient les cercles, pastilles qui se chevauchaient, traits qui coupaient les titres, genesis pas assez marquant, dépli sans animation, animations pas assez fluides. Côté performance : une seule animation de flottaison par nœud (transformation seule, sans calque réservé en permanence), calque dédié seulement pendant un glissement, flottaison en pause pendant un glissement, éclat Carbone seulement sur la carte active, durées raccourcies.
**Règle apprise :** une animation infinie par nœud coûte peu à 10 nœuds et beaucoup à 100 : animer seulement `transform`, réserver les calques (`will-change`) le temps du mouvement, et réserver les effets qui repeignent (dégradé conique animé) à un seul élément.

### [2026-10-09 07:15] FEAT — spec 022 : ancrage des cartes, liens d'analyse masqués par défaut
**Fichiers :** `cards/cardsStore.ts` (`pinned`, `togglePin`, `closeUnpinned`), `cards/DetailCard.tsx` (punaise dans l'en-tête), `cards/IdeaCards.tsx`, `cards/cards.css`, `IdeasCanvas.tsx` (clic dans le vide ou sur un autre nœud = clic extérieur), `buildGraph.ts` (`analysisLinks`), `app/uiStore.ts`, `CanvasToolbar.tsx` (bouton « Liens d'analyse ») ; spec 022 D28, D29 ; tests.
**Quoi :** D28 : un clic à l'extérieur ferme les cartes, sauf celles épinglées (punaise), pour travailler avec plusieurs discussions ; ✕, Échap et « Fermer les cartes » ferment aussi une carte épinglée. D29 : sur une carte de structure, les liens d'analyse au repos (appels mesurés, relations agrégées : des dizaines de traits et d'étiquettes) sont masqués par défaut — ils alourdissaient l'affichage et les animations ; le bouton « Liens d'analyse » les affiche ; la hiérarchie, les alertes « sens interdit » et les liens de l'élément en focus restent.

### [2026-10-09 08:00] PERF — spec 022 : repli animé, « Réorganiser » sur tout le graphe, glissements par le magasin de React Flow
**Fichiers :** `IdeasCanvas.tsx`, `structureGraph.ts` (option `transposed`), `buildGraph.ts`, `living/living.css`, `CanvasToolbar.tsx` et `cards/IdeaCards.tsx` (mémoïsés), test `structure-graph.test.ts` ; spec 022 D22 précisée.
**Quoi :** (1) au repli, les nœuds qui disparaissent restent le temps du glissement : ils rentrent dans leur parent en s'effaçant, avec leurs liens ; (2) « Réorganiser » transpose aussi les cartes de structure (modules en ligne à droite, enfants dessous) ; une idée qui porte une carte et un plan les envoie de côtés opposés ; (3) fluidité : les positions intermédiaires d'un glissement vont directement dans le magasin de React Flow (`useStoreApi().setNodes`) — seuls les nœuds qui bougent, leurs liens et les cartes accrochées se redessinent ; la page ne reçoit que la position finale ; barre d'outils et couche des cartes mémoïsées, gestes stables.
**Erreur corrigée :** au premier chargement, rien n'était à animer mais l'état de la page restait vide pendant le glissement (57 tests rouges) : sans nœud qui bouge ni ne disparaît, la carte se met à jour d'un coup.
**Règle apprise :** animer par le magasin d'une bibliothèque contrôlée est rapide, mais l'état React doit toujours finir par recevoir la valeur finale — et ne jamais rester vide pendant l'animation.
**Correction (08:30) :** en version de production, plus aucune animation : React Flow réimposait les positions finales à chaque image quand le glissement passait par son magasin. Retour au glissement par l'état de la carte (qui fonctionnait), en gardant repli / dépli animés, « Réorganiser » sur tout le graphe et la mémoïsation. Retiré aussi : un calque par nœud pendant un glissement (`will-change`), qui saturait la carte graphique à plus de 100 nœuds.
**Règle apprise :** une optimisation de performance se vérifie dans l'app construite, pas seulement en développement ni dans les tests (jsdom n'anime rien).
**Ajustement (09:00) :** le glisser d'une carte enregistrait sa place à chaque mouvement de souris : toutes les cartes et leurs discussions se redessinaient. La carte se déplace maintenant directement à l'écran (`translate`, une fois par image) et sa place n'est enregistrée qu'au lâcher.

### [2026-10-09 10:30] FEAT — spec 023 lot 0 : lecture de la vue Workflow (fondations)
**Fichiers :** `infrastructure/files/projectFiles.ts` (lecture gardée sous la racine, extraite d'`ElementFilesService`), `shared/structure/covers.ts` (`covers`, `coveringElement`, réexportés par `domain/reprise/measured.ts`), `shared/ipc/projectFile.ts` (schéma `ProjectFile` partagé), `shared/ipc/workflow.ts` (types, `WORKFLOW_KEY`), `domain/workflow/{limits, parseSpec, parseTasks, specStatus, brainstorm}.ts`, `application/workflow/WorkflowService.ts`, `infrastructure/db/repositories/WorkflowFoldRepository.ts`, `ipc/workflowHandlers.ts` (`workflow:read`, `workflow:file`, `workflow:setFolded`), `bootstrap.ts`, `channels.ts` ; tests `covers`, `workflow-parse-spec`, `workflow-parse-tasks`, `workflow-status`, `workflow-brainstorm`, `ipc/workflow-handlers`, `integration/workflow/workflow-service`.
**Quoi :** le processus principal lit en lecture seule les specs, tâches, documents de brainstorm et la fondation d'un projet lié, et en tire une vue typée : statut de chaque spec (marqueur de la ligne Status prioritaire, sinon calculé par les cases), user stories livrées, socle, reliquats, chemins cités par les tâches, familles de brainstorm, idées à brainstormer. Aucune écriture dans le projet ; un fichier piégé (HTML, `..`, jonction vers l'extérieur, fichier géant, binaire, `.env`) est ignoré ou refusé sans bloquer la vue.
**Décision :** un marqueur ne compte que s'il ouvre la ligne Status (« Livrée (date) ») : « Draft — US1 livrée » n'en est pas un (research R2 précisé). Le repli vit dans la table `settings` via un dépôt dédié (couche infrastructure), pas dans le service.
**Règle apprise :** sous Windows, un lien symbolique de fichier demande des droits d'administrateur ; les tests de sortie du dossier utilisent des jonctions de dossier.
**Erreur corrigée (lecture du dépôt du Brainstormer) :** les tâches à suffixe (`T009b`, `T024a`, `T031b`) étaient ignorées (compteurs faux : 020 à 34/34 au lieu de 39/39) ; une user story sans tâche étiquetée restait « non livrée » dans une spec livrée (004, 008). Identifiant `T\d{3,4}[a-z]?` admis ; sans tâche étiquetée, l'US suit sa spec. Lecture des 22 specs et 77 documents en ≈ 140 ms.

### [2026-10-09 11:30] FEAT — spec 023 US1 : la vue Workflow sur la carte
**Fichiers :** `shared/ipc/canvas.ts` (`linkedProject`), `CanvasService.ts`, `shared/ipc/workflow.ts` (`isToBrainstorm` partagé), `canvas/workflow/{workflowTree, workflowGraph, WorkflowNode, useWorkflow}.ts(x)`, `workflow/workflow.css`, `living/{nodeVisual, icons, LivingNode, living.css}` (pictogrammes de branches, spec, user story, socle ; ligne `meta` sous le titre), `buildGraph.ts` (`StructureViewKind`, `WorkflowNodeType`, barre aussi sans carte dessinée, nœuds Workflow à la place de la structure), `nodes/StructureBarNode.tsx` (« Workflow | Progression | Architecture », « Relire »), `uiStore.ts`, `IdeasCanvas.tsx` (type de nœud, parent pour les glissements, relecture) ; tests `renderer/workflow-tree`, `renderer/workflow-view`, `canvas.test.ts`, `architecture-view.test.tsx` (barre : `hasMap`).
**Quoi :** un genesis lié à un dossier de projet porte la barre même sans carte de structure ; « Workflow » remplace sa structure par quatre branches (En cours, À venir, Livrées, À brainstormer), puis spec › user stories › tâches restantes, socle replié, en nœuds vivants et sens alterné ; avancement « faites / toutes » sous chaque titre ; repli mémorisé par projet (réponse immédiate dans le cache, puis `workflow:setFolded`) ; relecture à chaque fin de tour de Claude et sur « Relire » ; projet vide : message ; dossier introuvable : message et « Relier le dossier… ». Progression et Architecture inchangées.
**Règle apprise :** dans les tests jsdom, le glissement image par image ne se termine pas : un test d'intégration de la carte qui attend de nouveaux nœuds passe en animations réduites. Un `combine` de `useQueries` doit être stable (`useCallback`), sinon la carte se reconstruit à chaque rendu.

### [2026-10-09 12:30] FEAT — spec 023 US2 et US3 : les cartes de la vue Workflow
**Fichiers :** `canvas/workflow/{prompts.ts, WorkflowCard.tsx}` (consignes, carte, lecteur de fichier, fondation, repli partagé `useWorkflowFold`), `WorkflowNode.tsx` (repli partagé), `cards/cardContent.ts` (sujet `workflow`, en-têtes par sorte de nœud), `cards/IdeaCards.tsx` (carte Workflow ; fondation dans la carte du genesis en vue Workflow), `cards/cardsStore.ts` (lecteur `workflow`), `IdeasCanvas.tsx` (clic, Entrée et double-clic sur un nœud Workflow ; pas de carte pour un message), `app/uiStore.ts` (`chatDrafts`, `seedChatDraft`, `takeChatDraft`), `chat/ChatPanel.tsx` (reprend une consigne pré-remplie une fois, sans l'envoyer) ; tests `renderer/workflow-card`, `renderer/workflow-view` (cartes dans la carte des idées), `chat-panel`.
**Quoi :** retour de mentalyas (« dommage que la carte ne s'ouvre pas en cliquant sur un nœud ») : chaque nœud Workflow ouvre sa carte de détails. Tâche, user story, socle, idée à brainstormer : « Discuter » (ou double-clic) ouvre la conversation du projet dans la carte du genesis avec la consigne pré-remplie (implémenter la tâche, mener les tâches restantes, lancer /brainstorm) — rien n'est envoyé sans son geste. Spec : statut, date, nombre de décisions, avancement ; « Détail » liste les user stories, les reliquats et le brainstorm d'origine ; « Lire la spec / les tâches / le plan » ouvre le fichier à droite, en texte brut numéroté. Genesis en vue Workflow : résumé de la fondation et « Lire la fondation ».
**Règle apprise :** dans les tests de la carte, `userEvent` déclenche le glisser de d3-zoom qui plante sous jsdom ; `fireEvent` pour cliquer sur un nœud React Flow.

### [2026-10-09 02:10] FIX — spec 001 T043 : accessibilité de Réglages › IA
**Fichiers :** `pages/settings/ai/AiSettingsPage.tsx`, `components/molecules/Section.tsx`, test `ai-settings.test.tsx` (+3 : axe, parcours clavier, focus conservé). 1 669 tests verts.
**Quoi :** vérification de l'écran tel qu'il est depuis la spec 010 (Claude Code, modèles par usage, Ollama, repli). Corrigé : (1) contraste des états « Prêt / Indisponible » : les variantes `dark:` de Tailwind suivent le système, pas le thème choisi — en sombre ou Carbone avec Windows en clair, le vert tombait à ~3:1 ; ils passent aux jetons du thème `text-pro` / `text-idea` (AA partout), la pastille « ● » est décorative ; (2) la page ouvrait un second `<main>` dans celui de l'app ; (3) un bouton ou une liste désactivés pendant un traitement perdaient le focus, renvoyé en haut de la page au clavier : `aria-disabled` + action ignorée pendant une autre ; (4) « Revérifier » ×2 et « Enregistrer » avaient des noms ambigus hors contexte (nom accessible qui commence par le texte visible) ; (5) l'aide des modèles faisait partie du libellé : elle passe en description ; (6) `Section` tirait son identifiant du titre (accents, doublons possibles) : `useId`.
**Règle apprise :** dans cette app, ne jamais colorer avec `dark:` de Tailwind — le thème est choisi dans l'app (`data-theme`), seuls les jetons de `tokens.css` le suivent. Et ne pas désactiver un contrôle qui a le focus.
**Reste hors périmètre :** `ContextPage.tsx` a aussi son propre `<main>`, et `Button` (variante `danger`) utilise `dark:` ; à reprendre avec le même correctif.

### [2026-10-09 13:15] FEAT — spec 023 US4 : les fichiers des tâches et leur code
**Fichiers :** `shared/ipc/workflow.ts` (`missingFiles`), `application/workflow/WorkflowService.ts` (chemins cités introuvables sous la racine), `canvas/workflow/WorkflowCard.tsx` (`filesOf`, `elementCovering`, rubrique « Fichiers », « ↗ structure »), `cards/IdeaCards.tsx` (éléments du genesis passés à la carte) ; tests `integration/workflow/workflow-service`, `renderer/workflow-card` et fixtures (`missingFiles`).
**Quoi :** retour de mentalyas (« il manque de voir les fichiers associés et leur code aux tâches ») : la carte d'une tâche liste les fichiers qu'elle cite (union pour une user story, un socle, une spec) ; un clic ouvre le fichier à droite avec son code numéroté et coloré, en lecture seule ; un fichier introuvable est barré et grisé ; « ↗ structure » bascule en Progression et ouvre la carte de l'élément qui couvre le fichier (le plus profond, le chemin le plus précis — même règle que les appels mesurés, partagée).
**Note :** un élément caché sous un parent replié n'a pas de nœud : sa carte ne s'affiche qu'une fois le parent déplié.

### [2026-10-09 14:00] FEAT — spec 023 D12 : raccourcis du code dans le lecteur Workflow (tree-sitter)
**Fichiers :** `application/workflow/WorkflowSymbols.ts` (un fichier analysé par le processus d'analyse de la spec 017, réponse revalidée par Zod, délai de 10 s), `WorkflowService.ts` (`target` : mêmes gardes que la lecture), `ipc/workflowHandlers.ts` (`workflow:symbols`), `bootstrap.ts`, `channels.ts`, `shared/ipc/workflow.ts` (`WorkflowSymbolView`), `canvas/workflow/WorkflowCard.tsx` (raccourcis au-dessus du code, surlignage au clic) ; spec 023 amendée (D12) ; tests `integration/workflow/workflow-symbols` (vrai moteur tree-sitter, réponse piégée, panne, délai), `ipc/workflow-handlers`, `renderer/workflow-card`.
**Quoi :** retour de mentalyas : le lecteur des éléments montrait les méthodes et fonctions d'un fichier (analyse d'un projet repris), pas celui de la vue Workflow. Le lecteur Workflow demande maintenant l'analyse syntaxique du seul fichier ouvert (tree-sitter, `@vscode/tree-sitter-wasm`, MIT — déjà présent) : classes, interfaces, fonctions et méthodes s'affichent en raccourcis ; un clic surligne le code et la vue s'y place. Le code s'affiche tout de suite, les raccourcis dès que l'analyse répond.
**Sécurité :** le fichier est lu et analysé dans le processus séparé de l'app, jamais exécuté ; seul un chemin déjà autorisé (cité par une tâche ou fichier de méthode) est analysé ; une réponse non conforme, une panne ou un délai dépassé donnent « aucun raccourci ».

### [2026-10-09 15:00] FEAT — spec 023 D6 précisé : une conversation par nœud, dans sa carte
**Fichiers :** `schemaNeurons.ts` et `shared/ipc/neurons.ts` (sorte `workflow_chat`, sans migration : texte), `infrastructure/db/repositories/WorkflowChatRepository.ts`, `application/workflow/WorkflowChats.ts`, `ipc/workflowHandlers.ts` (`workflow:chat`), `bootstrap.ts`, `channels.ts`, `shared/ipc/chat.ts` et `ConversationService.ts` (rôle `workflow`), `chat/{ChatPanel, useChat}.ts(x)` (sous-titre « Nœud du workflow », sans « plan d'attaque », « document » ni « Commencer le brainstorm » ; consigne reprise par clé de carte `draftKey`), `canvas/workflow/{WorkflowCard, prompts}.ts(x)` (la carte s'étire avec la conversation du nœud ; une spec est aussi discutable), `IdeasCanvas.tsx` (double-clic) ; spec 023 (D6 précisé) et contrats amendés ; tests `integration/workflow/workflow-service` (conversation créée puis reprise, cachée de la carte), `ipc/workflow-handlers`, `renderer/workflow-card`, `renderer/workflow-view`.
**Quoi :** retour de mentalyas (capture : « Discuter » sur le Socle ouvrait la carte du genesis à part) : « l'idée est que je discute avec Claude sur base du nœud sélectionné ». « Discuter » étire maintenant la carte du nœud vers la droite avec **sa propre conversation** (neurone caché `workflow_chat`, rattaché au genesis, clé du nœud), créée au premier geste et reprise ensuite ; la consigne pré-remplie porte sur ce nœud (tâche, user story, socle, spec, idée).
**Sécurité :** la conversation d'un nœud est rattachée au genesis par `genesis_id` : elle travaille dans son dossier et la garde de confidentialité (« Local uniquement ») la retrouve par lui ; clé validée (même projet) et titre borné à l'entrée IPC.

### [2026-10-09 12:25] FEAT — spec 023 D13 : les fichiers de méthode mis en forme dans le lecteur
**Fichiers :** `canvas/workflow/tasksMarkdown.ts` (`decorateTasks`, pur), `canvas/workflow/WorkflowCard.tsx` (lecteur : Markdown mis en forme, bascule « Mis en forme | Texte brut »), spec 023 amendée (D13) ; tests `renderer/workflow-tasks-markdown` (nouveau), `renderer/workflow-card` (+1, test du HTML brut adapté). 1 680 tests verts.
**Quoi :** retour de mentalyas au test guidé US4 (« lire les tâches, le texte est brut ; j'aimerais une mise en forme plus jolie ») : un `.md` (spec, tâches, plan, brainstorm, fondation) s'affiche mis en forme avec le composant `Markdown` du chat (titres, cases à cocher, tableaux, code) ; dans `tasks.md`, l'identifiant `T0NN` passe en gras et `[US4]`, `[P]` en pastilles. « Texte brut » rend le texte numéroté d'avant.
**Sécurité :** même rendu que les réponses de Claude (spec 008) : `skipHtml` (aucun HTML brut interprété), images jamais chargées, liens https seulement, hors de l'app. Un `<script>` dans un `.md` n'est ni rendu ni exécuté, dans les deux modes (testé).
**Règle apprise :** réutiliser le rendu Markdown sûr du chat plutôt qu'en écrire un second : un seul endroit à durcir.

### [2026-10-09 12:30] REFACTOR — spec 023 D9 révisé : le module d'un fichier affiché sur place
**Fichiers :** `canvas/workflow/WorkflowCard.tsx` (`trailOf`, rubrique « Fichiers » sans bouton « ↗ structure », bascule retirée), spec 023 (D9, FR-013, US4), `quickstart.md` (scénario 6), `contracts/interfaces.md`, `tasks.md` (T035 annoté) ; test `renderer/workflow-card` (module affiché, aucune bascule). 1 680 tests verts.
**Quoi :** retour de mentalyas au test guidé US4 (« je ne comprends pas l'utilité de la vue Progression quand on clique sur structure ») : changer de vue faisait perdre la tâche de vue pour une information d'une ligne. À côté de chaque fichier cité, la carte affiche maintenant le module de la structure qui le couvre (« Parent › Élément »), sans quitter la vue Workflow ; rien quand aucun élément ne le couvre.
**Règle apprise :** un pont entre deux vues ne vaut que si la destination apporte plus que ce qu'on quitte ; une information courte s'affiche sur place.

### [2026-10-09 12:40] SECURITY + DOCS — liens inertes dans le lecteur ; spec 023 US5 « Anatomie d'un fichier » (D14)
**Fichiers :** `chat/Markdown.tsx` (option `inertLinks`), `canvas/workflow/WorkflowCard.tsx` (lecteur : liens inertes), test `renderer/workflow-card` (lien affiché, jamais actif) ; spec 023 (D13 corrigé, D14, US5, cas limites, FR-019 à FR-024, SC-007), `tasks.md` (T037 cochée : test guidé US4 validé par mentalyas).
**Quoi :** (1) écart repéré en relisant la spec : D13 laissait les liens https d'un `.md` du projet cliquables, alors que FR-003 exige « aucun lien actif vers l'extérieur » pour le texte lu ; dans le lecteur, un lien est maintenant souligné, adresse au survol, et rien ne s'ouvre (les réponses de Claude gardent leurs liens). (2) brainstorm flash de mentalyas : un dernier niveau sous tâche › fichier › code, retenu en entier : schéma du fichier (imports, blocs reliés par les appels internes, blocs offerts, blocs peut-être inutilisés), parcours de lecture pas à pas, blocs nommés par la tâche mis en valeur. Source : l'extraction tree-sitter du processus d'analyse (symboles avec parent et complexité, imports, appels), déjà produite pour D12.
**Règle apprise :** relire les exigences de sécurité de la spec (FR-003) avant de réutiliser un composant pensé pour un autre contexte : le rendu Markdown du chat fait confiance à ses liens, un fichier d'un projet importé non.

### [2026-10-09 13:40] FEAT — spec 023 US5 : l'anatomie d'un fichier (schéma, parcours de lecture, blocs cités)
**Fichiers :** `analysis-worker/{extract, protocol}.ts` (`exported` par symbole ; `<Composant>` JSX compté comme appel ; `export { a }`), `main/domain/workflow/anatomy.ts` (pur : blocs, imports regroupés, appels internes par le nom, ambigus, peut-être inutilisés, bornes), `application/workflow/WorkflowAnatomy.ts` (renommé de `WorkflowSymbols.ts`), `shared/ipc/workflow.ts` (`WorkflowAnatomyView`), `channels.ts`, `ipc/workflowHandlers.ts`, `bootstrap.ts` (`workflow:anatomy` remplace `workflow:symbols`), `canvas/workflow/{anatomyPath.ts, FileAnatomy.tsx, WorkflowCard.tsx}` ; spec 023 (research R10–R14, plan, contrats, tâches T043–T050, quickstart 9) ; tests `reprise/extract` (+4), `workflow-anatomy` (nouveau), `integration/workflow/workflow-anatomy` (renommé), `ipc/workflow-handlers`, `renderer/workflow-anatomy-path` (nouveau), `renderer/workflow-card` (+4). 1 704 tests verts.
**Quoi :** brainstorm flash de mentalyas (« un dernier niveau de schéma qui concerne le code du fichier lui-même ; ludique, utile, facile à comprendre »). Le lecteur d'un fichier de code analysé gagne « Code | Schéma » : à gauche ce qu'il utilise, au centre ses blocs (hauteur selon les lignes, complexité ● ●● ●●●) reliés par des arcs d'appel, à droite ce qu'il offre ; bloc peut-être inutilisé grisé ; bloc nommé par la tâche « ✦ ». Clic sur un bloc : retour au code surligné. « Parcours de lecture » : étapes numérotées depuis les blocs offerts en suivant leurs appels, puis « Le reste » ; ← / → ou Précédent / Suivant, le code suit sous le schéma réduit. Au-delà de 40 blocs, classes repliées. Une seule analyse par fichier : les raccourcis (D12) sont tirés de la même anatomie.
**Choix (mentalyas m'a laissé décider) :** marqueur `exported` lu dans l'arbre syntaxique par l'analyseur (pas de recherche de `export` dans le texte) ; JSX compté comme appel dans l'analyseur partagé — la spec 017 y gagne les usages de composants (suite 017 verte) ; schéma en HTML + SVG (pas de React Flow : panneau étroit, disposition fixe, plus léger).
**Erreur corrigée :** un essai sur les vrais fichiers (`WorkflowCard.tsx`, `IdeasCanvas.tsx`) grisait les gestionnaires locaux des composants (`read`, `onKeyDown`…), passés en valeur et jamais appelés par leur nom ; une fonction locale à une fonction n'est plus grisée (R12 précisé).
**Sécurité :** le fichier est analysé dans le processus séparé, jamais exécuté ; la réponse est revalidée (Zod strict, champ `exported` compris) puis bornée (500 blocs, 200 sources, 2 000 appels) ; noms affichés comme texte.
**Règle apprise :** essayer une heuristique sur de vrais fichiers du dépôt avant de la montrer : les tests synthétiques ne voyaient pas les gestionnaires passés en valeur.

### [2026-10-09 15:30] FEAT — spec 023 US5 bis : le schéma d'un fichier en grand, explicite et raconté
**Fichiers :** `analysis-worker/{extract, protocol}.ts` (`doc` : phrase du commentaire collé, nettoyée), `shared/ipc/workflow.ts` et `domain/workflow/anatomy.ts` (`doc`), `canvas/workflow/{anatomyTree.ts, AnatomyNode.tsx, AnatomyOverlay.tsx, workflow.css}` (nouveaux : rôles, arbre en couches, nœuds à formes géométriques, fenêtre plein écran), `WorkflowCard.tsx` (« ◈ Schéma du fichier » ; liste à arcs `FileAnatomy.tsx` et `anatomyRows` retirés), `anatomyPath.ts` ; spec 023 (D14 précisé, FR-019/021/022, R13 remplacée, R15, R16, T050–T057) ; tests `reprise/extract` (+3), `renderer/workflow-anatomy-tree` (nouveau), `renderer/workflow-card` (fenêtre : récit, survol, parcours, Échap, axe), `renderer/workflow-anatomy-path` (allégé).
**Quoi :** test guidé T050 de mentalyas : « pas assez ludique et explicite ». Il a retenu : phrase « ce que ça fait », rôles en mots et couleurs, survol qui raconte, parcours façon histoire, **nœuds aux formes géométriques nettes et connexions claires**, en grand et en arbre. « ◈ Schéma du fichier » ouvre une fenêtre plein écran : arbre de haut en bas (offert en haut, appelés dessous, méthodes sous leur classe), une forme par rôle (composant à bandeau, hook hexagonal, classe à double bordure, type à coins coupés, méthode en pilule, utilitaire rectangulaire) et une couleur de jeton du thème, légende « Comment lire ce schéma », liens orthogonaux fléchés (pointillés pour « contient », tirets si ambigu), sous chaque nom la première phrase de son commentaire. Survol : le reste s'éteint, le récit dit qui l'appelle et ce qu'il appelle. « ▶ Raconter le fichier » : étapes cadrées, blocs visités cochés, jauge « N / M explorés ». « Voir le code » referme et surligne le bloc.
**Choix :** React Flow (déjà là) pour déplacer et zoomer un arbre parfois large ; disposition en couches maison, pure et testée (pas d'ELK / dagre) ; la phrase vient des commentaires du code (pas d'appel à Claude) ; la fenêtre est rendue hors de la carte (portail) car la carte est déplacée par transformation.
**Erreurs corrigées :** (1) un `<header>` dans la fenêtre doublait le repère « bannière » de la page (axe) : `role="dialog"` retire à `<section>` son rôle de section ; en-tête en `<div>`. (2) Un essai sur `WorkflowCard.tsx` montrait des phrases encombrées de `**` et de « (spec 023 D6, précisé le …) » : retirés à l'extraction. (3) Un commentaire de `Segmented` parlait encore de « Code | Schéma ».
**Règle apprise :** pour une vue « ludique », montrer le sens (phrase, rôle) avant la structure ; et, en français, garder l'espace avant « : » quand on nettoie un texte.

### [2026-10-09 16:30] FEAT — spec 023 D15 : « Que fait ce fichier ? » remplace le schéma
**Fichiers :** `domain/ai/{types, routing}.ts` (tâche `file_summary`), `shared/ai/schemas.ts` (`FileSummaryOut`), `infrastructure/ai/FileSummaryFrame.ts`, `application/ai/{ContextAssembler, FileSummaryTask}.ts`, `composition/aiEngine.ts`, `application/workflow/WorkflowSummaries.ts`, `shared/ipc/{workflow, channels}.ts`, `ipc/workflowHandlers.ts`, `bootstrap.ts`, `canvas/workflow/{FileExplanation.tsx, WorkflowCard.tsx}` ; retirés : `AnatomyOverlay.tsx`, `AnatomyNode.tsx`, `anatomyTree.ts`, `anatomyPath.ts`, formes de `workflow.css` et leurs tests ; spec 023 (D15, D16, FR-025, FR-026, R17, T057–T063, quickstart 9–10, contrats) ; tests `workflow-summaries` (nouveau), `ipc/workflow-handlers`, `renderer/workflow-card`.
**Quoi :** 2e test guidé de mentalyas : « le survol est bugué, et le résultat général n'est pas compréhensible ». Au lieu de corriger à l'aveugle, question de fond posée : le schéma répondait à « qui appelle qui » (vue de développeur) ; mentalyas veut « que fait ce fichier ? ». « ✨ Expliquer ce fichier » (à la demande) : rôle en une phrase simple, ce qu'il reçoit, ce qu'il produit, 3 à 5 morceaux importants dans l'ordre de lecture, cliquables vers leur code. Le schéma (jamais commité) est retiré. Retour de mentalyas noté pour le lot suivant (D16) : voir les tâches accomplies.
**Sécurité :** tâche sans outil par la passerelle, code balisé comme donnée (balises fermantes neutralisées), sortie validée par schéma, morceaux réduits aux blocs existants, affichage en texte ; projet « Local uniquement » : IA locale, jamais Claude.
**Règle apprise :** quand mentalyas dit « pas compréhensible », demander d'abord quelle question la vue doit résoudre (avec des aperçus), avant d'en améliorer la forme ; deux itérations de forme sur la mauvaise question ont coûté plus cher que la question.

### [2026-10-09 17:00] FEAT — spec 023 D15 précisé : un petit schéma dans l'explication
**Fichiers :** `shared/ai/schemas.ts` (`liens`), `infrastructure/ai/FileSummaryFrame.ts` (v2), `shared/ipc/workflow.ts` (`flow`), `application/workflow/WorkflowSummaries.ts` (flèches filtrées), `canvas/workflow/{flowDiagram.ts, FileExplanation.tsx}` ; spec 023 (D15 précisé, FR-025, R18, T061, T064, T065) ; tests `workflow-summaries`, `ipc/workflow-handlers`, `renderer/workflow-flow-diagram` (nouveau), `renderer/workflow-card`.
**Quoi :** retour de mentalyas au test T061 : « l'explication est TOP, mais y'a moyen de la générer avec un petit mermaid en plus ? ». Option retenue (sur deux proposées) : schéma **dessiné par l'app** plutôt que la bibliothèque `mermaid`. Claude renvoie aussi des flèches légendées (entrée → morceaux → sortie) ; le main garde celles dont les deux bouts existent ; « Comment ça marche » les dessine de haut en bas, un clic sur un morceau surligne son code, « Copier en Mermaid » donne le même schéma en texte pour ses notes.
**Sécurité :** aucun texte de l'IA n'est interprété (SVG construit par l'app, libellés en texte) ; le Mermaid copié a des identifiants générés et des libellés échappés.
**Erreur corrigée :** un `useId()` placé après un `return` anticipé (règle des hooks) ; et dans le test, `userEvent.setup()` remplaçait le presse-papiers simulé — le simuler après.

### [2026-10-09 17:30] FEAT — spec 023 D17 : un lecteur confortable (colonnes, plein écran)
**Fichiers :** `canvas/workflow/{WorkflowCard.tsx, FileExplanation.tsx}`, `canvas/cards/cards.css` ; spec 023 (D17, FR-027, T065–T067) ; test `renderer/workflow-card` (+1).
**Quoi :** capture de mentalyas au test du petit schéma : tout s'empilait dans un volet de 600 px (explication, schéma agrandi à la largeur, raccourcis, 3 lignes de code). Explication ouverte : explication à gauche, code à droite, chacun sur toute la hauteur (lecteur de 1 000 px) ; le schéma garde sa taille naturelle ; « ⤢ Agrandir » ouvre le lecteur sur toute la fenêtre (portail hors de la carte, Échap réduit sans fermer la carte, focus rendu à « Agrandir »).
**Erreur corrigée :** (encore) un `<header>` dans un dialogue devient une seconde bannière de la page pour axe : en-tête du lecteur en `<div>`.
**Règle apprise :** un SVG en `width: 100%` s'agrandit avec son conteneur : donner sa taille naturelle et seulement `max-width: 100%`. Et pour un volet de taille fixe, répartir en colonnes plutôt qu'empiler.

### [2026-10-09 17:50] FIX — spec 023 D17 précisé : le petit schéma respire
**Fichiers :** `canvas/workflow/{flowDiagram.ts, FileExplanation.tsx}` ; spec 023 (D17, T067–T069) ; test `renderer/workflow-flow-diagram` (+1 : le cas de la capture).
**Quoi :** capture de mentalyas : les verbes de cinq flèches convergeant sur `renderCard` s'empilaient au même milieu, et la flèche « Reçoit → renderCard » traversait la rangée des autres départs. Les départs (morceaux que rien n'appelle) rejoignent « Reçoit » sur la première rangée ; écarts agrandis ; chaque verbe sur une pastille près du départ de sa flèche, décalée si elle touche une boîte ou une autre pastille, coupée au-delà de 24 caractères avec le texte entier au survol.
**Règle apprise :** une étiquette au milieu d'une flèche se superpose dès que plusieurs flèches convergent ; la poser près du départ, et tester l'absence de chevauchement par la géométrie sur le cas réel.

### [2026-10-09 18:20] FEAT — spec 023 D18 : l'explication reste tant que le code ne change pas
**Fichiers :** `infrastructure/db/schemaReprise.ts` (`code_file_summaries`), `migrations/0038_file_summaries.sql` + `down/0038_file_summaries.down.sql` (écrit à la main), `meta/_journal.json` (nom de la migration), `repositories/FileSummaryRepository.ts`, `application/workflow/WorkflowSummaries.ts` (`saved`, enregistrement, revalidation Zod, demandes en cours partagées), `shared/ipc/{workflow, channels}.ts`, `ipc/workflowHandlers.ts`, `bootstrap.ts`, `canvas/workflow/WorkflowCard.tsx` ; spec 023 (D18, FR-028, R17 révisée, contrats, T069–T071) ; tests `integration/workflow/file-summary-repository` (nouveau, vraie base chiffrée), `workflow-summaries` (+2), `ipc/workflow-handlers`, `renderer/workflow-card` (+2).
**Quoi :** demande de mentalyas : « ce qui est généré par une analyse explicative reste là tant que le code n'a pas été changé ». L'explication était gardée en mémoire seulement (perdue au redémarrage). Elle est enregistrée avec l'empreinte SHA-256 du contenu ; à l'ouverture du fichier, elle s'affiche d'elle-même sans appeler l'IA ; code changé : pas d'ancienne explication, bouton « ✨ Réexpliquer (le code a changé) » ; la nouvelle remplace l'ancienne.
**Sécurité :** requêtes paramétrées (testé avec un chemin piégé) ; JSON relu revalidé par un schéma strict (une ligne abîmée est ignorée, jamais affichée) ; aucun code enregistré, seulement le texte de l'explication.
**Erreur corrigée :** `integration/neurons/migrations` vérifiait qu'aucune table `code_*` ne reste après l'annulation de 0028 : la nouvelle table (0038) restait ; les annulations se jouent maintenant à rebours (0038 d'abord) et 0038 a son propre test.
**Règle apprise :** `drizzle-kit generate` nomme les migrations au hasard : renommer le fichier **et** son `tag` dans `meta/_journal.json`, puis écrire le `down`.

### [2026-10-09 19:00] DOCS — spec 024 « Accueil ProjectMaster » (spécifiée)
**Fichiers :** `specs/024-accueil-projectmaster/{spec.md, checklists/requirements.md}`, `docs/brainstorm/L1k-accueil-projectmaster.md` (brainstorm mené par mentalyas dans le Brainstormer), `CLAUDE.md` (évolution du 2026-10-09).
**Quoi :** reprise du relais après le brainstorm L1k : spec écrite à partir de ses 8 décisions (un projet par canevas, le genesis redevient le départ d'une idée, pas de brainstorm hors projet, workflow ProjectMaster gardé tel quel, formulaire « Nouveau projet », continuer comme `/hub work`, fin de session éclatée en cases à cocher, le coffre). Cinq user stories (US1 retrouver mes projets — MVP, US2 continuer, US3 créer et brainstormer, US4 fin de session, US5 coffre au premier lancement), FR-001 à FR-018, SC-001 à SC-006. Trois questions tranchées par mentalyas : l'app fait elle-même les étapes de `/hub` et Claude ne sert qu'au `/brainstorm` (pas de nouveau mode de conversation) ; le contenu sans projet de la carte unique va dans un projet local « Idées en vrac » ; le skill `/hub` gagne une option GitHub oui / non (hors de ce dépôt, avec son accord).
**Note :** `.specify/feature.json` reste sur la spec 023 (en cours) ; la 024 sera planifiée et codée après la fermeture d'une partie des chantiers ouverts (L1k, « Suite »).

### [2026-10-09 19:30] FEAT — spec 023 D16 : les tâches faites visibles sur la carte
**Fichiers :** `canvas/workflow/{workflowTree.ts, prompts.ts, WorkflowCard.tsx}`, `canvas/cards/cardContent.ts` ; spec 023 (T062) ; tests `renderer/workflow-tree`, `renderer/workflow-view`, `renderer/workflow-card` (+2).
**Quoi :** retour de mentalyas (« je dois voir les tâches qui ont été accomplies ») : sous chaque user story et chaque socle, un nœud « ✓ Faites (N) » replié d'office ; déplié, il montre les tâches cochées (pastille « faite », « ✓ » dans le titre), chacune ouvrant sa carte avec ses fichiers, leur code et l'explication. Le socle apparaît aussi quand toutes ses tâches sont faites (statut « fait »), et une spec livrée montre ses tâches faites (ses reliquats restent dans sa carte, D7). « Discuter » sur une tâche faite propose de la **relire** (ce qu'elle a changé, est-elle complète), plus de l'implémenter ; le groupe « Faites » n'a pas de conversation ; sa carte liste ses tâches et l'union de leurs fichiers.

### [2026-10-09 19:45] DOCS — spec 024 D9 : projet hors du coffre, vault dans le projet
**Fichiers :** `specs/024-accueil-projectmaster/spec.md` (D9, Clarifications, US6, FR-019 à FR-022, SC-007, cas limites, entités).
**Quoi :** correction de mentalyas : un nouveau projet naît toujours dans le coffre ; charger un projet existant ailleurs sur le PC ne le déplace pas et crée dans le projet un vault `.brainstormer/` (comme le `.obsidian/` d'Obsidian). Tranché avec lui : le vault contient les métadonnées (identité, sessions, réglages du canevas), les documents restent en Markdown dans le projet, le contenu de la carte reste dans la base chiffrée (constitution IV inchangée) ; vault ignoré par git par défaut ; référence « externe » au registre du coffre, listée dans l'accueil.

### [2026-10-09 20:10] DOCS — spec 023 T038 : les specs du dépôt rangées par leur marqueur
**Fichiers :** ligne `**Status**` de `specs/{001,002,003,005,006,007,009,011,012,013,014,015,019,021,022}-*/spec.md` ; `docs/brainstorm/L1l-noeuds-genesis.md` (graine) ; `specs/023-carte-workflow/tasks.md` (T038).
**Quoi :** liste proposée puis validée par mentalyas. **Livrée** : 001, 003, 006, 007, 009 (reliquats nommés). **Abandonnée** : 002 (moteur remplacé par la spec 010, T038 demandait la clé API retirée). **En pause** : 005, 011, 012, 013, 014, 015, 019, 021 (planifiée ; sa seule case cochée l'aurait mise « en cours »), 022. Sans marqueur : 004, 008, 010, 016, 020 (toutes cochées), 017 et 023 (en cours), 024 (spécifiée). Pour 022, mentalyas a répondu « à brainstormer » (idées sur les nœuds genesis) : « À brainstormer » montre des L1, pas des specs ; d'où « En pause » + une graine `L1l-noeuds-genesis.md` (sa phrase et le contexte, rien d'inventé), qui apparaît sous « À brainstormer ».
**Vérifié :** lecture de la vue Workflow sur le dépôt par le vrai `WorkflowService` : chaque statut est celui voulu, « À brainstormer » montre L1l.
**Erreur corrigée :** l'ancienne ligne `**Status**` de la 001 citait `L1b-brainstormer.md` ; la remplacer l'avait fait apparaître « à brainstormer » : citation remise. Et la ligne de la 022 ne nomme pas la graine (une L1 citée par une spec quitte « À brainstormer », D11).
**Règle apprise :** avant de réécrire une ligne lue par l'app, vérifier ce qu'elle porte (ici, une citation qui range un L1).

### [2026-10-09 20:45] DOCS + FEAT — spec 023 finitions T039–T041
**Fichiers :** `infrastructure/db/demo/{demoMethod.ts (nouveau), seedDemo.ts}`, `main/index.ts`, `CLAUDE.md` (lignes `seed:demo` et « Workflows actifs »), `docs/FOUNDATION.md` (§0000000 « La vue Workflow », en-tête), `specs/017-reprise-voir/spec.md` (D20 amendé : bascule à trois positions) ; test `integration/db/seed-demo` (+2).
**Quoi :** T039 — le profil démo reçoit un dossier de méthode **fictif** `projet-demo/` (fondation, specs 001 en cours et 002 planifiée, un L1 cité et un L1 à brainstormer, un petit `src/notes/search.ts` cité par une tâche), écrit une seule fois (jamais écrasé) et lié au genesis « Projet démo : application de notes » ; la vue Workflow le lit comme prévu (testé avec le vrai `WorkflowService`). T040 — mesure SC-002 sur le dépôt du Brainstormer (23 specs, 800 tâches, 1 002 nœuds dont 38 affichés repliés) : lecture `workflow:read` ~210 ms, arbre et carte < 10 ms ; objectif 2 s tenu. T041 — amendements de la 017, de FOUNDATION et de CLAUDE.md. Consigne de mentalyas notée : un commit par module ou spec livré, plus de petits commits.
**Note :** un profil démo existant n'est pas relié après coup : `npm run seed:demo:reset` pour le recréer.

### [2026-10-09 20:55] DOCS — spec 023 « Carte Workflow » livrée (T042)
**Quoi :** vérifications finales vertes (typecheck, lint, prettier, 1 721 tests) ; quickstart scénario 7 couvert par `integration/workflow/workflow-service` (HTML et consignes affichés comme texte, `..`, liens symboliques sortants, fichier de 600 Ko, binaire : ignorés ou refusés, vue non bloquée), scénario 8 mesuré en T040 ; toutes les tâches cochées ; ligne `**Status**` : « Livrée ».

### [2026-10-09 21:20] DOCS — spec 024 réécrite : le Project Manager d'abord
**Fichiers :** `specs/024-accueil-projectmaster/spec.md` (réécrite : parcours, D1–D13, clarifications, US1–US7, FR-001 à FR-019, SC-001 à SC-009).
**Quoi :** correction de mentalyas sur le parcours : à l'ouverture, le **Project Manager** propose « Charger un brainstorm existant » (reprise exacte de la cartographie, sauvegarde) ou « Nouveau brainstorm » en trois sources : **de zéro** (dossier créé d'office dans le coffre, structure ProjectMaster), **projet en chantier** (dossier choisi tel quel, vault `.brainstormer/`, git selon le rôle), **depuis un lien Git** (clone dans le coffre, continuer ou extraire des morceaux). Tranché avec lui : sauvegarde automatique continue + points de sauvegarde nommés (retour annulable) ; « scrap » = extraire des morceaux (licence et attribution, spec 021 GH-G) ; git d'un projet en chantier selon le rôle — collaborateur sur sa branche (jamais de push vers la branche par défaut, PR proposée) ou propre dépôt, `git init` proposé sans dépôt. B3 et le rôle collaborateur dépendent de la spec 021.

### [2026-10-09 21:50] DOCS — spec 024 planifiée (`/speckit-plan`)
**Fichiers :** `specs/024-accueil-projectmaster/{plan.md, research.md, data-model.md, contracts/interfaces.md, quickstart.md}`, `.specify/feature.json` (spec 024).
**Quoi :** plan de l'accueil ProjectMaster, appuyé sur l'existant vérifié dans le code : `ProjectService.create` et `projectsRoot` (spec 016), `HubRegistry`, `CloneService` historique (spec 017). Choix (R1–R11) : table `brainstorms` + colonne `brainstorm_id` sur les genesis et les blocs (une coupure minimale plutôt qu'une base par projet) ; état de vue enregistré en différé ; points de sauvegarde = instantanés gzip du canevas, retour « tout ou rien » annulable par un point caché ; section `home` au démarrage ; références externes `external` + `path` au registre, `scripts/launcher.sh` à adapter avec l'accord de mentalyas (repli `.hub/external.json`) ; vault `.brainstormer/` en métadonnées ; rôle git et commit/push via la spec 021 (une seule porte vers git) ; graphe et cours de fin de session confiés à la conversation du projet (pas de Python lancé par l'app) ; migration de la carte unique (genesis du Brainstormer → `gestionnaire-idees`, le reste → « Idées en vrac »). Lots 0–6 faisables maintenant, lot 7 après les lots A, B et G de la 021.
**Découvert :** `pm.bat` construit `projects/<folder>` : une entrée externe sans adaptation le casserait (R6).

### [2026-10-09 22:05] DOCS — spec 024 découpée en tâches (`/speckit-tasks`)
**Fichiers :** `specs/024-accueil-projectmaster/tasks.md` (T001–T041, 10 phases).
**Quoi :** MVP = US1 (Project Manager, reprise exacte, passage de la carte unique aux brainstorms, d'abord sur une copie du profil réel) ; puis US2 points de sauvegarde, US3 de zéro, US4 projet en chantier (propriétaire), US5 clone, US7 coffre ; Phase 9 (collaborateur, fin de session, extraire) après les lots A, B, G de la spec 021. T001 : proposer à mentalyas les modifications hors du dépôt (skill `/hub`, `launcher.sh`) avant tout. Un test guidé par lot, un commit par lot livré.

### [2026-10-09 23:00] FEAT — spec 021 fondations (T002–T011)
**Fichiers :** `tests/support/gitRepos.ts` (dépôts fictifs, lançable par `npx tsx`), `tests/fixtures/git/`, `src/shared/git/model.ts`, `src/shared/ipc/git.ts`, `src/main/domain/git/{args, parse, sensitive, sensitivePatterns, riskyConfig}.ts`, `src/main/infrastructure/process/ProcessRunner.ts`, `src/main/infrastructure/git/{GitRunner, GitWriteQueue}.ts`, `src/main/application/git/RepoLocator.ts`, `src/main/infrastructure/db/{schemaGit.ts, client.ts}`, migration `0039_git` + `down`, `repositories/GitRepository.ts`, `drizzle.config.ts` ; `GitCli.runGit` et `GitProcess` deviennent des enveloppes de l'exécuteur commun ; `ProjectService.initGit` passe le premier message par stdin (`commit -F -`) ; tests `unit/git/*` (5 fichiers), `integration/git/*` (4 fichiers), `projects/project-service`, `neurons/migrations`. 1 762 tests verts.
**Quoi :** socle sûr de git dans l'app : un seul constructeur d'arguments (préfixe R2, chemins après `--`, `assertSafeArgs` qui rend impossibles force, reset, rebase, `--no-verify`, `--amend`, `add -A`…), hooks coupés hors confiance et sur `pr/*`, environnement purgé des `GIT_*` hérités, git par chemin absolu, sorties bornées, stdin, annulation ; fichiers sensibles (règle de nom de la spec 017 + motifs : clé privée bloquante, préfixes de jetons signalés, extraits masqués) ; configuration locale à risque lue AVANT toute autre commande (un dépôt non de confiance piégé ne reçoit que la lecture de sa configuration) ; file d'écriture par projet (`index.lock` → `BUSY`, jamais supprimé) ; tables git sans contenu (adresse avec identifiant refusée).
**Note :** la 021 prend la migration 0039 ; la 024 (planifiée avant) prendra le prochain numéro libre — à corriger dans son `data-model.md` et sa tâche T003 au moment de la coder.
**Règle apprise :** les faux secrets des tests sont assemblés à l'exécution (dépôt public : la détection de secrets de GitHub ne doit pas se déclencher sur un fichier de test).

### [2026-10-10 00:30] FEAT — spec 021 US1 : le dépôt local dans l'app (T012–T016)
**Fichiers :** `application/git/GitService.ts` (état, diff, branches, historique ; préparer, retirer, commit, créer et changer de branche, annuler un commit), `domain/git/authors.ts` (clé d'auteur HMAC), `domain/git/args.ts` (+ diff préparé, sujets, branche existante), `application/ai/GitMessageTask.ts`, `infrastructure/ai/GitMessageFrame.ts`, `shared/ai/schemas.ts` (`GitMessageOut`), `domain/ai/{types, routing}.ts`, `ContextAssembler.ts`, `aiEngine.ts`, `infrastructure/db/repositories/GitRepository.ts` (fusion ouverte), `ipc/gitHandlers.ts`, `shared/ipc/channels.ts` (11 canaux + `git:changed`), `bootstrap.ts` ; interface `renderer/src/git/{RepoBadge, RepoPanel, ChangesTab, DiffView, BranchesTab, HistoryTab, gitQueries}.tsx`, `components/WindowedList.tsx`, `pages/IdeasPage.tsx` (volet à 38 %, `Ctrl+Maj+G`), `canvas/nodes/NeuronNode.tsx` (badge), `app/{uiStore, useMainEvents}.ts` ; tests `integration/git/{git-service, git-message}`, `unit/ipc/git-handlers`, `unit/renderer/git-panel`. 1 783 tests verts.
**Quoi :** un genesis lié à un dossier git porte un badge (« ⎇ main · 3 modifiés ») ; le volet Dépôt s'ouvre à côté de la carte : rien coché d'office, fichiers sensibles verrouillés, diff (− / + en plus de la couleur), « Proposer un message » (Claude sans outil, diff des fichiers préparés non sensibles, ligne de co-auteur retirée, fichiers inventés écartés, format signalé ; rien pour un projet « Local uniquement »), « Commiter (n fichiers) » / `Ctrl+Entrée` qui n'envoie que la sélection vue (sinon « la sélection a changé »), sortie d'un hook en échec sans moyen de passer outre ; branches (création validée, refus « fichiers écrasés » avec la liste) ; historique (« Annuler ce commit » confirmé = commit d'annulation, jamais sur une fusion). Configuration à risque : aucune commande, explication ; opération lancée hors de l'app : lecture seule.
**Sécurité :** git réel testé sur dépôts fictifs : hooks seulement en confiance, message par stdin, chemins après `--`, aucune commande interdite constructible, `.env` jamais lu ni préparé, dépôt piégé intouché.


### [2026-10-10 01:30] TEST — tests de bout en bout sur l'app réelle (Playwright sur Electron)
**Fichiers :** `package.json` (dépendance de dev `playwright-core`, Apache-2.0, 0 alerte ; script `npm run e2e`), `vitest.e2e.config.ts`, `tests/e2e/support/app.ts`, `tests/e2e/git-local.e2e.ts`, `src/main/index.ts` (option `--e2e`, hors app empaquetée), `.gitignore` (`test-results/`).
**Quoi :** demande de mentalyas : Claude teste lui-même l'app de bout en bout plutôt que par checklist manuelle. `npm run e2e` construit l'app, la lance par Playwright (protocole de l'app, aucune touche envoyée à Windows) sur un profil FICTIF `%APPDATA%/gestionnaire-idees-e2e` recréé à chaque passe, et enregistre des captures dans `test-results/e2e/`. Spec 021 US1 : badge, volet sans rien coché, `.env` verrouillé, commit de 2 fichiers sur 3 sans co-auteur ni hook hors confiance, « la sélection a changé », branches, annulation d'un commit (5/5).
**Erreur corrigée :** le dépôt fictif était dans le profil, que l'app refuse pour git (dossier de ses données) : il vit maintenant dans le dossier temporaire, passé par `GI_E2E_PROJECT` (lu seulement avec `--e2e`). Une instance `--e2e` orpheline gardait le verrou d'instance unique : le lanceur ferme l'app si le démarrage échoue.
**Règle apprise :** une case pilotée par l'état git se coche au retour de l'état (son nom passe de « Préparer » à « Retirer ») : attendre ce nouvel état, pas `check()`.

### [2026-10-10 03:00] FEAT — spec 024 US1 + US3 : le Project Manager au lancement, un canevas par projet
**Fichiers :** migration `0040_brainstorms` (+ `down`) et `infrastructure/db/schemaBrainstorms.ts` (tables `brainstorms`, `save_points`, colonnes `brainstorm_id` sur `neurons` et `canvas_blocks`) ; `repositories/{BrainstormRepository, canvasScope}.ts`, `NeuronRepository` et `BlockRepository` filtrés par le brainstorm actif ; `application/brainstorms/{BrainstormScope, BrainstormService, LegacyCanvasMigration}.ts` ; `domain/brainstorms/anomalies.ts` ; `infrastructure/hub/HubFiles.ts` (registre, sessions, JOURNAL en lecture) ; `ipc/brainstormHandlers.ts` (6 canaux) ; `bootstrap.ts`, `index.ts` (options e2e `GI_E2E_VAULT`, `GI_E2E_EMPTY`, `GI_E2E_KEEP`) ; `shared/brainstorms/viewState.ts`, `shared/ipc/brainstorms.ts`, section `home` ; renderer `home/{ProjectManager, BrainstormList, NewBrainstorm, BrainstormBar, useBrainstorms, viewState}`, `AppShell`, `uiStore`, `IdeasPage`, `IdeasCanvas` (cadrage restauré) ; tests `integration/brainstorms`, `unit/brainstorms`, `renderer/project-manager`, `e2e/project-manager.e2e.ts`, `support/vault.ts`. 1 803 tests + 8 e2e verts.
**Quoi :** l'app s'ouvre sur le **Project Manager** (entrée « Projets ») : « Reprendre <dernier> », « Charger un brainstorm existant » (brainstorms de l'app + projets du registre du coffre jamais ouverts, recherche, dossier introuvable grisé, session `/hub` ouverte signalée), « Nouveau brainstorm › De zéro » (projet créé dans le coffre par `ProjectService` : structure ProjectMaster, registre, dépôt git local ; canevas ouvert sur la conversation du genesis, première consigne pré-remplie, jamais envoyée). Chaque brainstorm a **son canevas** (genesis et blocs rattachés) ; l'état de vue (cadrage, vues des cartes de projet, cartes ouvertes) est écrit en différé et revient à la réouverture. À l'ouverture, `/hub work` en lecture : session ouverte, fichiers non commités, commits non poussés, dernières entrées du JOURNAL. La carte unique d'avant est rangée au démarrage (projets liés → leur brainstorm, le reste → « Idées en vrac », sans dossier).
**Décisions datées (spec D14–D16) :** « Idées en vrac » sans dossier ; `.hub/sessions.json` lu mais pas encore écrit (avec la fin de session, US6) ; les projets du registre jamais ouverts sont listés et leur brainstorm naît à la première ouverture.
**Reste :** points de sauvegarde (US2), projet en chantier (US4), lien Git (US5), création du coffre (US7), fin de session (US6), GitHub (spec 021 lot B).
**Règle apprise :** la CSP de l'app refuse l'évaluation de texte (`unsafe-eval`) : dans les tests e2e, `waitForFunction` reçoit une fonction, jamais une chaîne.

### [2026-10-10 04:00] FEAT — spec 024 US2 : points de sauvegarde du canevas
**Fichiers :** `domain/brainstorms/snapshot.ts` (instantané gzip relu par Zod, 20 Mo compressé / 100 Mo décompressé au plus), `repositories/SavePointRepository.ts` (lignes d'un canevas : genesis et descendants hors conversations cachées, blocs, liens ; remplacement en une transaction), `application/brainstorms/SavePointService.ts`, 6 canaux `savepoints:*` (`brainstormHandlers.ts`, `channels.ts`, `shared/ipc/brainstorms.ts`), `bootstrap.ts` ; renderer `canvas/SavePoints.tsx` (bandeau du brainstorm), `uiStore` (`applyViewState`, `canvasEpoch`), `IdeasPage` ; tests `integration/brainstorms/save-points`, `unit/brainstorms/snapshot`, `renderer/save-points`, scénario e2e. 1 813 tests + 9 e2e verts.
**Quoi :** « Points de sauvegarde (n) » dans le bandeau : poser un point nommé, revenir à un point après confirmation (un point caché « avant retour à … » est posé d'abord, puis nœuds, blocs, liens et vue reviennent en une transaction), « Annuler le retour », renommer, supprimer (confirmé). Ce qui n'existait pas au point est archivé ou marqué supprimé, jamais effacé : l'annulation le ramène. La conversation des nœuds (session, modèle, mode, dossiers) et les fichiers du projet ne sont jamais touchés. Bornes : 50 points visibles, 5 points cachés gardés.
**Vérifié (SC-003) :** inventaire identique après retour puis après annulation (intégration) ; dans l'app : idée ajoutée après le point, retour → elle disparaît, annulation → elle revient.
**Règle apprise :** pour comparer un cadrage restauré en e2e, le mesurer au moment où l'on quitte la carte (la carte peut encore bouger juste après un zoom).

### [2026-10-10 04:30] DOCS — brainstorm L1m : wireframes et parcours dans les widgets
**Fichiers :** `docs/brainstorm/L1m-ecrans-wireframes.md`, `CLAUDE.md` (ligne Évolution).
**Quoi :** idée de mentalyas, à partir d'une synthèse de Gemini : un bac à sable visuel en amont du code. Une première
version prévoyait une vue « Écrans » dédiée ; mentalyas a remarqué que les widgets font déjà presque tout. Vérifié
dans le code : branchement nœud → widget (spec 005), widget HTML posé par Claude (MCP), panneau de réglages et
navigation libres dans le cadre isolé. Décision : **pas de nouvelle vue** ; un wireframe ou un parcours est un widget
relié à son nœud (basse fidélité par défaut, panneau de réglages, parcours jouable). La future spec se réduit à trois
ajouts : état persistant d'un widget, lecture et modification d'un widget par Claude (MCP), plein écran. L'éditeur
vectoriel de Gemini est écarté. Spec après la 024 (US4, US5) et la 021 ; 5 questions ouvertes.

### [2026-10-10 05:30] FEAT — spec 024 US4 : projet en chantier (vault `.brainstormer/`, « Relier »)
**Fichiers :** `domain/brainstorms/paths.ts` (dossiers refusés), `infrastructure/hub/{ProjectVault, ExternalRefs}.ts`, `application/brainstorms/ExistingProjectService.ts`, `BrainstormRepository.insert` (identifiant d'un vault repris), 3 canaux `brainstorms:{pickExisting, adoptExisting, relink}`, `bootstrap.ts` (sélecteur natif, dossiers système) ; renderer `home/ExistingProject.tsx`, `NewBrainstorm` (« Projet en chantier » actif), `BrainstormList` (« Relier… »), `ProjectManager` ; `git/RepoBadge.tsx` (badge au-dessus du genesis) ; tests `integration/brainstorms/existing-project`, `renderer/existing-project`, scénario e2e. 1 822 tests + 10 e2e verts.
**Quoi :** « Nouveau brainstorm › Projet en chantier » : le dossier est choisi au sélecteur natif (l'interface ne reçoit qu'un jeton), un aperçu dit ce que l'app écrira (`.brainstormer/brainstorm.json`, `sessions.json`, la ligne `.brainstormer/` du `.gitignore`) et ce qu'elle voit du dépôt (branche lue dans `.git/HEAD`, sans lancer git). Le dossier n'est jamais déplacé ; la référence externe va dans `.hub/external.json`. Rôles : « mon propre dépôt » ou « pas de dépôt » (sans `git init`, D17) ; « collaborateur » grisé jusqu'à la spec 021. Un vault connu rouvre le brainstorm ; un vault abîmé est refusé, jamais réécrit ; un projet déplacé se « relie » par son vault. Refusés : données de l'app, racine d'un disque, dossiers système, dossier personnel entier, coffre et projets du coffre.
**Erreur corrigée :** le badge git de la spec 021 recouvrait le titre du genesis : il passe au-dessus du nœud.
**Règle apprise :** en e2e, le sélecteur de dossier natif se remplace dans le main (`app.evaluate` sur `dialog.showOpenDialog`), jamais par des touches sur le bureau ; `vitest --config vitest.e2e.config.ts` seul teste l'ancien build : passer par `npm run e2e`.

### [2026-10-10 06:30] FEAT — spec 024 US5 : nouveau brainstorm depuis un lien Git
**Fichiers :** `application/brainstorms/CloneBrainstormService.ts`, 2 canaux `brainstorms:{clone, cancelClone}` + l'événement `brainstorms:cloneProgress`, `shared/ipc/brainstorms.ts`, `bootstrap.ts` (service de clone commun) ; renderer `home/CloneProject.tsx`, `NewBrainstorm` (« Depuis un lien Git » actif) ; tests `integration/brainstorms/clone-brainstorm`, `renderer/clone-project`, scénario e2e (vrai clone de `octocat/Hello-World`). 1 829 tests + 11 e2e verts.
**Quoi :** « Nouveau brainstorm › Depuis un lien Git » : le lien est vérifié pendant la saisie (`checkGitUrl` : seuls `https://` et `git@hôte:`, identifiant signalé et jamais gardé), le nom et le dossier sont proposés d'après le dépôt, le clone partiel se fait dans `projects/<dossier>` du coffre par le service de clone commun (sans hooks ni sous-modules, annulable, progression affichée), puis le projet est inscrit au registre (« Cloné depuis <lien sans identifiant> ») et sa carte s'ouvre. Rôle « collaborateur » par défaut (D18) ; contenu cloné jamais exécuté.
**Vérifié :** l'identifiant d'un lien n'est écrit ni au registre ni en base (test d'intégration) ; un échec ou une annulation ne crée rien.

### [2026-10-10 08:00] FEAT — spec 021 US2 : publier, tirer, pousser (T018–T026)
**Fichiers :** `domain/git/{args (fetch, fusion, push d'une branche, plage sortante, contenu brut), ghArgs, pushRules}.ts` ; `infrastructure/git/{GhRunner, GitRunner (transport local réservé aux tests)}.ts` ; `application/git/{GitAccess (aides communes, GitService y passe), SensitiveScan, SyncService, PublishService}.ts` ; `shared/git/sync.ts` ; 10 canaux `git:*` (`gitHandlers.ts`, `channels.ts`) ; `bootstrap.ts` (une seule file d'écriture git par projet, partagée) ; `index.ts` (`GI_E2E_LOCAL_REMOTES`, seulement avec `--e2e`) ; renderer `git/{SyncBar, PushPanel, PublishPanel}.tsx`, `RepoPanel` ; tests `unit/git/git-push-rules`, `integration/git/git-sync`, `renderer/git-sync-panel`, `e2e/git-sync.e2e.ts`. 1 845 tests + 13 e2e verts.
**Quoi :** barre du volet Dépôt « ↓ Tirer (n) », « ↑ Pousser (n) », âge de la vérification et ⟳ (distant vérifié à l'ouverture du volet et sur ⟳). Tirer = avance rapide seulement ; deux historiques divergents → fusion proposée et confirmée (sur l'empreinte du distant vue ; un conflit annule la fusion, dépôt intact, tant qu'US4 n'existe pas). Pousser = aperçu (destination sans identifiant, branche, commits, droits GitHub) puis push d'UNE branche vers UNE branche ; contrôle des fichiers sensibles sur TOUTE la plage (un `.env` dans un ancien commit bloque), préfixes de jetons acceptés ligne par ligne, clés et fichiers sensibles jamais ; règles R10 / D11 (branche principale d'un dépôt d'autrui refusée, propriétaire ou admin / maintain permis). Publier = `gh repo create` sans `--source` ni `--push`, privé par défaut, public après une seconde confirmation, puis `remote add` et push par git ; `gh` absent ou déconnecté → commande à copier.
**Erreurs corrigées :** un test de publication poussait vraiment vers github.com (push maintenant simulé : aucun réseau dans les tests) ; le test « second clone refusé » de la spec 020 attendait 20 ms au hasard (instable sous charge) : il attend que le clone ait démarré.
**Règle apprise :** une seule `GitWriteQueue` pour tout git dans l'app, sinon deux écritures (commit du volet, push) pourraient se croiser sur un même dépôt.

### [2026-10-10 09:30] FEAT — spec 021 US3 : cloner par lien et suivre
**Fichiers :** `application/brainstorms/CloneBrainstormService.ts` (confidentialité, question 500 Mo, après-clone), `bootstrap.ts` (registre des clones en base `git_clones_running` ; après-clone : `git_repos` cloné + dernier commit vu, projet repris + analyse statique), `application/reprise/CloneService.ts` (profil dans l'entrée du registre), `application/git/GitService.ts` (`updates`, `markSeen`, `newSinceVisit`), `domain/git/args.ts` (`rangeLogArgs`), canaux `git:updates`, `git:markSeen`, événement `brainstorms:cloneLarge`, renderer `home/CloneProject.tsx` (confidentialité, question 500 Mo), `git/HistoryTab.tsx` (« Depuis ta dernière visite »), `git/RepoBadge.tsx` (« ✦ N nouveautés »), `reprise/ImportWizard.tsx` (choix exportés) ; specs 021 (D13, tâches), 017 (T029–T031). 1 848 tests + 13 e2e verts.
**Quoi :** décision de mentalyas (D13) : une seule entrée pour cloner, le Project Manager. Au clone : confidentialité choisie (Claude autorisé / Local uniquement, sans défaut), question « Continuer / Arrêter » au-delà de 500 Mo (le téléchargement continue), clone en cours inscrit en base et nettoyé au démarrage après une fermeture brutale ; à la fin : dépôt marqué « cloné » (dernier commit vu = commit cloné), projet repris enregistré, analyse statique lancée. Ensuite : badge « ✦ N nouveautés » et section « Depuis ta dernière visite » (commits du distant depuis le dernier vu, jusqu'à « Marquer comme vu »).
**Erreur corrigée :** l'onglet Historique sortait sur « Aucun commit » avant d'afficher les nouveautés.
**Reporté :** nœuds touchés surlignés sur la carte de structure (T030).

### [2026-10-10 11:00] FEAT — spec 021 US4 : résoudre un conflit avec Claude
**Fichiers :** `domain/git/splitHunks.ts` (fusion à trois voies sur le diff de Myers existant, aperçu, marqueurs, lignes nouvelles), `application/ai/GitConflictTask.ts` + `infrastructure/ai/GitConflictFrame.ts` + `GitConflictOut` (tâche `git_conflict` sans outil, routage, cadre, modèle), `application/git/ConflictService.ts`, `SyncService.merge` (conflits → session ouverte), `domain/git/args.ts` (index en conflit, versions `:1:/:2:/:3:`, choix entier, commit de fusion), `GitRepository` (sessions et blocs), `shared/git/conflicts.ts`, 7 canaux `git:*` (+ `git:mergeAbort` par la résolution), `bootstrap.ts` ; renderer `git/ConflictView.tsx`, `IdeasPage` (la vue remplace la carte), `RepoPanel` (« ⚠ Fusion en cours » + verrou), `SyncBar` ; tests `unit/git/{git-split-hunks, git-conflict-task}`, `integration/git/git-conflicts`, `renderer/conflict-view`, `e2e/git-conflicts.e2e.ts`. 1 861 tests + 15 e2e verts.
**Quoi :** une fusion en conflit ouvre la vue de résolution (au lieu d'être annulée) : liste des fichiers ; pour chaque bloc « ta version » / « leur version » / proposition de Claude (sur clic « Demander à Claude », explication, « fusion évidente » ou « à vérifier », lignes nouvelles signalées par ✦ et un texte) ; 5 choix (la tienne, la leur, les deux, Claude, éditer) ; aperçu du fichier ; « Valider ce fichier » sur l'aperçu vu (empreinte), sans marqueur ; binaire ou supprimé d'un côté : version entière ; « Terminer la fusion » seulement quand git ne voit plus de conflit ; « Abandonner » confirmé = état d'avant. Propositions et décisions effacées en fin de fusion. Projet « Local uniquement » : rien n'est envoyé à Claude.
**Vérifié :** la fusion « tout la mienne » donne exactement le résultat de `git merge-file --ours` ; une proposition contenant un marqueur est rejetée ; une balise du cadre cachée dans le code d'un collègue est neutralisée.
**Erreurs corrigées :** pendant une fusion, le volet laissait cliquer Commiter, Tirer et Pousser (le main refusait déjà le commit) : volet verrouillé (D14). Les tests comparent la propreté du dépôt par l'app (la config système de Git pour Windows, `core.autocrlf`, n'est pas celle du helper de test).

### [2026-10-10 12:30] FEAT — spec 021 US5 (lot 1) : qui a fait quoi et quand
**Fichiers :** `domain/git/authors.ts` (palette de 12 teintes ≥ 3:1 sur les trois thèmes, clé principale après fusion, pseudonymes), `domain/git/args.ts` (`historyArgs`, `storyArgs`), `GitRepository` (alias d'auteurs), `application/git/GitHistoryService.ts`, tâche `git_story` (`GitStoryTask.ts`, `GitStoryFrame.ts`, `GitStoryOut`, routage, modèle), `shared/git/history.ts`, 4 canaux `git:*`, `bootstrap.ts` ; renderer `git/Timeline.tsx` (dans l'onglet Historique) ; tests `integration/git/git-history`, `renderer/git-timeline`, `e2e/git-history.e2e.ts` ; spec 021 (D15, tâches). 1 869 tests + 16 e2e verts.
**Quoi :** dans l'onglet Historique, une frise : une ligne par auteur (couleur ET initiales, légende toujours visible), un point par commit, zoom semaine / mois / année, ← → pour passer d'un commit à l'autre, « Charger plus » par pages de 5 000 ; deux identités d'une même personne se fusionnent (cases puis « Fusionner les identités », gardé dans l'app, par projet) et se séparent ; « Raconter la période » : Claude reçoit dates, messages et pseudonymes (« Auteur A »), jamais un nom ni un e-mail, et l'app remet les vrais noms à l'affichage. Rediffusion colorée de la carte : lot 2 (D15).
**Erreurs corrigées :** collision de noms avec l'Historique de la carte (`HistoryService` → `GitHistoryService`) ; la neutralisation des balises du récit écrivait littéralement `${tag.slice(1)}` (échappement perdu, vu par le lint) ; points d'un même auteur superposés et tassés au bord droit quand l'historique est plus court que le zoom (fenêtre ajustée au premier commit, marge et écartement dans les deux sens).

### [2026-10-10 13:30] FEAT — « Mettre à jour la carte » (spec 022 D30)
**Fichiers :** migration `0041_mapped_commit` (+ `down`), `schemaGit.ts`, `GitRepository` (`mappedCommit`), `domain/git/args.ts` (`mappedChangesArgs`, `recentChangesArgs`), `domain/structure/mapUpdate.ts` (changements, consigne bornée, balise neutralisée), `application/structure/MapUpdateService.ts`, canaux `structure:updatePlan`, `structure:markMapped` (`structureHandlers.ts`), `bootstrap.ts` ; renderer `canvas/nodes/StructureBarNode.tsx` (bouton), `canvas/mapping/mappingStore.ts` (repère avancé en fin de cartographie réussie) ; tests `integration/structure/map-update`, `renderer/map-update-button`, `neurons/migrations` (0041), contrôle e2e ; spec 022 (D30). 1 876 tests + 17 e2e verts.
**Quoi :** demande de mentalyas : un bouton sur la cartographie pour la mettre à jour avec les derniers changements. « ↻ Mettre à jour » dans la barre d'une carte déjà dessinée : l'app liste les fichiers changés depuis la dernière cartographie (commits + non commités, sans fichier sensible ; sans repère, les 20 derniers commits) ; rien → « la carte est à jour » sans appeler Claude ; sinon Claude reçoit dans la conversation du genesis une consigne de mise à jour ciblée (lire la carte, ne renvoyer que les éléments touchés, mêmes clés, retirer ce qui a disparu). Une cartographie réussie fait avancer le repère.
**Erreurs corrigées :** libellé trop long qui coupait la barre (« ↻ Mettre à jour », nom complet en accessibilité et infobulle) ; échappement perdu dans la neutralisation de la balise des chemins (vu par le lint).

### [2026-10-10 15:00] FEAT — spec 025 « Lancer un projet » (constitution 4.6.0)
**Fichiers :** `.specify/memory/constitution.md` (4.6.0 : npm pour l'exécution d'un projet de confiance), `specs/025-lancer-projet/{spec,tasks}.md`, `domain/run/scripts.ts`, `application/run/RunService.ts`, `ipc/runHandlers.ts` (`run:scripts|setFavorite|list|start|stop|dismiss`, `project:trust`, événements `run:output`, `run:changed`), `AppSettingsRepository` (script favori), `bootstrap.ts` (tout arrêté à la fermeture), `shared/run/run.ts` ; renderer `run/{runStore, RunButton, RunPanel, useRunShortcuts}`, `StructureBarNode` (bouton), `IdeasPage` (panneau, F5), `AppShell` ; tests `integration/run/run-service` (vrai npm), `renderer/run-project`, `e2e/run-project.e2e.ts`. 1 884 tests + 19 e2e verts.
**Quoi :** demande de mentalyas : lancer `npm run dev` (ou un autre script) depuis l'app avec un raccourci. Choix validés : panneau de sortie dans l'app, scripts du `package.json`, projets de confiance seulement (constitution amendée d'abord). Dans la barre du projet : « ▶ » + le script favori (menu des scripts) ; « ■ » l'arrête ; F5 lance le favori, Maj+F5 l'arrête. Panneau en bas : un onglet par lancement, sortie en direct (bornée, couleurs retirées), Arrêter, Relancer, Fermer l'onglet. Exécution : `node` + `npm-cli.js` par chemin absolu, sans shell, nom de script revalidé contre le `package.json` relu, processus et enfants arrêtés sur « Arrêter » et à la fermeture de l'app.
**Découvert :** la confiance d'un projet (spec 014) n'avait aucun écran : « 🔒 Lancer… » propose maintenant « Faire confiance à ce projet », confirmé, avec ce que ça permet (scripts d'un clic, hooks git).

### [2026-10-10 16:00] FEAT — spec 025 D6 : « Ouvrir dans le navigateur »
**Fichiers :** `shared/run/urls.ts` (adresses locales d'une sortie), `RunService.openUrl` + canal `run:openUrl`, `bootstrap.ts` (`shell.openExternal`), `run/RunPanel.tsx` (bouton « 🌐 Ouvrir … »), `home/BrainstormBar.tsx` ; tests `unit/run/local-urls`, `integration/run/run-service`, `renderer/run-project`, `e2e/run-project.e2e.ts` (ouverture remplacée dans le main : aucune fenêtre sur le bureau) ; spec 025 (D6). 19 e2e verts.
**Quoi :** demande de mentalyas : quand un serveur de dev annonce son adresse (« Local: http://localhost:5173/ »), le panneau de sortie propose de l'ouvrir dans le navigateur. Seules les adresses locales sont reconnues, et le main revérifie que l'adresse a bien été annoncée par ce lancement avant d'ouvrir.
**Erreurs corrigées :** `localhost.exemple.org` (domaine distant) était lu comme `http://localhost` (vu par le test pur) ; le cadrage d'un brainstorm pouvait être perdu si l'app se fermait moins de 500 ms après un déplacement (e2e instable sous charge) : « ← Projets » écrit maintenant la vue tout de suite.

### [2026-10-10 17:00] FEAT — spec 026 « Wireframes et parcours dans les widgets »
**Fichiers :** `specs/026-widgets-wireframes/{spec,tasks}.md`, `infrastructure/ai/WidgetFrame.ts` (v4 : constructions wireframe, parcours, adapter ; état ; échelle), `application/widgets/WidgetService.ts` (`build`, contexte complet et état dans chaque demande), `WidgetIoService.ts` (`inputContext`, `saveState`, `savedState`), `domain/widgets/resultLimits.ts` (`checkState`, 64 Ko), `WidgetDocument.ts` (prélude `gi.state` / `gi.onState` / `gi.saveState`, `zoom` sur 760 px), migration `0042_widget_states` (+ `down`), `WidgetIoRepository`, canaux `widget:build`, `widgetIo:savedState`, `widgetIo:saveState`, `ContextAssembler` (version du cadre), `infrastructure/ai/E2eClaude.ts` + `composition/aiEngine.ts` + `index.ts` (Claude simulé, profil e2e seulement : `GI_E2E_CLAUDE_REPLY`) ; renderer `canvas/nodes/WidgetNode.tsx` (barre des constructions, invitation), `widgets/useWidget.ts` (`build`), `widgets/useWidgetBridge.ts` (état remis à l'ouverture, envoi regroupé, vidé à la fermeture), `widgets/emitThrottle.ts` (`flush`) ; `domain/widgets/shape.ts` retiré (Claude reçoit maintenant les valeurs) ; tests `integration/widgets/{widgets,widget-io}`, `unit/widgets/widget-inputs`, `renderer/{widget-node,widget-output}`, `neurons/migrations` (0042), `e2e/widget-wireframe.e2e.ts`. 1 894 tests + 22 e2e verts.
**Quoi :** demande de mentalyas : relier un nœud à un widget pour que celui-ci parte de son contexte, et des boutons prédéfinis avec une consigne bien plus complète. Un widget relié à une idée ou une étape propose « 🖼 Wireframe » (écrans basse fidélité tirés du nœud, navigation, panneau de réglages), « 🔀 Parcours » (parcours jouable, carte des étapes, embranchements, erreurs) et « 🛠 Adapter au nœud ». Les consignes sont figées dans le cadre du widget ; la demande n'en porte que le nom. Claude reçoit désormais le contenu complet des nœuds branchés (avant : leur structure seule), aussi pour les retouches libres. Le widget garde son état (réglages du « mini CMS ») d'une ouverture à l'autre et d'une version à l'autre. Demande ajoutée en cours de route : le contenu des widgets s'adapte à la taille du bloc (mise en page sur 760 px, réduit jusqu'à la moitié).
**Décision :** brancher un nœud ne lance plus de construction automatique (amende spec 015 D6) : mentalyas choisit le bouton. Spec 015 : T012, T013, T016 faites ici.
**Erreurs corrigées :** canal `widgetIo:state` déjà pris (renommé `widgetIo:savedState`) ; échappements `
` perdus par un script Python (corrigés à la main) ; un texte libre commençant par « Construction : » aurait passé pour une construction (la construction passe maintenant par un champ à part, testé).
**Règle apprise :** un test e2e qui a besoin de Claude passe par `GI_E2E_CLAUDE_REPLY` (réponse lue dans un fichier fictif, demande écrite à côté) : jamais d'appel réel.

### [2026-10-10 18:00] FEAT — spec 026 D7, D8 : panneau de réglages flottant, plein écran
**Fichiers :** `shared/widgets/settings.ts` (déclaration Zod : texte, texte long, liste, interrupteur, couleur, curseur ; valeurs ramenées à la déclaration), migration `0043_widget_settings` (+ `down`), bloc `settings` (`shared/ipc/canvas.ts`, `schemaNeurons.ts`, `BlockRepository.settingsBlockOf`, `MapService`), `WidgetIoService` (`declareSettings`, `settingsPanel`, `settingsValues`, `setSettings`), 4 canaux `widgetIo:*`, `WidgetDocument.ts` (prélude `gi.settings`, `gi.onSettings`), `WidgetFrame.ts` (v5 : le wireframe déclare ses réglages, plus de panneau dans le widget), `AIGateway.ts` (raison réelle d'un échec), `domain/ai/routing.ts` (widget : 10 min) ; renderer `canvas/nodes/SettingsNode.tsx`, `widgets/{SettingsForm, useWidgetSettings, WidgetFullscreen}.tsx`, `useWidgetBridge.ts`, `WidgetNode.tsx` (⤢), `buildGraph.ts`, `IdeasCanvas.tsx`, `useBlockActions.ts` ; tests `unit/widgets/widget-settings`, `integration/widgets/{widget-io,widgets}`, `renderer/widget-node`, `neurons/migrations` (0043), `e2e/widget-wireframe.e2e.ts`, `support/FakeProvider` (erreur scriptée). 1 903 tests + 23 e2e verts.
**Quoi :** demandes de mentalyas : (1) le « CMS » du wireframe dans un cadre flottant séparé, comme la sortie d'un widget — choix validé : le widget déclare ses réglages, l'app dessine le panneau « ⚙ Réglages » à droite du widget, relié par un trait ; chaque changement arrive en direct dans le widget et est enregistré ; (2) « L'IA n'a pas pu répondre » sur un wireframe ; (3) l'échelle générale : les nœuds (72 à 120 px) semblent petits, et réduire un widget à leur taille rend son contenu illisible.
**Diagnostic :** (2) délai par défaut de 4 minutes dépassé par un wireframe de plusieurs écrans, raison masquée par un message générique ; (3) la carte n'est pas déséquilibrée : un écran d'application ne tient pas lisiblement à la taille d'un nœud. Réponse : le widget est un aperçu sur la carte, « ⤢ Plein écran » l'ouvre à taille réelle avec ses réglages à droite (ajout 3 du L1m).
**Erreurs corrigées :** les boutons « ne faisaient rien » : l'app tournait depuis avant le build (preload ancien, canal refusé) — relance de `npm run dev` ; course au plein écran : la redéclaration des réglages par le nouveau cadre écrasait un changement encore en route (la valeur locale prime maintenant) ; l'écho du main pendant une frappe aurait ramené une valeur ancienne (le cache n'est remplacé que sur « Réinitialiser ») ; échappement `
` perdu par un script Python (corrigé à la main).
**Vu, non corrigé :** la barre de la carte de structure (Workflow / Progression) passe au-dessus des widgets posés près du genesis.

### [2026-10-10 19:00] FEAT — spec 023 D19 : chaque étape dans la vue où elle est née
**Fichiers :** migration `0044_step_view` (+ `down`), `schemaNeurons.ts` (`structure_view`), `PlanRepository` (vue lue et écrite, `brainstormOf`, `hasMap`), `PlanService.decide` (vue de naissance, héritée par une sous-étape), `bootstrap.ts` (vue relue dans l'état de vue du brainstorm, Progression par défaut avec une carte), `CanvasService` (`StepView.view`), `shared/brainstorms/viewState.ts` (`STRUCTURE_VIEWS`), renderer `canvas/buildGraph.ts` (`stepShown`, vue affichée calculée avant les plans), `canvas/usePlanDecide.ts` (vue enregistrée avant la décision), `app/uiStore.ts` ; tests `integration/plan/plan-ipc`, `unit/renderer/step-view`, `neurons/migrations` (0044) ; spec 023 (D19).
**Quoi :** demande de mentalyas : sur un projet de zéro, la structure créée à la main dans Workflow restait affichée par-dessus la Progression et l'Architecture après la cartographie. Les étapes du plan d'attaque n'avaient pas de vue (les éléments de la cartographie ne vivent que dans Progression et Architecture, ceux du dossier de méthode que dans Workflow). Désormais une étape naît dans la vue affichée et n'apparaît que dans celle-ci ; les étapes existantes d'un projet lié sont rangées dans Workflow.
**Choix :** la vue est relue par le main (état de vue du brainstorm, écrit tout de suite avant la décision) plutôt que transmise par chacun des trois boutons de décision.

### [2026-10-10 20:00] FIX — spec 024 D19 : tous les genesis d'un canevas ont le contexte du projet
**Fichiers :** `domain/conversation/workingDirs.ts` (règle des dossiers), `ConversationRepository` (`projectFolder` : dossier du canevas du genesis, lu par sous-requête), `ConversationService` (`dirsOf`, `linkedOf`, `--add-dir`), `contextBlock.ts` (dossier ouvert en plus), `shared/ipc/chat.ts`, renderer `chat/{useChat.ts, ChatPanel.tsx}` (puce « Projet : … ») ; tests `unit/conversation/{working-dirs, conversation-service}`, `integration/conversation/project-folder`, `renderer/chat-panel` ; spec 024 (D19).
**Quoi :** correction de mentalyas : sur un projet repris, seul le genesis créé avec le canevas était lié au dossier ; un genesis ajouté ensuite travaillait dans le dossier de l'app, sans le contexte du projet. Désormais un genesis sans dossier travaille dans le projet du canevas ; un genesis lié à un autre dossier travaille dans le projet du canevas avec son dossier ouvert en plus (mêmes droits). Ses étapes et éléments : son dossier d'abord, le projet du canevas en plus.
**Choix :** le dossier est lu sur le canevas au lieu d'être recopié sur chaque genesis (règle « un dossier, un seul neurone » de la spec 017 intacte, projet déplacé suivi). Git, lancement et vue Workflow restent sur le dossier propre du genesis.
**À savoir :** une conversation déjà commencée dans le dossier de l'app change de dossier : sa première reprise échoue une fois (session introuvable) et repart sur une nouvelle session, le contexte rejoint (mécanisme existant).
**Erreurs corrigées :** (1) la sous-requête SQL du dossier du canevas renvoyait le dossier du premier canevas pour tous les genesis (colonne non qualifiée, lue sur la ligne de la sous-requête) : remplacée par une requête Drizzle typée, test à plusieurs canevas ajouté ; (2) « La conversation s'est interrompue » en boucle sur PID (cause sans lien avec D19, révélée par une trace temporaire, retirée) : un tour interrompu après l'ouverture de la session par le CLI ne la marquait pas commencée ; l'app relançait `--session-id` sur un identifiant existant, refusé par le CLI 2.1.296 (« Session ID … is already in use »). La session est maintenant marquée dès l'événement `init`, et un « already in use » la fait reprendre au message suivant.
**Règle apprise :** `npm run dev` (`electron-vite dev` sans `--watch`) ne reconstruit pas le main : après une modification du main, relancer l'app avant de tester.

### [2026-10-10 21:00] FEAT — spec 023 D20 à D23 : Workflow statique, lu dans les fichiers de tâches
**Fichiers :** `domain/workflow/parseTaskFile.ts` (fichier Markdown → lots `##`, groupes `###`, tâches à trois états, clés compactes et stables), `parseTasks.ts` (`- [~]`, `taskState`), `specStatus.ts` (une tâche en cours rend actif), `limits.ts`, `WorkflowService` (fichiers de tâches à la racine et dans `docs/`, hors règles, journal, historique et fondation), `shared/ipc/workflow.ts` (`TaskState`, `TaskFileView`, `TaskGroupView`), `PlanService` (`refuseWorkflow`, `birthView`, `removeMany`), canal `plan:removeSteps` ; renderer `workflow/{workflowTree, prompts, WorkflowCard, WorkflowNode, runningChats, useWorkflow}`, `cards/cardContent.ts`, `buildGraph.ts` (aucune étape ni proposition en Workflow, étapes masquées passées à la barre), `nodes/StructureBarNode.tsx` (bandeau « Les reporter dans les fichiers » / « Les retirer »), démo `docs/TACHES-DESIGN.md` ; tests `unit/workflow-parse-task-file`, `integration/workflow/workflow-service`, `integration/plan/plan-ipc`, `renderer/{workflow-tree, step-view, running-chats, report-steps-prompt, workflow-card}`, `e2e/workflow-task-files.e2e.ts`. 1 939 tests + e2e verts.
**Quoi :** demande de mentalyas : la carte Workflow de PID changeait à chaque génération. Cause : PID n'a pas de `specs/` ; ses tâches vivent dans `docs/USER-STORIES.md`, que la vue ne lisait pas, et Claude inventait des étapes de plan à chaque demande. Désormais un fichier Markdown à cases est une branche (titre `#`), ses `##` des lots, ses `###` des groupes ; trois états (`[ ]`, `[~]`, `[x]`, aussi dans `tasks.md`) ; une tâche dont la conversation tourne s'allume « en cours » le temps du tour ; plus aucune étape ne naît en Workflow (Claude est renvoyé au fichier) ; les étapes nées là avant sont masquées, à reporter dans les fichiers ou retirer (un lot annulable).
**Choix :** fichiers lus à la racine et directement dans `docs/` seulement (vérifié : PID → `docs/USER-STORIES.md` seul ; le Brainstormer → aucun, ses sous-dossiers de règles et de brainstorm restent hors carte). Clés de nœud tirées d'empreintes (chemin, titres, texte), jamais du rang : ajouter une tâche ne déplace pas les autres.
**Erreurs corrigées :** clés trop longues pour `WORKFLOW_KEY` (chemin et `|` dedans) ; un test renderer importait du code du main (projets TypeScript séparés) ; en e2e, React Flow ne garde dans la page que les nœuds visibles (comparer le DOM avant/après « Relire » était faux).

### [2026-10-10 21:00] UI — pastilles d'un nœud aérées
**Fichiers :** `canvas/living/living.css` (rang, repli, cadenas, action finale), `canvas/canvas.css` (poignée de liaison).
**Quoi :** demande de mentalyas (capture « Analyse des besoins client ») : rang, poignée, repli « ▸ 30 » et cadenas collés au cercle, difficiles à cliquer. Répartis autour du cercle : rang en haut à droite décollé, poignée détachée du bord droit, repli à côté du cercle sous la poignée, cadenas au milieu gauche, action finale en haut à gauche.

### [2026-10-10 21:30] FIX — tirer un lien jusqu'à un widget
**Fichiers :** `canvas/IdeasCanvas.tsx` (état « lien en cours » : `onConnectStart`, `onConnectEnd`, `data-connecting`), `canvas/canvas.css` ; test `e2e/widget-wireframe.e2e.ts` (lien lâché au milieu du widget).
**Quoi :** mentalyas n'arrivait pas à brancher un nœud sur ses widgets. Seul le point d'arrivée de 14 px au bord gauche acceptait le lien (rayon de 64 px sur un widget de plus de 700 px), et l'iframe du widget captait la souris pendant le glisser. Pendant qu'un lien se tire, les iframes ne captent plus la souris et tout le widget devient le point d'arrivée (pointillés).

### [2026-10-10 22:30] FEAT — spec 023 D24, D25 : chaque vue son canevas, brancher une tâche ou un élément
**Fichiers :** D25 : migration `0045_block_view` (+ `down`), `schemaNeurons.ts`, `BlockRepository` (vue à la création, héritée par le cadre résultat et les réglages, `assignViewless`, `setView`), `BrainstormService.open`, `CanvasService.setBlockView`, canal `canvas:setBlockView`, `bootstrap.ts` (`structureViewOf`, `canvasView`), renderer `buildGraph.ts` (blocs et traits de la vue affichée), `IdeasCanvas.tsx` (vue enregistrée avant une création, menu « Envoyer vers… »), `ToolMenu.tsx` (`ContextMenu`). D24 : `shared/ipc/widgetIo.ts` (sources `element`, `workflow`), `domain/widgets/structureInputs.ts`, `WidgetIoService`, `widgetIoHandlers.ts`, `WidgetFrame.ts` (v6), `CanvasService` (traits), renderer `connection.ts`, `ElementNode.tsx`, `WorkflowNode.tsx`, `WidgetReview.tsx`, `canvas.css`. Tests `integration/canvas/block-view`, `neurons/migrations`, `renderer/step-view`, `unit/widgets/structure-inputs`, `integration/widgets/widget-io`, `unit/ipc/widget-io-handlers`, `renderer/canvas-connection`, e2e `workflow-task-files` (3 scénarios).
**Quoi :** demandes de mentalyas : (1) un widget restait affiché dans toutes les vues ; chaque vue (Workflow, Progression, Architecture) a maintenant ses propres blocs, les anciens rangés une fois à l'ouverture, « Envoyer vers… » au clic droit ; (2) plus de poignée sur les nœuds du Workflow (les étapes masquées par D22 la portaient) ni sur les éléments, et le point d'arrivée du widget écrasé par le cadre de sélection : poignée au survol de chaque nœud, branchement d'une tâche ou d'un élément sur un widget, contexte relu dans les fichiers à chaque demande.
**Choix :** la vue d'un canevas est celle de son genesis principal (une carte de structure par canevas) ; le contexte d'une tâche n'est jamais copié en base, seule sa clé stable l'est (si la tâche sort du fichier, l'entrée s'efface).
**Erreurs corrigées :** clic droit e2e posé sur un nœud ; survol pendant le glissement de la carte après une bascule de vue (le test survole de nouveau jusqu'à voir la poignée).

### [2026-10-10 12:13] SESSION — End
**Resume :** session du 07 au 10/10 (82 commits). Livrées : 019 US5 (annuler une mise à jour de l'Analyste), 022 (nœuds vivants, thème Carbone, structure vivante), 023 « Carte Workflow » (US1-US5, puis D19-D25 : Workflow statique lu dans les fichiers de tâches à trois états, une vue un canevas, brancher tâches et éléments sur un widget), 024 « Accueil ProjectMaster » (US1-US5, D19), 025 « Lancer un projet », 026 « Wireframes et parcours dans les widgets » ; 021 US1-US5 lot 1 (Git et GitHub dans l'app) ; brainstorms L1k, L1l, L1m ; tests e2e Playwright.
**Branche :** main
**Commits pushes :** 82

### [2026-10-10 12:31] DOCS — parcours académique (session du 08→10/10, /hub end 7bis, mode auto)
**Fichiers :** `docs/academique/` — créées : `Git piloté par l'app — préfixe sûr, arguments construits, configuration piégée et push gardé.md`, `Conflit de fusion — trois versions lues dans l'index, blocs à décider et aperçu validé.md`, `Vue Workflow — l'état lu dans les fichiers, parseur ligne à ligne et clés stables.md`, `Points de sauvegarde — instantané compressé, point caché avant retour et colonnes épargnées.md`, `Lancer un projet — processus de longue durée, sortie par lots bornée et arbre de processus.md`, `Réglages déclarés par un widget — le widget décrit, l'app dessine et ramène chaque valeur.md`, `Tests de bout en bout — Playwright pilote Electron sur un profil fictif.md`, `Glossaire — Fusion à trois voies (base commune).md`, `Glossaire — Concurrence optimiste (agir sur l'état vu).md`, `Glossaire — Bombe de décompression (zip bomb).md`, `Glossaire — Arbre de processus (enfants, taskkill T).md` ; étendues (blocs « Évolution ») : `Mise à jour réversible…` (+ bandeau « Correction du 10/10 » : statut « pas encore codé » dépassé), `Lancer un programme sans shell…`, `Bac à sable des widgets…`, `Bibliothèque de skills…`, `Explorateur de code…`, `Glossaire — Écriture atomique…` ; MOC (parcours 42 → 48, section « L'app pilote le projet », questions de révision, graphe du 10/10) et canvas (8 nœuds, 8 flèches) mis à jour ; `CLAUDE.md` (dernière mise à jour).
**Points ⚠️ :** code lu, non exécuté. Spec 022 (nœuds vivants, thème Carbone) et spec 020 (déjà couverte le 08/10) sans nouvelle note : finitions visuelles. Constaté en lisant : npm exécute la commande d'un script dans un shell — la garde de la spec 025 est la confiance du projet, pas l'absence de shell (dit tel quel dans les notes).

### [2026-10-11 19:30] DOCS — audit d'usage « nouveau projet de zéro »
**Fichiers :** `docs/AUDIT-2026-10-11-parcours-nouveau-projet.md` (captures dans `test-results/audit-2026-10-11/`, hors git).
**Quoi :** demande de mentalyas : tester l'app comme un utilisateur sur un workflow complet et auditer ce qui marche, ce qui ne marche pas, ce qui peut être amélioré et ce qui est hors contexte. Parcours joué avec Claude réel sur un profil et un coffre fictifs : Project Manager → brainstorm → plan d'attaque → étape codée → commit → cartographie → report en fichier de tâches → widget Wireframe.
**Constat principal :** le travail restant existe en trois exemplaires non synchronisés (étapes du plan, éléments de structure, fichier de tâches) ; ensuite, conversation prise dans le canevas, étape sans bouton « Réaliser », bouton de départ qui ignore la consigne préparée (`ChatPanel.tsx:683`).
**Règle apprise :** un audit e2e qui pilote une conversation doit accepter les demandes de permission à chaque tour, sinon l'attente passe pour de la lenteur (corrigé grâce à mentalyas pendant le test).

### [2026-10-11 19:15] FIX — petits correctifs de l'audit du 11/10 (priorités 4 à 7)
**Fichiers :** `renderer/src/chat/ChatPanel.tsx` (bouton de départ), `renderer/src/app/useMainEvents.ts` (git relu à `chat:turnEnd`, suivi des permissions), `renderer/src/chat/waitingChats.ts` (nouveau : demandes en attente par conversation), `renderer/src/canvas/living/LivingNode.tsx` (pastille « ⏸ attend ton accord », `chatId`), `canvas/workflow/WorkflowNode.tsx`, `shared/ipc/ai.ts` (Haiku 5.5, `currentModel`), `AiConfigRepository.ts`, `ConversationService.ts` (ancien Haiku 4.5 relu en 5.5), `renderer/src/pages/settings/ai/AiSettingsPage.tsx`, `canvas/CanvasToolbar.tsx`, `canvas/IdeasCanvas.tsx` (« Reprendre un projet existant » hors du canevas d'un projet), `renderer/index.html`, `renderer/capture.html` (CSP) ; tests `renderer/{chat-panel, map-primitives, waiting-chats, canvas-toolbar, ai-settings, ai-thinking}`, `integration/db/ai-config`, `conversation/conversation-service`, `ipc/ai-handlers`. 1 957 tests verts ; vérifié dans l'app réelle (profil et coffre fictifs, Claude réel).
**Quoi :** (1) « Commencer le brainstorm » envoie la consigne préparée du projet quand le champ en contient une (avant : message générique, cadrage « une question à la fois » perdu) ; (2) le badge du dépôt se relit à la fin de chaque tour de Claude (avant : « à jour » avec 10 fichiers modifiés) ; (3) un nœud dont la conversation attend une permission affiche « ⏸ attend ton accord » jusqu'à la décision ou la fin du tour ; (4) Haiku 5.5 remplace Haiku 4.5, un réglage ou un choix de conversation enregistré en 4.5 est relu en 5.5 ; `frame-ancestors` retiré des CSP `<meta>` (ignoré par le navigateur à cet endroit, avertissement en console ; aucun en-tête CSP côté main) ; « Reprendre un projet existant » masqué sur le canevas d'un projet (la reprise part du Project Manager).
**Choix :** pastille posée dans `LivingNode` (commun au genesis, aux étapes, aux éléments et aux tâches Workflow) plutôt que dans chaque nœud ; suivi des permissions branché une seule fois dans `useMainEvents`, pour toute l'app.
**Vu, non corrigé :** la pastille est en partie couverte par la carte de conversation ouverte (placement de la carte, audit §5.4, à traiter par spec).

### [2026-10-11 19:35] FIX — spec 013 D6 : « Réaliser cette étape » sur une conversation d'étape vide
**Fichiers :** `specs/013-actions-finales/spec.md` (D6), `renderer/src/chat/ChatPanel.tsx` (état vide d'une étape), `tests/unit/renderer/chat-panel.test.tsx` (2 tests), `docs/AUDIT-2026-10-11-parcours-nouveau-projet.md` (priorité 3). 1 959 tests verts ; vérifié dans l'app réelle (Claude réel, profil fictif).
**Quoi :** audit du 11/10 (§5.3, §4.3) : une étape vide proposait « Commencer le brainstorm » et rien pour la réaliser ; codée hors du parcours, elle restait « à faire ». Le parcours existait déjà (spec 013 : action finale proposée par Claude, acceptée, exécutée, livrable accepté → « fait ») mais ne se découvrait pas. Le bouton principal d'une étape vide est maintenant « Réaliser cette étape » (consigne de « Proposer l'action finale »), avec une phrase qui dit la suite ; « En discuter d'abord » garde le brainstorm.
**Choix :** le statut ne passe pas à « fait » quand Claude écrit hors d'une action finale : la règle D3 (mentalyas valide le livrable) est gardée, c'est le chemin vers elle qui est rendu visible.
**Vérifié :** plan de 2 étapes validé, étape ① ouverte : texte et deux boutons ; « Réaliser cette étape » → Claude propose l'action (livrable `docs/NOTES.md`), ⚡ sur l'étape, ✓ dans sa carte → ▶ Exécuter.

### [2026-10-11 21:40] FEAT — spec 027 lot 1 : conversation en panneau fixe (US1 + US4, MVP)
**Fichiers :** nouveaux `renderer/src/canvas/side/{sidePanelStore.ts, SidePanel.tsx, SideTabs.tsx, ChatTabContent.tsx, WorkflowChatTabContent.tsx, viewNodes.ts, side.css}` ; modifiés `canvas/cards/{cardsStore.ts, DetailCard.tsx, IdeaCards.tsx, cards.css}`, `canvas/workflow/WorkflowCard.tsx`, `canvas/IdeasCanvas.tsx`, `pages/IdeasPage.tsx`, `git/RepoPanel.tsx`, `app/uiStore.ts`, `home/{viewState.ts, useBrainstorms.ts}`, `chat/ChatPanel.tsx` ; `specs/022-noeuds-vivants/spec.md` (D6, D10, D28 amendées) ; tests nouveaux `renderer/side-panel-store.test.ts`, `renderer/side-panel.test.tsx`, `e2e/side-panel.e2e.ts`, mis à jour `renderer/{canvas-create, document-node, living-foundations, plan-ghosts, project-manager, workflow-card, workflow-view}`, `e2e/git-*.e2e.ts`. 1 977 tests verts, 29 e2e verts, typecheck, lint, Prettier OK.
**Quoi :** audit du 11/10 (§5.4, §5.5) : la conversation et le lecteur de fichiers quittent l'étirement de droite de la carte de détails (couche de la carte, soumise au zoom) pour un panneau fixe à onglets à droite de l'écran Idées (38 %), qui accueille aussi le Dépôt. « Discuter » ouvre ou affiche l'onglet du nœud ; fermer la carte ne ferme pas l'onglet ; un fichier se lit dans l'onglet de son nœud ; Échap revient du lecteur à la conversation, puis rend le focus à la carte, sans jamais fermer d'onglet. Les onglets suivent la vue (titre, nœud supprimé) et sont gardés dans l'état de vue du brainstorm (spec 024 : `side: 'chat'` d'une carte = onglet ouvert).
**Choix :** une seule source de vérité (`sidePanelStore`, `side`/`reader` retirés de `cardsStore`) ; façades de `uiStore` gardées (`openChat`, `openViewer`, `openRepo`, `repoGenesisId`…) pour ne pas toucher les appelants ; panneau dans `IdeasPage`, hors de React Flow (il reste à côté de la résolution des conflits) ; pas de second en-tête quand la conversation est affichée (celui de `ChatPanel` porte titre, sorte et ×).
**Erreurs corrigées :** (1) axe `aria-required-children` : un bouton × dans la liste d'onglets est interdit → × visuel dans l'onglet, Suppr au clavier, vrai bouton « Fermer l'onglet » dans l'en-tête ; (2) le champ de `ChatPanel` arrêtait toutes les touches, Échap compris → Échap remonte au panneau ; (3) scripts Python d'édition : `open(..., 'w')` sous Windows écrit des CRLF → `newline=''`.
**Règle apprise :** sous Windows, un script Python qui réécrit un fichier du dépôt doit l'ouvrir avec `newline=''` (lecture et écriture), sinon il convertit tout le fichier en CRLF.

### [2026-10-11 22:10] FEAT — spec 027 lot 2 : plusieurs conversations en onglets (US2)
**Fichiers :** `renderer/src/canvas/side/{SideTabs.tsx, sidePanelStore.ts, WorkflowChatTabContent.tsx, side.css}`, `renderer/src/app/useMainEvents.ts`, `renderer/src/canvas/workflow/useWorkflow.ts` ; tests `renderer/side-panel-tabs.test.tsx` (nouveau), `e2e/side-panel.e2e.ts` (scénario 2). 1 984 tests verts, e2e verts.
**Quoi :** chaque onglet dit si Claude écrit (point qui pulse, coupé avec « réduire les animations ») ou attend ton accord (⏸, prioritaire), avec un texte lu par les lecteurs d'écran ; ←/→ (en boucle), Début, Fin passent d'un onglet à l'autre (tabindex itinérant) ; l'onglet affiché reste visible quand la barre défile. L'écoute des tours (`watchRunningChats`) passe de `useWorkflows` à `useMainEvents` : elle ne marchait que quand une vue Workflow était affichée. Un onglet de tâche Workflow garde le neurone de sa conversation (`bindNeuron`) dès que `workflow:chat` répond.
**Vérifié (e2e) :** genesis + élément « Données » ouverts, demande de permission envoyée au genesis par le canal du main (`chat:permission`) → « ⏸ » sur son onglet et sur son nœud ; tranchée → l'indicateur part ; Suppr ferme l'onglet affiché, le genesis s'affiche.
**Règle apprise :** le nom accessible d'un élément composé de plusieurs `span` diffère entre Chromium (garde l'espace d'un texte caché, ajoute une espace avant une virgule) et jsdom (la retire) : écrire le texte caché sans ponctuation de tête (« (attend ton accord) ») et des motifs de test tolérants (`\s*`).

### [2026-10-11 22:25] FEAT — spec 027 lot 3 : retrouver le nœud de la conversation (US3)
**Fichiers :** `renderer/src/canvas/living/{LivingNode.tsx, living.css}` (anneau `data-chat`), `renderer/src/canvas/side/{SidePanel.tsx, viewNodes.ts, side.css}` (« ◎ Centrer », `focusViewOf`), `renderer/src/canvas/IdeasCanvas.tsx` (exécution de la demande de centrage), `renderer/src/canvas/buildGraph.ts` (`bornIn` exporté) ; tests `renderer/side-panel-focus.test.tsx` (nouveau), `e2e/side-panel.e2e.ts` (scénario 3). 1 991 tests verts.
**Quoi :** le nœud de l'onglet affiché porte un anneau plein (accent) hors du cercle, distinct du focus, de la sélection et de la carte ouverte ; un seul nœud à la fois. « ◎ Centrer » (au bout de la barre d'onglets, nom complet « Centrer sur le nœud ») dépose une demande que la carte exécute : centrage sur la place finale du nœud (même pendant un glissement), sans animation si elles sont réduites ; nœud d'une autre vue (tâche → Workflow, élément → Progression, étape → sa vue de naissance) : la vue bascule, puis le nœud est centré dès qu'il est dessiné (4 s au plus) ; sinon « Ce nœud n'est pas affiché sur la carte ». Chaque demande (nonce) n'est exécutée qu'une fois.
**Choix :** centrer sur `graph.nodes[].position` (centres, `nodeOrigin` 0.5, positions finales) plutôt que sur le nœud interne mesuré (position en cours d'animation) ; les onglets se resserrent avant que la barre ne défile (le bouton prenait leur place).
**Vérifié (e2e) :** carte déplacée jusqu'à faire disparaître « Données » (React Flow ne dessine plus un nœud hors écran), « Centrer » → nœud à moins de 40 px du centre ; vue Workflow affichée → « Centrer » rebascule en Progression et centre.

### [2026-10-11 22:35] FEAT — spec 027 lot 4 : largeur du panneau, fenêtre étroite (US5)
**Fichiers :** `shared/ipc/app.ts` (`CHAT_PANEL_WIDTH`, `chatPanelWidth`), `main/infrastructure/db/repositories/AppSettingsRepository.ts` (clé `ui.chatPanelWidth`, Zod entier 25–55), `main/ipc/appHandlers.ts` (`SettingsPatch`), `renderer/src/canvas/side/{panelWidth.ts (nouveau), SidePanel.tsx, side.css}`, `renderer/src/pages/IdeasPage.tsx` ; `specs/027-panneau-conversation/{quickstart.md, tasks.md}` (sens des flèches) ; tests `integration/db/app-settings`, `ipc/app-handlers`, `renderer/side-panel-resize.test.tsx` (nouveau), `e2e/side-panel.e2e.ts` (scénarios 5 et 7). 2 002 tests verts.
**Quoi :** poignée sur le bord gauche du panneau (`separator` accessible) : glisser à la souris (pointeur capturé, enregistré au lâcher), ← élargit et → resserre par 2 %, Début / Fin aux bornes (enregistré 400 ms après la dernière touche, une seule écriture) ; largeur gardée dans les réglages de l'app et reprise à la relance ; une valeur invalide en base retombe à 38. Fenêtre de moins de 1 100 px : le panneau passe par-dessus la carte (ombre), « ⇥ Masquer » le replie en un bouton « ◧ Panneau (n) » sans fermer ses onglets ; il revient dès qu'une conversation s'ouvre.
**Choix :** pas de stockage local du navigateur, le canal `app:setSettings` existant validé par le main (R8) ; sens des flèches spatial (la poignée est un bord : ← la pousse vers la gauche, donc élargit) — le quickstart disait l'inverse, corrigé.
**Vérifié (e2e) :** glisser jusqu'au milieu → 50 %, → × 3 → 44 %, fermeture et relance de l'app (profil gardé) → 44 % ; fenêtre réduite à 1 000 px → surimpression, masquer puis rouvrir.
**Vu, non corrigé :** sur 3 passes complètes des e2e après le lot 4, deux échecs isolés et différents, hors spec 027 (`widget-wireframe` : « Plein écran » sous la barre d'outils ; `workflow-task-files` : poignée de branchement), chacun vert seul et la 3ᵉ passe entière verte (33/33). Tests sensibles au glissement de la carte et à la place des widgets : à rendre déterministes (attendre la fin du glissement) dans un correctif à part.

### [2026-10-11 23:05] TEST — spec 027 lot 5 : passe réelle du parcours de l'audit (Claude réel), spec livrée
**Fichiers :** `specs/027-panneau-conversation/{spec.md (Livrée), tasks.md}`, `CLAUDE.md` (Workflows actifs), `docs/AUDIT-2026-10-11-parcours-nouveau-projet.md` (priorité 2 livrée) ; captures `test-results/027-passe-reelle/` (hors git).
**Parcours :** coffre fictif neuf, Claude réel, fenêtre 1 600 × 950 : projet de zéro « Carnet de recettes » → conversation du genesis dans le panneau, consigne préparée dans le champ, aucune conversation dans la carte ; 6 dézooms → panneau identique au pixel près (SC-001) ; brainstorm, plan de 2 étapes validé ; « Discuter » sur l'étape ① → second onglet, l'anneau passe à l'étape ; « Réaliser cette étape », onglet du genesis affiché → « Claude écrit » sur l'onglet de l'étape ; action acceptée, « Exécuter » → « ⏸ » sur l'onglet de l'étape et sur son nœud 4 s plus tard (SC-004) ; 9 permissions accordées dans l'onglet, 6 fichiers écrits ; fichier du livrable lu dans un troisième onglet (titre repris de la carte) ; commit depuis l'onglet « ⎇ Dépôt » (message proposé en 5 s) ; `Ctrl+Maj+G` ferme le Dépôt, « Centrer » ramène l'étape. Aucune étape n'a demandé de dézoomer, de faire glisser la carte ou de forcer un clic pour atteindre la conversation (SC-005). Animations réduites (T039) : le point « Claude écrit » ne pulse plus, le centrage n'est pas animé ; le panneau lui-même n'a aucune animation.
**Vu, non corrigé (hors périmètre de la spec, à trier) :** (1) la carte de détails ouverte, posée à droite du nœud, couvre encore en partie sa pastille « ⏸ attend ton accord » ; (2) la notification (« Claude exécute l'action… ») se pose sur le champ de saisie du panneau ; (3) sur un canevas neuf, « Tout afficher » zoome très fort sur l'unique nœud et sa carte de détails passe sous le panneau ; (4) à 38 %, trois onglets tronquent fortement leurs titres (« Carnet … »).

### [2026-10-12 01:40] DOCS — audit d'usage « mener un vrai projet » (Bike_cycle, profil réel)
**Fichiers :** `docs/AUDIT-2026-10-12-bike-cycle.md` (captures dans `test-results/audit-2026-10-12-bike-cycle/`, hors git).
**Quoi :** demande de mentalyas : mener le projet Bike_cycle (né dans le Brainstormer) le plus loin possible dans l'app, sur le profil réel, en auditant à chaque pas. Base et dossier sauvegardés avant (`%TEMP%/gi-sauvegarde-2026-10-12`). Six fonctionnalités codées par Claude réel depuis les conversations d'éléments et commitées par le volet Dépôt (tests de la base, API de dépôt, PWA comptoir avec ticket QR, suivi public, tablette d'atelier) ; produit lancé depuis l'app et vérifié de bout en bout (tablette → page du client).
**Constat principal :** la carte ne dit plus la vérité : `TASKS.md` à 0 sur 26, éléments codés restés « à faire » ou « en cours », modules « à faire » avec des enfants livrés, genesis « Idée brute » ; Claude ne peut ni lire un widget (le wireframe n'a pas servi au code), ni faire avancer un autre élément que celui de sa conversation. 28 constats, 12 corrections et 7 fonctionnalités proposées, priorités en §5.
**Règle apprise :** sur le profil réel, sauvegarder la base (avec `-wal` et `-shm`) et noter le commit du projet avant toute écriture ; l'app réduite en zone de notification ne se ferme pas par sa fenêtre.

### [2026-10-12 02:10] FEAT — spec 017 US6 : lever les ambiguïtés avec l'IA (T032–T034)
**Fichiers :** nouveaux `main/application/reprise/ResolutionService.ts`, `main/application/ai/RepriseResolutionTask.ts`, `main/infrastructure/ai/RepriseResolutionFrame.ts`, `main/domain/reprise/callContext.ts`, `renderer/src/explorer/ResolveLinks.tsx`, migration `0046_reprise_edge_candidates` (+ down) ; modifiés `shared/ai/schemas.ts` (`ResolutionOut`), `domain/ai/{types,routing}.ts`, `ContextAssembler.ts`, `AnalysisService.ts`, `CodeGraphRepository.ts`, `ExplorerService.ts`, `RepriseService.ts`, `ipc/repriseHandlers.ts`, `bootstrap.ts`, `explorer/{ExplorerPage,NodePanel,FilePanel}.tsx` ; tests `unit/ai/reprise-resolution`, `unit/reprise/call-context`, `integration/reprise/resolution-service`, `unit/ipc/reprise-handlers`, `unit/renderer/explorer-page`, `integration/neurons/migrations`, `e2e/reprise-resolution.e2e.ts`.
**Quoi :** « Préciser les liens avec l'IA (N) » dans l'en-tête de l'explorateur : les liens incertains qui ont des cibles possibles partent par lots de 50 (appel, 8 lignes de contexte autour du nom appelé, candidats par identifiant), à Claude ou, pour un projet « Local uniquement », au modèle local seul. Un choix dans les candidats devient « déduit » avec sa raison (jamais « sûr ») ; hors candidats ou lien inconnu : rejeté, lien inchangé ; « indécidable » : le lien reste incertain avec la raison. IA arrêtée en cours de passe : ce qui est fait est gardé, le reste inchangé, la phrase de fin le dit. La raison d'un lien déduit s'affiche dans le panneau de l'élément et au survol des liens du code.
**Choix :** les candidats du résolveur sont gardés dans `code_edges.candidates_json` (recalculer par le nom aurait divergé du résolveur) ; entrée de la tâche en JSON (le code du projet ne peut pas se faire passer pour un autre élément) ; une passe plafonnée à 500 liens ; run `resolution` journalisé sans contenu.
**Limite connue :** une réanalyse recalcule les liens et efface les déductions de l'IA (seules les corrections manuelles survivent, FR-018) ; relancer « Préciser » les refait.
**Erreur corrigée :** la raison, trop longue, écrasait le nom du lien dans le panneau (`shrink-0`) — vue sur la capture e2e, raison passée sur sa propre ligne.
**Vérifié (e2e, app réelle, Claude simulé) :** `cs-app` repris en « Claude autorisé », `store.Save` → `InvoiceRepository.Save` « déduit » avec sa raison, cible étrangère rejetée, `.env` absent de la demande.

### [2026-10-12 02:11] SESSION — End
**Resume :** session du 11 au 12/10. Audit d'usage « nouveau projet de zéro » et ses correctifs (consigne de départ, badge du dépôt, attente de permission, Haiku 5.5, « Réaliser cette étape » spec 013 D6) ; spec 027 « Conversation en panneau fixe » spécifiée, planifiée et livrée en 5 lots (onglets, anneau et « Centrer », largeur réglable, passe réelle) ; audit d'usage « mener un vrai projet » sur Bike_cycle (profil réel, 7 commits dans ce projet, 29 constats, propositions et priorités) ; spec 017 US6 (lever les ambiguïtés du graphe avec l'IA) codée par Claude depuis l'app, revue et commitée ; correctif de l'Analyste (faux code mort).
**Branche :** main
**Commits pushes :** 7

### [2026-10-12 02:30] DOCS — parcours académique (session du 11→12/10, /hub end 7bis, mode auto)
**Fichiers :** `docs/academique/` — créées : `Panneau fixe à onglets — une source de vérité, règles pures et façade gardée.md`, `Lever les ambiguïtés du graphe d'appels — l'IA choisit dans une liste fermée, le code vérifie.md`, `Glossaire — Tabindex itinérant (motif ARIA des onglets).md`, `Glossaire — Demande à nonce (exécutée une seule fois).md`, `Glossaire — Fonction passée en valeur (première classe) et faux code mort.md` ; étendues (blocs « Évolution du 12/10 ») : `Glossaire — Graphe d'appels…`, `Explorateur de code…`, `Injection de prompt…`, `TanStack Query et Zustand…`, `Glossaire — Throttle et debounce…` ; MOC (parcours 48 → 50, section « Lire la conversation, croire le graphe », questions de révision, graphe du 12/10) et canvas (3 nœuds, 2 flèches) mis à jour ; `CLAUDE.md` (dernière mise à jour).
**Points ⚠️ :** code lu, non exécuté. Correctifs de l'audit du 11/10 et spec 013 D6 sans nouvelle note (chemin rendu visible, pas de mécanisme nouveau) ; audits d'usage non enseignés (constats, pas de notion). La qualité réelle des choix de l'IA (US6) n'est pas mesurée : l'e2e utilise un Claude simulé.

### [2026-10-12 17:05] FEAT — fichiers .md toujours mis en forme (lecteurs d'élément et de livrable, encadrés)
**Fichiers :** `renderer/src/chat/{ElementFiles.tsx, Markdown.tsx}`, `renderer/src/canvas/FileViewer.tsx`, `renderer/src/lib/Segmented.tsx` (nouveau, sorti de `canvas/workflow/WorkflowCard.tsx`) ; test `unit/renderer/markdown-readers.test.tsx` (nouveau). 2 041 tests verts.
**Quoi :** retour de mentalyas sur un cours `.md` généré pour le projet PLGI, ouvert depuis un élément de carte : texte brut numéroté. Le lecteur des fichiers d'élément s'ouvre désormais « Mis en forme » pour un `.md`, « Texte brut » en option (même bascule que le lecteur Workflow, spec 023 D13). La visionneuse d'un livrable gagne un onglet « Mis en forme », ouvert d'office pour un `.md`. Les encadrés GitHub (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) sont rendus partout où passe `Markdown` (conversations comprises) : bordure et titre colorés aux jetons du thème, marque retirée.
**Choix :** petit plugin remark local (`remarkCallouts`, types mdast réduits à l'utile) plutôt qu'une nouvelle dépendance ; type inconnu (`[!FOO]`) laissé en texte ; sécurité inchangée (`skipHtml`, liens inertes pour un fichier du projet).
**Règle apprise :** tout lecteur de fichier qui peut recevoir un `.md` l'affiche mis en forme par défaut (demande explicite de mentalyas : « TOUJOURS »).

### [2026-10-12 17:45] FEAT — schémas Mermaid dessinés dans les fichiers .md (et les réponses de Claude)
**Fichiers :** nouveau `renderer/src/chat/MermaidDiagram.tsx` ; `renderer/src/chat/Markdown.tsx` (`pre` : bloc ```mermaid → schéma) ; `package.json` (dépendance `mermaid` 12.0.0, MIT, accord de mentalyas ; overrides `lodash-es ^4.18.1`, `mermaid > katex 0.18.8`), `CLAUDE.md` (note `npm audit`) ; tests `unit/renderer/markdown-readers.test.tsx` (3 cas Mermaid simulé), nouveau `e2e/markdown-mermaid.e2e.ts`. 2 044 tests verts, e2e vert, `npm audit` 0.
**Quoi :** retour de mentalyas sur le cours PLGI : le schéma ```mermaid restait du code. Tout bloc ```mermaid passé par `Markdown` (lecteurs de fichiers, conversations) est dessiné ; syntaxe invalide : « Schéma Mermaid illisible : code source affiché. » ; thème clair ou sombre suivi en direct (redessin au changement).
**Choix :** Mermaid chargé à la demande (morceau séparé de 1,1 Mo), `securityLevel: 'strict'` ; le SVG est affiché en **image** `data:` (permise par la CSP `img-src 'self' data:`) et jamais injecté dans la page : un `.md` piégé ne peut rien exécuter. Thème sombre lu sur le fond réel (`--color-surface`), pas sur le nom du thème (carbone compris). mermaid 12.0.0 plutôt que 12.1.0 (publiée il y a 10 jours).
**Erreur corrigée :** l'image ne se décodait pas (largeur naturelle 0, vu en e2e seulement) : les étiquettes HTML de Mermaid (`<br>` non fermé) sont invalides en XML ; le SVG est relu dans un document HTML inerte puis resérialisé (`XMLSerializer`).
**Règle apprise :** un SVG produit pour la page n'est pas forcément une image valide ; vérifier `naturalWidth` dans l'app réelle, jsdom ne décode rien. En e2e, « Tout afficher » anime la vue : refaire le clic sur un nœud tant que sa carte n'est pas ouverte.

### [2026-10-12 18:10] FIX — document_ecrire dans la conversation d'un élément : refus clair au lieu de « Neurone introuvable »
**Fichiers :** `main/application/mcp/DocumentTools.ts`, `main/application/conversation/frame.ts`, `shared/mcp/tools.ts` ; test `integration/mcp/document-tools.test.ts`. 2 045 tests verts.
**Symptôme :** cours PLGI, conversation d'un élément de carte de structure : la fiche disait « non relié à la carte : document_ecrire a échoué ». Transcription de la session Claude : deux appels, deux fois « Neurone introuvable » ; Claude a alors écrit le `.md` dans le projet lui-même.
**Cause (vérifiée) :** les documents (spec 012) ne s'attachent qu'à un genesis ou une étape (`PlanRepository.node` rend `undefined` pour `kind = 'element'`, et la carte ne les dessine qu'autour d'un plan) ; l'interface masque déjà « Rédiger un document » dans une conversation d'élément, mais la consigne générale de Claude l'envoyait vers `document_ecrire`, et le pont laissait passer jusqu'au service.
**Correction :** refus explicite dans l'outil (`NON_MODIFIABLE`, avec la marche à suivre : écrire le `.md` dans le projet sous un chemin de l'élément, il rejoint ses fichiers) ; la consigne et la description de l'outil le disent d'avance. Aucun changement de comportement attendu (spec 012 inchangée).
**Règle apprise :** une limite décidée dans l'interface (bouton masqué) doit aussi être dite à Claude et gardée par l'outil MCP, sinon il la découvre par une erreur trompeuse.

### [2026-10-12 18:45] DOCS — brainstorm « Le dossier du nœud » (L1n, L2, L3, L4b §7)
**Fichiers :** `docs/brainstorm/L1n-dossier-du-noeud.md`, `L2-dossier-{rangement,carte,tout-voir,claude-actions,reprise-012}.md`, `L3-dossier-{rangement,carte,claude-actions,reprise-012}.md`, `L4b-neurones.md` (§7).
**Quoi :** demande de mentalyas après le cours PLGI : un porte-documents de verre flottant, relié à tout nœud qui a des fichiers (documents de Claude, fichiers couverts, écrits en conversation, ajoutés à la main), sur le modèle visuel « Glass Folder Cards » (21st.dev) ; éventail de 4 fichiers, « Tout voir » dans l'onglet du nœud, `dossier_lire` pour Claude, reprise des nœuds documents de la spec 012 (épinglés s'ils avaient été arrangés). 7 décisions validées (D1–D7).
**Choix :** la source « écrit en conversation » généralise le hook `ecriture_avant` existant (spec 014 R5) ; les fichiers couverts d'un élément sont calculés, pas stockés ; le CSS de la référence est réécrit aux jetons (pas de `<style>` par instance) ; la commande `npx shadcn add` n'est pas lancée (dépôt non shadcn).
**Ouvert :** licence du composant 21st.dev ; mesure de performance à 30 dossiers ; borne de la source « conversation » pour un genesis ; ordre de livraison.

### [2026-10-12 19:10] DOCS — export du brainstorm et spec 028 « Le dossier du nœud »
**Fichiers :** `docs/FOUNDATION.md` (§00000000, lignes Statut et Niveaux), `CLAUDE.md` (Évolution, Workflows actifs), `specs/028-dossier-du-noeud/{spec.md,checklists/requirements.md}`, `specs/012-documents/spec.md` (ligne d'amendement D3/D4), `.specify/feature.json`.
**Quoi :** export du brainstorm L1n en amendement de la fondation ; spec 028 écrite (D1–D8, 7 user stories : MVP = documents de Claude dans un dossier de verre relié à tout nœud ; puis quatre sources, « Tout voir », lecture par Claude, reprise des documents de la spec 012 avec épingles, pastille au dézoom, glisser et menu). Checklist qualité verte, aucun marqueur de clarification.
**Choix :** deux questions ouvertes du L1n tranchées par défaut dans les Assumptions (conversation du genesis non bornée, limite de 500 fichiers ; livraison après les finitions T035–T037 de la spec 017) ; la spec 012 reste en pause, amendée d'abord (méthode : amender la spec avant de coder).

### [2026-10-12 21:20] SECURITY — spec 017 T035 : rien d'un projet « Local uniquement » ne part vers Claude, sur tout le parcours
**Fichiers :** `tests/integration/reprise/local-only-end-to-end.test.ts` (nouveau), `ConfidentialityGuard.ts`, `WidgetService.ts`, `WidgetIoService.ts`, `NeuronService.ts`, `bootstrap.ts`, `tests/support/neurons.ts`, tests unitaires de la garde, du widget et de la catégorisation.
**Quoi :** test composé comme `bootstrap.ts` : projet piégé repris « Local uniquement » (import, analyse, ambiguïtés, guide, carte, widget, conversation, chaque outil public du pont MCP avec les identifiants du projet à toutes les places, appelé par une session externe, un autre projet et le projet lui-même ; git piégé), sous deux réglages de l'IA (modèle local en marche ; arrêté avec repli vers Claude autorisé).
**Erreurs corrigées (trois fuites réelles) :** (1) un widget branché sur un nœud du projet envoyait son contexte complet à Claude (Wireframe, Parcours, Adapter, demande) → `localOnly` imposé ; (2) la garde du pont ne lisait que `id`, `projet`, `document` : `element_avancer` modifiait un élément local et renvoyait son titre, `dessiner` et `widget_poser` écrivaient dans le projet → la garde examine tout identifiant des arguments (clés `wf:` comprises) ; (3) le genesis d'une reprise était catégorisé avant l'enregistrement de sa confidentialité (repli Claude possible) → plus de catégorisation, modèle local imposé pour un genesis local.
**Règle apprise :** une garde qui énumère des noms de champs se périme au premier champ ajouté ; garder par ce que les arguments contiennent (tout identifiant), et tester en énumérant les outils réels (un outil sans cas fait échouer le test).

### [2026-10-12 21:25] PERF — spec 017 T036 : mesures sur 5 000 fichiers dans l'app réelle
**Fichiers :** `tests/e2e/reprise-bench.e2e.ts`, `tests/support/benchProject.ts` (nouveaux), `domain/reprise/resolve.ts`, `AnalysisService.ts`, `CodeGraphRepository.ts`, `tests/unit/reprise/resolve.test.ts`, `specs/017-reprise-voir/{research.md R9, data-model.md}`.
**Quoi :** projet généré (TS, C#, PHP qui s'importent et s'appellent), importé par l'interface, mesuré : analyse 42,9 s (< 2 min), réanalyse 3,6 s (< 10 s), main 6 ms et images 7 ms au 95ᵉ centile, niveau de l'explorateur 85 ms (< 1 s), carte 7 ms par image. Plan B WebGL inutile.
**Erreurs corrigées :** (1) un lien incertain gardait toutes les cibles de même nom (jusqu'à 3 000) : ≈ 1,2 Go écrits par analyse et des listes géantes envoyées à l'IA → borne `MAX_CANDIDATES = 20` (au-delà : incertain sans liste) ; (2) la réanalyse réécrivait tout le graphe malgré la promesse du dépôt → `changedFiles` / `edgeChanges` comparent à la base, seules les différences sont écrites ; (3) main bloqué 3,6 s en fin d'analyse → écriture par tranches et `setImmediate` entre phases (1,6 s au pire) ; (4) deux boucles quadratiques remplacées par des index.
**Règle apprise :** mesurer d'abord par phase (le coupable était l'écriture des liens, pas l'analyse syntaxique) ; une donnée « pour l'IA » sans borne finit par coûter plus que tout le reste.

### [2026-10-12 21:30] FEAT — spec 017 T037 : projet repris dans la démo, spec 017 livrée
**Fichiers :** `src/main/infrastructure/db/demo/demoReprise.ts` (nouveau), `src/main/index.ts`, `bootstrap.ts` (`analyzeReprise`), `tests/integration/reprise/demo-reprise.test.ts`, `tests/e2e/demo-reprise.e2e.ts`, `docs/FOUNDATION.md` §000, `CLAUDE.md`, `specs/017-reprise-voir/{spec.md, tasks.md}`.
**Quoi :** `npm run seed:demo` ajoute `boutique-demo/` (boutique TS + facturation C#, un appel `Save` ambigu), « Local uniquement », dans son propre canevas (spec 024), analysé à sa création ; graine séparée, ajoutée aussi à un profil démo déjà rempli ; hors des tests e2e sauf `GI_E2E_REPRISE_DEMO=1`. Spec 017 marquée « Livrée ».
**Observé, non corrigé :** un double-clic envoyé dans la première seconde après l'ouverture de l'explorateur d'un gros projet est perdu ; la résolution des liens (1,6 s) reste dans le main.

### [2026-10-12 21:50] DOCS — spec 028 « Le dossier du nœud » : plan technique
**Fichiers :** `specs/028-dossier-du-noeud/{plan.md, research.md, data-model.md, quickstart.md, contracts/ipc-folders.md, contracts/mcp-dossier.md}`.
**Quoi :** plan en 8 lots (US1 MVP → US7, puis finitions), tiré des L3 et du code relu après `41585b3` : table de rangement `folder_entries` + `folder_places` (migration 0047), fichiers couverts calculés, source « conversation » par le hook `DeliverableTracker` existant (posé sur toutes les conversations), `document_ecrire` pour tout nœud, reprise des documents de la spec 012 dès le lot 1 (épinglés rendus par `DocumentNode`), `GlassFolder` réécrit, « Tout voir » comme cible de lecteur de l'onglet (spec 027), `dossier_lire`. Aucune dépendance nouvelle.
**Choix :** code de la référence 21st.dev lu (consultation gratuite de mentalyas) : aucune licence déclarée → réécriture inspirée, sans copie ; techniques retenues notées dans research R5 (variables CSS d'état, file de peinture partagée, `inert`, menu clavier). Confidentialité : aucun cas particulier dans le dossier (décision de mentalyas : le Brainstormer travaille avec l'IA, un code interdit d'IA est signalé en début de brainstorm) ; FR-023 et SC-004 retirés de la spec 028.

### [2026-10-12 23:10] FEAT — spec 028 lot 1 (US1) : le dossier de verre des documents de Claude
**Fichiers :** migration `0047_node_folders` (+ `down`), `schemaFolders.ts`, `FolderRepository`, `FolderService`, `domain/folders/folderRules.ts`, `shared/ipc/folders.ts`, `ipc/folderHandlers.ts`, `documents/{documentView,mapNodes}.ts`, `DocumentService`, `DocumentTools`, `frame.ts`, `tools.ts`, `CanvasService`, `bootstrap.ts` ; interface `canvas/folder/{GlassFolder,FolderNode,folderArt,folderGeometry}.ts(x)`, `folder.css`, `planLayout.ts`, `buildGraph.ts`, `IdeasCanvas.tsx` ; tests `folder-rules`, `folder-service`, `folder-backfill`, `document-tools`, `document-ipc`, `folder-placement`, `folder-art`, `glass-folder`, e2e `node-folder.e2e.ts`.
**Quoi :** `document_ecrire` accepte tout nœud de la carte (genesis, étape, élément, nœud Workflow) ; le document est rangé dans le dossier de verre de son nœud (éventail des 4 plus récents, documents d'abord, « nouveau » jusqu'à l'ouverture, lecture dans l'onglet du nœud, place glissée gardée). Les documents existants passent dans les dossiers par la migration ; ceux arrangés à la main restent épinglés. Illustration « encre » teintée de la couleur du nœud, peinte par une file partagée (6 ms par image). Composant réécrit sans copie de la référence 21st.dev.
**Choix (research R11) :** les documents sont une source calculée depuis `documents` (pas de recopie ni de synchronisation d'annulation) ; table `folders` (place, dernière ouverture) ; reprise dans la migration plutôt qu'au démarrage.
**Erreurs corrigées :** dossier d'un élément posé à droite, il couvrait ses enfants (vue Progression) → à gauche ; trait vers le nœud invisible → point d'attache du côté du nœud. Les blocs heredoc du shell perdent les barres obliques inverses : fichiers à barres obliques écrits par l'outil d'écriture.
**Mesures :** `canvas:get` + < 20 ms avec 30 dossiers ; 2093 tests verts.

### [2026-10-12 23:30] FIX — spec 028 : dossier réduit à l'échelle des nœuds
**Retour de mentalyas :** « le dossier est top, il fonctionne bien, mais est trop grand par rapport aux nœuds ». **Correction :** scène dessinée en grand puis réduite à 60 % (`FOLDER_SCALE`, 108 × 114 px au lieu de 180 × 190), textes de la scène agrandis pour rester lisibles, case du plan réduite (136 × 140). Tests et e2e verts.

### [2026-10-12 23:55] FIX + FEAT — spec 028 : dossier plus petit, sans animation parasite, fichiers couverts dès maintenant
**Retours de mentalyas :** « le dossier s'anime même quand je clique dans le vide et quand je zoome » ; « tous les nœuds qui ont déjà une doc doivent avoir leur dossier, sans que je doive regénérer une doc » ; « encore un petit peu plus petit ».
**Causes (vérifiées dans le code) :** l'allègement du verre pendant que la carte bouge (`data-moving`, posé aussi par un clic dans le vide) changeait sa teinte ; au zoom, React Flow redessine le nœud et l'illustration refaisait son fondu.
**Corrections :** allègement retiré (research R5 : la mesure à 30 dossiers, US6, décidera d'une autre parade) ; illustration finie gardée en mémoire et posée aussitôt, sans fondu ; échelle 50 % (90 × 95 px), textes de la scène agrandis, case du plan 116 × 118.
**Avancé du lot 2 (US2) :** les fichiers que couvrent les chemins d'un élément sont dans son dossier, calculés à la lecture (index des fichiers du projet, sans fichiers sensibles) ; docs d'abord ; un fichier couvert s'ouvre dans le lecteur des fichiers d'élément. Le cours PLGI écrit sous un chemin de l'élément y apparaît sans rien régénérer.

### [2026-10-13 00:20] DECISION — spec 028 en pause : dossiers désactivés derrière un interrupteur
**Retour de mentalyas :** « les dossiers c'est joli mais inutile sur les nœuds, car ils sont déjà autosuffisants avec leur scroller intégré, donc on va désactiver ces dossiers pour le moment ; on le réutilisera plus tard si nécessaire dans un autre cas de besoin ».
**Quoi :** interrupteur unique `FOLDERS_ENABLED = false` (`src/shared/ipc/folders.ts`), lu au démarrage (canevas, suivi des écritures, canaux `folder:*`), par `document_ecrire` (option `allNodes`), sa description et la consigne de conversation, et par la vue de la carte (sans dossiers, tous les documents vivants sont dessinés, spec 012). Coupé, l'app retrouve son comportement d'avant la spec 028.
**Gardé :** code des lots 1 et 2 (dont la suite du lot 2 écrite ce soir : rangement depuis les conversations, « + », retrait, masquage, lecture d'un fichier rangé), ses tests (2104 verts), migrations 0047-0048 (la 0047 a tourné sur la base de mentalyas : sans effet tant que c'est coupé). L'e2e `node-folder.e2e.ts` ne tourne que dossiers allumés.
**Erreur corrigée en route :** le lot `folder` n'était pas déclaré annulable dans l'Historique (trouvé par le test du retrait annulé).
**Règle apprise :** une fonction visuelle se juge sur la vraie carte avant d'en coder la suite ; le lot 1 (MVP) a suffi à trancher.

### [2026-10-13 00:36] SESSION — End
**Resume :** fichiers .md toujours mis en forme (encadrés, schémas Mermaid) ; `document_ecrire` refuse clairement un élément ; brainstorm, export et spec 028 « Le dossier du nœud » (plan, tâches, analyse) ; spec 017 « Reprise — Voir » livrée (T035 : 3 fuites vers Claude corrigées ; T036 : mesures 5 000 fichiers, analyse 43 s, réanalyse 3,6 s, 1,2 Go d'écriture inutile supprimé ; T037 : projet repris de démo) ; spec 028 lots 1-2 codés puis mis en pause par mentalyas (interrupteur `FOLDERS_ENABLED = false`), dossier de partage du composant pour un collègue ; correction asynchrone de la vue Workflow par l'Analyste vérifiée (2105 tests, 40 e2e) ; worktree Kilo Code inutilisé retiré.
**Branche :** main
**Commits pushes :** 7


### [2026-10-13 00:50] DOCS — parcours académique (session du 12→13/10, /hub end 7bis, mode auto)
**Fichiers :** `docs/academique/` — créées : `Afficher un Markdown non fiable — arbre syntaxique, plugin remark et schéma Mermaid en image.md`, `Garde de confidentialité de bout en bout — garder par contenu, tester par énumération.md`, `Mesurer puis désengorger le main — banc par phases, bornes, différences et tranches.md`, `Glossaire — Boucle d'événements (synchrone, asynchrone, céder la main).md`, `Glossaire — Interrupteur de fonctionnalité (feature flag).md` ; étendues (blocs « Évolution du 13/10 ») : `Glossaire — Générateur pseudo-aléatoire à graine (PRNG)`, `Glossaire — CSP`, `Consigne pour un agent outillé…`, `Tests de bout en bout…`, `Vue Workflow…` ; MOC (parcours 50 → 53, section « Afficher sans exécuter, ne rien laisser fuir, mesurer », questions de révision, graphe du 13/10) et canvas (3 nœuds, 1 étiquette, 3 flèches) mis à jour ; `CLAUDE.md` (dernière mise à jour).
**Points ⚠️ :** code lu, non exécuté ; chiffres de performance repris de `specs/017-reprise-voir/research.md` R9 (mesurés sur le poste de mentalyas). Pas de note dédiée au composant visuel du dossier (spec 028 en pause ; sa technique de bruit est dans le glossaire PRNG) ni au projet repris de démo (données fictives).

### [2026-10-13 01:05] FEAT — spec 029 : scènes animées « Comment ça marche » sur l'accueil
**Fichiers :** `specs/029-scenes-accueil/`, `src/renderer/src/home/scenes/` (`beats.ts`, `useBeatCycle.ts`,
`TravelDot.tsx`, `sceneKit.tsx`, `SceneIdea.tsx`, `ScenePlan.tsx`, `SceneMcp.tsx`, `SceneReprise.tsx`, `scenes.css`,
`HowItWorks.tsx`), `src/renderer/src/home/ProjectManager.tsx`, `tests/unit/renderer/scene-beats.test.ts`,
`tests/unit/renderer/how-it-works.test.tsx`, `.specify/feature.json`
**Resume :** Quatre scènes vectorielles (Idée → neurone, Plan d'attaque, Pont MCP, Reprise) inspirées du composant
« Services Stack » (21st.dev, MIT, code non repris) et validées sur un prototype autonome. SVG dans le JSX, transitions
CSS (`stroke-dashoffset`, `transform-box: fill-box`, `scaleX`, cache en `steps()`), point voyageur par
`getPointAtLength`. Le domaine pur `beats.ts` décide des phases (fondu → remise à zéro → étapes → pause) ; le hook
`useBeatCycle` ne fait que les enchaîner. Section dépliée sans brainstorm, repliée sinon ; figée sur l'état final en
mouvement réduit, hors écran (IntersectionObserver) ou en pause. Couleurs : jetons de `tokens.css` uniquement, teintes
douces par `color-mix`. Aucune dépendance ajoutée, CSP inchangée.
**Regle apprise :** une animation en boucle se teste par ses phases (fonction pure) et par les classes posées sur le
SVG avec de fausses minuteries, pas par le rendu (jsdom ne calcule ni transitions ni `getPointAtLength`).

### [2026-10-13 01:20] DOCS — critique impartiale du projet (à relire en début de prochaine session)
**Fichiers :** `docs/AUDIT-2026-10-13-critique-projet.md`
**Resume :** Critique demandée par mentalyas : ce qui est intelligent (pont MCP, sécurité, annulation par lot, mesures),
utile, redondant (widgets sur 5 specs, 4 façons de rattacher du contenu, 6 vues), inefficace (fichiers trop gros,
98 migrations, e2e instables, documentation plus lourde que le produit) ; dispersion des fonctionnalités (10 specs livrées sur
28) et besoin d'origine (rappel quotidien) disparu. Se termine par une checklist de décisions à prendre ensemble :
usage réel, gel des fonctionnalités, tri des 16 specs non livrées, code mort, fin de session allégée, statuts réalignés.

### [2026-10-13 14:30] DOCS — décisions de la critique : gel, tri des specs, statuts réalignés
**Fichiers :** `docs/AUDIT-2026-10-13-critique-projet.md`, `CLAUDE.md`, `specs/0{04,05,08,10,11,12,13,14,15,16,19,20,21,22,24,28,29}-*/spec.md`
**Resume :** Les sept décisions de la critique sont prises avec mentalyas. Quatre usages sont gardés (carte + conversation,
piloter, reprendre, widgets). **Gel des fonctionnalités** jusqu'à ce que la carte de Bike_cycle remontre l'avancement et
que les e2e soient stables. Tri spec par spec : 021 « Git et GitHub » gardée pour après le gel (commit, pull et push par
Claude) ; 005, 011, 012, 013, 014, 015, 019, 022 redeviennent des idées ; 024 livrée (US1–US5) ; 028 abandonnée (code
retiré le 2026-11-12 s'il n'a pas resservi) ; 029 abandonnée, code rangé sur `archive/029-scenes-accueil`. Le besoin
d'origine (rappel quotidien) est abandonné : la description est mise à jour. Microsoft Graph + MSAL sont retirés de la
stack (absents du code). Ollama et l'anonymisation de l'import de contexte servent encore. Le retrait des tables
d'archive est reporté à un chantier à part. Skill `/hub` : graphe hebdomadaire, cours sur confirmation.
**Regle apprise :** un statut de spec qui ne commence pas par « Livrée », « En pause » ou « Abandonnée » est invisible
pour la vue Workflow ; cinq specs finies (004, 008, 010, 016, 020) y apparaissaient comme non livrées.

### [2026-10-13 15:10] FIX — spec 030 « Avancement fiable » : la carte de structure suit le travail
**Fichiers :** `specs/030-avancement-fiable/`, `src/shared/mcp/tools.ts`, `src/main/application/structure/StructureService.ts`,
`src/main/domain/structure/status.ts`, `src/main/application/history/HistoryService.ts`,
`src/main/application/conversation/frame.ts`, `src/main/ipc/structureHandlers.ts`, `src/shared/ipc/channels.ts`,
`src/renderer/src/canvas/{progress.ts,buildGraph.ts,nodes/ElementNode.tsx,cards/IdeaCards.tsx}`,
`src/renderer/src/git/{ChangesTab.tsx,CommitDelivery.tsx}`, `src/main/infrastructure/db/demo/seedDemo.ts`, tests
(`tests/unit/structure/status.test.ts`, `tests/unit/renderer/element-status.test.tsx`, `element-progress.test.ts`,
`tests/integration/structure/structure.test.ts`, `tests/e2e/avancement.e2e.ts`)
**Resume :** Première réparation du gel (audit Bike_cycle §3.1, propositions C1 à C4). (1) `element_avancer` accepte
l'identifiant **ou la clé** d'un autre élément du même projet (`projet` pour une session sans neurone) ;
`structure_lire` affiche les identifiants ; un identifiant inconnu est refusé avec « pas une étape du plan d'attaque ».
(2) Choix du statut dans la carte de détails d'une feuille : un lot « par toi », annulable, l'avancement suit le statut
(domaine pur `manualProgress` : livrée = 100 %, rouvrir efface un 100 %). (3) Statut affiché des parents calculé
(`statusOf`) : livré quand tous les enfants le sont, en cours dès que l'un avance, bloqué s'il l'est lui-même. (4) Après
un commit dans le volet Dépôt, les feuilles dont un chemin couvre un fichier commité sont proposées « Passer en
livrée », cochées d'office ; rien sans clic. Aucune migration, aucune dépendance. Carte démo : chemins fictifs ajoutés
pour le lot 4. Vérifié : 2 118 tests, typecheck, lint, Prettier ; e2e joué dans l'app (2/2).
**Erreur corrigée :** le renderer affichait son propre toast après `element:setStatus`, aussitôt remplacé par celui du
main (`map:changed`, déjà annulable) : un seul toast, celui du main.
**Regle apprise :** toute écriture de la carte émise par le main (`emit`) a déjà sa notification annulable ; le renderer
ne montre que les erreurs.

### [2026-10-13 15:45] TEST — e2e rendus déterministes (seconde condition du gel)
**Fichiers :** `tests/e2e/support/app.ts` (`settled`), `tests/e2e/widget-wireframe.e2e.ts`,
`tests/e2e/workflow-task-files.e2e.ts`
**Resume :** Les trois e2e dits instables (git-sync, widget-wireframe, workflow-task-files) n'ont pas échoué sur
4 exécutions : 3 passes complètes de la suite (sans le banc de 5 000 fichiers, 39/39 chacune) et 1 passe ciblée. Les
deux échecs notés le 11/10 avaient la même cause : une mesure ou un clic pendant que la carte glisse. Ajout de
`settled(locator)` (trois mesures identiques à 100 ms d'intervalle avant de mesurer ou de cliquer, 10 s au plus),
utilisé avant les deux glisser-déposer vers un widget et avant « Plein écran ». Ensuite, 3 passes ciblées vertes
(9/9 chacune). git-sync n'avait aucune trace d'échec : inchangé.
**Regle apprise :** dans un e2e sur la carte, ne jamais lire une position (`boundingBox`) sans attendre que le nœud
soit immobile ; un `waitForTimeout` fixe ne suffit pas sous charge.

### [2026-10-13 17:30] DECISION — Gel des fonctionnalités levé
**Fichiers :** `CLAUDE.md`
**Resume :** Les deux conditions de la critique sont remplies : la carte de structure remonte l'avancement (spec 030,
vérifiée sur la carte de Bike_cycle : statut des modules calculé d'après leurs sous-éléments, statut à la main puis
annulé) et les e2e sont rendus déterministes (`settled`). Prochain chantier : spec 021 « Git et GitHub », recentrée sur
commit, pull et push par Claude depuis le Brainstormer.
**Regle apprise :** Bike_cycle est un projet fictif qui sert à éprouver le Brainstormer : on conclut sur le code (e2e,
démo), jamais sur la justesse de ses données.

### [2026-10-13 18:10] FEAT — Spec 021 US5 lot 2 : Skyline des contributions et rediffusion sur l'explorateur
**Fichiers :** `src/renderer/src/git/skyline/{contributions.ts,ContributionSkyline.tsx}`, `src/renderer/src/git/{Timeline,HistoryTab}.tsx`,
`src/main/domain/git/{fileToNode,replay,args}.ts`, `src/main/application/git/{GitHistoryService,SyncService}.ts`,
`src/main/application/reprise/ExplorerService.ts` (`tree`), `src/shared/git/history.ts`, `src/main/ipc/gitHandlers.ts`,
`src/shared/ipc/channels.ts`, `src/main/bootstrap.ts`, `src/renderer/src/explorer/{useReplay.ts,ReplayBar.tsx,ExplorerNodes.tsx,ExplorerPage.tsx}`,
`src/renderer/src/app/{uiStore.ts,AppShell.tsx}`, tests (`tests/unit/renderer/skyline.test.ts`, `tests/unit/git/replay.test.ts`,
`git-timeline.test.tsx`, `explorer-page.test.tsx`, `tests/integration/git/git-history.test.ts`, e2e `git-history.e2e.ts`, `git-replay.e2e.ts`)
**Resume :** (1) **Skyline** (D16, référence visuelle de mentalyas : composant « Contribution Skyline » de 21st.dev, sans
licence publiée, principe repris et code réécrit) : commits par jour sur un an, carte de chaleur 2D qui se replie en
relief 3D (vague, orbite, double-clic), survol et flèches du clavier, légende qui isole un niveau, statistiques (total,
jour le plus chargé, séries) ; couleur de l'auteur choisi dans la frise (sinon l'accent du thème) ; un clic ou Entrée sur
un jour centre la frise sur ce jour. Canvas, aucune dépendance, `prefers-reduced-motion` respecté. (2) **Rediffusion**
(T030, T041, T043) : `git:replaySteps` lit une fois les 5 000 derniers commits avec leurs fichiers (`--numstat`, ou
`--name-only` dans un clone partiel : jamais de téléchargement caché), en cache par HEAD ; `git:replay` attribue chaque
fichier au nœud visible de l'explorateur qui le contient (`fileToNode`, arbre de la cartographie de la spec 017) et
donne auteur principal, dernier auteur et parts ; `git:fetchAll` (« Tout télécharger », confirmé) retire le filtre puis
`fetch --refetch`. Interface : bouton « Rediffusion » de l'explorateur et « ▶ Rejouer sur la carte » de l'onglet
Historique ; pastille (couleur + initiales) et bordure par nœud, « — » pour un nœud jamais touché, barre ◀◀ ▶ ▶▶ +
curseur + légende + principal / dernier + parts du nœud choisi, `Échap` pour quitter. Vérifié : 2 134 tests,
typecheck, lint, Prettier ; e2e git-history, git-replay, demo-reprise, git-sync (7/7).
**Erreur corrigée :** « Tout télécharger » lançait d'abord `--refetch` puis retirait le filtre : git aurait retéléchargé
en partiel ; le filtre est retiré avant (research R13). Sous Windows, ▶ s'affichait en emoji : sélecteur de variation
texte (U+FE0E).
**Regle apprise :** pour un journal git avec fichiers, `-z --numstat --format=%x1e…` : un enregistrement par commit
ouvert par \x1e, l'en-tête finit au premier NUL, puis les fichiers séparés par NUL.

### [2026-10-13 18:30] FEAT — Spec 021 US6 : pull requests, issues et fork
**Fichiers :** `src/main/application/git/GitHubService.ts`, `src/main/application/ai/GitHubTasks.ts`,
`src/main/infrastructure/ai/GitHubFrames.ts`, `src/main/domain/git/{ghArgs,args}.ts`, `src/main/infrastructure/git/GhRunner.ts`,
`src/main/infrastructure/db/repositories/{GitRepository,changeLog,HistoryRepository}.ts`, `schemaNeurons.ts` (type `git`),
`src/main/application/history/HistoryService.ts`, `src/main/domain/ai/{types,routing}.ts`, `ContextAssembler.ts`, `aiEngine.ts`,
`src/main/ipc/gitHandlers.ts`, `src/main/bootstrap.ts`, `src/shared/git/github.ts`, `src/shared/ai/schemas.ts`,
`src/shared/ipc/{channels,history}.ts`, `src/renderer/src/git/{PrTab,IssuesTab,ForkDialog,GitHubMarkdown,IssueChips,RepoPanel,PushPanel}.tsx`,
`src/renderer/src/chat/Markdown.tsx` (`link`), `src/renderer/src/canvas/nodes/{NeuronNode,ElementNode}.tsx`, tests
(`tests/unit/git/github-args.test.ts`, `tests/integration/git/github.test.ts`, `tests/unit/renderer/git-github.test.tsx`)
**Resume :** Onglets **PR** et **Issues** du volet Dépôt (dépôt GitHub seulement). PR : liste (50 au plus, gardée
5 min, « Actualiser »), détail (description en Markdown sûr, fichiers, diff borné à 2 Mo), « ✨ Relire avec Claude »
(résumé et remarques gardés dans l'app), commentaire publié seulement après relecture du texte et clic, branche
`pr/<n>` récupérée sans être lancée, « Nouvelle PR » (texte proposé par Claude, modifiable, récapitulatif puis
création ; branche poussée exigée, état vu vérifié ; depuis un fork, la PR part vers l'original). Issues : recherche,
pages de 100, détail, « Nouvelle issue » depuis une idée (texte de Claude, reliée d'office), liens issue ↔ idée dans
l'app (lot « git » annulable depuis l'Historique) et pastille `#n` sur le genesis et les éléments. **Fork** depuis
l'aperçu du push quand le compte n'a pas le droit d'écrire : récapitulatif, `gh repo fork` sans clone ni remote, puis
`origin` = le fork, `upstream` = l'original. Liens d'un texte GitHub : seuls `https://github.com/…` s'ouvrent (le main
revérifie) ; les autres se copient. `gh` ne peut construire ni approbation, ni fusion, ni fermeture. Vérifié : 2 149
tests, typecheck, lint, Prettier ; e2e git-local, git-sync, avancement, git-history (12/12). Non joué contre le vrai
GitHub (compte et réseau) : à faire par mentalyas sur un dépôt de test.
**Erreur corrigée :** `prComment` renvoyait le numéro journalisé en plus de l'adresse. Deux substitutions Python ont
transformé `\r\n\t` et `[\\]` en caractères réels dans des expressions régulières : corrigé, et les modifications
passent désormais par l'outil d'édition ou un script écrit dans un fichier.
**Regle apprise :** un texte venu de GitHub est une donnée hostile possible : rendu sans HTML ni image, et une adresse
ne devient cliquable que si le main la revérifie (`https://github.com/`), jamais sur la seule foi du renderer.

### [2026-10-13 18:40] FEAT — Spec 021 US7 : extraire un morceau, et clôture de la spec 021
**Fichiers :** `src/main/domain/git/{license,attribution}.ts`, `src/main/application/git/ExtractService.ts`,
`src/shared/git/extract.ts`, `src/main/ipc/gitHandlers.ts` (`createExtractRoutes`), `src/main/bootstrap.ts`,
`src/shared/ipc/channels.ts`, `src/renderer/src/git/ExtractDialog.tsx`, `src/renderer/src/explorer/FilePanel.tsx`, tests
(`tests/unit/git/extract.test.ts`, `tests/integration/git/{extract,git-audit}.test.ts`, `tests/unit/renderer/git-extract.test.tsx`,
e2e `git-replay.e2e.ts`), `specs/021-git-github/{spec,tasks}.md`, `docs/FOUNDATION.md`, `CLAUDE.md`
**Resume :** « Extraire… » dans le volet de code de l'explorateur : la licence du dépôt est identifiée par règles fixes
(MIT, Apache-2.0, BSD, ISC, MPL-2.0, Unlicense : copie permise ; GPL, LGPL, AGPL : réciprocité ; sinon inconnue) et
affichée avant toute copie, avec l'en-tête d'attribution (origine, chemin, lignes, commit, licence, copyright) dans la
syntaxe de commentaire du fichier. Licence inconnue : seule une note d'étude (sans le code). Écriture dans
`snippets/` ou `techno/` du workspace ProjectMaster seulement (dossier et nom vérifiés, `realpath`), jamais
d'écrasement, ni commit ni exécution, journalisée sans contenu. Audit de bout en bout (T056) : aucune commande
interdite lancée par les parcours US5–US7, rien de sensible en base ni vers Claude. **Spec 021 livrée** ; reste la
mesure SC-006 (clone d'un dépôt public ≈ 10 000 commits en moins de 3 min), qui demande le réseau. Vérifié : tests,
typecheck, lint, Prettier ; e2e git-replay (rediffusion + extraction).
**Erreur corrigée :** la première version préparait le texte copié avant de savoir si la note d'étude était choisie :
une note demandée sur un dépôt MIT aurait écrit le code. Copie et note sont maintenant deux textes distincts, et le
code n'est jamais préparé quand la licence ne le permet pas. La règle AGPL attrapait la GPL-3.0, qui la cite.
**Regle apprise :** quand un mode « sans le contenu » existe, ne jamais dériver son texte de celui « avec contenu » :
préparer les deux séparément, et ne jamais préparer le contenu interdit.

### [2026-10-13 18:50] FIX — Entrée permanente du volet Dépôt dans la barre du projet
**Fichiers :** `src/renderer/src/git/RepoBadge.tsx` (variante `bar`), `src/renderer/src/home/BrainstormBar.tsx`,
`tests/unit/renderer/brainstorm-bar.test.tsx`
**Resume :** Retour de mentalyas en test : le volet Dépôt ne s'ouvrait que par le bandeau d'ouverture (refermable) ou
le badge du genesis sur la carte ; bandeau fermé, plus d'accès visible. Le badge du dépôt (branche, état, ↑ ↓) est
désormais aussi dans la barre du projet ouvert, à côté de « Points de sauvegarde », toujours visible ; un clic ouvre
le volet. Raccourci existant : Ctrl+Maj+G.
**Regle apprise :** une fonction ne doit jamais n'être accessible que depuis un élément refermable : toujours une
entrée permanente.

### [2026-10-13 19:10] FIX — Frise : zooms distincts et commits regroupés ; Skyline : choix des couleurs
**Fichiers :** `src/renderer/src/git/Timeline.tsx` (`bucketsOf`, fenêtre pleine), `src/renderer/src/git/skyline/ContributionSkyline.tsx`
(palettes, période avec l'année), `src/renderer/src/git/RepoBadge.tsx` (nom accessible de la barre), tests
(`git-timeline.test.tsx`, `brainstorm-bar.test.tsx`, e2e `git-history.e2e.ts`)
**Resume :** Retours de mentalyas en test. (1) Semaine / mois / année semblaient sans effet : sur ce dépôt (209 commits
en 15 jours, un seul auteur), les points, tenus à 3 % d'écart, s'empilaient au bord droit, et un historique plus court
que le zoom faisait commencer la frise au premier commit (mois = année). La frise couvre désormais toute la période du
zoom, et les commits d'un auteur sont regroupés par tranche du calendrier local (6 h à la semaine, un jour au mois, une
semaine à l'année) en une pastille qui porte leur nombre ; les flèches passent de pastille en pastille. Vérifié sur un
clone de ce dépôt. (2) « Changement de couleurs » : sélecteur de palette de la Skyline (Auto, GitHub, Halloween, Océan,
Braise, Raisin, Gris, d'après la référence), retenu par poste. (3) « Sur un an » affiche l'année (« 13 oct. — 13 oct. »
était ambigu). Le badge de la barre se nomme « Dépôt du projet : … » (deux badges au même nom gênaient les e2e).
**Erreur corrigée :** premier regroupement calé sur la fenêtre (qui finit à l'heure du dernier commit) au lieu du
calendrier : un même jour était coupé en deux.
**Observé :** `side-panel.e2e.ts` échoue parfois dans la suite complète (un test différent à chaque fois), jamais seul :
instable, sans lien avec ces changements ; à traiter à part (même cause probable que les e2e rendus déterministes ce
matin).
**Regle apprise :** une frise de points doit regrouper au-delà d'une densité donnée ; un écart minimal entre points ne
suffit pas, il pousse tout au bord.

### [2026-10-13 19:25] FIX — La Skyline suit le zoom de la frise
**Fichiers :** `src/renderer/src/git/skyline/{contributions.ts,ContributionSkyline.tsx}`, `src/renderer/src/git/Timeline.tsx`, tests
(`skyline.test.ts`, `git-timeline.test.tsx`, e2e `git-history.e2e.ts`)
**Resume :** Retour de mentalyas : le zoom semaine / mois / année « ne fonctionne toujours pas ». Les boutons sont juste
au-dessus de la Skyline, qui occupe la place, mais ne changeaient que les lignes de la frise en dessous. La Skyline
montre désormais la période du zoom (7, 31 ou 365 jours : « sur une semaine », « sur un mois », « sur un an »), carte de
chaleur plafonnée en hauteur pour les périodes courtes ; les jours de calage avant la période (début au lundi) restent
vides, le total est celui de la période. Vérifié sur un clone de ce dépôt aux trois zooms.
**Regle apprise :** une commande doit agir sur ce qu'elle surplombe ; sinon l'utilisateur conclut qu'elle ne marche pas.

### [2026-10-13 21:15] FEAT — spec 021 T030 : nouveautés depuis ta dernière visite surlignées sur la carte
**Fichiers :** `src/main/domain/git/args.ts` (`rangeReplayArgs`), `src/main/application/git/GitHistoryService.ts`
(`touched`, `ownerOf` partagé avec `replay`), `src/shared/git/history.ts` (`TouchedInput`, `TouchedView`),
`src/shared/ipc/channels.ts` et `src/main/ipc/gitHandlers.ts` (`git:touched`), `src/renderer/src/explorer/{useUpdatesMarks.ts,
UpdatesBar.tsx}` (nouveaux), `ExplorerPage.tsx`, `ExplorerNodes.tsx` (`MarksKindContext`), `src/renderer/src/app/{uiStore.ts,
AppShell.tsx}` (`explorerMarks: 'replay' | 'updates'` remplace `explorerReplay`), `src/renderer/src/git/HistoryTab.tsx` ;
tests `integration/git/git-history.test.ts`, `renderer/{explorer-page,git-sync-panel}.test.tsx` ; spec 021 (D13, T030, T032).
**Quoi :** dernier report de la 021. Dans « Depuis ta dernière visite » (volet Dépôt), « Voir sur la carte » (projet repris
seulement : il a une cartographie) ouvre l'explorateur ; chaque élément touché par `last_seen..tête du distant` porte la
couleur et les initiales du dernier auteur passé (parts en commits), les autres sont estompés ; barre en bas : nombre de
commits, d'éléments touchés à ce niveau, légende ; Échap ou « Quitter les nouveautés ».
**Choix :** réutiliser la rediffusion (même `fileToNode`, même `replayNodes` en poids « commits », mêmes pastilles) plutôt
qu'un second marquage ; l'intervalle vient de `git:updates` (empreintes validées par Zod puis par `rangeReplayArgs`).
**Non couvert en e2e :** seul un clone par l'app pose « dernier vu », et le clone n'accepte qu'une adresse https ; pas de
porte « adresse locale » ajoutée pour un test. Logique couverte sur un vrai dépôt git (intégration), interface en jsdom.

### [2026-10-13 21:35] TEST — spec 021 T057 (SC-006) mesuré ; `side-panel.e2e.ts` rendu déterministe
**Fichiers :** `specs/021-git-github/{research.md (R18), tasks.md, spec.md}`, `CLAUDE.md`, `tests/e2e/side-panel.e2e.ts`.
**SC-006 :** clone de `eslint/eslint` (11 063 commits) par « Depuis un lien Git », app construite, profil et coffre de
test temporaires : canevas ouvert 7,1 s après le clic (seuil : 3 min). Clone partiel `blob:none` par défaut. Script de
mesure ponctuel, non gardé dans le dépôt.
**side-panel :** deux passes complètes des e2e (sans le banc) vertes, 42/42, sans échec ce soir ; restaient une pause
fixe de 1,5 s et trois clics forcés sur des nœuds qui peuvent glisser après « Tout afficher » ou une bascule de vue →
`settled()` avant chaque clic. Trois passes seules vertes.
**Règle apprise :** une instabilité qui ne se reproduit pas se traite quand même à sa cause probable (attente à l'aveugle),
avec le même remède que les cas déjà élucidés.

### [2026-10-13 22:45] FIX — spec 021 : changer de branche dans le dépôt de l'app qui tourne demande confirmation
**Fichiers :** `src/main/application/git/GitService.ts` (`appSourceDir`, `switchBranch(…, confirmed)`, erreur `APP_REPO`),
`src/main/bootstrap.ts` (`app.getAppPath()` en développement, `null` empaquetée), `src/shared/ipc/git.ts` (`GitSwitchInput`),
`src/main/ipc/gitHandlers.ts`, `src/renderer/src/git/BranchesTab.tsx` (« Passer quand même » / « Rester ici ») ; tests
`integration/git/git-service.test.ts`, `renderer/git-panel.test.tsx` ; délai de 60 s pour `git-repos` et `git-service`
(vrais `git`, dépassaient 5 s quand l'app tourne en même temps).
**Pourquoi :** en testant le volet sur le dépôt du Brainstormer, mentalyas est passé deux fois sur
`archive/029-scenes-accueil` : le code de l'app a été remplacé sous elle (interface rechargée à chaud, sans le volet
Dépôt de la 021), impossible de revenir depuis l'app. Remis sur `main` dans un terminal, rien de perdu.
**Règle apprise :** une app qui pilote git doit reconnaître son propre dépôt : y changer de branche, c'est se remplacer
soi-même.

### [2026-10-13 23:05] TEST — spec 021 US6 contre le vrai GitHub (compte de mentalyas, à sa demande)
**Comment :** app construite pilotée par Playwright, profil de test neuf, `gh` réel ; script ponctuel non gardé.
**Résultat :** tout passe. Publier → dépôt privé `brainstormer-essai-github` ; branche `essai/pr`, commit, push ; PR #1
au texte proposé par Claude (réel), relecture de Claude affichée, commentaire publié ; issue #2 proposée par Claude depuis
le genesis, créée et reliée à l'idée. Fork : clone de `octocat/Spoon-Knife`, push refusé (« pas le droit d'écrire »),
« Forker » → fork `ernesthdj/Spoon-Knife`, `origin` → le fork, `upstream` → l'original. Rien n'a été écrit chez octocat.
**Vu :** dans le panneau de droite à 38 %, la barre d'onglets du Dépôt déborde (« Issues » coupé).
**À faire par mentalyas :** supprimer les deux dépôts de test sur GitHub (le jeton gh n'a pas `delete_repo`).

### [2026-10-13 23:20] FEAT — bouton « Explorateur » dans la barre d'un projet repris
**Fichiers :** `src/renderer/src/home/BrainstormBar.tsx` (`ExplorerEntry`), `tests/unit/renderer/brainstorm-bar.test.tsx`.
**Pourquoi :** mentalyas ne trouvait pas seul la vue aux nœuds rectangulaires (l'explorateur, spec 017) : elle n'avait
que deux entrées cachées (un lien dans l'en-tête de la conversation, « Rejouer sur la carte » dans le Dépôt).
**Quoi :** « Explorateur » dans la barre du projet, à côté du badge Dépôt, seulement pour un projet repris (`reprise:get`).

### [2026-10-13 23:55] FEAT — spec 017 D23 : « Analyser le code… » d'un projet déjà lié à son dossier
**Fichiers :** `src/main/application/reprise/RepriseService.ts` (`adopt`, dépendance `projectDirOf`), `src/main/ipc/repriseHandlers.ts`
et `src/shared/ipc/channels.ts` (`reprise:adopt`), `src/main/bootstrap.ts`, `src/renderer/src/home/BrainstormBar.tsx` (« Analyser
le code… » / « Explorateur ») ; tests `integration/reprise/reprise-service.test.ts`, `unit/ipc/reprise-handlers.test.ts`,
`unit/renderer/brainstorm-bar.test.tsx`, e2e `explorer-adopt.e2e.ts` (nouveau) ; `specs/017-reprise-voir/spec.md` (D23).
**Pourquoi :** mentalyas n'avait l'explorateur sur aucun de ses projets : seuls les projets entrés par « Reprendre » ou par
un clone avaient une analyse ; ses projets du coffre, déjà liés, ne pouvaient même pas être repris (dossier déjà lié).
**Choix :** fiche « projet repris » créée sur le genesis existant (pas de second nœud), dossier relu dans le main (jamais
un chemin de l'interface), confidentialité obligatoire, refus repris de l'import (données de l'app, trop grand, autre nœud).
**Vérifié (e2e) :** genesis de démo lié à un projet C# fictif → « Analyser le code… », « Local uniquement », explorateur
avec ses modules, puis « Explorateur » dans la barre ; aucun nœud ajouté à la carte.
**Erreur corrigée (test de mentalyas) :** « Ce dossier est déjà lié à un autre neurone » sur son projet : le contrôle de
l'import (tout neurone lié au dossier) refusait les éléments et conversations du projet, qui travaillent dans le même
dossier. Seul un autre projet repris (non supprimé) du même dossier bloque désormais.
**Puis (retour de mentalyas, « j'aurais aimé pouvoir réanalyser ») :** son dossier était déjà analysé pour un autre
nœud (un ancien « Reprendre » du même dossier). `reprise:get` renvoie alors `analyzedBy` : la barre propose directement
« Explorateur » sur cette analyse, où « Réanalyser » met la carte à jour ; plus de détour par « Analyser le code… ».

### [2026-10-14 00:30] SPEC — 031 « Explorateur en boîtes » écrite, maquette validée
**Fichiers :** `specs/031-explorateur-boites/{spec.md, tasks.md, maquette.html}`.
**Pourquoi :** mentalyas n'était pas satisfait de l'explorateur (style, informations muettes, architecture et liens
incompréhensibles, zoom par paliers). Maquette interactive itérée avec lui (17 versions, commentaires dans la page) :
piste A (boîtes de gauche à droite), clic = ouverture sur place, double-clic = entrée par un zoom où le nœud et ses
fichiers grandissent ensemble, amorces vers les modules voisins, fiche et code à droite, Ctrl+K, molette amortie,
glisser-déposer de chaque nœud, fondus enchaînés.
**Vérifié dans la maquette :** rapport fichier/cadre constant pendant le zoom, somme des opacités du relais égale à 1,
titre relayé au pixel près, aucune erreur.
**Règle apprise :** pour une transition, mesurer image par image (positions, échelles, opacités) plutôt que juger à
l'œil ; deux scènes cadrées dans le même rectangle donnent un zoom commun sans approximation.

### [2026-10-14 01:20] FEAT — spec 031 lot 1 : la carte en boîtes en une réponse (`explorer:map`)
**Fichiers :** `src/main/domain/reprise/boxes.ts` (nouveau, pur), `src/shared/ipc/reprise.ts` (couches, vues de la carte,
bornes), `src/main/application/reprise/ExplorerService.ts` (`map`), `src/main/ipc/explorerHandlers.ts` et
`src/shared/ipc/channels.ts` (`explorer:map`) ; tests `unit/reprise/boxes.test.ts` (nouveau),
`integration/reprise/explorer-service.test.ts`, `unit/ipc/explorer-handlers.test.ts` ; `specs/031-explorateur-boites/tasks.md`.
**Quoi :** modules à plat avec leur couche (Démarrage s'il contient un `main`/`cli`, sinon Entrée, Règles, Données et
outils d'après la catégorie), rôle du guide, colonnes dans le sens des appels ; fichiers avec dossier d'origine,
fonctions (sans constructeurs), profondeur d'appel dans le module, « relié à un autre module » ; appels de fichier à
fichier en phrases (`OrdersController.Post` appelle `OrderService.Place`), un lien sans cible retenue étant tracé vers
chacune de ses cibles possibles (« 4 possibles »). Aucune migration.
**Erreur corrigée (sonde sur le vrai projet de test) :** les colonnes saturaient au plafond. `SqlOrderRepository`
implémente une interface du domaine : ce lien remonte et créait une boucle Domain ↔ Infrastructure que la relaxation
gonflait. Colonnes et profondeurs se calculent maintenant sur les seuls appels, injections et routes, par ordre
topologique qui rompt une boucle à son nœud le moins appelé.
**Règle apprise :** tester un calcul de graphe sur des données réelles analysées, pas seulement sur un petit cas propre :
les liens « implémente » et « importe » vont dans l'autre sens que la lecture.

### [2026-10-14 01:50] FEAT — spec 031 lot 1b : le rôle de chaque fichier, écrit par Claude avec le guide
**Fichiers :** migration `0049_file_summaries.sql` (+ `down`), `schemaReprise.ts` (`code_files.summary`),
`CodeGraphRepository.ts` (`setFileSummaries`, rôle hors de l'empreinte de réanalyse), `shared/ai/schemas.ts` (`GuideOut.files`
facultatif), `RepriseGuideFrame.ts` (consigne, version 2), `RepriseGuideTask.ts` (fonctions de chaque fichier dans
l'arborescence), `GuideService.ts`, `domain/reprise/boxes.ts` (`fileFunctions` partagé, rôle dans la carte),
`ExplorerService.ts` ; tests `integration/reprise/guide-service.test.ts`, `unit/ai/reprise-guide.test.ts`,
`unit/reprise/boxes.test.ts` ; `specs/031-explorateur-boites/tasks.md`.
**Quoi :** dans la même passe que le guide, Claude écrit le rôle de chaque fichier (300 au plus), d'après son chemin et
ses fonctions ; gardé seulement pour un projet « Claude autorisé » et un chemin analysé ; montré dans la carte.
**Piège évité :** le rôle est exclu de l'empreinte qui décide quels fichiers une réanalyse réécrit ; sinon tout fichier
doté d'un rôle passerait pour modifié et la réanalyse effacerait tous les rôles (vérifié par un test).

### [2026-10-14 02:40] FEAT — spec 031 lot 2 : la carte d'ensemble en boîtes dans l'app
**Fichiers :** `src/renderer/src/explorer/boxes/{boxLayout.ts, BoxNodes.tsx, BoxMap.tsx, BoxList.tsx, useBoxMap.ts}` (nouveaux),
`ExplorerPage.tsx` (réécrite autour de la carte), `ExplorerNodes.tsx` (pastille, bordure et poignées réutilisées),
`labels.ts` (couches, phrases d'appel) ; tests `unit/renderer/box-layout.test.ts` (nouveau),
`unit/renderer/explorer-page.test.tsx` (réécrit), e2e `demo-reprise` et `reprise-resolution` (nouvelle vue liste).
**Quoi :** les modules en boîtes de gauche à droite dans le sens des appels (couche, nom, rôle, taille, liseré aux
couleurs du thème) ; un clic ouvre une boîte sur place — ses fichiers en boîtes, ou une liste filtrable au-delà de 6 —
et un clic dans le vide les referme ; les traits arrivent sur le fichier exact et disent l'appel en mots (nom
accessible, bandeau sous la carte au survol) ; filtres réduits à « Masquer la plomberie » et au langage (menu) ; vue
liste équivalente ; plus de fil d'Ariane ni de paliers. Panneau de droite, guide, code, résolution, rediffusion et
nouveautés gardés.
**Erreurs corrigées :** (1) un clic simulé sur un nœud déplaçable fait lire `event.view` à d3-drag, nul dans jsdom :
`fireEvent.click` pour les nœuds dans les tests ; (2) le libellé de couche en capitales (CSS) change le nom accessible
calculé par Chromium (« RÈGLES Domain ») : motifs e2e insensibles à la casse ; (3) un script Python a écrit un vrai
caractère retour arrière à la place de `\b` dans un e2e : remplacé, et vérifié qu'il n'en reste aucun dans le dépôt.
**Vérifié :** 2 189 tests unitaires, suite e2e complète (43 tests, 15 fichiers).
**Règle apprise :** écrire les expressions régulières d'un test avec l'outil d'édition, jamais à travers une chaîne
Python non brute (`\b` y devient un caractère de contrôle invisible).

### [2026-10-14 03:40] FEAT — spec 031 lot 3 : entrer dans un module, passer par une amorce, ressortir
**Fichiers :** `src/renderer/src/explorer/boxes/{insideLayout.ts, sceneMath.ts, boxes.css}` (nouveaux), `BoxMap.tsx` (deux
scènes et leurs transitions), `BoxNodes.tsx` (cadre, amorce, fichier avec ses fonctions), `ExplorerPage.tsx` (`focus`) ;
tests `unit/renderer/box-inside.test.ts` (nouveau), `unit/renderer/explorer-page.test.tsx`, e2e
`tests/e2e/explorer-boxes.e2e.ts` (nouveau).
**Quoi :** double-clic = entrer : l'intérieur seul (cadre à la taille de son contenu, fichiers par profondeur d'appel
avec leurs fonctions, appels internes en accent, amorces des voisins sur les bords) ; une amorce mène au voisin ;
Échap ou double-clic dans le vide ressort et rend la carte au zoom d'avant. Transition : une copie figée de la scène
(le viewport React Flow cloné, `aria-hidden`, `inert`) et la vraie scène (`setViewport`) cadrent leur nœud dans le
même rectangle à chaque image ; fondus par variables CSS (aucun re-rendu React par image) ; le titre glisse sur un
calque. Le clic simple sur un module attend 220 ms (un double-clic ne l'ouvre pas puis ne le referme pas).
**Mesuré (e2e, image par image) :** rapport largeur fichier / cadre constant (0,25701, écart nul) ; somme des opacités
boîte + cadre égale à 1,0 tout du long ; titre posé à moins de 1,5 px du vrai titre.
**Erreur corrigée :** le nœud d'arrivée était cherché dans tout le conteneur ; la copie figée, insérée avant, porte le
même identifiant : le fondu et le masquage du titre visaient la copie (somme des opacités à 0,95). Recherche limitée à
la vraie scène. Trouvée par la mesure e2e, invisible à l'œil.
**Règle apprise :** une copie figée d'une scène doit être exclue de toute recherche d'élément (et des lecteurs d'écran) :
elle duplique les identifiants.

### [2026-10-14 02:55] SESSION — End
**Resume :** spec 021 « Git et GitHub » terminée (US5 lot 2 à US7, T030 nouveautés surlignées, SC-006 mesuré : clone
d'eslint en 7,1 s, US6 vérifiée sur le vrai GitHub) ; confirmation avant de changer de branche dans le dépôt de l'app ;
spec 017 D23 (« Analyser le code… » d'un projet déjà lié, bouton Explorateur) ; spec 031 « Explorateur en boîtes »
écrite (D1-D13, maquette validée) puis lots 1 à 3 livrés (carte en une réponse, rôle des fichiers par Claude, carte en
boîtes, entrer / amorces / Échap, transition mesurée image par image). Reste : lots 4 à 6 de la 031.
**Branche :** main
**Commits pushes :** 17 (branche locale `archive/029-scenes-accueil` gardée hors du dépôt distant)

### [2026-10-14 09:15] FEAT — spec 031 lot 4 : la fiche à droite et la recherche Ctrl+K
**Fichiers :** `src/renderer/src/explorer/boxes/{sheet.ts, BoxSheet.tsx, SearchPalette.tsx}` (nouveaux),
`ExplorerPage.tsx` (fiches, Ctrl+K à la place du champ de recherche), `FilePanel.tsx` (se placer sur une fonction par
son nom) ; tests `unit/renderer/box-sheet.test.ts` (nouveau), `unit/renderer/explorer-page.test.tsx`, e2e
`explorer-boxes.e2e.ts` (parcours Ctrl+K), `git-replay.e2e.ts` (extraction trouvée par Ctrl+K).
**Quoi :** D8 : un module choisi → sa fiche en mots (couche, rôle et image du guide, « Utilise », « Utilisé par » avec
le nombre d'appels et les phrases, deviné compris, puis son contenu ; « Entrer dans le module ») ; un fichier → sa fiche
(rôle, fonctions cliquables qui placent le code, ce qu'il appelle et qui l'appelle) au-dessus de son code, repliable.
Tout est calculé depuis `explorer:map`, sans nouvel IPC (Inter-Process Communication). D9 : Ctrl+K ouvre une palette
(combobox + listbox, flèches, Entrée, Échap) : fichiers et fonctions de la carte tout de suite (nom exact, début,
milieu, chemin ; sans casse ni accents), puis les éléments que seule l'analyse connaît (`explorer:search`, classes,
fonctions au-delà des 20 d'un fichier) ; Entrée entre dans le module (filtres levés s'ils le cachent), choisit le
fichier et ouvre son code. SC-001 tenu : 2 gestes (Ctrl+K, Entrée).
**Choix :** la fiche d'un module sort de la carte (appels regroupés par module voisin) et non plus de `explorer:node`,
qui ne sert plus qu'à l'image du guide ; les appels internes ne sont pas des voisins.
**Règle apprise :** une liste qui reprend les noms de la carte dans le panneau crée des doublons de texte : dans les
tests, viser un élément de la carte par son nœud (`within(nœud)`), jamais par `getByText` sur tout l'écran.

### [2026-10-14 11:30] FEAT — spec 023 D26 à D29 : le Workflow est le lieu de travail, Progression et Architecture des lecteurs
**Fichiers :** `specs/023-carte-workflow/{spec.md, tasks.md}` (amendement, phase 12), `PlanService.ts` +
`bootstrap.ts` (`projectLinked`), `StructureService.ts` (refus `tache` / `decision`, `removeElements`),
`structureHandlers.ts` + `channels.ts` (`structure:removeElements`), `shared/mcp/tools.ts` (consignes et descriptions),
`buildGraph.ts` (`strays`), `StructureBarNode.tsx`, `workflow/prompts.ts` ; tests `integration/plan/plan-ipc`,
`integration/structure/structure`, `unit/ipc/explorer-handlers`, `unit/renderer/{structure-bar (nouveau),
report-steps-prompt, step-view, map-update-button, architecture-view, workflow-view}`.
**Pourquoi :** retour de mentalyas : le brainstorm de départ et les tâches naissent dans le Workflow (là où se font la
doc et le code) ; Progression et Architecture ne font que montrer comment le projet prévoit de s'articuler (doc) et
s'articule réellement (code). Ce matin, Claude avait posé 8 tâches et une décision dans la carte de structure.
**Quoi :** (1) « ✦ Nouveau brainstorm » dans la barre Workflow : sujet nettoyé (120 car.), consigne pré-remplie dans
la conversation du genesis (L1 dans `docs/brainstorm/`, tâches dans `docs/TACHES-<Sujet>.md`, rien dans la carte).
(2) Aucune étape de plan ne naît dans une vue d'un projet lié (ni dans un projet lié sans vue) ; une idée non liée
garde son plan d'attaque. (3) `structure_dessiner` refuse un nouvel élément `tache` ou `decision` (les existants
restent modifiables) ; consignes MCP réécrites. (4) En Progression et Architecture, la barre signale les étapes nées
dans la vue et les tâches / décisions de la carte : « Les reporter dans les fichiers » (consigne) ou « Les retirer »
(lots annulables, descendants et liens compris).
**Erreur corrigée :** le bandeau élargissait la barre, centrée sur le genesis : son bouton « Workflow » passait sous la
navigation (7 e2e en échec). Le bandeau est passé sur une seconde ligne.
**Règle apprise :** un ajout dans la barre d'une carte doit se faire en hauteur, pas en largeur : elle est centrée sur
le genesis et déborde des deux côtés.
**Reste :** D29, la refonte du rendu de Progression et d'Architecture (prévu en fantôme / réel), à brainstormer dans
un artifact.

### [2026-10-14 13:30] SPEC — 032 « Les trois vues » écrite (brainstorm visuel dans un artifact)
**Fichiers :** `specs/032-trois-vues/{spec.md, tasks.md}` (nouveaux), `specs/023-carte-workflow/spec.md` (D29 renvoie
à la 032), `CLAUDE.md`.
**Quoi :** brainstorm de la refonte de Progression et Architecture (023 D29) sur un canevas d'artifact, maquettes
cliquables. Retenu par mentalyas : (1) la planche « arbre en sens alterné » devient la **nouvelle vue Workflow** :
ronds = brainstorm et doc (dessin de l'app gardé, anneau violet = maturité, bleu = tâches), carrés = tâches à
implémenter, ébauches tant que le brainstorm n'est pas complet, un seul « ▶ Bosser ici » ; (2) Progression : les trois
pistes (arbre, étages, lots) derrière un sélecteur, bascule Réel · Prévu · Les deux ; (3) Architecture : l'explorateur
en boîtes (spec 031) dans la carte, plus un détecteur d'architecture.
**Choix :** l'arbre du Workflow vient des fichiers écrits par Claude (lignes `**Parent**`, `**Maturité**`, `**Tâches**`,
cases des fichiers de tâches) et l'app les relit sans IA : même fichiers, même arbre (leçon de 023 D20).
**Clarifications :** Q1 → passe faite : les 90 documents de `docs/brainstorm/` ont leur en-tête `**Parent** ·
**Maturité**` (familles de 023 D11 ; « complet » pour toute famille qui a mené à une spec ; `L1l-noeuds-genesis.md`
« insuffisant », graine sans décision). Q2 → une spec livrée est un rond complet avec ses carrés faits.
**Prochain :** lot 1 (l'arbre du Workflow côté main, sans IA).

### [2026-10-14 15:00] FEAT — spec 032 lot 1 : l'arbre du Workflow, lu dans les fichiers sans IA
**Fichiers :** `src/main/domain/workflow/{docHeader.ts, workflowArbre.ts}` (nouveaux), `brainstorm.ts`, `parseSpec.ts`,
`specStatus.ts` (en-tête), `WorkflowService.ts` (`tree` dans la vue), `src/shared/ipc/workflow.ts` (maturité,
`WorkflowTreeNode`, `WorkflowTreeView`) ; tests `unit/workflow-arbre.test.ts` (nouveau),
`integration/workflow/workflow-service.test.ts`, fixtures des tests renderer du Workflow ; `specs/032-trois-vues/`.
**Quoi :** l'en-tête d'un document (`**Parent**`, `**Maturité**`, `**Tâches**`, sous le titre, 12 lignes au plus) est
lu comme une donnée (valeur inconnue ou chemin hors du projet ignorés). L'arbre range les documents sous leur parent
(boucle ou parent absent → niveau 1 ; `L1-fondation.md` = le projet), les specs sous leur `**Parent**` sinon sous le
document de plus bas niveau qu'elles citent, les fichiers de tâches sous le rond qui les nomme ; specs = ronds complets
(user stories en ronds, tâches en carrés) ; lots en ronds ; ébauches sous un brainstorm pas complet ; au plus 4
niveaux (au-delà, les carrés remontent) ; « Bosser ici » = premier carré en cours, sinon premier à faire, hors
ébauches et specs livrées, abandonnées ou en pause.
**Mesuré (SC-004) :** 50 ms sur le dépôt du Brainstormer (42 ronds de niveau 1, 1 030 carrés) ; « Bosser ici » =
`task:032:T010`.
**Erreur corrigée :** la spec 032 tombait sous `L1l-noeuds-genesis` qu'elle cite en exemple : une spec peut désormais
écrire son `**Parent**`, qui prime sur les citations (D9 amendée ; la 032 → `L1j-carte-workflow.md`).
**Règle apprise :** citer un document n'est pas en venir : un rangement déduit d'une citation doit pouvoir être
corrigé par une déclaration explicite dans le fichier.

### [2026-10-14 17:00] FEAT — spec 032 lot 2 : le Workflow sur la carte, en ronds et en carrés
**Fichiers :** `src/shared/workflow/arbre.ts` (déplacé depuis `main/domain/workflow/workflowArbre.ts` : pur, lu aussi
par les tests de l'interface), `src/renderer/src/canvas/workflow/{workflowTree.ts, workflowGraph.ts, WorkflowNode.tsx,
WorkflowCard.tsx, prompts.ts}`, `canvas/cards/cardContent.ts`, `canvas/living/{LivingNode.tsx, living.css}`,
`canvas/buildGraph.ts` ; tests `unit/renderer/{workflow-tree, workflow-card, workflow-view}`, e2e
`workflow-task-files`, `markdown-mermaid` ; `specs/032-trois-vues/`.
**Quoi :** la vue Workflow lit l'arbre du lot 1 : ronds (nœud vivant de l'app, deux anneaux fins — violet = maturité du
brainstorm, accent = tâches ; non évalué en pointillé gris), carrés (tâches ; pleins quand faits ; ébauches pâles en
pointillé violet, traits en pointillé), « ▶ Bosser ici » (halo, fixe si animations réduites). Les clés de la spec 023
sont gardées (`spec`, `story`, `task`, `doc`, `tfile`, `tgroup`, `ttask`) : conversations et replis retrouvés. Actions
D7 : « Discuter » pré-remplit la consigne selon le nœud (évaluer la maturité, continuer le brainstorm puis écrire
l'en-tête et le fichier de tâches, rédiger la doc, implémenter, préciser une ébauche dans son brainstorm d'origine) ;
« Rouvrir le brainstorm » / « Réévaluer la maturité » en action secondaire. Ancien rangement par branches retiré
(sujets `branch`, `socle`, `done`, `fileDone`).
**Choix :** un rond dont tout est fait est replié d'office (1 030 carrés sur le dépôt) : écart à Q2 noté dans la spec,
à valider par mentalyas.
**Erreur corrigée :** l'e2e fermait l'onglet de conversation par un bouton introuvable ; l'onglet resté ouvert
masquait la barre des tests suivants. Le parcours « Bosser ici » passe en dernier et ne ferme plus rien.
**Règle apprise :** une fonction pure partagée par le main et l'interface vit dans `src/shared/` : les tests de
l'interface ne peuvent pas importer le main (projet TypeScript séparé).

### [2026-10-14 17:40] FEAT — spec 032 lot 3 : le brainstorm et le pont MCP écrivent l'en-tête des ronds
**Fichiers :** `src/renderer/src/canvas/workflow/prompts.ts` (« Nouveau brainstorm »), `src/shared/mcp/tools.ts`
(consignes, `maturite_evaluer`), `src/main/infrastructure/db/demo/demoMethod.ts` (en-têtes, `TACHES-PARTAGE.md`) ;
tests `unit/mcp/instructions.test.ts` (nouveau), `unit/renderer/report-steps-prompt.test.ts`,
`integration/db/seed-demo.test.ts`.
**Quoi :** « ✦ Nouveau brainstorm » fait écrire le L1 dès le début avec son en-tête (`**Maturité**` et ce qui manque,
`**Parent**` s'il prolonge un autre brainstorm), puis, une fois complet, le fichier de tâches nommé par `**Tâches**`.
Les consignes du pont décrivent l'en-tête et précisent que la maturité d'un brainstorm de projet lié s'écrit dans le
document, pas avec `maturite_evaluer` (dont la description le rappelle). Le profil démo montre un rond mûr (sa spec) et
un rond « insuffisant » dont les deux tâches restent des ébauches. (Les consignes « Discuter » D7 — continuer, évaluer,
rouvrir — sont du lot 2.)

### [2026-10-14 18:30] FEAT — spec 032 lot 4 : l'Architecture est l'explorateur, avec son détecteur
**Fichiers :** `src/shared/structure/detect.ts` (nouveau, détecteur pur), `src/renderer/src/explorer/ArchitectureDetector.tsx`
(nouveau), `src/renderer/src/canvas/ArchitectureView.tsx` (nouveau), `src/renderer/src/reprise/AnalyzeCode.tsx` (nouveau,
sorti de `home/BrainstormBar.tsx`), `ExplorerPage.tsx` (prop `switcher`, détecteur en tête), `IdeasCanvas.tsx`,
`StructureBarNode.tsx` (`StructureViewSwitch` exporté), `buildGraph.ts`, `structureGraph.ts`, `uiStore.ts`,
`shared/ipc/reprise.ts` + `RepriseService.ts` + `bootstrap.ts` (`architecture` dans la vue du projet repris),
`shared/mcp/tools.ts` ; retirés : `nodes/LayerBandNode.tsx`, `architectureGraph`, `BAND`, `violation` des liens,
`DEPENDENCY_RELATIONS`, le choix d'architecture de la barre. Tests : `unit/structure/detect.test.ts`,
`integration/reprise/architecture-detector.test.ts` (SC-005), `unit/renderer/architecture-view.test.tsx` (réécrit),
e2e `architecture-view.e2e.ts`.
**Quoi :** T040 — le détecteur reconnaît l'architecture par des règles sur les dossiers (la plus spécifique d'abord :
`ports`/`adapters` → hexagonale, `viewmodels` → MVVM, 2 rôles parmi domaine/application/infrastructure → Clean,
2 parmi contrôleurs/modèles/vues → MVC, 2 parmi présentation/métier/données → couches) et compte les appels qui sortent
du cœur ; raison en une phrase. Sur les jeux de la spec 017 (analyse réelle) : cs-app et ts-app Clean (2 et 1 appels
du domaine vers l'infrastructure, vrais dans le code), laravel-app MVC, hostile-app aucune. T041 — « Architecture »
dans la barre monte l'explorateur par-dessus la carte (la bascule remplace « ← Carte », une seule carte à la fois dans
cette position, la carte dessous `inert`) ; sans analyse, « Analyser le code » (confidentialité d'abord). En tête de
l'explorateur, l'architecture reconnue, précisée par Claude ou choisie par mentalyas (prioritaire, annulable).
**Choix :** l'explorateur couvre la carte plutôt que d'être un nœud dans React Flow : une carte imbriquée suivrait le
zoom du canevas et deviendrait illisible ; l'overlay est posé à côté de la surface (pas dedans) pour que le double-clic
de la carte ne crée pas d'idée dans l'explorateur.
**Règle apprise :** Playwright ne tient pas compte de `inert` pour `getByRole` : cibler la région de l'explorateur.

### [2026-10-14 19:30] FEAT — spec 032 lot 5 : la Progression en trois lectures (prévu, réel, hors plan)
**Fichiers :** `src/shared/workflow/progression.ts` (nouveau, domaine pur), `src/renderer/src/canvas/progression/`
(nouveaux : `ProgressionView.tsx`, `progression.css`), `src/renderer/src/canvas/PanelFold.tsx` (nouveau),
`IdeasCanvas.tsx`, `ArchitectureView.tsx`, `buildGraph.ts` (`shownStructureView`), `StructureBarNode.tsx`,
`uiStore.ts`, `shared/brainstorms/viewState.ts` + `home/viewState.ts` + `useBrainstorms.ts` (lecture gardée par
projet), `shared/ipc/workflow.ts` + `shared/workflow/arbre.ts` (`files` d'un carré) ; spec 032 Q3 à Q5. Tests :
`unit/workflow-progression.test.ts`, `unit/renderer/progression-view.test.tsx` (nouveaux), `brainstorm-rules`,
`step-view`, `workflow-view`, `architecture-view` ; e2e `progression-view.e2e.ts` (nouveau), `workflow-task-files`,
`side-panel`.
**Quoi :** T050 — une partie = un rond du Workflow qui porte des carrés (socle, user story, lot, groupe ; un document
sans tâches est une partie vide) ; réelle si un fichier qu'elle cite existe dans le code analysé (un dossier cité
couvre ses fichiers) ou si toutes ses cases sont faites, prévue sinon ; module = celui de la plupart de ses fichiers ;
hors plan = fichier de code (hors plomberie, hors `.md`/manifestes) qu'aucune tâche ne cite. T051 — « Progression »
ouvre un panneau sur la carte : A l'arbre (un module par colonne, anneau = tâches cochées), B les étages (fondations =
modules les plus appelés en bas, prévu au sommet), C les lots dans l'ordre du Workflow (+ colonne hors plan) ; bascule
Réel · Prévu · Les deux ; lecture gardée par projet dans l'état de vue ; relu à la fin d'une analyse et d'un tour de
Claude ; sans analyse, « Analyser le code » proposé et seules les cases cochées disent le bâti. Progression et
Architecture ne demandent plus de carte de structure dessinée.
**Choix (mentalyas, 2026-10-14) :** réel = analyse du code (Q3) ; panneau sur la carte (Q4), repliable (Q5) pour garder
la carte de structure de Claude (statuts de la spec 030) et les blocs de la vue (023 D25) ; « Centrer sur le nœud »
replie le panneau. Un panneau ne s'ouvre que sur un choix de vue.
**Hors de ce lot :** `reprise-resolution.e2e.ts` (« Préciser les liens avec l'IA ») échoue déjà au commit du lot 3
(`ce15eea`) : à examiner à part.

### [2026-10-14 20:15] DOCS — spec 032 lot 6 : finitions, spec livrée
**Fichiers :** `specs/023-carte-workflow/spec.md` (D5 remplacée pour le Workflow, D8 et FR-008 remplacées, D29
réalisée), `specs/017-reprise-voir/spec.md` (D20 et FR-041 remplacées), `specs/032-trois-vues/spec.md` (« Livrée »),
`tasks.md` (T060), `docs/FOUNDATION.md` (§000000000 « Les trois vues », ligne Rangement de §0000000.2 barrée),
`CLAUDE.md` (spec 032 livrée).
**Quoi :** T060 — les specs anciennes renvoient à la 032 au lieu d'être réécrites (décisions datées, texte d'origine
gardé) ; la vue d'ensemble des trois vues est dans la fondation.
**Reste :** `reprise-resolution.e2e.ts` échoue depuis avant la spec 032 (voir l'entrée du lot 5).

### [2026-10-14 21:30] FIX — spec 032 : la Progression rangée par familles du Workflow (Q6)
**Fichiers :** `src/shared/workflow/progression.ts` (réécrit), `src/renderer/src/canvas/progression/ProgressionView.tsx`,
`progression.css`, `IdeasCanvas.tsx` (nom du projet passé au panneau) ; spec 032 Q6, `docs/FOUNDATION.md`. Tests :
`unit/workflow-progression.test.ts`, `unit/renderer/progression-view.test.tsx`, e2e `progression-view.e2e.ts`.
**Erreur :** sur le dépôt du Brainstormer, la Progression (lot 5) ne ressemblait pas aux maquettes de l'artifact : une
colonne par dossier du code, des dizaines de user stories et de « Socle » sans leur spec, 613 fichiers hors plan un par
case, pas de rond du projet ni de tronc.
**Quoi :** une colonne, un étage ou une colonne de lots = une famille du Workflow (rond de niveau 1), ses lots dessous
(specs et fichiers de tâches ; les documents sans tâches seulement si rien n'est encore spécifié) ; A a le rond du
projet et le tronc ; un lot livré est bâti ; le hors plan est regroupé par dossier, replié, dans un bloc orange ; une
carte du code vide (analyse en cours) ne rend rien « prévu » à tort. Vérifié sur une copie de `specs/`, `docs/` et
`src/` : 29 lots bâtis, 14 prévus, 352 fichiers hors plan en ~70 dossiers.
**Règle apprise :** relire les maquettes validées avant de coder une vue, et l'essayer sur un vrai projet, pas
seulement sur le projet de démo (trop petit pour montrer le bruit).

### [2026-10-15 12:17] FIX — spec 032 : la Progression peaufinée vers les maquettes, le terminé replié (Q7)
**Fichiers :** `src/shared/workflow/progression.ts` (`finished` sur la famille, `maturity` sur le lot),
`src/renderer/src/canvas/progression/ProgressionView.tsx` ; spec 032 Q7, `tasks.md` (T061). Tests :
`unit/workflow-progression.test.ts`, `unit/renderer/progression-view.test.tsx`.
**Erreur :** sur le dépôt du Brainstormer (une quarantaine de familles, les maquettes en montraient 4), A débordait et
sa partie gauche était inaccessible (arbre centré et étiré dans une zone qui défile), B empilait 41 étages ; titres
répétés quand la famille est le lot ; étapes de C toutes grises ; hors plan de 78 dossiers étalé.
**Quoi :** une famille terminée (lots livrés, abandonnés ou cochés) rejoint « ✔ Bâti », replié : première branche de A,
fondations de B, dépliable ; C garde toutes ses colonnes, étape en couleur (jetons `pro`, `accent`, `idea`, `seed`) ;
le projet reste au centre, seules les branches défilent (`w-max mx-auto`) ; rond du projet plus grand, briques en
13 px, barres de 6 px ; légende et résumé en pied de vue ; hors plan replié en une ligne (« à décrire dans une spec, ou
à retirer ») ; un document mûr sans tâches est « à spécifier ». Vérifié par captures sur une copie de `specs/`, `docs/`
et `src/` (e2e temporaire retiré).
**Règle apprise :** un conteneur flex en colonne étire ses enfants à sa largeur : un contenu centré plus large déborde
des deux côtés et sa gauche ne défile plus ; donner `w-max` au contenu qui défile.

### [2026-10-15 12:30] DOCS — F1 à F8 : à brainstormer plus tard
**Fichiers :** `docs/brainstorm/L2-capture-rapide.md`, `L2-structuration-ia.md`, `L2-validation.md`,
`L2-organigramme.md`, `L2-planning.md`, `L2-synchro-outlook.md`, `L2-conseiller-proactif.md`, `L2-compagnon.md`.
**Quoi :** demande de mentalyas : les fonctionnalités du besoin d'origine (mis de côté le 2026-10-13) passent en
**Maturité : insuffisant — à brainstormer plus tard** ; la Progression et le Workflow les lisent « ✦ à brainstormer » au
lieu de « à spécifier » ; leurs documents de niveau 3 (`L3-structuration-ia`, `L3-synchro-outlook`,
`L3-conseiller-proactif`, `L3-compagnon`) aussi. F9 (Moteur IA) et F11 (Moteur CLI), codés, sortaient prévus faute de
lien : `L2-moteur-ia.md` est rattaché à L1b (son MVP-1, qui porte la spec 001) et `L2-moteur-cli.md` à L1c (qui le
définit) ; la spec 010 a `**Parent** : L2-moteur-cli.md`. Ils rejoignent « ✔ Bâti » ; B passe de 13 à 11 étages.
**Erreur évitée :** donner la spec 001 pour enfant à `L2-moteur-ia.md` vidait la famille L1b (redevenue « prévue ») ;
rattacher le document à son L1 garde la spec où elle était.

### [2026-10-15 13:10] FEAT — l'analyse du code laisse de côté la doc pour l'IA (spec 032 Q9, 017 FR-013)
**Fichiers :** `src/main/domain/reprise/fileFilter.ts`, `src/main/infrastructure/reprise/ProjectScanner.ts` ; specs 017
(FR-013 amendée) et 032 (Q9). Tests : `unit/reprise/file-filter.test.ts`.
**Quoi :** demande de mentalyas : l'Architecture ne reprend que le code et la doc informative. Ne sont plus parcourus :
`.claude`, `.specify`, `.kilo`, `.cursor`, `.obsidian`, `.analyste`, `graphify-out` (2 443 fichiers sur ce dépôt),
`test-results`, `docs/claude/` ; ni les fichiers `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `SKILL.md`, `.cursorrules`,
`docs/JOURNAL.md`. `isExcludedDir` prend désormais le chemin du dossier (nom, ou chemin pour `docs/claude`).
**Choix :** tri à l'analyse plutôt que dans la seule vue (mentalyas) : explorateur, Architecture et hors plan s'allègent
ensemble. `docs/academique/` reste (choix de mentalyas).
**Note :** `explorer-page.test.tsx` (« entrer dans un module par double-clic ») a échoué une fois dans la suite complète,
puis passé 3 fois sur 3 seul : instable sous charge, sans lien avec ce changement.

### [2026-10-15 14:30] FEAT — spec 032 Q8 : la Progression en canevas organique, un clic mène au Workflow
**Fichiers :** `src/renderer/src/canvas/progression/ProgressionCanvas.tsx` (nouveau), `ProgressionView.tsx`,
`progression.css`, `canvas/IdeasCanvas.tsx` (surbrillance d'arrivée), `canvas/workflow/workflowTree.ts`
(`roundNodeKey`), `workflow.css`, `app/uiStore.ts` (`workflowArrival`), `src/shared/workflow/progression.ts`
(`later`, `pathTo`), `arbre.ts`, `src/shared/ipc/workflow.ts`, `src/main/domain/workflow/docHeader.ts`,
`brainstorm.ts` ; spec 032 Q8, T062. Tests : `unit/renderer/progression-canvas.test.ts` (nouveau),
`progression-view.test.tsx`, `workflow-progression.test.ts`, `workflow-arbre.test.ts`.
**Quoi :** maquettes « Progression en canevas » (artifact du 2026-10-14), piste organique choisie par mentalyas. Plus
de barre de défilement : molette = zoom autour du pointeur, glisser le fond = se déplacer, « + », « − », « Tout
afficher » ; une lecture s'ouvre calée sur la largeur, en haut. Anneaux à halo, courbes du projet vers ses branches
(vertes vers « Bâti », bleues vers le bâti, pointillées vers le prévu), briques à ombre douce, prévu hachuré, l'arbre
pousse à l'ouverture (pas en animations réduites). Les documents « … plus tard » (en-tête) forment le groupe
« ✦ Plus tard ». Un clic sur une famille, une brique ou une famille d'un groupe : ses ancêtres repliés et lui-même se
déplient, la carte passe en Workflow centrée sur le rond, qui pulse avec ses carrés pendant 5 s (contour fixe en
animations réduites).
**Erreur corrigée :** cadrer toute la lecture à l'ouverture rendait B (42 %) et C (20 %) illisibles sur le vrai dépôt :
l'ouverture se cale sur la largeur, « Tout afficher » cadre tout.
**Choix :** un canevas maison (transformation CSS) plutôt que React Flow : les trois lectures gardent leur mise en
page HTML, leurs tests et leur accessibilité ; les fonctions de zoom de la carte (`zoomAround`, `wheelFactor`) sont
reprises.

### [2026-10-15 15:00] FEAT — « Recentrer » ramène sur le genesis du projet (spec 024 D20)
**Fichiers :** `src/renderer/src/canvas/projectGenesis.ts` (nouveau), `canvas/IdeasCanvas.tsx` ; spec 024 D20. Tests :
`unit/renderer/project-genesis.test.ts`.
**Quoi :** demande de mentalyas : « Recentrer » centre la vue sur le genesis lié au dossier de projet (à défaut le
premier éclos, sinon le premier), à 100 %, au lieu de cadrer tout le graphe ; « Tout afficher » (boutons de zoom) garde
le cadrage de tout le graphe. Vérifié en e2e (carte déplacée et dézoomée, puis « Recentrer »).

### [2026-10-15 17:30] FEAT — spec 033 « La coque compacte » : un maximum de canevas
**Fichiers :** `src/renderer/src/app/AppShell.tsx`, `Rail.tsx`, `Icon.tsx`, `usePopover.ts` (nouveaux), `HeaderUsage.tsx`,
`uiStore.ts`, `home/ProjectMenu.tsx` (nouveau, remplace `BrainstormBar.tsx`, retiré), `git/RepoBadge.tsx`,
`git/OpeningSummary.tsx` (nouveau), `git/RepoPanel.tsx`, `canvas/CanvasToolbar.tsx`, `ToolMenu.tsx`, `IdeasCanvas.tsx`,
`ArchitectureView.tsx`, `SavePoints.tsx`, `components/atoms/Button.tsx` (variante `ghost`), `pages/IdeasPage.tsx`,
`analyste/useAnalysteStatus.ts`, `styles/tokens.css` ; specs 033 (nouvelle). Tests : `project-menu.test.tsx` (ex
`brainstorm-bar`), `app-shell`, `canvas-toolbar`, `canvas-keyboard`, `canvas-tools`, `git-sync-panel`,
`project-manager` ; e2e : aides `openProjectMenu` et `backToProjects`, sélecteurs mis à jour.
**Quoi :** maquettes « La coque » (artifact, 4 pistes puis la fusion A + B validée par mentalyas). Rail de 48 px à gauche
(sections en icônes, thème en panneau, réglages) ; une barre fine de 32 px (fil « section / projet ▾ » avec le menu du
projet : retour aux projets, chemin, points de sauvegarde, « Analyser le code… » ; pastille git « ⎇ branche » et ⚠ quand
il reste à commiter ou à pousser, qui ouvre le Dépôt ; jauges Claude compactes). Le bandeau d'ouverture est retiré :
ses points (anomalies `/hub`, JOURNAL) sont en tête du volet Dépôt. Plus de bouton « Explorateur » : les autres portes
(conversation, « Rejouer sur la carte », « Voir sur la carte ») ouvrent la vue Architecture avec leurs marques. Dock
d'outils flottant en bas (compteurs, Chercher, Filtrer, Fermer les cartes, Reprendre, Réorganiser, Recentrer) ; « Bloc
libre » et « Liens d'analyse au repos » au clic droit. La carte passe d'≈ 1 040 × 520 à ≈ 1 216 × 729 px.
**Erreur corrigée :** les icônes Thème et Réglages se ressemblaient (deux soleils) : roue dentée pour les réglages.
**Reste :** `reprise-bench.e2e.ts` (« Élément choisi » après un clic de module) et `reprise-resolution.e2e.ts` échouent :
le premier attend qu'un clic choisisse un module, ce que la spec 031 a changé (le clic l'ouvre sur place) sans mettre le
test à jour (inchangé depuis le 2026-10-12) ; le second échouait déjà depuis le lot 3 de la spec 032.

### [2026-10-15 19:00] FEAT — spec 033 D10 à D12 : barre des vues en haut, zoom fluide, l'abandonné en rouge
**Fichiers :** `canvas/nodes/StructureBarNode.tsx` (`StructureBar`, variante `inHeader`), `app/topbarSlot.ts` (nouveau),
`app/AppShell.tsx`, `canvas/IdeasCanvas.tsx` (portail), `run/RunButton.tsx` (`pill`), `canvas/ArchitectureView.tsx`,
`canvas/progression/ProgressionView.tsx`, `ProgressionCanvas.tsx`, `canvas/useSmoothZoom.ts` (bornes réglables),
`explorer/boxes/BoxMap.tsx`, `canvas/workflow/workflowTree.ts` (`abandoned`), `buildGraph.ts`, `workflow.css`,
`progression.css` ; spec 033 D10 à D12. Tests : `architecture-view.test.tsx`, `workflow-tree.test.ts` ; e2e
`architecture-view`, `explorer-adopt`, `progression-view`.
**Quoi :** demandes de mentalyas. D10 : la barre des vues (Workflow · Progression · Architecture, Relire, Nouveau
brainstorm, Lancer…, Mettre à jour) monte dans la barre fine, à droite de la pastille git, en pastilles arrondies ; la
carte l'y place par un portail et ne la dessine plus au-dessus du genesis du projet ; « à reporter » devient une pastille
⚠ ; les panneaux Progression et Architecture perdent leur bascule. D11 : zoom amorti (celui de la carte) dans la
Progression et dans la carte en boîtes de l'Architecture ; « Tout afficher » glisse ; glisser le canevas de la
Progression ne sélectionne plus de texte. D12 : spec ou fichier de tâches abandonné cerné de rouge dans le Workflow ;
étape et briques rouges dans la Progression.

### [2026-10-15 20:00] FIX — barre des vues toujours en haut ; e2e de la reprise à jour ; raisons des liens rendues
**Fichiers :** `canvas/IdeasCanvas.tsx`, `explorer/boxes/BoxSheet.tsx`, `explorer/NodePanel.tsx` (`Links` exporté) ;
spec 033 D10 précisée. Tests : `explorer-page.test.tsx` ; e2e `reprise-bench`, `reprise-resolution`.
**Erreur :** sur le projet de mentalyas, la barre des vues restait sur la carte : elle ne montait que pour le genesis
du brainstorm, or ce projet est repris (son genesis est un autre). → La barre fine prend celle du genesis du projet,
sinon la première de la carte.
**Erreur (spec 031 lot 2, 2026-10-14) :** la fiche de module en boîtes avait remplacé le panneau de la spec 017 sans
reprendre les raisons des liens précisés par Claude (017 US6) : « Préciser les liens avec l'IA » n'avait plus de
résultat visible. → Section « Liens précisés » dans la fiche (cible et « déduit — raison », un clic ouvre le fichier).
**Quoi :** `reprise-bench` suit la spec 031 (fiche titrée par le nom du module ; entrer par double-clic dans un module
fermé, sortir par Échap ; la sortie se mesure au retour du niveau des modules, pas à la fin du fondu) : 763 / 460 ms,
sélection 358 ms, déplacement p95 7 ms. `reprise-resolution` repasse.
**Règle apprise :** quand une vue en remplace une autre, relancer les e2e des fonctions que l'ancienne montrait.
**Ajout :** le banc de mesure (`reprise-bench.e2e.ts`) sort de `npm run e2e` et se lance par `npm run e2e:bench` (mode
Vitest `bench`) : enchaîné aux autres, ses images tombaient à une par seconde (fenêtre ralentie par Chromium) ; seul, il
passe 3 sur 3.

### [2026-10-15 21:30] FIX — spec 032 Q10 : un fichier de tâches sans brainstorm n'est plus « prêt » ; consignes avec les règles du projet
**Fichiers :** `src/shared/workflow/arbre.ts`, `src/renderer/src/canvas/workflow/prompts.ts`, `src/shared/ipc/workflow.ts`
(`isToBrainstorm`), `src/main/infrastructure/db/demo/demoMethod.ts` ; spec 032 Q10, T063. Tests : `workflow-arbre`,
`workflow-tree`, `workflow-card`, `seed-demo` ; e2e `workflow-task-files`.
**Erreur :** les pipelines d'agents (`docs/TACHES-AGENTS.md`) ont été implémentés depuis le Brainstormer avec des
écarts (validation finale après la fusion, travail dans la copie du projet, `--no-verify`, `git add -A`, pas de
journal). Causes : le brainstorm était resté dans une conversation (aucun document, des règles contradictoires) ; un
fichier de tâches qu'aucun document ne nomme comptait d'office comme mûr (100 %), ses tâches étaient donc « à
implémenter » ; la consigne d'une tâche de fichier ne rappelait aucune règle du projet, et le chat ne charge aucun
réglage.
**Quoi :** un fichier de tâches orphelin est « non évalué » : ses tâches restent des ébauches, et « Discuter » sur lui
ou sur une ébauche fait d'abord écrire son brainstorm (`**Tâches**`, `**Maturité**`). Toute consigne d'implémentation
(tâche, user story, tâche de fichier, lot) rappelle : lire le CLAUDE.md et les règles de travail du projet, vérifier
avec ses commandes, consigner au journal, jamais `--no-verify` ni `git add -A` sans revue, aucun commit sans accord.
`isToBrainstorm` ne compte plus un L1 complet. La démo donne un brainstorm complet à `TACHES-DESIGN.md`.
**Règle apprise :** un fichier écrit par Python sous Windows en mode texte reçoit des fins de ligne CRLF ; et un `\n`
dans un heredoc devient un vrai saut de ligne : vérifier avec Prettier après chaque écriture scriptée.

### [2026-10-16 13:10] FEAT — agents assemblés : brainstorm L1o, finitions T001–T004 (T015), skills transmis aux sessions (T010)
**Fichiers :** `docs/brainstorm/L1o-agents-assembles.md` (nouveau), `docs/TACHES-AGENTS.md`,
`src/main/infrastructure/claude/AgentSession.ts` ; formatage de `bootstrap.ts`, `db/client.ts`, `SkillsPage.tsx`,
`ipc/channels.ts`, `migrations.test.ts` ; tests `tests/integration/agents/agent-session.test.ts` (nouveau),
`pipeline-engine.test.ts`.
**Quoi :** le brainstorm des pipelines d'agents a maintenant son document (maturité complet). mentalyas assemble ses
agents à la main sur la carte, sans file fixe ni valeur par défaut. Un lien entre deux agents = l'un attend l'autre ;
sans lien = en parallèle. Le PO ouvre le travail et recommande les agents. Le QA renvoie ses observations au PO, qui
réécrit la spec. Les passes sont indexées (initiale, correction, repasse). Chaque agent a son worktree, et il y a un
seul accord de fusion. `PipelineEngine` (T003–T004, file fixe) sera réécrit en planificateur (T011). Code des T001–T004
(15/10, depuis le Brainstormer) : profils, documents, moteur, `AgentSession`, migration 0050. T015 : Prettier, et
`{ timeout: 60_000 }` sur le test du moteur, comme les autres tests qui lancent git. T010 : les skills cochés dans le
profil sont copiés dans un plugin propre à la session (`--plugin-dir`, plugin `agent-skills`, rien d'autre que
`plugin.json` et les dossiers des skills, liens symboliques ignorés), effacé à la fin de la session.
**Erreur :** `pipeline-engine.test.ts > should_default_to_three_rounds` dépassait 5 s dans la suite complète (5,8 s,
vrais appels git) ; 5 fichiers en CRLF.
**Règle apprise :** sonde du 2026-10-16 (CLI 2.1.301) : `claude -p --setting-sources ""` ne charge que les skills
intégrés à Claude Code, aucun skill personnel ni de projet ; `--plugin-dir` les ajoute, même avec `--setting-sources ""`.
Le résolveur des skills (`SkillInventory.dirOf`) sera branché avec le moteur (T005).

### [2026-10-16 14:30] FEAT — agents assemblés : planificateur (T011) et worktree par agent (T012)
**Fichiers :** `src/shared/agents/pipeline.ts` (réécrit), `src/main/application/agents/PipelineEngine.ts` (réécrit),
`src/main/application/agents/PipelineDocuments.ts`, `src/shared/agents/documents.ts`, `docs/brainstorm/L1o-agents-assembles.md`
(§4) ; tests `tests/unit/agents/assembly.test.ts` (nouveau), `pipeline-documents.test.ts`,
`tests/integration/agents/pipeline-engine.test.ts` (réécrit), `agent-session.test.ts`.
**Quoi :** un assemblage regroupe des agents (un profil chacun, deux agents peuvent partager un rôle) et des liens « B
attend A ». Règles (`assemblyError`) : identifiants uniques, aucun cycle ; dès deux agents, un PO et un seul, qui
n'attend personne, et dont tous les autres dépendent. Le planificateur lance tout agent dont les agents attendus ont
fini, en parallèle ; il bloque ceux qui attendaient un agent arrêté, et n'en lance plus après une annulation. Chaque agent
a son worktree (hors du projet) et sa branche `agents/<tâche>/<agent>`, partie de la base, de la branche attendue ou
de la fusion de plusieurs (un conflit arrête l'agent). Le moteur commite les fichiers par leur nom, sans
`--no-verify` ; un hook qui refuse arrête l'agent. Le worktree est retiré quand l'agent a fini, et gardé s'il a échoué.
Rien n'est fusionné sur la base (T018). La spec et les rapports (un par agent) sont commités sur la branche de l'agent ;
le journal du projet peut sortir du dépôt (`projectJournalFile`). Retirés : `PIPELINE_ORDER`, branches en chaîne, boucle
QA à plafond, fusion par le QA, `validate`.
**Erreur :** (1) dans un worktree, git sous Windows (`core.autocrlf`) remet des CRLF, et l'en-tête de la spec n'était
plus reconnu : les documents sont normalisés à la lecture. (2) `runGit` colle la sortie d'erreur à la sortie normale :
un avertissement CRLF était pris pour un nom de fichier ; avec `-z`, seuls les noms terminés par `\0` comptent.
**Règle apprise :** toute sortie de `runGit` lue comme une liste doit être en `-z`, et sans ce qui suit le dernier
`\0` ; tout fichier relu après un checkout doit accepter les CRLF.

### [2026-10-16 16:00] FEAT — agents assemblés : boucle QA → PO (T016), passes indexées (T017), accord unique (T018)
**Fichiers :** `src/shared/agents/pipeline.ts`, `src/shared/agents/documents.ts`,
`src/main/application/agents/PipelineEngine.ts`, `src/main/application/agents/PipelineDocuments.ts`,
`docs/brainstorm/L1o-agents-assembles.md` (D8, D11) ; tests `pipeline-engine.test.ts`, `pipeline-documents.test.ts`.
**Quoi :** si un QA finit par `VERDICT: RENVOI`, le PO reprend la spec avec le rapport du QA, la réécrit (version
suivante) et la termine par `AGENTS: back=correction, front=repasse`. Les agents désignés repartent, avec ceux qui
dépendent d'eux (en repasse) et le QA, sans plafond, jusqu'à `VERDICT: VALIDE` ou l'annulation. Un agent relancé
reprend sa branche dans un nouveau worktree et y fusionne les branches qu'il attend (la nouvelle spec arrive ainsi).
Chaque passe a un numéro, une nature et une version de spec, inscrits dans la mission, le commit (`chore(agents): T010 ·
back · passe 2 (correction, spec v2)`) et l'en-tête du rapport. `approve` : les branches finales sont fusionnées dans un
worktree détaché partant de la base, puis la base avance d'un coup (avance rapide si la copie de travail est sur la
base et propre, sinon `update-ref` contrôlé) ; un conflit ou une copie modifiée refuse sans rien changer. `warnings` :
les modes de permissions qui bloquent écritures ou commandes.
**Règle apprise :** sonde `claude -p` du 2026-10-16 : `--permission-mode default` refuse Write et Bash, `acceptEdits`
refuse Bash ; un agent qui doit lancer des tests a besoin d'un autre mode.

### [2026-10-16 17:30] FEAT — agents assemblés : agents recommandés et suggérés dans la spec du PO (T009)
**Fichiers :** `src/shared/agents/recommendation.ts` (nouveau), `src/shared/agents/documents.ts`,
`src/main/application/agents/PipelineDocuments.ts`, `src/main/application/agents/PipelineEngine.ts` ; tests
`tests/unit/agents/recommendation.test.ts` (nouveau), `tests/integration/agents/pipeline-engine.test.ts`.
**Quoi :** la mission du PO contient maintenant le catalogue des profils existants (nom, rôle, modèle, effort, skills,
début des consignes) et le format à suivre. La spec finit par une ligne par agent : `RECOMMANDÉ: <profil> — <raison>`
(profil existant) ou `SUGGÉRÉ: <nom> | <rôle> | <consignes> | <skills>` (profil à créer, rôle « Autre » si inconnu). La
spec lue ou écrite porte `agents` (`parseSpecAgents`) ; `matchRecommended` isole les noms de profil qui n'existent pas,
à signaler à mentalyas. Ce ne sont que des propositions : l'app ne crée ni ne relie aucun agent (L1o D1, D2). Dans une
réécriture après renvoi du QA, les lignes restent avant la dernière ligne `AGENTS:`.
**Erreur :** aucune. Reste à faire (T005) : afficher ces propositions à mentalyas et créer le profil suggéré en un clic.
**Règle apprise :** une ligne mal formée dans la sortie d'un agent est ignorée, jamais une erreur : seule la ligne
`AGENTS:` du renvoi, dont dépend la suite du travail, arrête le PO.

### [2026-10-16 18:30] FEAT — spec 014 D9 : une pastille de fichier du chat s'ouvre sur le fichier et sa modification
**Fichiers :** `specs/014-claude-libre/spec.md` (D9), migration `0051_tool_files` (+ `down`), `schemaNeurons.ts`,
`ConversationRepository.ts`, `ConversationService.ts`, `domain/conversation/toolPatch.ts` (nouveau), `streamEvents.ts`,
`application/conversation/ToolFileReader.ts` (nouveau), `ipc/chatHandlers.ts`, `shared/ipc/chat.ts`, `channels.ts`,
`bootstrap.ts`, `renderer/src/chat/ToolFileDialog.tsx` (nouveau), `ChatPanel.tsx`, `lib/SourceCode.tsx` (nouveau, tiré
de `FileViewer.tsx`) ; tests `tool-patch.test.ts`, `tool-file-reader.test.ts`, `conversation-service.test.ts`,
`chat-panel.test.tsx`, `migrations.test.ts`.
**Quoi :** les pastilles « fichier lu / écrit / modifié » deviennent des boutons. Le chemin visé est gardé à l'appel
(`tool_path`) ; la modification vient du `tool_use_result` du CLI (`structuredPatch` ; tout le contenu en lignes
ajoutées pour un Write qui crée), bornée à 3 000 lignes et 300 000 caractères, gardée en JSON (`tool_patch`). La fenêtre
(portail sur `document.body`, Échap ou × ferme) montre trois onglets : « Modification » (retiré en rouge, ajouté en vert,
signes − / +, numéros de ligne), « Fichier » (contenu actuel coloré) et « Mis en forme » pour un `.md`. Sécurité : le
renderer n'envoie qu'un identifiant de message ; le main lit le fichier par `ProjectFiles`, seulement s'il est dans un
dossier de la conversation (fichiers sensibles, binaires connus et liens qui sortent refusés, 1 Mo au plus). Aucun
chemin absolu ne quitte le main. Vérifié dans l'app réelle avec le vrai Claude (essai ponctuel, non gardé :
`test-results/e2e/014-D9-*.png`).
**Erreur :** `migrations.test.ts` vérifiait qu'après le `down` de 0027 aucune colonne `tool_*` ne restait : les deux
nouvelles colonnes de 0051 le cassaient. Le test vise maintenant les colonnes de 0027.
**Règle apprise :** le CLI joint à chaque message `user` un `tool_use_result` (sonde 2.1.301) ; il décrit l'unique
résultat du message, donc il n'est rattaché que s'il y a un seul `tool_result`.

### [2026-10-16 19:15] FIX — spec 014 D9 : la syntaxe est colorée dans l'onglet « Modification »
**Fichiers :** `src/renderer/src/chat/ToolFileDialog.tsx`, test `chat-panel.test.tsx`.
**Erreur :** l'onglet « Modification » montrait le diff en texte brut ; seul l'onglet « Fichier » était coloré (retour
de mentalyas).
**Quoi :** comme la visionneuse des livrables, chaque bloc est coloré par côté, puis redécoupé en lignes. Le côté
d'avant regroupe le contexte et les lignes retirées, le côté d'après le contexte et les lignes ajoutées. Une ligne
retirée prend la couleur d'avant, une ligne ajoutée ou de contexte celle d'après : une chaîne ou un commentaire sur
plusieurs lignes reste juste.

### [2026-10-16 19:00] FEAT — agents assemblés : zones de travail et chevauchement (T014, L1o D4)
**Fichiers :** `src/shared/agents/pipeline.ts`, `src/main/application/agents/PipelineEngine.ts`,
`tests/unit/agents/assembly.test.ts`, `tests/integration/agents/pipeline-engine.test.ts`, `docs/TACHES-AGENTS.md`
**Quoi :** chaque agent d'un assemblage peut déclarer sa zone (`zone` : dossiers ou fichiers relatifs au projet).
`zoneOverlaps` repère deux agents en parallèle (aucun n'attend l'autre, même de loin) dont les zones se recouvrent
(égalité ou dossier contenant) et propose le lien qui les mettrait à la suite ; `PipelineEngine.warnings` rend la phrase
avec les autres avertissements de l'assemblage. Un agent sans zone n'est jamais signalé. `assemblyError` refuse une zone
absolue, avec lecteur ou qui sort du projet (`..`). La zone est rappelée dans la consigne de l'agent. L'écran qui
déclare les zones et affiche la proposition viendra avec T005 (IPC) et T006 (canevas).
**Erreur :** `exactOptionalPropertyTypes` refusait `zone: undefined` dans le test : propriété ajoutée seulement si présente.
**Règle apprise :** comparer des chemins par segments (`a/b` contient `a/b/c`, pas `a/bc`), jamais par préfixe de texte.

### [2026-10-16 14:41] FIX — les sessions lancées depuis l'app datent bien le journal ; zones comparées sans tenir compte des majuscules
**Fichiers :** `src/main/domain/conversation/contextBlock.ts` (`withLocalTime`, `localTime`),
`src/main/application/conversation/ConversationService.ts`, `src/renderer/src/canvas/workflow/prompts.ts`,
`src/shared/agents/pipeline.ts` ; tests `conversation-service.test.ts`, `workflow-card.test.tsx`, `assembly.test.ts`.
**Erreur :** la session T014, lancée depuis l'app, a daté son entrée de journal à 19:00 (heure devinée, avant l'entrée
de 19:15) et laissé `docs/JOURNAL.md` sans saut de ligne final : l'entrée suivante se serait collée à sa dernière ligne.
Claude connaît la date, pas l'heure. Aussi : `zoneOverlaps` (T014) distinguait `src/App` de `src/app`.
**Quoi :** chaque message envoyé à Claude finit par `<heure_locale>AAAA-MM-JJ HH:MM</heure_locale>` (heure du poste,
donnée par l'app). Les consignes d'implémentation du Workflow demandent une entrée ajoutée à la fin du journal, datée de
cette heure, et un fichier qui finit par un saut de ligne. Les chemins de zone sont comparés en minuscules.
**Règle apprise :** une donnée que Claude ne peut pas connaître (l'heure, un état de l'app) se joint au message ;
une consigne seule ne suffit pas.

### [2026-10-16 14:55] FEAT — agents assemblés : un PO ou un agent seul connecté à un nœud, planificateur branché au bootstrap et à l'IPC (T005, L1o D1 et D12)
**Fichiers :** `src/main/application/agents/AssemblyService.ts`, `src/main/ipc/assemblyHandlers.ts`,
`src/shared/ipc/assemblies.ts`, `src/main/application/agents/PipelineEngine.ts` (`check`), `src/main/bootstrap.ts`,
`src/shared/ipc/channels.ts`, `src/renderer/src/app/useMainEvents.ts` ; tests `assembly-service.test.ts`,
`assembly-handlers.test.ts`, `docs/TACHES-AGENTS.md`
**Quoi :** `AssemblyService` relie un assemblage à un nœud (idée, tâche, module) : le titre, le contenu et la fiche du
nœud, plus la tâche demandée, deviennent la mission que lisent le PO ou l'agent seul (D12 : sans PO, l'agent seul lit la
tâche et le contexte). Le planificateur tourne en arrière-plan ; on suit (`assembly:list`), on arrête (`assembly:cancel`)
et on donne l'accord unique de fusion (`assembly:approve`, `confirm: true`). `assembly:warnings` rend les avertissements
de permissions et de zones sans rien lancer. Le bootstrap crée la session `claude -p` (skills du profil compris), un
moteur par projet (worktrees et journal du projet dans le profil, hors du dépôt, hooks gardés) et l'événement
`assembly:changed`. Refus : nœud inconnu ou sans dossier lié, projet repris (jamais modifié, spec 017 FR-030), projet
« Local uniquement », assemblage invalide ou branche de base absente (vérifiés avant tout lancement), tâche déjà en cours.
Le renderer ne donne que des identifiants, des listes fermées et du texte ; le nom de la branche de base est borné
(pas de tiret en tête, ni `..`).
**Limite connue :** les assemblages en cours vivent en mémoire ; après la fermeture de l'app, leurs branches
`agents/<tâche>/<agent>` restent dans le dépôt mais l'accord de fusion n'est plus proposé. L'écran (nœuds d'agents,
déclaration des zones) vient avec T006.
**Erreur :** un script Python a réécrit `channels.ts` en CRLF (Prettier l'a signalé) ; remis en LF.
**Règle apprise :** modifier un fichier par script en conservant ses fins de ligne, ou repasser Prettier dessus avant
de vérifier le format.

### [2026-10-16 15:12] FIX — T005 : un seul moteur d'agents par projet ; correction des heures du journal du 2026-10-16
**Fichiers :** `src/main/application/agents/AssemblyService.ts`, test `assembly-service.test.ts` ;
`specs/014-claude-libre/spec.md` (D10, D11, D12) ; `docs/design/sprites-commandes/` (planche et choix des sprites).
**Erreur :** (1) revue de T005 : `AssemblyService` créait un `PipelineEngine` à chaque lancement. C'est le moteur qui
fait passer les commandes git une à une, donc deux tâches lancées en même temps sur le même dépôt auraient envoyé
leurs `git worktree add` et leurs commits en parallèle (verrous de références). (2) Les entrées du journal du
2026-10-16 datées 14:30, 16:00, 17:30, 18:30 et 19:15 ont des **heures inventées par Claude Code** (l'heure réelle
était entre 12 h et 14 h 45). L'entrée de T014 (19:00) a suivi cette suite fausse : l'entrée de 14:41 la rendait
responsable à tort.
**Quoi :** un moteur par (genesis, dossier du projet), gardé par le service. Les décisions D10 (expliquer une
modification), D11 (sprites des commandes) et D12 (progression estimée des tests) sont écrites dans la spec 014 ;
les sprites choisis sont gardés dans `docs/design/sprites-commandes/`.
**Règle apprise :** dater une entrée de journal avec `date`, jamais de tête.

### [2026-10-16 15:52] FEAT — agents en nœuds du canevas : croquis, volet au clic, vue animée (T006, L1o D10)
**Fichiers :** `src/renderer/src/canvas/agents/` (`agentGraph.ts`, `agentTypes.ts`, `sketchEdit.ts`, `agentsHost.ts`,
`useAssemblies.ts`, `AgentNode.tsx`, `AgentEdge.tsx`, `AgentsTabContent.tsx`, `agents.css`), `IdeasCanvas.tsx`,
`cards/IdeaCards.tsx`, `side/sidePanelStore.ts`, `side/SidePanel.tsx`, `edges/useCenter.ts`, `buildGraph.ts` ;
`src/main/application/agents/PipelineEngine.ts` (suivi en direct), `AssemblyService.ts` (croquis, état de chaque agent),
`infrastructure/db/schemaAgents.ts` + migration `0052_assembly_sketches` (et son `down`) +
`repositories/AssemblySketchRepository.ts`, `ipc/assemblyHandlers.ts` (`assembly:sketches`, `sketchSave`, `sketchClear`),
`shared/agents/pipeline.ts` (`structureError`, `AgentProgress`), `shared/ipc/assemblies.ts`, `infrastructure/ai/E2eClaude.ts`
(`e2eAgentRun`), `bootstrap.ts` ; tests `agent-graph`, `agent-sketch-edit`, `agents-panel`, `side-panel-store`,
`assembly-handlers`, `assembly-service`, `migrations`, e2e `agents-map.e2e.ts` ; `docs/brainstorm/L1o-agents-assembles.md` (D10 défini)
**Quoi :** (1) **Design (D10)** : les agents connectés à un nœud forment un croquis enregistré (un par nœud, table
`assembly_sketches`) ; leurs nœuds sont dérivés du croquis et du suivi, posés sous leur nœud, non glissables. « ◇ Agents »
dans la carte de détails d'une idée, d'une étape ou d'un module d'un projet lié ouvre l'onglet « ◇ <nœud> » du panneau de
droite : ajouter un agent, choisir qui attend qui (liste, ou lien tiré d'une poignée à l'autre sur la carte, boucles
refusées), tâche et zone, lancer (avertissements d'abord), arrêter, accord unique de fusion. (2) **Vue animée** : le
planificateur émet l'état de chaque agent au fil de l'eau (en attente, au travail avec sa passe, fini avec son rapport,
verdict du QA, échec, blocage, annulation) ; le nœud a sa couleur, son pictogramme, son texte et sa barre (qui défile au
travail) ; le lien s'anime quand le résultat de l'agent attendu passe à celui qui travaille ; **vert à la validation** du
QA (cerclé après la fusion), rouge en erreur, orangé s'il est renvoyé ou bloqué. (3) **Clic = volet** : profil, état, passe,
verdict, motif d'arrêt, mission → rapport de l'agent. (4) Sessions d'agents simulées pour l'e2e (`GI_E2E_CLAUDE_REPLY`).
Vérifié : typecheck, lint, Prettier, 2 395 tests, e2e `agents-map` (croquis → au travail → validé → fusionné, captures
`t006-0*.png` relues), `side-panel` et `progression-view` toujours verts.
**Limites connues :** le volet montre le rapport de la dernière passe, pas une conversation reprise en direct avec la
session de l'agent (pas de neurone ni de session reprise pour un agent) ; les agents se posent sous leur nœud sans éviter
les voisins (ils peuvent en recouvrir) ; un croquis d'un nœud sans carte dessinée (replié, autre vue) n'a pas de nœuds
affichés ; un assemblage en cours est suivi en mémoire (limite de T005 inchangée : fermer l'app l'arrête).
**Erreur :** un test e2e cherchait « 3 agents ont fini » alors que le texte dit « 3 agents sur 3 ont fini » ; un bouton
« Lancer » se confondait avec les lignes d'agents (`exact: true`). Deux fois, des caractères combinants ont remplacé
`̀` dans une expression régulière écrite par script (un outil d'édition interprète l'échappement) : écrit avec
`chr(92)`.
**Règle apprise :** un nœud d'interface qui montre un état en direct se vérifie dans l'app réelle avec une session
simulée (captures relues), pas seulement en test de composant ; et une table ajoutée a son `down` et son test de migration.

### [2026-10-16 15:55] FIX — T006 : boucle de rendu de la carte ; retour d'expérience d'une tâche visuelle (L1p)
**Fichiers :** `src/renderer/src/canvas/agents/useAssemblies.ts` ; `docs/brainstorm/L1p-taches-visuelles.md` (§5, D6
proposé), `docs/TACHES-VISUEL.md`.
**Erreur :** pendant T006 (session lancée depuis l'app), `useAssemblyData` rendait un objet neuf à chaque rendu ; la
carte s'en servait comme dépendance de son graphe et se refaisait sans fin (« Maximum update depth exceeded »). En
`npm run dev`, le rechargement à chaud a chargé ce code dans l'app ouverte : carte blanche, et la session, en attente
d'un accord, ne pouvait plus être débloquée. 72 tests d'interface échouaient. Corrigé par Claude Code (terminal), pas
par la session : objet mémorisé tant que les données ne changent pas.
**Quoi :** retour d'expérience de T006 dans L1p : design décidé sans options proposées, fenêtre de suivi cassée,
chevauchements vus sur les captures mais laissés ; D6 proposé (une tâche qui touche l'interface de l'app travaille dans
un worktree).
**Règle apprise :** un hook qui rend un objet utilisé comme dépendance le mémorise (`useMemo` sur ses données).

### [2026-10-16 18:34] FEAT — T008 lot A : l'agent est sa chambre-cube 3D, posée librement, visio au clic (L1o D13)
**Fichiers :** `src/renderer/src/canvas/agents/character/` (tirage, sprites des 4 univers portés de la planche,
portrait), `src/renderer/src/canvas/agents/room/` (chambre Three.js, scène et visio, renderer partagé, activité selon
l'état), `AgentNode.tsx`, `AgentVisioPanel.tsx`, `visioStore.ts`, `agents.css`, `agentGraph.ts`, `sketchEdit.ts`
(`placeAgent`), `IdeasCanvas.tsx` (place enregistrée au lâcher) ; `AssemblyAgent.place` (IPC Zod, dépôt des croquis) ;
migration 0053 `agent_profiles.delivered` (+ down), crédit à la validation du QA et à la fusion (`AssemblyService`) ;
dépendance `three@0.150.1` (MIT) + `@types/three` ; L1o D13 et T008 en cours.
**Quoi :** décisions de mentalyas du 2026-10-16 : l'agent est sa chambre-cube (pas de cadre, pas de fond), glissable
où il veut, sa place gardée par rapport à son nœud ; personnage tiré de l'identifiant du profil (objet de métier du
rôle) ; chambre tirée puis enrichie par le travail livré (paliers 1, 3, 6, 10…) ; un clic ouvre le volet à côté de
l'agent et le fait passer en visio (webcam sur l'écran du bureau, chambre en incrustation). Un seul contexte WebGL pour
toutes les chambres (copiées chacune dans leur canevas 2D), rendu des seules chambres visibles, 4 par image au plus,
30 images/s, ombres calculées une fois, `three` chargé à la demande ; sans WebGL, le personnage en pixels.
**Choix :** `three` 0.150 plutôt que la dernière version : même rendu que la planche (r128) sans gestion des couleurs ni
lumières physiques à compenser. La place est relative au nœud (l'agent suit le Workflow quand il se réorganise).
**Vérifié :** typecheck, lint, Prettier, 2 409 tests unitaires et d'intégration ; e2e `agents-map` (chambres,
glisser, visio, lancement jusqu'à la fusion) avec captures `test-results/e2e/t008-*.png`.
**Reste :** lot B (conversation `claude -p` avec l'agent dans le volet de visio) ; « ◇ Agents » seulement sur les nœuds
du Workflow (correctif T006) : ces nœuds sont des fichiers, pas des neurones, alors que `assembly_sketches.node_id` est
une clé étrangère vers `neurons` ; à décider avant de coder.

### [2026-10-16 19:00] FEAT — agents connectés aux nœuds du Workflow, appelés au clic droit (L1o D14, correctif T006)
**Fichiers :** `src/main/application/agents/workflowHost.ts` (contexte d'un nœud du Workflow lu dans les fichiers),
`src/main/bootstrap.ts` (résolution des nœuds `wf:…`), `src/main/ipc/assemblyHandlers.ts` (clé `WORKFLOW_KEY` au lieu
d'un UUID), migration 0054 `sketch_workflow_hosts` (+ down) : `assembly_sketches` sans clé étrangère vers `neurons` ;
`agentsHost.ts`, `agentTypes.ts` (identifiant `agent:<agent>:<nœud>`), `sketchEdit.ts` (`defaultTaskId` valide pour une
clé `wf:…`), `IdeasCanvas.tsx` (hôtes = nœuds du Workflow, menu du clic droit), `ToolMenu.tsx`, `sidePanelStore.ts`,
`AgentNode.tsx` (côté du volet de visio) ; tests unitaires, d'intégration (migration) et e2e `agents-map`.
**Quoi :** décision de mentalyas (option A) : on n'appelle des agents que sur une tâche, un lot, un fichier de tâches,
une spec, une story ou un document du Workflow ; leur mission part de la ligne de la tâche, des fichiers cités et des
documents d'origine. Clic droit sur le nœud : « Appeler <profil> », « Gérer les agents… ».
**Erreurs corrigées en route :** l'identifiant de tâche par défaut reprenait les « : » de la clé (« Données
invalides ») ; `syncWithView` fermait aussitôt le volet d'agents d'un nœud du Workflow (pas un neurone de la vue) ; le
menu contextuel supposait 180 px de haut et sortait de l'écran avec plusieurs profils (recalé d'après sa vraie taille) ;
le volet de visio passait sous le panneau de droite (il s'ouvre du côté le plus large, 320 px).
**Règle apprise :** une clé de nœud qui n'est pas un neurone (`wf:…`) traverse plusieurs couches (IPC, identifiant de
nœud de carte, onglets du panneau, identifiant de tâche) : vérifier chacune par l'e2e, pas seulement le main.
**Vérifié :** typecheck, lint, Prettier, 2 416 tests ; e2e `agents-map` (clic droit, lancement, validé, fusionné).

### [2026-10-16 19:19] FEAT — T008 lot B : conversation en visio avec un agent (L1o D13)
**Fichiers :** `src/main/application/agents/AgentChats.ts` (conversation par agent et par nœud, persona du profil),
`ConversationService.ts` (persona : consignes et contexte de la tâche ajoutés au cadre, modèle et mode du profil,
worktree de l'agent comme dossier), `WorkflowChatRepository.ts` + `schemaNeurons.ts` (neurone caché `agent_chat`, sans
migration : énumération TypeScript seulement), `ConversationRepository.ts` (`elementKey`), route `assembly:chat`,
`E2eClaude.ts` (conversation simulée mot à mot en e2e) ; `AgentVisioPanel.tsx` (le `ChatPanel` dans le volet de visio),
`ChatPanel.tsx` (`onActivity`, titre masqué en visio), `visioStore.ts` (sous-titres), `AgentNode.tsx` (tête qui hoche,
sous-titres, recentrage à 100 %), `agents.css` ; tests unitaires et e2e `agents-map` (on écrit à l'agent, il répond en
sous-titres).
**Quoi :** un clic sur l'agent ouvre la visio et, à côté, la conversation avec lui : `claude -p` avec la persona de son
profil, reprise d'un appel à l'autre, dans son worktree s'il a déjà travaillé.
**Choix :** le mode « Libre » d'un profil n'est jamais repris d'office par la conversation (il se confirme dans le chat,
spec 014 D8) : « Écrire sans demander » au plus. Les skills du profil ne sont pas encore transmis à la conversation
(seulement aux sessions de travail, par plugin).
**Erreurs corrigées en route :** le volet passait sous la barre d'outils de la carte (z-index), puis sortait de la carte
quand l'agent était au bord : la carte se recentre sur l'agent à l'appel.
**Vérifié :** typecheck, lint, Prettier, 2 423 tests ; e2e `agents-map` avec captures `t008-03-visio`,
`t008-04-visio-parle`.

### [2026-10-16 20:07] FEAT — T019 : créer un profil d'agent avec Claude (L1o D15)
**Fichiers :** outil MCP `agent_profil_proposer` (`src/shared/mcp/tools.ts`, `AgentProfileTools.ts`, `toolHandler.ts`,
`MapService.ts`) ; `skillsFrame.ts` (`AGENT_PROFILE_FRAME`, conversation `agent-profile:…`), `SkillService.ts`
(`agentConversation`), route `agents:conversation`, événement `agents:proposal`, `ConversationService.ts` (cadre et
outil autorisé), `bootstrap.ts` ; `AgentProfilesPanel.tsx` (conversation et fiche côte à côte, marques ✦),
`SkillsPage.tsx` (panneau élargi) ; tests unitaires, d'intégration, de garde (« Local uniquement ») et e2e
`agent-profile-assistant`.
**Quoi :** choix de mentalyas : « ✦ Créer avec Claude » (ou « ✦ Avec Claude » sur un profil) ouvre la conversation à
gauche de la fiche ; mentalyas décrit son agent, Claude ne pose que les questions utiles, lit les skills
(`skills_lire`) et remplit la fiche (champs marqués ✦ jusqu'à ce qu'on les touche, avec le pourquoi). Rien n'est créé
avant « Enregistrer ». Un skill qui manque : Claude le propose et ne dépose le brouillon (`skill_brouillon`) qu'après
accord.
**Choix :** la conversation est une conversation Skills (mêmes garde-fous : lecture et brouillons seulement, mode
Demander figé) avec une consigne de plus ; l'outil refuse hors de cette conversation et refuse un skill inconnu ou de
plugin (un profil ne consulte que des skills personnels ou de projet). Une création ouvre une conversation neuve ; celle
d'un profil existant est reprise.
**Vérifié :** typecheck, lint, Prettier, 2 428 tests ; e2e (conversation simulée, fiche retouchée, enregistrée).
**Reste à vérifier à la main :** l'appel réel de `agent_profil_proposer` par Claude (relais MCP reconstruit par
`npm run dev`).

### [2026-10-16 20:32] FEAT — T020 : peaufiner les skills d'un agent en visio ; renvoyer un agent (L1o D16)
**Fichiers :** outil MCP `agent_skills_proposer` (`tools.ts`, `AgentProfileTools.proposeSkills`, `toolHandler.ts`,
`MapService.ts`), événement `agents:skillsProposal`, `bootstrap.ts` (`agentOfChat` partagé par la persona et l'outil),
`AgentChats.ts` (la persona dit ses skills et comment proposer) ; `VisioSkills.tsx` (cartes Accepter / Refuser,
brouillons de l'appel), `AgentVisioPanel.tsx` (cartes, `DraftPanel` dans le volet, « Renvoyer l'agent »),
`IdeasCanvas.tsx` (clic droit sur un agent : visio, gestion, renvoi), `useAssemblies.ts` (`dismiss`),
`AgentsTabContent.tsx` ; tests unitaires, de garde (« Local uniquement ») et e2e `agents-map`.
**Quoi :** choix de mentalyas : en visio, l'agent propose d'ajouter ou de retirer des skills de son profil (carte ✦,
Accepter / Refuser, rien sans le clic) et dépose les brouillons des skills à améliorer, installés depuis le volet
(différences, Installer, Jeter). Demande de mentalyas : renvoyer un agent (le détacher de son nœud) au clic droit et
depuis le volet de visio ; pas pendant que l'assemblage travaille.
**Erreur corrigée :** retirer le dernier agent d'un nœud envoyait un croquis vide, refusé par l'IPC (au moins un
agent) : le croquis est alors effacé (aussi pour « Retirer » du volet de droite).
**Limite :** la persona est fixée au démarrage de la conversation : un skill accepté en cours d'appel est connu de
l'agent au prochain démarrage de sa conversation (il le sait par sa réponse d'outil d'ici là).
**Vérifié :** typecheck, lint, Prettier, 2 432 tests ; e2e `agents-map` et `agent-profile-assistant`.

### [2026-10-16 20:41] FIX — des agents aussi sur un projet analysé (L1o D17)
**Fichiers :** `src/main/bootstrap.ts` (refus des agents), `AssemblyService.ts` (commentaire).
**Erreur :** « Un projet repris n'est jamais modifié par l'app » refusait tout assemblage sur un projet ayant une
analyse de code, y compris un projet créé par le Brainstormer puis « Analyser le code… » (spec 017 D23) : l'app ne
distingue pas un projet analysé d'un projet tiers importé. Règle posée à la T005 sans en mesurer la portée.
**Quoi :** décision de mentalyas : les agents travaillent sur tout projet analysé (worktrees, fusion après accord) ;
seul « Local uniquement » les refuse.
**Règle apprise :** un refus qui protège un cas (projet tiers) se pose sur ce qui caractérise ce cas, pas sur une
donnée partagée par d'autres (la fiche d'analyse).
**Vérifié :** typecheck, 2 432 tests.

### [2026-10-16 21:00] FEAT — voir ce que fait un agent dans sa visio (L1o D18)
**Fichiers :** `AgentSession.ts` (`stream-json`, événements au fil de l'eau), `ClaudeCliProvider.ts` (`onStdoutLine`),
`PipelineEngine.ts` (`AgentWorkEvent` : début, flux, fin, bilan des fichiers du commit ; `workFilesOf`),
`AssemblyService.ts` (`workLog`), `ConversationService.recordWork`, `bootstrap.ts` (conversation de l'agent créée au
besoin, chemins du worktree ramenés au projet), `E2eClaude.ts` (session simulée qui écrit un fichier) ; tests
unitaires, d'intégration et e2e `agents-map`.
**Quoi :** demande de mentalyas : voir dans le chat de l'agent ce qu'il fait, fichiers écrits, modifiés, supprimés,
cliquables comme dans le chat général. La suppression passe par une commande (pas d'outil fichier) : le bilan du commit
la montre.
**Erreur corrigée en route :** des scripts Python écrits par heredoc ont perdu leurs barres obliques inverses (`\n` et
`\0` devenus de vrais caractères) ; corrigés avec l'outil d'édition.
**Vérifié :** typecheck, lint, Prettier, 2 436 tests ; e2e `agents-map` (passe, pastille du fichier écrit, rapport
dans la visio).

### [2026-10-16 21:09] FEAT — « Mettre à jour » dans le Workflow remet un ancien projet au format (spec 032 D17)
**Fichiers :** `specs/032-trois-vues/spec.md` (D17), `src/renderer/src/canvas/workflow/updatePrompt.ts` (diagnostic et
consigne, purs), `StructureBarNode.tsx` (bouton du Workflow, suivi propre, surbrillance de « Bosser ici ») ; tests
unitaires et e2e `workflow-task-files` (désormais en conversation simulée).
**Quoi :** retour de mentalyas : ses projets commencés avant la spec 032 n'ont ni en-têtes de brainstorm ni fichiers
`TACHES-*.md`, donc pas de « Bosser ici ». Dans la vue Workflow, « ↻ Mettre à jour » envoie à Claude ce qui manque
(brainstorms sans en-tête, tâches en ébauches, aucun fichier de tâches) ; il complète les en-têtes, range les tâches et
coche leur état réel, sans toucher au code. À la fin de son tour, l'app relit l'arbre et centre la carte sur
« ▶ Bosser ici », en surbrillance (« Prochaine tâche : … »). Les autres vues gardent la mise à jour de la carte de
structure (spec 022).
**Erreur évitée :** le premier essai réutilisait le suivi de la cartographie : sa fin affichait « Cartographie
terminée » et faisait avancer le repère des changements de la carte. Suivi propre à la mise à jour du Workflow.
**Vérifié :** typecheck, lint, Prettier, 2 439 tests ; e2e `workflow-task-files` (5 cas, dont la surbrillance).

### [2026-10-16 21:36] FEAT — jauge de contexte sur chaque tâche, « ▶ Compléter ici » (spec 032 D18)
**Fichiers :** `specs/032-trois-vues/spec.md` (D18), `src/shared/workflow/arbre.ts` (`roundToComplete`, champ
`complete` de l'arbre), `src/shared/ipc/workflow.ts`, `workflowTree.ts` (maturité des carrés, nom accessible avec le
contexte), `WorkflowNode.tsx`, `LivingNode.tsx` (anneau sur les carrés, étiquette « ▶ Compléter ici »), `living.css`
(anneau qui épouse le carré), `StructureBarNode.tsx` (après « Mettre à jour », la carte va sur « Compléter ici » s'il
n'y a pas de « Bosser ici ») ; tests unitaires et e2e `workflow-context` (nouveau), `workflow-task-files`.
**Quoi :** retour de mentalyas sur Bike_cycle : après « Mettre à jour », les en-têtes étaient posés et les cases
cochées, mais aucun « Bosser ici » : tous ses brainstorms sont « suffisant » ou « insuffisant », leurs tâches restent
des ébauches (D5), c'est voulu (« un nœud sans le contexte au max ne doit pas permettre de travailler »). Ce qui
manquait : le voir. Chaque carré porte maintenant l'anneau de contexte (maturité de son brainstorm) ; sans tâche
travaillable, le brainstorm le plus mûr qui a encore des tâches s'allume, « ▶ Compléter ici ».
**Vérifié :** typecheck, lint, Prettier, 2 440 tests ; e2e `workflow-context` et `workflow-task-files` (6 cas).

### [2026-10-16 21:53] FIX — le Workflow lit aussi les documents de l'app, docs/brainstormer/ (spec 032 D19)
**Fichiers :** `specs/032-trois-vues/spec.md` (D19), `WorkflowService.ts` (lecture de `docs/brainstormer/`, fichiers
lisibles), `brainstorm.ts` (document de l'app retenu s'il a un en-tête ; niveau par son parent), `docHeader.ts` (parent
donné par un chemin), `BrainstormDocView.path` et son usage (`arbre.ts`, `workflowTree.ts`, `WorkflowCard.tsx`,
`prompts.ts`, `workflowHost.ts`) ; fixtures de tests, nouveau test.
**Erreur :** retour de mentalyas sur Bike_cycle : après « Mettre à jour », ni jauge de contexte lisible ni « Compléter
ici ». Ses brainstorms, écrits par Claude dans l'app (`document_ecrire`, spec 012), sont dans `docs/brainstormer/`
avec des noms libres ; le Workflow ne lisait que `docs/brainstorm/L*.md` : aucun rond, tâches « non évaluées »
(pointillé gris peu visible), rien à compléter. Les e2e passaient : leurs projets fictifs utilisaient le bon dossier.
**Quoi :** les documents de `docs/brainstormer/` qui ont un en-tête de brainstorm deviennent des ronds ; leur niveau vient
de leur parent ; chaque rond garde son vrai chemin. Vérifié sur le dossier réel de Bike_cycle : 9 brainstorms lus,
« Compléter ici » sur « Choix de la stack technique » (aucun n'est complet).
**Règle apprise :** tester une vue sur le projet réel qui a motivé la demande, pas seulement sur un projet fictif.
**Vérifié :** typecheck, lint, 2 441 tests ; e2e `workflow-context` et `workflow-task-files`.

### [2026-10-16 22:04] FIX — mode et modèle d'un agent : un seul réglage, celui de son profil (L1o D19)
**Fichiers :** `ConversationService.ts` (`updateAgent` : mode et modèle d'une visio d'agent écrits dans le profil ;
le profil prime pour l'affichage), `AgentChats.ts` (persona : mode brut du profil), `bootstrap.ts` ; tests.
**Erreur :** retour de mentalyas : Thor réglé sur « Accepter les modifications » dans sa visio, mais le lancement du
pipeline le disait « Demander avant d'écrire ». Le sélecteur de la visio changeait le mode de la conversation (spec 014),
le pipeline lit celui du profil : deux réglages de même nom, sans lien.
**Quoi :** dans la visio d'un agent, les sélecteurs de mode et de modèle lisent et écrivent son profil (la carte et le
volet se relisent) ; Libre se confirme toujours dans la conversation. Un mode déjà choisi dans une ancienne visio est
ignoré : c'est le profil qui compte (à régler une fois de plus).
**Vérifié :** typecheck, lint, Prettier, 2 442 tests.

### [2026-10-16 22:26] FIX — premier vrai lancement d'agents : refus d'écriture, copie non commitée, rangement (L1o D20)
**Fichiers :** `PipelineEngine.ts` (`refusalsOf`, arrêt `permission-denied`, `uncommittedWarning`, consigne de
rangement dans la mission), `AssemblyService.ts`, `src/shared/agents/pipeline.ts` (`permission-denied`,
`UNCOMMITTED_MARK`), `AgentsTabContent.tsx` (« Ouvrir le Dépôt ») ; tests d'intégration et unitaires ; e2e
`agents-map` stabilisé.
**Constat (Bike_cycle, demandé par mentalyas) :** le PO a écrit une spec correcte mais sans les documents
d'architecture, non commités (9 fichiers de tâches, des brainstorms et du code en cours) ; Thor, en « Demander avant
d'écrire », a vu ses 3 écritures refusées et n'a rendu qu'un rapport ; l'app a pourtant dit « validé » (pas de QA, un
rapport suffisait). Le brainstorm du PO, nommé librement dans docs/brainstorm/, n'apparaît pas dans le Workflow.
**Quoi :** agent arrêté si ses outils sont refusés et qu'il n'a rien changé ; avertissement des fichiers non commités
avant le lancement ; règle de rangement dans la mission.
**Erreur de test corrigée :** l'e2e `agents-map` échouait une fois sur deux : la visio recentre la carte, qui ne dessine
que les nœuds visibles ; un agent passait sous le panneau de droite. Le test recadre (« Tout afficher ») après chaque
visio ; 5 passes sur 5.
**Vérifié :** typecheck, lint, Prettier, 2 445 tests ; e2e `agents-map`.
