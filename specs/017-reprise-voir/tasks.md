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
- [x] T013 [P] [US3] Processus d'analyse `src/analysis-worker/worker.ts` : chargement des grammaires par chemin absolu, parcours de l'arbre syntaxique figé par langage (`src/analysis-worker/extract.ts` ; plus lisible et contrôlable que des requêtes `.scm`), protocole Zod (`protocol.ts`), lots asynchrones annulables (`process.ts`), extraction symboles / imports / appels / points d'entrée, délai 2 s et 1 Mo par fichier, refus de tout chemin hors racine, messages Zod + tests sur fixtures
- [x] T014 [P] [US3] Pur : modules (`package.json` / workspaces, `.csproj`, dossiers) dans `src/main/domain/reprise/modules.ts` + tests
- [x] T015 [P] [US3] Pur : résolution TS / JS (relatifs, `tsconfig` paths, paquets), C# (namespaces, `using`, DI), PHP (PSR-4, `use`, routes Laravel, Eloquent) dans `src/main/domain/reprise/resolve.ts` (un seul résolveur : les règles par langage partagent l'index des symboles) → `syntax` / ambigu (candidats) / inconnu + tests
- [x] T016 [P] [US3] Pur : catégories par règles (plomberie, orchestration, infrastructure, métier) dans `src/main/domain/reprise/categories.ts` + tests
- [x] T017 [US3] `AnalysisService` dans `src/main/application/reprise/AnalysisService.ts` : `utilityProcess.fork`, une analyse par projet et une lourde à la fois, incrémental par empreinte, écriture par lots, overrides réappliqués, progression (`reprise:analysisProgress`), annulation sans perte, `interrupted` au démarrage, run journalisé (sans code ni chemin complet) ; lancée à la création (T009) + tests d'intégration (3 fixtures avec la **liste fermée des liens sûrs attendus**, SC-006 ; piégé ; incrémental)
- [x] T018 [US3] IPC `reprise:analyze`, `reprise:cancelAnalysis`, `reprise:setCategory`, `reprise:setTarget` dans `src/main/ipc/repriseHandlers.ts` + tests

## Phase 5 — US2 Voir le projet dans l'explorateur (P1) 🎯 MVP
**Test indépendant** : `ts-app` : Modules → dossiers → fichiers → fonctions + extrait, fil d'Ariane, plomberie masquée avec compteur, isoler, vue liste.
- [x] T019 [P] [US2] Pur : agrégation par niveau (ancêtre visible, nombre d'appels, fiabilité la plus faible, regroupement au-delà de 150) dans `src/main/domain/reprise/aggregate.ts` + tests
- [x] T020 [P] [US2] Pur : mise en page en colonnes par catégorie, ordre par barycentre, positions épinglées respectées dans `src/main/domain/reprise/layout.ts` + tests
- [x] T021 [US2] `ExplorerService` dans `src/main/application/reprise/ExplorerService.ts` (vue agrégée avec cache par run, détail avec appelants / appelés, extrait ≤ 200 lignes sous la racine et hors secrets, recherche, positions, état ; dossier déplacé ou supprimé → dernière analyse en lecture seule, signalée) + IPC `src/main/ipc/explorerHandlers.ts` (`explorer:*`) + tests d'intégration (volumétrie 5 000 fichiers synthétiques)
- [x] T022 [US2] Interface : vue `explorer` dans `uiStore`, `src/renderer/src/explorer/ExplorerPage.tsx` (carte React Flow 62 % / panneau 38 %, indicateur de niveau 1-2-3-4, fil d'Ariane, zoom sémantique, double-clic, filtres, recherche, isoler, légende traits + icônes, badge, bandeau d'analyse en cours, bandeau « dossier introuvable »), `NodePanel.tsx`, `CodeExcerpt.tsx` (texte échappé, highlight.js), `ExplorerList.tsx` (vue liste clavier) ; « Ouvrir l'explorateur » sur le genesis + tests renderer/axe
- [x] T023 [US2] Test guidé (quickstart §2, §3) — retour du 2026-10-07 : dézoom corrigé (D10), suppression d'un genesis (D9), et réorientation vers la carte combinée (D11–D13, phase 5 bis)

## Phase 5 bis — US7 La carte de Claude, nourrie par l'analyse (P1, retour T023, D11–D13)
**Test indépendant** : `cs-app` cartographié par Claude : fichiers d'un élément consultables, liens « N appels » entre éléments, graphe lu par Claude.
- [x] T038 [US7] Fichiers d'un élément : `ElementFilesService` (chemins de l'élément → fichiers du projet, dossiers développés, 200 au plus ; lecture sous la racine, 1 Mo, hors sensibles ; symboles et appelants si projet repris analysé) + IPC `structure:files`, `structure:file` + tests
- [x] T039 [US7] Interface : section « Fichiers » dans le chat d'un élément, lecteur de fichier en lecture seule (code coloré, symboles, appelants) + tests renderer/axe
- [x] T040 [P] [US7] Pur : appels mesurés entre éléments (fichier → élément le plus profond qui le couvre, agrégation, fiabilité la plus faible) dans `src/main/domain/reprise/measured.ts` ; `IdeasCanvasView.measuredLinks` (CanvasService) ; rendu distinct sur la carte, rattaché à l'ancêtre visible (`structureGraph`) + tests
- [x] T041 [US7] Outil du pont `code_graphe_lire` (modules, points d'entrée, appels sûrs entre fichiers, bornés) garde comprise ; consigne de cartographie (`MAP_MESSAGE`, cadre) : s'appuyer sur le graphe mesuré + tests
- [x] T042 [US7] Explorateur en second plan (D12) : bouton discret dans le chat du genesis, mis en avant seulement en « Local uniquement » + tests
- [x] T043 [US7] Test guidé (US7) — attendre le retour
- [x] T044 [P] [US7] Pur : arbre en colonnes aéré (écart entre colonnes, entre nœuds, et entre modules de niveau 1) dans `src/renderer/src/canvas/structureGraph.ts` + tests (FR-035, D14 révisée)
- [x] T045 [P] [US7] Pur : liens selon le focus (agrégés au niveau 1 au repos ; détail de l'élément sélectionné ou survolé et de son sous-arbre) dans `structureGraph.ts` + tests (FR-036, D15)
- [x] T046 [US7] Rendu : liens du focus (survolé / ouvert) dans `IdeasCanvas`, liens arrêtés au bord des éléments (`edges/useCenter.ts`), estompage au repos (`canvas.css`) + tests
- [x] T047 [US7] Test guidé (D14–D15) — attendre le retour

## Phase 5 quater — US2 Explorateur sur un seul écran (D16, retour T027)
**Test indépendant** : `cs-app` : module → dossiers ; onglet « Fichiers » d'un dossier → code complet à droite avec appelants / appelés par bloc ; clic sur un appel → l'autre fichier, au bon bloc.
- [x] T048 Spec : D16, FR-020 révisée, FR-037, scénario 8 d'US2
- [x] T049 [US2] Main : arbre de la carte sans niveau « fonctions » (modules → dossiers, nœud « Racine » des fichiers directs), fichiers directs de chaque dossier dans la vue (`ExplorerNodeView.files`) dans `domain/reprise/aggregate.ts` / `ExplorerService` + tests
- [x] T050 [US2] Main : `explorer:file` (fichier complet ≤ 1 Mo, hors sensibles, sous la racine réelle ; blocs avec appelants / appelés et fiabilité, lignes d'appel approchées) + IPC + tests
- [x] T051 [US2] Interface : nœud module, nœud dossier à onglets « Fichiers » / « Sous-dossiers », volet de code (marques par bloc, navigation d'un fichier à l'autre, dossier sélectionné sur la carte) ; vue liste équivalente + tests renderer/axe
- [x] T052 [US2] Recherche, isolement, guide (`explorer:locate`) et `NodePanel` adaptés aux nouvelles clés (un symbole mène à son fichier, au bon bloc) + tests
- [x] T053 [US2] Test guidé (D16) — attendre le retour

## Phase 5 quinquies — US7 Carte de structure : disposition alternée et progression (D17)
**Test indépendant** : `cs-app` cartographié : modules en colonne sous le genesis, enfants en ligne à droite, petits-enfants en colonne dessous ; numéros 1, 1.1, 1.1.1 ; ordre fondations → métier → interface.
- [x] T054 Spec : D17, FR-035 révisée, FR-038
- [x] T055 [US7] `ordre` dans `structure_dessiner` (Zod, description de l'outil), `ResolvedElement.order`, rang des éléments écrit et historisé (`neurons.rank`, instantané, Historique), `ElementView.order` + tests
- [x] T056 [P] [US7] Pur : ordre des frères (Claude → dépendances → dessin) et numéros de progression dans `src/renderer/src/canvas/structureOrder.ts` + tests
- [x] T057 [US7] Pur : disposition alternée (boîtes de sous-arbres, sans chevauchement) et hiérarchie en chemin dans `structureGraph.ts` + tests
- [x] T058 [US7] Rendu : pastille du numéro dans `ElementNode` ; consigne de cartographie (`MAP_MESSAGE`) : numéroter selon la progression + tests renderer/axe
- [x] T059 [US7] Test guidé (D17) — attendre le retour

## Phase 5 sexies — US7 Carte de structure : nœuds selon leur contenu (D18)
**Test indépendant** : sur la carte du Brainstormer, un élément qui ne couvre que `docs/` a l'aspect « page » et le badge « Doc » ; un élément sur `src/main/` l'aspect « éditeur », le badge « Code » et « + N doc » s'il contient un `.md`.
- [x] T060 Spec : D18, FR-039
- [x] T061 [P] [US7] Pur : classement doc / code des fichiers d'un élément dans `src/main/domain/reprise/content.ts` (extensions de documentation, couverture par les chemins, compteurs) + tests
- [x] T062 [US7] `ElementView.content` calculé par `CanvasService` à partir des fichiers du dossier lié (inventaire du projet mis en cache 30 s par dossier, fichiers sensibles exclus) + tests
- [x] T063 [US7] Rendu : aspect « page » / « éditeur » et badges dans `ElementNode` (libellé accessible « contient de la documentation / du code ») + tests renderer/axe
- [x] T064 [US7] Test guidé (D18 + lisibilité) — attendre le retour

## Phase 5 septies — US7 Carte de structure : état visuel du statut (D19)
- [x] T065 Spec : D19, FR-040
- [x] T066 [US7] Pastille, bande latérale et contour « bloquée » dans `ElementNode` ; statut dans le libellé accessible + tests renderer/axe
- [x] T067 [US7] Test guidé (D19) — avec T064

## Phase 5 octies — US7 Carte de structure : vue « Architecture » (D20)
**Test indépendant** : la carte du Brainstormer cartographiée par Claude en « Clean » ; vue Architecture : bandes Présentation / Infrastructure / Application / Domaine, nœuds inchangés, un appel Domaine → Infrastructure tracé en rouge ; corriger la couche d'un nœud le déplace de bande, « Annuler » le remet.
- [x] T068 Spec : D20, FR-041
- [x] T069 [P] [US7] Pur : catalogue des architectures et profondeurs, couche par défaut (catégories, dossiers), violations, dans `src/shared/structure/architecture.ts` + tests — *déduction par les noms de dossiers seulement ; les catégories de l’analyse (projets repris) viendront si la déduction se révèle insuffisante*
- [x] T070 [US7] Données et outil de Claude : migration 0031 (+ down) — architecture de la carte sur le genesis, couche et source de chaque élément ; `structure_dessiner` (`architecture`, `couche`) validé contre le catalogue ; `StructureService` (écriture, instantané d'Historique) ; `ElementView.layer`, `architecture` de la carte ; consigne de cartographie + tests — *couches et architecture vérifiées contre l’architecture effective (celle de mentalyas prime) ; nouveau type de lot d’Historique `structure`, annulable*
- [x] T071 [US7] Corrections : `structure:setArchitecture`, `element:setLayer` (source `user`, historisées, annulables) + tests
- [x] T072 [US7] Vue Architecture : bascule par carte, disposition en bandes (pure, testée), liens en violation en rouge, légende de la règle + tests renderer/axe — *barre de la carte posée à droite du genesis ; violations seulement dans la vue Architecture (la vue Progression validée reste inchangée)*
- [x] T073 [US7] Puce de couche dans le pied du nœud (« déduite » si besoin), sélecteurs de correction (architecture dans la barre de la carte, couche dans le volet de l'élément) + tests renderer/axe — *la couche se corrige dans la puce même du nœud (menu déroulant du pied) plutôt que dans le volet ; nœud porté à 304 × 152 px pour loger la puce*
- [x] T074 [US7] Test guidé (D20) — validé par mentalyas

## Phase 5 nonies — US7 Carte de structure : avancement vivant (D21)
**Test indépendant** : dans la conversation d'un élément, Claude termine un travail (tests, commit) → le nœud passe « livrée », barre pleine, sans recartographier ; son parent voit sa barre monter ; « Annuler » remet l'état d'avant.
- [x] T075 Spec : D21, FR-042
- [x] T076 [US7] Données et outil : migration 0032 (+ down) `neurons.progress`, `progress_note` ; outil MCP `element_avancer` (élément de la conversation par défaut, même projet seulement, livrée ⇒ 100 %) ; `StructureService.advance` historisé (`element_progress`, annulable) ; consigne des conversations d'élément et instructions du pont + tests
- [x] T077 [P] [US7] Pur : avancement mixte des éléments (moyenne des sous-éléments, feuille déclarée) dans `src/renderer/src/canvas/progress.ts` + tests
- [x] T078 [US7] Rendu : barre de progression et % dans `ElementNode`, reste à faire au survol, % dans le libellé accessible + tests renderer/axe
- [x] T079 [US7] Test guidé (D21) — validé par mentalyas le 2026-10-08, après correction : un parent livré suit la moyenne de ses sous-éléments (D21 amendée)

## Phase 5 decies — US7 Carte de structure : fichiers écrits pendant le travail (D22)
- [x] T080 [US7] Hook d'avant-écriture : dans la conversation d'un élément, le chemin relatif du fichier écrit (sous le dossier lié, hors sensible) rejoint ses chemins (`ElementRepository.addPath`, ajout seulement), carte rafraîchie (`final:changed` → `structure`) + tests (`element-add-path.test.ts`, `deliverable-tracker.test.ts`) — écrit par Claude dans le Brainstormer, relu et spécifié ensuite

## Phase 6 — US4 Le guide de reprise (P2)
**Test indépendant** : `cs-app` : 9 sections avec analogies, lien vers l'explorateur, chemin inventé signalé.
- [x] T024 [US4] Tâche `reprise_guide` dans `src/main/application/ai/` (entrée bornée, sortie Zod : 9 sections + résumés-analogies des modules) ; routage forcé vers Ollama pour un projet local ; `AI_UNAVAILABLE` + tests (moteurs simulés)
- [x] T025 [US4] `GuideService` dans `src/main/application/reprise/GuideService.ts` : contexte (graphe résumé, README, docs, configs, hors secrets), vérification des sources sur le disque (retrait / signalement), document du genesis versionné (spec 012), mention « modèle local », résumés des modules dans `code_modules` ; run journalisé (`code_runs`, sans contenu) ; produit à la fin de la première analyse ; IPC `reprise:guide` + tests (README piégé)
- [x] T026 [US4] Interface : ouverture du guide, liens cités → explorateur centré, « Régénérer », analogie du module dans `NodePanel` + tests renderer/axe
- [x] T027 [US4] Test guidé (quickstart §4) — attendre le retour

## Phase 7 — US5 Reprendre un projet depuis un dépôt git (P2)
**Test indépendant** : clone `https://` avec progression ; annulation → dossier partiel supprimé ; `ext::…` refusé sans rien lancer.
**En pause (2026-10-07)** : décision de mentalyas, US5 non prioritaire pour le moment ; on passe aux tâches suivantes sans elle (rien n'en dépend).
- [x] T028 [P] [US5] Pur : contrôle et nettoyage d'URL (`https://`, `git@`, identifiants retirés, options et transports refusés) dans `src/shared/reprise/gitUrl.ts` + tests (URL hostiles) — *livrée par la spec 020 (T026)*
- [x] T029 [US5] `CloneService` *(2026-10-10 : livrée par les specs 020 T027, 021 US3 et 024 US5 ; le clone passe par le Project Manager, spec 021 D13)* dans `src/main/application/reprise/CloneService.ts` : git par chemin absolu, arguments fixes (research R4), `GIT_TERMINAL_PROMPT=0`, progression lue sur stderr, un clone à la fois, délai 30 min, annulation et nettoyage du seul dossier créé, classement des échecs (auth, introuvable, réseau…), clone interrompu nettoyé au démarrage ; clone journalisé dans le journal de l'app (durée, issue, hôte — jamais l'adresse complète ni un identifiant) ; IPC `reprise:clone`, `reprise:cancelClone` + événements + tests (processus simulé) — *partiel (2026-10-08) : `CloneService` livré par la spec 020 (T027) ; restent les IPC `reprise:clone` / `reprise:cancelClone`, leurs événements et la trace du clone dans le journal*
- [x] T030 [US5] *(remplacée, spec 021 D13 : « Nouveau brainstorm › Depuis un lien Git » du Project Manager, pas d'onglet dans l'assistant)* Interface : onglet « Depuis GitHub (ou une URL git) » de l'assistant, progression, Annuler, erreurs claires + tests renderer/axe
- [x] T031 [US5] Test guidé (quickstart §5) *(e2e de la spec 024, vrai clone)* — attendre le retour

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
