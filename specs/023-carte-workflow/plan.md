# Implementation Plan: Carte Workflow (spec 023)

**Branch**: `main` (spec `023-carte-workflow`) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

## Summary

Une troisième position **« Workflow »** dans la bascule des cartes de projet lié (« Workflow | Progression |
Architecture »). Le processus principal **lit en lecture seule** les fichiers de méthode du projet (`specs/*/spec.md`,
`specs/*/tasks.md`, `docs/brainstorm/L*.md`, `docs/FOUNDATION.md`), les **analyse en fonctions pures** (specs, user
stories, tâches, statuts, chemins cités, familles de brainstorm) et renvoie une vue typée ; l'interface la dessine sous
le genesis avec la **disposition en sens alterné et les nœuds vivants** de la spec 022 (quatre branches : En cours,
À venir, Livrées, À brainstormer). Chaque nœud ouvre sa **carte de détails** ; « Discuter » ouvre la conversation du
genesis avec une **consigne pré-remplie** (implémenter la tâche, mener l'US, brainstormer le L1). La vue est relue à
l'ouverture, à chaque fin de tour de Claude et sur « Relire ». Aucune écriture dans le projet, aucune dépendance
nouvelle, aucune migration.

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: existantes — Electron, React, React Flow, Tailwind v4, Zod, TanStack Query, zustand,
`lucide-react` (spec 022). **Aucune nouvelle.**
**Storage**: aucune migration. Repli des nœuds Workflow mémorisé par projet dans la table `settings` existante (clé
`workflow.folded.<genesisId>`, liste bornée de clés de nœuds, R6). Choix de la vue (Workflow / Progression /
Architecture) : en mémoire comme aujourd'hui (`uiStore.structureViews`).
**Testing**: Vitest — purs : `parseSpec`, `parseTasks`, `specStatus`, `citedPaths`, `brainstormFamilies`,
`workflowTree` (rangement, repli d'office, Socle, US non décrite), `workflowGraph` (disposition) ; intégration :
`WorkflowService` sur un dossier temporaire (fichiers hostiles : HTML, `..`, lien symbolique, fichier géant, binaire) ;
renderer + axe : bascule à trois positions, carte d'une spec / US / tâche / L1, « Discuter » pré-remplit, « Voir dans
la structure ». Mesure SC-002 sur une copie du dépôt (21 specs, ~750 tâches). **Tous les tests existants restent verts.**
**Target Platform**: Windows 11
**Performance Goals**: vue affichée en < 2 s sur 21 specs / ~750 tâches (lecture ≈ 45 fichiers, < 1 Mo) ; relecture
après un tour de Claude sans à-coup (glissement 450 ms, spec 022 D27).
**Constraints**: lecture seule confinée au dossier lié (realpath + inclusion), Markdown = texte (aucun HTML rendu),
limites de taille et de nombre (R3), fichiers sensibles jamais lus, entrée IPC Zod, jetons du thème, clavier complet,
animations réduites respectées.
**Scale/Scope**: ~6 fichiers main/shared nouveaux, ~6 renderer nouveaux, ~8 modifiés.

## Constitution Check (4.5.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Aucun programme lancé ; lecture par le main seulement, chemin résolu sous `projectDir` (realpath, refus `..`, absolu, lien sortant), fichiers sensibles refusés (`classifyFile`), taille et nombre bornés ; entrées IPC (`genesisId`, chemin relatif) validées par Zod ; sorties = texte, rendu sans HTML (`CodeLines` / texte brut) ; rien journalisé du contenu | ✅ |
| II Humain dans la boucle | L'app n'écrit jamais dans le projet ; « Discuter » **pré-remplit** la consigne, mentalyas l'envoie (aucun tour de Claude lancé sans son geste) ; les marqueurs « Livrée » posés sur les specs existantes seulement avec son accord | ✅ |
| III IA cadrée | Aucune tâche d'IA nouvelle ; conversation existante (spec 008), mêmes permissions et réglages isolés | ✅ |
| IV Local d'abord | Rien ne quitte la machine ; aucun appel à Claude pour construire la vue | ✅ |
| V Tests | Analyse pure testée cas par cas (formats réels du dépôt, variantes, fichiers mal formés) ; service testé sur dossier temporaire hostile ; axe sur les cartes | ✅ |
| VI Simplicité | Réutilise `alternateLayout`, `nodeVisuals`, `LivingNode`, `DetailCard`, lecteur, repli, glissement (022), bascule (017), garde de lecture extraite d'`ElementFilesService` (partagée, DRY), table `settings` ; pas de migration ni de surveillance de fichiers (relecture sur événements, R5) | ✅ |

## Project Structure

```text
src/main/domain/workflow/parseSpec.ts          titre, ligne Status (marqueur), date, décisions, user stories (pur)
src/main/domain/workflow/parseTasks.ts         tâches T0NN : case, [USn], description, chemins cités (pur)
src/main/domain/workflow/specStatus.ts         statut retenu : marqueur > calcul ; US livrées ; reliquats (pur)
src/main/domain/workflow/brainstorm.ts         documents L1–L4, familles, L1 couverts par une spec (pur)
src/main/domain/workflow/limits.ts             bornes (taille, nombre de specs, de tâches, de chemins)
src/main/infrastructure/files/projectFiles.ts  lecture gardée sous la racine (extraite d'ElementFilesService, partagée)
src/main/application/workflow/WorkflowService.ts  lit le dossier lié, assemble WorkflowView ; lit un fichier cité
src/main/infrastructure/db/repositories/WorkflowFoldRepository.ts  repli par projet (table settings)
src/main/ipc/workflowHandlers.ts               workflow:read, workflow:file, workflow:setFolded (Zod)
src/shared/ipc/workflow.ts                     types WorkflowView, SpecView, StoryView, TaskView, BrainstormDocView
src/shared/ipc/channels.ts                     + 3 canaux
src/shared/ipc/canvas.ts                       CanvasNeuronView.linkedProject?: boolean
src/main/application/canvas/CanvasService.ts   renseigne linkedProject (genesis avec projectDir)
src/main/application/reprise/ElementFilesService.ts  utilise projectFiles (comportement inchangé)
src/renderer/src/canvas/workflow/workflowTree.ts     WorkflowView → arbre (branches, repli d'office, Socle) (pur)
src/renderer/src/canvas/workflow/workflowGraph.ts    arbre → nœuds/liens via alternateLayout + nodeVisuals (pur)
src/renderer/src/canvas/workflow/WorkflowNode.tsx    nœud (LivingNode : pictogramme, jauge, pastille, ▸ N)
src/renderer/src/canvas/workflow/WorkflowCard.tsx    contenu de carte : spec / US / tâche / L1 / branche / genesis
src/renderer/src/canvas/workflow/prompts.ts          consignes de « Discuter » (pur)
src/renderer/src/canvas/workflow/useWorkflow.ts      requête workflow:read + relecture sur chat:turnEnd
src/renderer/src/app/uiStore.ts                StructureView + 'workflow' ; chatDrafts (consigne pré-remplie)
src/renderer/src/chat/ChatPanel.tsx            reprend une consigne pré-remplie (une fois)
src/renderer/src/canvas/nodes/StructureBarNode.tsx   bascule à trois positions ; barre aussi sans carte dessinée
src/renderer/src/canvas/buildGraph.ts          genesis en vue Workflow : workflowGraph au lieu de la structure
src/renderer/src/canvas/cards/IdeaCards.tsx    sujet « workflow » → WorkflowCard
src/renderer/src/canvas/living/icons.ts        pictogrammes spec, US, tâche, socle, brainstorm, branches
```

## Lots (un test guidé à la fin de chacun)

0. **Fondations** : `projectFiles` extrait d'`ElementFilesService` (tests 017 verts), domaine `workflow/*` pur et
   testé sur des extraits réels du dépôt, `WorkflowService` + IPC `workflow:read` (dossier temporaire hostile).
1. **US1 Voir** : `linkedProject`, bascule à trois positions (barre présente même sans carte dessinée), `workflowTree`
   + `workflowGraph`, `WorkflowNode`, branches et repli d'office, repli mémorisé (`workflow:setFolded`), message d'un
   projet vide, mention « lecture partielle », « Relire », relecture sur `chat:turnEnd`, glissements. Test guidé sur le
   dépôt du Brainstormer lui-même (lié à un genesis de démo) et sur le profil démo.
2. **US2 Agir** : `WorkflowCard` (tâche, US, L1), `prompts.ts`, `chatDrafts` + `ChatPanel`, « Discuter » / double-clic.
   Test guidé : Claude coche une case, la carte suit.
3. **US3 Présenter** : carte du genesis (fondation dans le lecteur), carte de spec (intention, décisions comptées, US,
   brainstorm cités ouvrables), Livrées dans l'ordre. Test guidé.
4. **US4 Pont** : « Fichiers » (chemins cités, `workflow:file` dans le lecteur), « Voir dans la structure » (élément
   couvrant, bascule, focus et carte ouverte). Test guidé.
6. **US5 Anatomie d'un fichier** (D14, ajoutée le 2026-10-09) : `exported` et usages JSX dans le processus d'analyse
   (R11, R12 ; tests 017 relus), `anatomy.ts` pur (appels internes, peut-être inutilisés), `WorkflowAnatomy` +
   `workflow:anatomy` (remplace `workflow:symbols`, R10), schéma HTML + SVG en trois colonnes avec arcs (R13), parcours
   de lecture et blocs cités (R14). Aucune dépendance nouvelle, aucune migration. Test guidé sur des fichiers du
   Brainstormer.
5. **Finitions** : marqueurs « Livrée » sur les specs déjà finies du dépôt (**liste soumise à mentalyas d'abord**),
   démo (`seed:demo` : genesis de démo lié à un petit dossier de specs fictif), mesure SC-002, amendement spec 017
   (bascule à trois positions), CLAUDE.md, JOURNAL.

## Conservation (spec 022 D23)

Progression et Architecture : mêmes nœuds, liens, barre (architecture choisie, correction annulable), glissements,
« Liens d'analyse », « Réorganiser », cartes d'éléments ; seule la bascule gagne un segment à gauche. Un genesis sans
projet lié n'a pas de barre (comme aujourd'hui). Les tests de la carte de structure (017, 022 US3) restent verts.

## Complexity Tracking

| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Analyseur Markdown maison (regex par ligne) | Formats Spec Kit connus et bornés ; aucun rendu, seulement de l'extraction | Bibliothèque Markdown : dépendance nouvelle, rend du HTML, inutile ici |
| Consigne pré-remplie (`chatDrafts`) | II : aucun tour de Claude sans geste de mentalyas ; coût de l'abonnement | Envoi automatique : lance Claude sur un simple clic |
| Repli dans `settings` (sans migration) | État d'affichage, clés textuelles hors base de neurones | Table dédiée : migration + down pour une préférence |
