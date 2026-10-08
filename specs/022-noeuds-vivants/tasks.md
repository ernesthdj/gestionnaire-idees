# Tasks: Nœuds vivants (spec 022)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [inventory.md](inventory.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>` ; purs dans `tests/unit/`,
interface renderer + axe (`expectNoAxeViolations`), git réel sur dépôt temporaire pour US5. **Tous les tests existants
restent verts à chaque lot (D23).**
**Référence visuelle** : prototype validé (artifact « Nœuds vivants » v23).
**Règle D23** : avant de cocher la dernière tâche d'une carte, chaque ligne de `inventory.md` qui la concerne est
vérifiée à la main dans l'app.

## Phase 1 — Mise en place
- [x] T001 Annoncer puis installer `lucide-react` (ISC, D12) : `npm install lucide-react` ; vérifier `npm audit` (0 alerte) et la taille du paquet produit (`npm run build`) ; noter dans `docs/JOURNAL.md`
- [x] T002 [P] Jetons `src/renderer/src/styles/tokens.css` : palette de branches `--color-branch-1…10` (clair, sombre), tailles de nœuds, courbe `--ease-soft` (700 ms), jetons du canevas sobre (points, bords) ; aucun changement visible ailleurs
- [x] T003 [P] Thème **Carbone** (R7, en plus des autres) : `THEMES` + `'carbon'` dans `src/shared/ipc/app.ts` (Zod), option dans la page Réglages (thème), jetons Carbone dans `tokens.css` (surfaces, liserés argentés `--silver-hi/lo`, champs), `colorMode="dark"` de React Flow pour ce thème ; tests du schéma de réglages

## Phase 2 — Fondations (bloquant)
- [x] T004 [P] Pur : `src/renderer/src/canvas/living/rhythm.ts` (`hash`, `rhythm(id)` : durée, délai, amplitudes, rotation) + `tests/unit/living-rhythm.test.ts` (déterministe, bornes, deux identifiants différents → rythmes différents)
- [x] T005 [P] Pur : `src/renderer/src/canvas/layout/alternateLayout.ts` extrait de `structureGraph.ts` (boîtes par sous-arbre, niveau pair → enfants en colonne, impair → en ligne, poussée, option `transposed`, nœuds repliés traités comme feuilles) + `tests/unit/alternate-layout.test.ts` (aucun chevauchement sur arbres aléatoires à graine fixe, transposition, repli qui resserre)
- [x] T006 `src/renderer/src/canvas/structureGraph.ts` utilise `alternateLayout` sans changement de positions (tests existants de structure inchangés et verts)
- [x] T007 [P] Pur : `src/renderer/src/canvas/living/nodeVisual.ts` (`nodeVisuals(tree)` : profondeur, branche 1–10 transmise depuis l'enfant direct de la racine, taille par profondeur, clé d'icône, statut livré / en cours / à faire) + `tests/unit/node-visual.test.ts`
- [x] T008 [P] `src/renderer/src/canvas/living/icons.ts` : `NODE_ICONS` (étape, sous-idée, document, action finale, livrable, module, composant, donnée, tâche, famille, skill perso / projet / plugin, projet, Toi, trombone) en imports nommés de `lucide-react`, `aria-hidden`
- [x] T009 `src/renderer/src/canvas/living/LivingNode.tsx` : couche flottante (variables de `rhythm`), orbe (dégradé, disque, anneau, onde si éclose, pointillés si brute) ou cercle (taille, couleur de branche, pictogramme, rang, pastille de statut, trombone, ▸ N / ▾ en `button` accessible), titre dessous ; styles dans `src/renderer/src/canvas/canvas.css` (`drift`, `depth`, pause par `data-drift`, aucune animation en mode réduit) + test renderer/axe
- [x] T010 [P] `src/renderer/src/canvas/useGlide.ts` : `data-glide="on"` 700 ms après un changement de signature de disposition, jamais pendant un glisser, `off` en mode réduit ; règle CSS `.react-flow__node` correspondante + test
- [x] T011 [P] `src/renderer/src/canvas/useSmoothZoom.ts` (R9) : cible de zoom autour du pointeur, boucle d'amorti 0,14, bornes 0,2–2, boutons par `zoomTo` / `fitBounds` avec durée, instantané en mode réduit + `tests/unit/smooth-zoom.test.ts` (convergence, bornes, point sous la souris fixe)
- [x] T012 [P] `src/renderer/src/canvas/cards/cardsStore.ts` (data-model `OpenCard`) : `openCard`, `closeCard`, `activate`, `moveCard`, `toggleSheet`, `setSide('chat'|'reader'|null)`, `closeAll` ; compatibilité `openChat(id)` / `closeChat` ; + `tests/unit/cards-store.test.ts` (pas de doublon, discussion et lecteur exclusifs, carte active après fermeture)
- [x] T013 Test guidé du lot 0 (quickstart, thème Carbone visible dans Réglages, carte de structure inchangée) — attendre le retour de mentalyas

## Phase 3 — US1 Carte des idées (P1) 🎯 MVP
**Test indépendant** : `npm run seed:demo` : orbes et cercles colorés qui flottent, plan en sens alterné, plusieurs cartes déplaçables et zoomées, fiche / discussion / lecteur par étirement, repli mémorisé, « Réorganiser », zoom amorti ; inventaire §1–§5 vérifié.
- [x] T014 [US1] Amendement daté de la spec 008 (`specs/008-*/spec.md`) : le clic ouvre la carte de détails, le double-clic la discussion (renvoi à la spec 022 D5, D10, D15)
- [x] T015 [US1] `src/renderer/src/canvas/planLayout.ts` utilise `alternateLayout` (étapes, sous-étapes) en gardant décalages glissés (spec 011 D7) et annexes (spec 012 D4) ; option transposée ; + tests (décalage déplace la branche, annexe sous son nœud, aucun chevauchement)
- [x] T016 [P] [US1] *(2026-10-09 : colonne dédiée `plan_folded` (défaut faux) plutôt que réutiliser `collapsed` (défaut vrai, qui aurait obligé à réécrire les données) ; research R11 amendée)* Migration `0037_plan_fold` + `migrations/down/0037_plan_fold.down.sql` ; aller-retour testé
- [x] T017 [US1] IPC `plan:setCollapsed` (Zod `{ neuronId, collapsed }`, étape ou genesis sinon `NOT_FOUND`) : gestionnaire, canal dans `channels.ts`, câblage, vue `collapsed` exposée dans `canvas:get` ; + tests des canaux
- [x] T018 [US1] `src/renderer/src/canvas/buildGraph.ts` : nœuds masqués par un repli rentrent dans leur ancêtre (`shownAs`), liens libres raccrochés, visuels `nodeVisuals` passés aux nœuds ; + tests
- [x] T019 [P] [US1] `src/renderer/src/canvas/nodes/NeuronNode.tsx` en orbe via `LivingNode` (taille selon maturité, catégorie en anneau fin, nature ✦ et badge « par Claude » gardés, poignée de lien gardée) + test renderer/axe
- [x] T020 [P] [US1] `src/renderer/src/canvas/nodes/PlanNode.tsx` : étape et fantôme en cercles via `LivingNode` (rang, statut, poignée vers widget gardée, ✓ / ✗ du fantôme gardés sur le nœud) ; `PlanBarNode` inchangé + test renderer/axe
- [x] T021 [P] [US1] `DocumentNode.tsx` et `DeliverableNode.tsx` en cercles (document, livrable + trombone), glisser gardé + tests
- [x] T022 [P] [US1] Pur : `src/renderer/src/canvas/cards/cardContent.ts` (rubriques par sorte de nœud : badge, date, résumé, jauge + libellé, liés, fichiers, actions — y compris Exécuter, Arrêter, Accepter, Refuser, Lire, ✓ / ✗, Montrer dans l'Explorateur, « ⋯ » menu) + tests (une rubrique sans donnée est absente)
- [x] T023 [US1] `src/renderer/src/canvas/cards/DetailCard.tsx` dans le `ViewportPortal` (R1) : à droite du nœud, en-tête déplaçable avec poignée (décalage en unités de la carte), double-clic recolle, fil en pointillés si déplacée, ✕, carte active au premier plan, classes `nodrag nopan nowheel`, éclat argenté en thème Carbone, Échap sur la carte active, focus et annonce aux lecteurs d'écran + test renderer/axe
- [x] T024 [US1] Étirements de la carte : fiche vers le bas (fiche du neurone), discussion vers la droite (`ChatPanel` tel quel), lecteur vers la droite `src/renderer/src/canvas/cards/CardReader.tsx` (`FileViewer` pour les livrables, Markdown pour les documents), exclusivité discussion / lecteur, la vue glisse pour garder la carte visible + tests
- [x] T025 [US1] `src/renderer/src/canvas/IdeasCanvas.tsx` : clic = carte (plusieurs), double-clic = carte sur la discussion, Entrée = carte + focus, clic dans le vide ne ferme rien, plus de volet (`ChatPanel`, `GhostPanel`, `FinalPanel`, `FileViewer` passent dans les cartes), menu d'idée inchangé, `useGlide`, `useSmoothZoom`, flottaison de tous les nœuds (`driftActive` étendu, pause si une carte est ouverte) ; tous les autres gestes de l'inventaire §1 inchangés
- [x] T026 [US1] Repli : ▸ N / ▾ sur le nœud et « Masquer / Afficher les sous-étapes (N) » dans la carte → `plan:setCollapsed`, glissement, carte d'un descendant masqué refermée + tests
- [x] T027 [US1] `src/renderer/src/canvas/CanvasToolbar.tsx` : bouton « Réorganiser » (D22 : plan transposé, glissement) ; compteurs, filtres, recherche, « Reprendre un projet existant », « + Bloc », « Recentrer » inchangés ; « Fermer les cartes » dans l'en-tête quand une carte est ouverte + tests
- [x] T028 [US1] Canevas sobre (points discrets, bords assombris) et liens d'arbre à la couleur de branche (`BranchEdge.tsx`), sans lueur ; style Carbone de la carte, des boutons et de la barre
- [x] T029 [US1] Données de démonstration `scripts/seed-demo*` : un genesis éclos avec un plan profond (3 niveaux), un livrable avec fichiers, un document (fictif) ; `npm run seed:demo:reset` vérifié
- [x] T030 [US1] Vérification D23 : parcourir `inventory.md` §1–§5 dans l'app et cocher chaque ligne (noter tout écart dans `docs/JOURNAL.md` et le corriger) ; suite complète verte
- [x] T031 [US1] Test guidé US1 (quickstart US1) — attendre le retour de mentalyas

## Phase 4 — US2 Arbre de skills (P2)
**Test indépendant** : éventail conservé, cercles colorés par branche, carte d'un skill (Fiche, SKILL.md, Fichiers, Conversation, gestes), bibliothèque dépliée fluide ; inventaire §6.
- [ ] T032 [US2] Amendement daté de la spec 020 : clic = carte de détails, volet du skill remplacé par les étirements (gestes inchangés)
- [ ] T033 [P] [US2] `src/renderer/src/skills/SkillNodes.tsx` : skills, branches, brouillons, fantômes et skills disponibles via `LivingNode` (couleur de branche, étoiles et usage dans le nom accessible et la carte, verdict) ; `skillTree.ts` inchangé + tests
- [ ] T034 [US2] `src/renderer/src/skills/SkillsPage.tsx` : cartes de détails (store partagé), Fiche complète (`SkillCardSheet`) vers le bas, SKILL.md et Fichiers dans le lecteur, Conversation à droite, gestes Dupliquer / Revenir / Supprimer avec leurs confirmations, brouillon Installer / Jeter, bibliothèque Installer… / Supprimer une copie ; filtres et « Analyser les skills » inchangés ; zoom amorti, « Réorganiser » (éventail tourné) + tests renderer/axe
- [ ] T035 [US2] Mesure SC-003 : bibliothèque dépliée (~300 nœuds) fluide au déplacement et au zoom ; vérification D23 de `inventory.md` §6 ; test guidé — attendre le retour

## Phase 5 — US3 Carte de structure (P3)
**Test indépendant** : éléments en cercles, Progression / Architecture glisse, ▸ N inchangé, carte avec fichiers liés dans le lecteur.
- [ ] T036 [US3] Amendement daté de la spec 017 : clic sur un élément = carte de détails
- [ ] T037 [US3] `src/renderer/src/canvas/nodes/ElementNode.tsx` via `LivingNode` (type → icône, numéro de progression, statut, ▸ N avec `element:setCollapsed` inchangé, focus des liens au survol gardé) ; carte : résumé, couche, chemins, fichiers liés dans le lecteur (`CodeLines`) ; `StructureBarNode` et `LayerBandNode` inchangés + tests
- [ ] T038 [US3] Vérification D23 (éléments, barre de structure) ; test guidé — attendre le retour

## Phase 6 — US4 Blocs du canevas (P4)
**Test indépendant** : widgets, notes, cadres, résultats flottent ; glisser précis ; carte avec leurs actions.
- [ ] T039 [US4] `WidgetNode.tsx`, `ResultNode.tsx`, `BlockNode.tsx`, `LabelNode.tsx`, `MapNoteNode.tsx`, `FrameNode.tsx` : couche flottante (arrêtée au glisser), carte de détails avec leurs actions actuelles (relancer, version, voir le code, entrées, modifier, supprimer), cadres et tailles inchangés + tests
- [ ] T040 [US4] Vérification D23 (blocs) ; test guidé — attendre le retour

## Phase 7 — US5 Main et agents (P5)
**Test indépendant** : trois discussions sur un dépôt jetable : ★ Main puis deux ⑂ agents avec leur branche ; messages en parallèle ; un fichier d'agent seulement sur sa branche ; Garder fusionne après aperçu, Jeter supprime.
- [ ] T041 [US5] **Amendement constitution 4.6.0** (R6) rédigé, présenté et **validé par mentalyas** avant toute autre tâche US5 : `.specify/memory/constitution.md` (principe II, Sync Impact Report, version)
- [ ] T042 [US5] Migration `0038_agent_sessions` (data-model) + down écrit à la main + `AgentSessionRepository` + tests d'intégration (transitions autorisées seulement)
- [ ] T043 [US5] `src/main/application/agents/AgentService.ts` : rôle (Main si aucun actif), branche `agent/<id8>-<slug>` (`branchName.ts`), worktree sous `<dépôt>/.brainstormer/agents/` vérifié par inclusion, jonction `node_modules`, conversation lancée dans le worktree (dossier résolu par le main), garder (aperçu commits + diff, fusion sans forçage, conflit → rien fusionné), jeter, fin sans décision ; neurone sans dépôt = agent sans branche + tests git réel sur dépôt temporaire
- [ ] T044 [US5] IPC `agent:open|list|keep|discard|end` (Zod) + câblage + tests des canaux
- [ ] T045 [US5] Interface : étiquette et note de rôle dans la discussion, anneau de rôle autour du nœud, anneau d'activité pendant une réponse, `src/renderer/src/app/HeaderCrew.tsx` (« ★ Main · titre », « ⑂ N agents », branches au survol), Garder / Jeter dans la carte d'un agent avec aperçu + tests renderer/axe
- [ ] T046 [US5] Mesure SC-007 (3 discussions, 0 fichier d'agent sur la branche principale avant fusion) ; test guidé — attendre le retour

## Phase 8 — Finitions
- [ ] T047 [P] `docs/FOUNDATION.md`, `CLAUDE.md` (workflows actifs, thème Carbone, cartes multiples, agents), `README.md` si besoin
- [ ] T048 [P] `docs/JOURNAL.md` à chaque lot (quoi, pourquoi, erreurs corrigées, règles apprises)
- [ ] T049 Vérifications avant chaque commit : `npm run typecheck`, `npm run lint`, `npx prettier --check src tests`, `npm test` ; commits atomiques **après confirmation de mentalyas**

## Dépendances
- Phase 1 → Phase 2 → US1 (MVP). US2, US3, US4 dépendent des fondations et du store / `DetailCard` d'US1 (T023–T024) ; elles sont indépendantes entre elles. US5 dépend d'US1 (cartes, discussions multiples) et de T041.
- Dans US1 : T015–T018 (disposition, repli) avant T026 ; T022–T024 avant T025.

## Parallélisme
- Phase 2 : T004, T005, T007, T008, T010, T011, T012 en parallèle (fichiers distincts) ; T006 après T005 ; T009 après T004, T007, T008.
- US1 : T016, T019, T020, T021, T022 en parallèle ; puis T023 → T024 → T025.

## Stratégie
MVP = Phases 1–3 (fondations + carte des idées), test guidé à la fin du lot 0 et d'US1. Ensuite une carte par lot
(US2, US3, US4), puis US5 après l'amendement. Rien n'est retiré : `inventory.md` fait foi à chaque lot.
