# Implementation Plan: Nœuds vivants (spec 022)

**Branch**: `main` (spec `022-noeuds-vivants`) | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

## Summary

Refonte visuelle et gestuelle des quatre cartes, d'après le prototype validé (artifact « Nœuds vivants » v23) :
genesis en **orbe**, sous-nœuds en **petits cercles** à pictogramme (Lucide), **couleur par grande branche**, **taille
par niveau**, plans en **sens alterné** ; tout **flotte** ; un clic ouvre une **carte de détails** (plusieurs à la fois,
déplaçables, zoomées avec la toile) qui **s'étire** pour la fiche (bas), la discussion ou le lecteur de fichiers
(droite) ; **repli** des sous-nœuds ; **zoom fluide** ; thème **Carbone**. Puis **Main et agents** : une discussion
supplémentaire travaille sur sa propre branche dans un worktree. **Priorité D23 : aucune fonctionnalité retirée**, voir
[inventory.md](inventory.md).

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron, React, React Flow (`ViewportPortal`, `setViewport`), Tailwind v4, `motion` (déjà
présent), Zod, Drizzle ; **nouvelle : `lucide-react`** (ISC, validée D12) ; git par `GitCli` (US5).
**Storage**: migration `0037_plan_fold` (données : repli des étapes et genesis, + down) ; US5 : `0038_agent_sessions`
(+ down).
**Testing**: Vitest — purs : `rhythm`, `nodeVisuals`, `alternateLayout` (aucun chevauchement, transposition, repli,
décalages glissés, annexes), règles du store de cartes, amorti du zoom ; renderer + axe : carte de détails (chaque sorte
de nœud), étirements, repli, plusieurs cartes ; intégration US5 : git réel sur dépôt temporaire (branche, worktree,
garder, jeter, conflit). **Tous les tests existants restent verts** (D23).
**Target Platform**: Windows 11
**Performance Goals**: 300 nœuds (bibliothèque de skills) fluides au déplacement et au zoom (SC-003) ; flottaison en CSS
sur une couche intérieure ; aucune mise à jour React par image hors zoom amorti.
**Constraints**: jetons du thème uniquement ; animations réduites respectées partout ; clavier complet (Entrée, Échap,
Tab dans la carte) ; aucune fonctionnalité retirée.
**Scale/Scope**: ~20 fichiers renderer (dont ~10 nouveaux), ~6 main / shared (US5), 2 migrations.

## Constitution Check (4.5.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Aucun nouveau programme lancé (US1–US4) ; US5 : git par `GitCli` (chemin absolu, arguments fixes), worktree vérifié par inclusion sous le dépôt lié, branche validée par `branchName.ts`, dossier de travail résolu par le main ; IPC Zod ; lecteur en lecture seule, Markdown sans HTML | ✅ |
| II Humain dans la boucle | Repli = préférence d'affichage ; US5 : branche et worktree créés sur le geste d'ouvrir une discussion supplémentaire, fusion seulement sur « Garder » après aperçu, jamais de push ni de réécriture. **Exige l'amendement 4.6.0** (R6) : aujourd'hui seul l'Analyste crée des branches | ⚠️ US5 bloquée jusqu'à l'amendement |
| III IA cadrée | Aucune tâche d'IA nouvelle ; conversations inchangées (même `ChatPanel`, mêmes permissions) | ✅ |
| IV Local d'abord | Rien de nouveau ne quitte la machine | ✅ |
| V Tests | Toute la logique pure testée (disposition, couleurs, rythme, store, zoom) ; git réel sur dépôt jetable ; axe sur les cartes | ✅ |
| VI Simplicité | `alternateLayout` partagé (plans + structure, deux usages) ; réutilise `ChatPanel`, `FileViewer`, `CodeLines`, `driftActive`, colonne `collapsed`, mécanique worktree de l'Analyste ; une seule dépendance (icônes), validée | ✅ |

## Project Structure

```text
src/renderer/src/canvas/living/rhythm.ts          rythme de flottaison (pur)
src/renderer/src/canvas/living/nodeVisual.ts      profondeur, branche, taille, icône, statut (pur)
src/renderer/src/canvas/living/icons.ts           type de nœud → icône Lucide
src/renderer/src/canvas/living/LivingNode.tsx     couche flottante + aspect (orbe / cercle, pastilles, trombone, ▸ N)
src/renderer/src/canvas/layout/alternateLayout.ts disposition en sens alterné (pure), extraite de structureGraph.ts
src/renderer/src/canvas/planLayout.ts             utilise alternateLayout (décalages et annexes conservés)
src/renderer/src/canvas/structureGraph.ts         utilise alternateLayout
src/renderer/src/canvas/cards/cardsStore.ts       cartes ouvertes (remplace chatNeuronId / ghostId / finalId / viewer)
src/renderer/src/canvas/cards/DetailCard.tsx      carte : en-tête déplaçable, jauge, liés, fichiers, actions, étirements
src/renderer/src/canvas/cards/CardReader.tsx      lecteur (FileViewer, CodeLines, Markdown)
src/renderer/src/canvas/cards/cardContent.ts      rubriques par sorte de nœud (pur)
src/renderer/src/canvas/useSmoothZoom.ts, useGlide.ts
src/renderer/src/canvas/nodes/*.tsx               aspect via LivingNode ; actions déplacées dans la carte (inventaire)
src/renderer/src/canvas/IdeasCanvas.tsx           portail des cartes, gestes (clic = carte), plus de volet
src/renderer/src/canvas/CanvasToolbar.tsx         + « Réorganiser »
src/renderer/src/styles/tokens.css, canvas.css    jetons de branche, thème Carbone, flottaison, glissement, liserés
src/renderer/src/skills/SkillsPage.tsx, SkillNodes.tsx, SkillPanel.tsx, LibraryPanel.tsx   (US2)
src/shared/ipc/app.ts                             THEMES + 'carbon'
src/main/…/neurons (repo + handler)               plan:setCollapsed ; migration 0037 (+ down)
src/main/application/agents/AgentService.ts       (US5) sessions, worktree, garder / jeter
src/main/infrastructure/db/…                      (US5) migration 0038 (+ down), AgentSessionRepository
src/renderer/src/app/HeaderCrew.tsx               (US5) équipe en cours
```

## Lots (un test guidé à la fin de chacun)

0. **Fondations** : `lucide-react`, jetons (branches, Carbone, canevas sobre), `rhythm`, `nodeVisuals`, `LivingNode`,
   `alternateLayout` (+ bascule de `structureGraph.ts` sans changement visible : tests existants verts), `useSmoothZoom`,
   `useGlide`, thème Carbone dans Réglages.
1. **US1 Carte des idées** : aspect des nœuds (idée, étape, fantôme, document, livrable), plans en sens alterné,
   « Réorganiser », cartes multiples déplaçables dans le portail, étirements (fiche, discussion = `ChatPanel`, lecteur),
   actions des nœuds déplacées dans la carte, repli (`plan:setCollapsed`, migration 0037), amendement de la spec 008
   (clic). Vérification ligne à ligne de l'inventaire §1–§5. Test guidé.
2. **US2 Skills** : nœuds en cercles colorés, carte (Fiche, SKILL.md, Fichiers, Conversation, gestes), bibliothèque,
   amendement spec 020 ; mesure 300 nœuds. Test guidé.
3. **US3 Structure** : éléments en cercles, carte (fichiers liés dans le lecteur), amendement spec 017. Test guidé.
4. **US4 Blocs** : flottaison et carte pour widgets, notes, cadres, résultats. Test guidé.
5. **US5 Main et agents** : **amendement constitution 4.6.0 d'abord** (validation de mentalyas), migration 0038,
   `AgentService` (réutilise branchName / GitCli / worktree de l'Analyste), IPC `agent:*`, rôle dans la carte, anneaux,
   équipe dans l'en-tête, garder / jeter. Test guidé sur dépôt jetable.
6. **Finitions** : mesures SC-003 et SC-007, démo (`seed:demo` avec un plan profond et des fichiers), FOUNDATION,
   CLAUDE.md, JOURNAL.

## Complexity Tracking

| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Store de cartes multiples | D15 (plusieurs cartes, une conversation chacune) ; remplace 4 états de volet | Garder un volet unique : contraire à la décision |
| Zoom amorti maison | React Flow zoome par crans ; D20 demande un glissé | `zoomOnScroll` natif : saccadé |
| Worktree par agent | D19 : chaque agent sur sa branche, sans toucher au travail du Main | Même dossier pour tous : conflits d'écriture entre Claude |
| Thème Carbone en plus du sombre | D21 sans retirer le thème sombre (D23) | Remplacer le sombre : retire un choix |
