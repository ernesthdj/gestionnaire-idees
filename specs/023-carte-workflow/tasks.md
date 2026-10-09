# Tasks: Carte Workflow (spec 023)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>` ; purs dans `tests/unit/`,
intégration sur dossier temporaire hostile dans `tests/integration/workflow/`, interface renderer + axe
(`expectNoAxeViolations`). **Tous les tests existants restent verts à chaque lot** (Progression et Architecture
inchangées, spec 022 D23).
**Règle** : l'app n'écrit jamais dans les fichiers du projet lié (FR-010) ; un test guidé à la fin de chaque lot, puis
attendre le retour de mentalyas.

## Phase 1 — Mise en place
- [x] T001 Extraire la lecture gardée d'`ElementFilesService.file` dans `src/main/infrastructure/files/projectFiles.ts` (`readProjectText(root, relPath, { maxBytes })` : realpath de la racine et de la cible, inclusion stricte, refus des liens sortants, fichier sensible refusé par `classifyFile`, taille bornée, `\0` = binaire, erreurs `AppError` NOT_FOUND / SECRET_FILE / TOO_LARGE / INVALID_STATE) ; `src/main/application/reprise/ElementFilesService.ts` l'utilise sans changement de comportement (tests 017 existants verts)
- [x] T002 [P] Déplacer le schéma `ProjectFile` de `src/main/ipc/structureHandlers.ts` vers `src/shared/ipc/projectFile.ts` (réutilisé par `workflow:file`) ; déplacer `covers` / `normalizeElementPath` et la règle du chemin le plus précis de `src/main/domain/reprise/measured.ts` vers `src/shared/structure/covers.ts` (réexport côté main, tests existants verts) + `tests/unit/covers.test.ts`
- [x] T003 [P] Types partagés `src/shared/ipc/workflow.ts` (`WorkflowView`, `SpecView`, `StoryView`, `TaskView`, `BrainstormDocView`, `SpecStatus`, `SpecMarker`, `WorkflowFileView`) d'après `data-model.md`, et canaux `workflow:read`, `workflow:file`, `workflow:setFolded` dans `src/shared/ipc/channels.ts`

## Phase 2 — Fondations (bloquant)
- [x] T004 [P] Bornes `src/main/domain/workflow/limits.ts` (fichier ≤ 512 Ko, ≤ 200 specs, ≤ 1 000 tâches par spec, ≤ 300 documents, ≤ 20 chemins par tâche, texte de tâche ≤ 500, ligne de statut ≤ 200, résumé de fondation ≤ 600)
- [x] T005 [P] Pur `src/main/domain/workflow/parseSpec.ts` (R2 : titre sans « Feature Specification: », ligne `**Status**` et marqueur livrée / en pause / abandonnée sans casse ni accents, `Created`, nombre de lignes `| D<n>`, user stories aux formats « — », « - », « (Priority: PN) », « (PN) », suffixes retirés, documents `L*.md` cités, `partial`) + `tests/unit/workflow-parse-spec.test.ts` sur des extraits réels des specs 001, 009, 017, 022 et des cas mal formés
- [x] T006 [P] Pur `src/main/domain/workflow/parseTasks.ts` (R2 : `- [ ]` / `- [x]` / `- [X]`, `T\d{3,4}`, `[P]` ignoré, `[USn]`, description sans étiquettes, chemins cités entre backticks ou après « in » / « dans », relatifs seulement, sans `..`, dédoublonnés, ≤ 20) + `tests/unit/workflow-parse-tasks.test.ts` (extraits réels de 017 et 022, absolu et `..` rejetés, tâche sans US)
- [x] T007 [P] Pur `src/main/domain/workflow/specStatus.ts` (transitions de `data-model.md` : marqueur prioritaire, reliquats d'une spec livrée ou abandonnée, spécifiée sans `tasks.md`, planifiée, en cours, livrée ; US livrée = total > 0 et tout coché ; Socle ; US citée par des tâches mais absente de `spec.md` → `described: false`) + `tests/unit/workflow-status.test.ts`
- [x] T008 [P] Pur `src/main/domain/workflow/brainstorm.ts` (D11 : niveau depuis `L<n>`, titre, famille = L1 qui partage un mot avec le nom du document, L1 couvert = cité par au moins une `spec.md`, `L1-fondation.md` jamais « à brainstormer ») + `tests/unit/workflow-brainstorm.test.ts` (noms réels : `L2-skills-voir` → `L1h-arbre-de-skills`, `L2-capture-rapide` → aucune famille)
- [x] T009 `src/main/application/workflow/WorkflowService.ts` : `read(genesisId)` (genesis avec `projectDir`, sinon FOLDER_MISSING ; `readdir` non récursif de `specs/` et `docs/brainstorm/`, chaque fichier par `readProjectText`, fichier ignoré au-delà des bornes avec `partial`, résumé de `docs/FOUNDATION.md`, `empty`, `readAt`, repli de T010) et `file(genesisId, path)` (chemin cité par une tâche du projet ou fichier de méthode, sinon NOT_FOUND ; `lang` via `langOf`) ; aucune écriture
- [x] T010 [P] `src/main/infrastructure/db/repositories/WorkflowFoldRepository.ts` : lecture / écriture de `workflow.folded.<genesisId>` dans la table `settings` (JSON validé par Zod, ≤ 500 clés, clé R7), ignorée si le genesis n'existe plus
- [x] T011 `src/main/ipc/workflowHandlers.ts` (`workflow:read`, `workflow:file`, `workflow:setFolded`, entrées Zod de `contracts/interfaces.md`) + branchement dans `src/main/bootstrap.ts` (le preload relaie tout canal de la liste blanche : rien à y ajouter)
- [x] T012 Intégration `tests/integration/workflow/workflow-service.test.ts` sur dossier temporaire : specs valides (statuts, compteurs exacts), spec marquée « Livrée » avec cases restantes, projet vide, et fichiers hostiles (HTML et instructions rendus en texte brut, `..`, lien symbolique sortant, fichier de 2 Mo, binaire, `.env` cité) : ignorés ou refusés, vue jamais bloquée ; `workflow:file` refuse un chemin non cité
- [x] T013 Test guidé du lot 0 : lecture du dépôt du Brainstormer par `workflow:read` (compteurs comparés à `tasks.md` de 017 et 022) — attendre le retour de mentalyas

## Phase 3 — US1 Voir où en est le projet (P1) 🎯 MVP
**Test indépendant** : un genesis lié à un dossier de deux specs (une à moitié faite, une sans case cochée) montre en
Workflow la bonne répartition, les bons compteurs et seulement les tâches restantes ; Progression puis retour ne perd rien.
- [x] T014 [P] [US1] `CanvasNeuronView.linkedProject?: boolean` dans `src/shared/ipc/canvas.ts`, renseigné dans `src/main/application/canvas/CanvasService.ts` pour un genesis avec `projectDir` + test du service
- [x] T015 [P] [US1] Pur `src/renderer/src/canvas/workflow/workflowTree.ts` : `WorkflowView` → arbre à clés R7 (genesis › branches En cours / À venir / Livrées / À brainstormer, spec › US › tâches restantes, Socle, nœud « US9 (user story non décrite) »), compteurs, repli par défaut (Livrées, US livrées, Socle repliés) corrigé par `folded`, specs dans l'ordre du numéro + `tests/unit/workflow-tree.test.ts`
- [x] T016 [P] [US1] Pictogrammes `src/renderer/src/canvas/living/icons.ts` : branche en cours, à venir, livrées, à brainstormer, spec, user story, tâche, socle, document de brainstorm (imports nommés `lucide-react`, `aria-hidden`)
- [x] T017 [US1] Pur `src/renderer/src/canvas/workflow/workflowGraph.ts` : arbre → nœuds (type `workflow`) et liens `branch` via `alternateLayout` et `nodeVisuals` (couleur par branche, taille par niveau, statut en pastille, nœuds repliés cachés, option `transposed`) + `tests/unit/workflow-graph.test.ts` (aucun chevauchement, repli qui resserre)
- [x] T018 [US1] `src/renderer/src/canvas/workflow/WorkflowNode.tsx` (via `LivingNode` : pictogramme, titre, jauge « done/total », pastille de statut, « ▸ N » relié à `workflow:setFolded`, nom accessible « Spec 022 Nœuds vivants, en cours, 33 sur 49 ») enveloppé par `stillNode`, enregistré dans `NODE_TYPES` de `src/renderer/src/canvas/IdeasCanvas.tsx`
- [x] T019 [US1] `StructureView` + `'workflow'` dans `src/renderer/src/app/uiStore.ts` ; `src/renderer/src/canvas/nodes/StructureBarNode.tsx` à trois segments « Workflow | Progression | Architecture », barre présente pour tout genesis `linkedProject` (Progression et Architecture désactivées sans carte dessinée), bouton « Relire » en vue Workflow ; `buildGraph.ts` place la barre aussi sans éléments
- [x] T020 [US1] `src/renderer/src/canvas/workflow/useWorkflow.ts` : `useQuery(['workflow', genesisId])` actif seulement pour les genesis en vue Workflow, invalidé sur `chat:turnEnd` et « Relire » ; `src/renderer/src/canvas/buildGraph.ts` reçoit `workflows` et remplace les éléments d'un genesis en vue Workflow par `workflowGraph` ; signature de glissement (`glideSignature`) étendue aux clés Workflow dans `IdeasCanvas.tsx`
- [x] T021 [US1] États particuliers : projet vide (nœud-message sous le genesis : « Brainstorme une idée, puis spécifie-la : la carte se remplira »), dossier absent (FOLDER_MISSING → message et action « Relier le dossier » existante), spec `partial` (mention « lecture partielle ») dans `WorkflowNode.tsx`
- [x] T022 [US1] Tests renderer + axe `tests/unit/renderer/workflow-view.test.tsx` : bascule à trois positions, répartition et compteurs, US livrée repliée, retour en Progression identique (nœuds et barre), projet vide, accessibilité
- [x] T023 [US1] Test guidé US1 (quickstart scénarios 1 à 3) sur le dépôt du Brainstormer lié à un genesis — attendre le retour de mentalyas

## Phase 4 — US2 Lancer Claude depuis la carte (P2)
**Test indépendant** : « Discuter » sur une tâche ouvre la conversation du projet avec la consigne pré-remplie (rien
n'est envoyé) ; une case cochée dans `tasks.md` puis un tour de Claude terminé mettent la carte à jour.
- [x] T024 [P] [US2] Pur `src/renderer/src/canvas/workflow/prompts.ts` (consignes de `contracts/interfaces.md` : tâche, user story avec ses identifiants restants dans l'ordre, document de brainstorm) + `tests/unit/workflow-prompts.test.ts`
- [x] T025 [P] [US2] `chatDrafts` + `seedChatDraft(neuronId, text)` dans `src/renderer/src/app/uiStore.ts` ; `src/renderer/src/chat/ChatPanel.tsx` reprend la consigne dans son champ au montage ou à son changement puis l'efface du magasin, sans envoyer + test renderer
- [x] T026 [US2] `src/renderer/src/canvas/workflow/WorkflowCard.tsx` pour tâche (identifiant, description, US, spec, fichiers cités), user story (priorité, tâches restantes, faites en compteur) et document L1 (titre, niveau, fichiers L2–L4 de sa famille) ; sujet `workflow` dans `src/renderer/src/canvas/cards/IdeaCards.tsx` et `cardContent.ts`
- [x] T027 [US2] « Discuter » dans la carte et double-clic sur le nœud : ouvre la carte du genesis côté discussion (`openChat(genesisId)`) avec `seedChatDraft` de la consigne ; dans `IdeasCanvas.tsx` (gestes clic / double-clic / Entrée pour les nœuds `workflow`)
- [x] T028 [US2] Tests renderer + axe `tests/unit/renderer/workflow-card.test.tsx` : carte de tâche, d'US, de L1 ; « Discuter » pré-remplit sans envoyer ; relecture sur `chat:turnEnd` retire une tâche cochée et fait avancer la jauge
- [x] T029 [US2] Test guidé US2 (quickstart scénario 4) : mentalyas envoie la consigne, Claude coche une case, la carte suit — attendre le retour

## Phase 5 — US3 Présenter le projet (P3)
**Test indépendant** : chaque spec livrée a une carte lisible (titre, intention, US, documents d'origine) sans ouvrir
de fichier.
- [x] T030 [US3] Carte du genesis en vue Workflow dans `WorkflowCard.tsx` : résumé de la fondation, « Lire » ouvre `docs/FOUNDATION.md` dans le lecteur (`workflow:file`, texte brut via le lecteur de document existant), documents de brainstorm sans famille
- [x] T031 [US3] Carte d'une spec : titre, statut et jauge, date de création, nombre de décisions, US (priorité, titre, livrée ou non), reliquats d'une spec livrée, documents de brainstorm cités ouvrables dans le lecteur, `spec.md` / `tasks.md` / `plan.md` ouvrables ; cartes des branches (nombre de specs, liste)
- [x] T032 [US3] Tests renderer + axe `tests/unit/renderer/workflow-present.test.tsx` (carte de genesis, de spec livrée avec reliquats, ordre des Livrées)
- [x] T033 [US3] Test guidé US3 (quickstart scénario 5) — attendre le retour

## Phase 6 — US4 Passer d'une tâche au code (P4)
**Test indépendant** : une tâche citant un fichier couvert par un élément mène à cet élément ; un fichier non couvert
est listé sans bouton.
- [x] T034 [US4] Rubrique « Fichiers » de `WorkflowCard.tsx` (tâche ; union pour US et spec) : fichier existant ouvrable dans le lecteur de la carte (`workflow:file`, `CodeLines`), inexistant ou refusé grisé
- [x] T035 [US4] « Voir dans la structure » : élément couvrant du même genesis par `src/shared/structure/covers.ts` (chemin le plus précis), `setStructureView(genesisId, 'progression')`, carte de l'élément ouverte et vue centrée (focus existant) ; bouton absent sans élément couvrant
- [x] T036 [US4] Tests renderer + axe `tests/unit/renderer/workflow-bridge.test.tsx` (fichier couvert → bascule et carte d'élément ouverte, non couvert sans bouton, inexistant grisé)
- [ ] T037 [US4] Test guidé US4 (quickstart scénario 6) — attendre le retour

## Phase 7 — Finitions
- [ ] T038 Proposer à mentalyas la liste des specs du dépôt à marquer « Livrée » (ou « Abandonnée », « En pause » : 013, 014, 015) avec leurs reliquats ; **après son accord seulement**, écrire leur ligne `**Status**` dans `specs/0NN-*/spec.md`
- [ ] T039 [P] Démo : `src/main/infrastructure/db/demo/seedDemo.ts` crée un petit dossier de méthode fictif dans le profil démo (deux specs, un L1 à brainstormer, une fondation) lié à un genesis ; mise à jour de la ligne `seed:demo` de `CLAUDE.md`
- [ ] T040 [P] Mesure SC-002 sur le dépôt du Brainstormer (temps de `workflow:read` et d'affichage, < 2 s) notée dans `docs/JOURNAL.md`
- [ ] T041 [P] Amendement daté de `specs/017-reprise-voir/spec.md` (bascule à trois positions, Workflow) ; `docs/FOUNDATION.md` (vue Workflow) ; `CLAUDE.md` (Workflows actifs : spec 023)
- [ ] T042 Vérifications finales (`npm run typecheck`, `npm run lint`, `npx prettier --check src tests`, `npm test`) et quickstart scénarios 7 et 8 ; JOURNAL à jour ; demander la confirmation avant commit

## Dépendances
- Phase 1 → Phase 2 → US1 (bloquant pour US2 à US4 : arbre, nœuds, bascule).
- US2, US3, US4 dépendent d'US1 et sont indépendantes entre elles (même fichier `WorkflowCard.tsx` : à enchaîner, pas
  en parallèle).
- Finitions après les user stories ; T038 n'écrit rien sans l'accord de mentalyas.

## Parallélisme
- Phase 1 : T002 et T003 en parallèle (après T001 pour T002 si `projectFiles` est touché, sinon libres).
- Phase 2 : T004 à T008 en parallèle (fichiers purs distincts) ; T010 en parallèle de T009.
- US1 : T014, T015, T016 en parallèle ; puis T017 → T018 → T019 → T020 → T021 → T022.
- US2 : T024 et T025 en parallèle, puis T026 → T027 → T028.
- Finitions : T039, T040, T041 en parallèle.

## Stratégie
- **MVP = Phases 1–3 (US1)** : la vue Workflow seule sert déjà à piloter ; test guidé avant d'aller plus loin.
- Puis US2 (agir), US3 (présenter), US4 (pont), chacune livrable et testée seule.
- Chaque lot : tests, typecheck, lint et prettier verts, JOURNAL, test guidé, puis commit après confirmation.
