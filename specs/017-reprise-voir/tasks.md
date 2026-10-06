# Tasks: Reprise — Voir (spec 017)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>` ; interface : renderer + axe.
**Ordre des histoires** : US3 (analyse) est livrée avant US2 (explorateur), qui affiche son résultat.

## Phase 1 — Mise en place
- [x] T001 Constitution 4.1.0 (D8) : principe I (git par chemin absolu, sans shell, arguments fixes), principe IV (« Local uniquement » → modèle local), contraintes techniques (`@vscode/tree-sitter-wasm`), Sync Impact Report, version et date dans `.specify/memory/constitution.md`
- [x] T002 Dépendance `@vscode/tree-sitter-wasm@0.3.1` (annoncée : MIT, Microsoft, sans dépendance ni script d'installation) dans `package.json` ; 3e point d'entrée `analysis-worker` et copie du moteur (`tree-sitter.js` + `tree-sitter.wasm`) et des 5 grammaires utiles (TS, TSX, JS, C#, PHP) vers `out/main/grammars/` dans `electron.vite.config.ts`
- [x] T003 [P] Projets fixtures **fictifs** `tests/fixtures/reprise/{ts-app, cs-app, laravel-app, hostile-app}` (modules, routes, interface injectée, appel ambigu, fichier cassé, `.env`, scripts d'installation, hook, commentaire porteur de consigne)

## Phase 2 — Fondations (bloquant)
- [x] T004 Migration `0028_reprise_projet` (10 tables `code_*`, data-model.md) + `migrations/down/0028_reprise_projet.down.sql` écrit à la main + aller-retour testé dans `tests/integration/db/`
- [x] T005 Dépôts `src/main/infrastructure/db/repositories/RepriseRepository.ts` (projets, runs, overrides, état de l'explorateur, positions) et `CodeGraphRepository.ts` (modules, fichiers, symboles, liens, points d'entrée ; écriture par lots en transaction) + tests d'intégration
- [x] T006 [P] Vues et contrats partagés `src/shared/ipc/reprise.ts` (ImportPreviewView, RepriseProjectView, Explorer*View, CodeExcerptView, codes d'erreur) ; les canaux et événements rejoignent `src/shared/ipc/channels.ts` avec leurs gestionnaires (T010, T018, T021…), comme le veut ce fichier
- [x] T007 [P] Pur : exclusions + fichiers sensibles + `.gitignore` simple dans `src/main/domain/reprise/fileFilter.ts` (réutilise la liste de `checkProjectPath`) + tests
- [x] T008 `ConfidentialityGuard` dans `src/main/application/reprise/ConfidentialityGuard.ts` (genesis → niveau ; projet non repris = autorisé) ; branché dans `ConversationService.send` (code `LOCAL_ONLY`, message clair) **et dans les outils de lecture du pont MCP** (`document_lire`, `noeud_lire`, `neurone_contexte`, `carte_lire`, `etat`, `structure_lire` : un projet local est refusé ou masqué, y compris pour une session externe sans neurone) + tests

## Phase 3 — US1 Reprendre un projet depuis un dossier, confidentialité (P1) 🎯 MVP
**Test indépendant** : importer `laravel-app` en « Local uniquement » → genesis avec badge ; chat indisponible ; aucune tâche Claude.
- [x] T009 [US1] `RepriseService` dans `src/main/application/reprise/RepriseService.ts` : aperçu (sélecteur natif, parcours en flux, langages, retenus / ignorés / sensibles, git, ≤ 20 000), `previewId` éphémère 15 min, dossier de données refusé (`realpath`), dossier déjà lié à **n'importe quel** neurone (projet repris ou dossier de projet de la spec 008, comparés par chemin réel) → `ALREADY_LINKED` avec ce neurone ; création transactionnelle genesis + `code_projects` ; `setConfidentiality` (local → claude `CONFIRM_REQUIRED`) + tests
- [x] T010 [US1] IPC `src/main/ipc/repriseHandlers.ts` (`reprise:previewFolder`, `reprise:create`, `reprise:get`, `reprise:setConfidentiality`) + câblage `src/main/bootstrap.ts` + tests du canal (Zod)
- [x] T011 [US1] Interface : bouton « Reprendre un projet existant » sur la carte, assistant `src/renderer/src/reprise/ImportWizard.tsx` (source → aperçu → confidentialité sans défaut, « Importer » grisé sans choix), badge de confidentialité (chat du genesis, futur explorateur) qui permet de **changer le niveau** (local → Claude : confirmation ; Claude → local : immédiat, rappel « ce qui a déjà été envoyé ne peut pas être rappelé »), chat indisponible en local avec la raison + tests renderer/axe
- [x] T012 [US1] Test guidé (quickstart §1) — attendre le retour

## Phase 4 — US3 Une analyse qui ne lance rien et dit ce qu'elle sait (P1) 🎯 MVP
**Test indépendant** : analyser les 3 fixtures → liens attendus (route → contrôleur → modèle, interface → implémentation, imports TS) ; fichier cassé « non analysé » ; `hostile-app` : rien exécuté, consigne sans effet.
- [ ] T013 [P] [US3] Processus d'analyse `src/analysis-worker/worker.ts` : chargement des grammaires par chemin absolu, requêtes `.scm` figées par langage (`src/analysis-worker/queries/{typescript, csharp, php}.ts`), extraction symboles / imports / appels / points d'entrée, délai 2 s et 1 Mo par fichier, refus de tout chemin hors racine, messages Zod + tests sur fixtures
- [ ] T014 [P] [US3] Pur : modules (`package.json` / workspaces, `.csproj`, dossiers) dans `src/main/domain/reprise/modules.ts` + tests
- [ ] T015 [P] [US3] Pur : résolution TS / JS (relatifs, `tsconfig` paths, paquets), C# (namespaces, `using`, DI), PHP (PSR-4, `use`, routes Laravel, Eloquent) dans `src/main/domain/reprise/resolve/{ts, cs, php}.ts` → `syntax` / ambigu (candidats) / inconnu + tests
- [ ] T016 [P] [US3] Pur : catégories par règles (plomberie, orchestration, infrastructure, métier) dans `src/main/domain/reprise/categories.ts` + tests
- [ ] T017 [US3] `AnalysisService` dans `src/main/application/reprise/AnalysisService.ts` : `utilityProcess.fork`, une analyse par projet et une lourde à la fois, incrémental par empreinte, écriture par lots, overrides réappliqués, progression (`reprise:analysisProgress`), annulation sans perte, `interrupted` au démarrage, run journalisé (sans code ni chemin complet) ; lancée à la création (T009) + tests d'intégration (3 fixtures avec la **liste fermée des liens sûrs attendus**, SC-006 ; piégé ; incrémental)
- [ ] T018 [US3] IPC `reprise:analyze`, `reprise:cancelAnalysis`, `reprise:setCategory`, `reprise:setTarget` dans `src/main/ipc/repriseHandlers.ts` + tests

## Phase 5 — US2 Voir le projet dans l'explorateur (P1) 🎯 MVP
**Test indépendant** : `ts-app` : Modules → dossiers → fichiers → fonctions + extrait, fil d'Ariane, plomberie masquée avec compteur, isoler, vue liste.
- [ ] T019 [P] [US2] Pur : agrégation par niveau (ancêtre visible, nombre d'appels, fiabilité la plus faible, regroupement au-delà de 150) dans `src/main/domain/reprise/aggregate.ts` + tests
- [ ] T020 [P] [US2] Pur : mise en page en colonnes par catégorie, ordre par barycentre, positions épinglées respectées dans `src/main/domain/reprise/layout.ts` + tests
- [ ] T021 [US2] `ExplorerService` dans `src/main/application/reprise/ExplorerService.ts` (vue agrégée avec cache par run, détail avec appelants / appelés, extrait ≤ 200 lignes sous la racine et hors secrets, recherche, positions, état ; dossier déplacé ou supprimé → dernière analyse en lecture seule, signalée) + IPC `src/main/ipc/explorerHandlers.ts` (`explorer:*`) + tests d'intégration (volumétrie 5 000 fichiers synthétiques)
- [ ] T022 [US2] Interface : vue `explorer` dans `uiStore`, `src/renderer/src/explorer/ExplorerPage.tsx` (carte React Flow 62 % / panneau 38 %, indicateur de niveau 1-2-3-4, fil d'Ariane, zoom sémantique, double-clic, filtres, recherche, isoler, légende traits + icônes, badge, bandeau d'analyse en cours, bandeau « dossier introuvable »), `NodePanel.tsx`, `CodeExcerpt.tsx` (texte échappé, highlight.js), `ExplorerList.tsx` (vue liste clavier) ; « Ouvrir l'explorateur » sur le genesis + tests renderer/axe
- [ ] T023 [US2] Test guidé (quickstart §2, §3) — attendre le retour

## Phase 6 — US4 Le guide de reprise (P2)
**Test indépendant** : `cs-app` : 9 sections avec analogies, lien vers l'explorateur, chemin inventé signalé.
- [ ] T024 [US4] Tâche `reprise_guide` dans `src/main/application/ai/` (entrée bornée, sortie Zod : 9 sections + résumés-analogies des modules) ; routage forcé vers Ollama pour un projet local ; `AI_UNAVAILABLE` + tests (moteurs simulés)
- [ ] T025 [US4] `GuideService` dans `src/main/application/reprise/GuideService.ts` : contexte (graphe résumé, README, docs, configs, hors secrets), vérification des sources sur le disque (retrait / signalement), document du genesis versionné (spec 012), mention « modèle local », résumés des modules dans `code_modules` ; run journalisé (`code_runs`, sans contenu) ; produit à la fin de la première analyse ; IPC `reprise:guide` + tests (README piégé)
- [ ] T026 [US4] Interface : ouverture du guide, liens cités → explorateur centré, « Régénérer », analogie du module dans `NodePanel` + tests renderer/axe
- [ ] T027 [US4] Test guidé (quickstart §4) — attendre le retour

## Phase 7 — US5 Reprendre un projet depuis un dépôt git (P2)
**Test indépendant** : clone `https://` avec progression ; annulation → dossier partiel supprimé ; `ext::…` refusé sans rien lancer.
- [ ] T028 [P] [US5] Pur : contrôle et nettoyage d'URL (`https://`, `git@`, identifiants retirés, options et transports refusés) dans `src/shared/reprise/gitUrl.ts` + tests (URL hostiles)
- [ ] T029 [US5] `CloneService` dans `src/main/application/reprise/CloneService.ts` : git par chemin absolu, arguments fixes (research R4), `GIT_TERMINAL_PROMPT=0`, progression lue sur stderr, un clone à la fois, délai 30 min, annulation et nettoyage du seul dossier créé, classement des échecs (auth, introuvable, réseau…), clone interrompu nettoyé au démarrage ; clone journalisé dans le journal de l'app (durée, issue, hôte — jamais l'adresse complète ni un identifiant) ; IPC `reprise:clone`, `reprise:cancelClone` + événements + tests (processus simulé)
- [ ] T030 [US5] Interface : onglet « Depuis GitHub (ou une URL git) » de l'assistant, progression, Annuler, erreurs claires + tests renderer/axe
- [ ] T031 [US5] Test guidé (quickstart §5) — attendre le retour

## Phase 8 — US6 Lever les ambiguïtés avec l'IA (P3)
**Test indépendant** : `cs-app` : l'appel `Save()` ambigu devient « déduit » vers la bonne classe ; une cible hors candidats est rejetée.
- [ ] T032 [US6] Tâche `reprise_resolution` (lots de 50, contexte ≤ 8 lignes, candidats par id, sortie Zod fermée), routage Claude / Ollama par la garde ; `ResolutionService` dans `src/main/application/reprise/ResolutionService.ts` (liens `deduced` avec raison, reclassements justifiés, abonnement épuisé → liens laissés incertains) ; IPC `reprise:resolve` + tests
- [ ] T033 [US6] Interface : « Préciser les liens avec l'IA » dans l'explorateur, raison d'un lien déduit dans le panneau + tests renderer/axe
- [ ] T034 [US6] Test guidé (quickstart §3, §6) — attendre le retour

## Phase 9 — Finitions
- [ ] T035 Test de bout en bout SC-002 (projet local : aucune tâche ni conversation Claude sur tout le parcours, et aucun contenu lisible par le pont MCP, session externe comprise) et SC-003 (`hostile-app` : rien exécuté) dans `tests/integration/reprise/`
- [ ] T036 Mesures SC-004 / SC-005 sur 5 000 fichiers (plan B WebGL seulement si échec), consignées dans `research.md`
- [ ] T037 Démo `npm run seed:demo` (projet repris fictif), `docs/FOUNDATION.md` (§000 : 017 livrée), `CLAUDE.md` (commande, dépendance, spec en cours), `docs/JOURNAL.md`

## Dépendances
T001–T003 → T004 → T005 → (T006, T007 en parallèle) → T008 → US1 (T009–T012) → US3 (T013–T016 en parallèle → T017 → T018)
→ US2 (T019, T020 en parallèle → T021 → T022 → T023) → US4 (T024 → T025 → T026 → T027) → US5 (T028 → T029 → T030 → T031)
→ US6 (T032 → T033 → T034) → T035–T037. US5 ne dépend que d'US1 (peut avancer après T012 si besoin).

## Parallélisme
- Phase 1 : T003 pendant T001–T002.
- US3 : T013 (processus d'analyse), T014, T015, T016 (purs) sur des fichiers distincts.
- US2 : T019 et T020 (purs).

## Stratégie
MVP = US1 + US3 + US2 (Voir le projet) : test guidé à la fin de chaque histoire. Puis US4 (guide), US5 (clone), US6
(ambiguïtés). Commit après chaque test guidé validé, sur confirmation.
