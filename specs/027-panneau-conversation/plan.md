# Implementation Plan: Conversation en panneau fixe (spec 027)

**Branch**: `main` (spec `027-panneau-conversation`) | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

## Summary

La conversation avec Claude et le lecteur de fichiers quittent l'étirement de droite de la carte de détails (couche
de la carte React Flow, soumise au zoom) pour un **panneau fixe à onglets** à droite de l'écran Idées, qui accueille
aussi le volet Dépôt. Un magasin `sidePanelStore` (renderer) tient les onglets ; la carte de détails garde son contenu
sans étirement ; le nœud de l'onglet affiché porte un anneau ; « Centrer sur le nœud » passe par une demande que le
canevas exécute. Seule donnée nouvelle : la largeur du panneau, dans les réglages existants. Détails : [research.md](research.md),
[data-model.md](data-model.md), [contracts/side-panel.md](contracts/side-panel.md).

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: React, React Flow (`setCenter`), zustand, TanStack Query, Tailwind v4, `motion` (déjà
présents) ; **aucune dépendance nouvelle**.
**Storage**: aucune migration ; réglage `ui.chatPanelWidth` dans la table `settings` (canal `app:setSettings`
existant, schéma Zod élargi).
**Testing**: Vitest — purs : transitions de `sidePanelStore` (ouvrir sans doublon, fermer l'onglet affiché, voisin,
lecteur, `closeMissing`, `reset`, focus) ; renderer + axe : `SidePanel` (onglets, indicateurs, clavier, poignée,
surimpression), carte de détails sans étirement, `LivingNode` (`data-chat`), façades `uiStore` ; intégration :
réglage `chatPanelWidth` (bornes, valeur invalide). E2E Playwright : `tests/e2e/side-panel.e2e.ts` (quickstart 1–7) et
mise à jour des sélecteurs des e2e existants. **Tous les tests existants restent verts.**
**Target Platform**: Windows 11 (Electron)
**Performance Goals**: changer d'onglet < 100 ms ; aucun rendu de la carte provoqué par une frappe dans le panneau
(le panneau est hors de l'arbre de `IdeasCanvas`).
**Constraints**: jetons du thème, grille 8 px, proportion 62 / 38 par défaut, clavier complet, animations réduites,
aucune fonctionnalité retirée (conversations, lecteurs, Workflow, Dépôt, conflits).
**Scale/Scope**: ~6 fichiers nouveaux (renderer), ~14 modifiés (renderer), 3 (shared / main : réglage), ~12 fichiers
de tests touchés.

## Constitution Check (4.6.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Aucun programme lancé, aucun canal nouveau ; `chatPanelWidth` validé par Zod dans le main (entier borné, `strict`) ; titres d'onglets affichés comme texte (React, jamais `dangerouslySetInnerHTML`) | ✅ |
| II Humain dans la boucle | Rien n'est écrit sans geste ; demandes de permission relayées comme avant (`ChatPanel` inchangé) et plus visibles (onglet, nœud) ; fermer un onglet n'interrompt ni ne décide rien | ✅ |
| III IA cadrée | Aucune tâche d'IA ni consigne nouvelle | ✅ |
| IV Local d'abord | Rien ne quitte la machine ; une préférence d'affichage de plus | ✅ |
| V Tests | Transitions pures testées ; composants + axe ; e2e du parcours ; réglage borné testé | ✅ |
| VI Simplicité | Réutilise `ChatPanel`, `RepoPanel`, les quatre lecteurs, `useRunningChats`, `useWaitingChats`, `app:setSettings` ; une seule source de « conversation ouverte » (retire `side` de `cardsStore`) | ✅ |

Amendements de specs livrées (pas de la constitution) : spec 022 D6 et D10 (étirement de droite), D28 (rôle de
l'épingle), notés dans la spec 022 au lot 1.

## Project Structure

```text
src/renderer/src/canvas/side/sidePanelStore.ts     NOUVEAU onglets, onglet affiché, demande de centrage (règles pures + zustand)
src/renderer/src/canvas/side/SidePanel.tsx         NOUVEAU panneau : largeur, poignée, surimpression, onglet affiché
src/renderer/src/canvas/side/SideTabs.tsx          NOUVEAU barre d'onglets (tablist), indicateurs, ×
src/renderer/src/canvas/side/ChatTabContent.tsx    NOUVEAU en-tête (titre, sorte, Centrer) + ChatPanel ou lecteur
src/renderer/src/canvas/side/WorkflowChatTabContent.tsx NOUVEAU requête workflow:chat + ChatPanel
src/renderer/src/canvas/side/side.css              NOUVEAU anneau data-chat, poignée, surimpression
src/renderer/src/canvas/cards/cardsStore.ts        retire side / reader / setSide
src/renderer/src/canvas/cards/DetailCard.tsx       retire l'étirement de droite ; Discuter → onChat
src/renderer/src/canvas/cards/IdeaCards.tsx        Discuter / lecteurs → sidePanelStore
src/renderer/src/canvas/cards/cards.css            retire les styles de l'étirement de droite
src/renderer/src/canvas/workflow/WorkflowCard.tsx  discussWorkflow / lecteur → sidePanelStore
src/renderer/src/canvas/workflow/useWorkflow.ts    watchRunningChats déplacé
src/renderer/src/canvas/living/LivingNode.tsx      data-chat
src/renderer/src/canvas/IdeasCanvas.tsx            exécute la demande de centrage (vue + setCenter) ; Échap ; closeMissing
src/renderer/src/pages/IdeasPage.tsx               SidePanel à la place de RepoPanel ; reset au changement de canevas
src/renderer/src/git/RepoPanel.tsx                 sans enveloppe de largeur
src/renderer/src/app/uiStore.ts                    façades openChat / navigate / openViewer / openRepo / closeRepo
src/renderer/src/app/useMainEvents.ts              watchRunningChats (écoute unique)
src/shared/ipc/app.ts                              chatPanelWidth (vue, défaut, patch, bornes)
src/main/infrastructure/db/repositories/AppSettingsRepository.ts  clé ui.chatPanelWidth
src/main/ipc/appHandlers.ts                        SettingsPatch + chatPanelWidth
tests/unit/renderer/side-panel*.test.tsx, tests/unit/canvas/side-panel-store.test.ts, tests/integration/db/app-settings.test.ts,
tests/e2e/side-panel.e2e.ts (+ sélecteurs des e2e existants)
```

## Lots (un test de bout en bout par lot, captures relues)

1. **US1 + US4 — le panneau** (MVP) : `sidePanelStore` (onglets `chat`, `workflowChat`, `repo`), `SidePanel` à 38 %,
   `ChatTabContent`, `WorkflowChatTabContent`, `RepoPanel` en onglet ; `cardsStore` et `DetailCard` sans étirement ;
   façades `uiStore` ; lecteurs dans l'onglet ; Échap ; `reset` au changement de canevas, `closeMissing` ; amendement
   spec 022. Mise à jour des tests renderer et e2e existants. E2E : quickstart 1, 4, 6.
2. **US2 — onglets multiples** : indicateurs « Claude écrit » et « ⏸ », `watchRunningChats` global, clavier de la
   barre (←/→, Début/Fin), défilement, voisin à la fermeture. E2E : quickstart 2.
3. **US3 — retrouver le nœud** : `data-chat` sur `LivingNode`, « Centrer sur le nœud » (demande, bascule de vue,
   `setCenter`, animations réduites). E2E : quickstart 3.
4. **US5 — largeur** : réglage `chatPanelWidth` (shared, main, tests d'intégration), poignée souris + clavier,
   enregistrement différé, surimpression sous 1 100 px. E2E : quickstart 5, 7.
5. **Passe réelle** : parcours de l'audit rejoué avec Claude réel (profil et coffre fictifs) ; SC-005 vérifié ; JOURNAL,
   statut de la spec, `CLAUDE.md` (Workflows actifs) ; un commit pour la spec livrée.

## Complexity Tracking

Aucune violation à justifier.
