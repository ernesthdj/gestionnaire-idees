# Implementation Plan: Actions finales (spec 013)

**Branch**: `013-actions-finales` (travail sur `main`) · **Date**: 2026-10-05 · **Spec**: [spec.md](spec.md)

## Summary
Une étape feuille devient **action finale** sur proposition de Claude (`action_proposer`) acceptée par mentalyas.
« Exécuter » ouvre une **exécution** : un tour de la conversation de l'action, précédé d'un dossier d'exécution (chemin
du genesis, dépendances, documents, livrable annoncé). Pendant ce tour seulement, Claude écrit dans le dossier du
projet lié par deux outils MCP de l'app (`fichier_ecrire`, `fichier_modifier`) qui contrôlent chaque chemin, gardent
le contenu d'avant, tracent et historisent. Le **livrable** cumulé s'annexe à l'action : différences, Accepter,
Corriger, Revenir en arrière. Claude n'a toujours ni `Write`, ni `Edit`, ni `Bash`.
Détail : [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

## Technical Context
**Language/Version**: TypeScript strict (Electron main, React 19 renderer)
**Primary Dependencies**: existantes — Zod, Drizzle, MCP SDK, React Flow ; **aucune nouvelle** (diff maison, R6)
**Storage**: SQLite chiffré (`final_actions`, `executions`, `execution_events`, `deliverable_files`), migration `0025`
(+ down) ; fichiers du projet lié écrits en place
**Testing**: Vitest — chemins hostiles (pur), écriture sur dossier temporaire avec lien symbolique/jonction sortants,
service d'exécution avec conversation simulée, outils MCP, IPC, disposition, nœuds + axe
**Target Platform**: Windows
**Project Type**: desktop app
**Performance Goals**: différence d'un fichier de 1 Mo affichée sans gel perceptible ; livrable visible < 1 s après la
fin du tour
**Constraints**: aucune écriture hors du `realpath` du projet ; aucune commande ; aucune suppression définitive ;
1 Mo / fichier, 40 fichiers / passe, 15 min / passe ; une exécution par genesis
**Scale/Scope**: quelques actions par plan, quelques dizaines de fichiers par livrable

## Constitution Check
| Principe | Respect |
|---|---|
| I Sécurité | Confinement appliqué par le main (R1–R2) : chemins relatifs, liste noire, `realpath` sous le projet, liens sortants refusés, écriture atomique, bornes ; pas de `Bash` ni `Write`/`Edit` du CLI ; Zod sur MCP et IPC ; aucun contenu de fichier dans les logs ni dans la trace ; arguments du CLI inchangés. ✅ |
| II Humain dans la boucle | Proposition d'action = acceptation explicite ; écritures MCP directes, « par Claude », une opération d'Historique par appel, annulables ; revue obligatoire avant « fait » ; corbeille, jamais d'effacement. ✅ |
| III IA cadrée | Dossier d'exécution transmis comme donnée délimitée ; consignes figées (`EXECUTE_MESSAGE`) ; refus motivés des outils. ✅ |
| IV Local d'abord | Tout local ; Claude par le CLI officiel. ✅ |
| V Tests | Chemins hostiles, états, bornes, cumul, retour arrière, conflits testés sans service externe. ✅ |
| VI Simplicité | Réutilise conversation (8), plan (11), annexes et Historique externe (12) ; diff maison de ~80 lignes. ✅ |

**Écart à signaler** : c'est la première fois que Claude **écrit des fichiers hors des documents** ; l'écart est
couvert par la décision D2 de mentalyas et par le confinement côté app. Une ligne sera ajoutée à la constitution
(principe I, puce « écriture dans le projet lié ») — version 3.1.0, à valider.

## Project Structure
```
src/shared/diff/lineDiff.ts                 diff ligne à ligne (Myers), pur
src/shared/ipc/finals.ts                    vues et schémas (StepView.final, DeliverableView…)
src/shared/mcp/tools.ts                     action_proposer, fichier_ecrire, fichier_modifier
src/main/domain/finals/projectPath.ts       contrôle pur des chemins (R2), liste noire
src/main/domain/finals/state.ts             transitions d'état
src/main/infrastructure/finals/ProjectFiles.ts   realpath, écriture atomique, lecture texte, corbeille
src/main/infrastructure/db/                 schéma + FinalRepository + migration 0025 (+ down)
src/main/application/finals/FinalService.ts     proposer, décider, rétrograder, livrable, accepter, revenir
src/main/application/finals/ExecutionService.ts exécuter, corriger, arrêter, fin de tour, bornes, reprise au démarrage
src/main/application/finals/executionBrief.ts   dossier d'exécution (R5)
src/main/application/mcp/FinalTools.ts          outils MCP
src/main/application/conversation/              frame (section ACTION FINALE), FINAL/EXECUTE messages, écoute turnEnd
src/main/ipc/finalHandlers.ts
src/renderer/src/canvas/planLayout.ts       annexe livrable
src/renderer/src/canvas/nodes/PlanNode.tsx  variante action, proposition, Exécuter / Arrêter
src/renderer/src/canvas/nodes/DeliverableNode.tsx  fichiers, différences, Accepter / Corriger / Revenir, fil
src/renderer/src/chat/ChatPanel.tsx         bouton « Proposer l'action finale »
```

## Lots
1. **P1 — Socle sûr** : `projectPath` (tests hostiles), `ProjectFiles` (jonction/lien sortant), migration, dépôt,
   diff. Aucun effet visible.
2. **P2 — US1** : `action_proposer`, `final:decide/demote`, variante de carte, bouton du chat. Test guidé.
3. **P3 — US2** : exécution (dossier, droits limités au tour, outils `fichier_*`, trace, bornes, arrêt, reprise),
   annexe livrable minimale. Test guidé dont scénario hostile.
4. **P4 — US3** : différences, Accepter, Corriger, Revenir en arrière, « modifié depuis ». Test guidé.
5. **P4 bis — D4** : visionneuse (onglets Différences / Fichier, `highlight.js`), « Ouvrir dans l'éditeur » (réglage,
   liste blanche). Avec US3.
6. **P5 — US4 / D5** : tests du livrable (fichiers de test, chemins sûrs, `test_runs`, Faire corriger, Demander les
   tests). Test guidé.
7. **Finitions** : démo fictive, constitution 3.1.0, FOUNDATION, CLAUDE.md, JOURNAL.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Claude écrit dans le projet (I) | D2 de mentalyas : livrable réel | Documents seulement : ne livre pas de code |
| Tests lancés avec des chemins en arguments (I) | D5 : tests ciblés sur le livrable | Toute la suite : ne cible pas l'action ; chemins limités à une liste sûre (R11) |
| Outils d'écriture maison plutôt que `Edit` du CLI | Confinement, trace et contenu d'avant contrôlés par l'app | `Edit(./**)` : confinement délégué, pas de différence ni de trace |
