# Implementation Plan: Accueil ProjectMaster (spec 024)

**Branch**: `main` (spec `024-accueil-projectmaster`) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

## Summary

L'app s'ouvre sur le **Project Manager** : « Charger un brainstorm existant » (reprise exacte du canevas) ou « Nouveau
brainstorm » de zéro (dossier dans le coffre), sur un projet en chantier (vault `.brainstormer/`, rôle git) ou depuis un
lien Git (clone dans le coffre). Chaque brainstorm a **son canevas** (nouvelle table `brainstorms`, colonne
`brainstorm_id` sur les genesis et les blocs), son **état de vue** enregistré en continu et ses **points de sauvegarde**
(instantanés du canevas, retour annulable). L'app suit le protocole de `/hub` (ouverture, fin de session éclatée) en
s'appuyant sur `ProjectService` (spec 016), `HubRegistry`, `CloneService` (spec 017) et, pour commit / push / branches,
sur la **spec 021**. Voir [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: existantes — Electron, React, React Flow, Tailwind v4, Zod, TanStack Query, zustand,
Drizzle + better-sqlite3-multiple-ciphers, `node:zlib` (gzip des instantanés). **Aucune nouvelle.**
**Storage**: migration `0039_brainstorms` + `down` : tables `brainstorms`, `save_points` ; colonnes
`neurons.brainstorm_id`, `canvas_blocks.brainstorm_id` ([data-model.md](data-model.md)). Fichiers du coffre `.hub/`
(format du skill) et vault `.brainstormer/` des projets externes.
**Testing**: Vitest — purs : règles de chemin, `ViewState` (Zod), instantané ↔ canevas, plan de fin de session,
anomalies ; intégration : `BrainstormService` (créer, adopter, cloner, ouvrir, migration R10 sur une copie de base),
`SavePointService` (poser, revenir, annuler — inventaire identique), `HubSessions` / `HubRegistry` sur un coffre
temporaire (écritures atomiques, entrées inconnues intactes), vault (aperçu, `.gitignore`, reprise d'un vault) ;
renderer + axe : Project Manager, liste, formulaires, points de sauvegarde, fin de session.
**Target Platform**: Windows 11
**Performance Goals**: Project Manager < 2 s avec 30 brainstorms (SC-009) ; ouverture d'un brainstorm < 1 s hors
anomalies ; écriture de l'état de vue différée de 500 ms ; point de sauvegarde < 1 s pour 2 000 nœuds.
**Constraints**: un seul brainstorm actif ; écritures `.hub` et vault atomiques et confirmées ; aucun git sans clic ;
chemins confinés ; contenu cloné = donnée non fiable ; constitution IV : contenu de la carte dans la base chiffrée.
**Scale/Scope**: ~8 fichiers main/shared nouveaux, ~6 renderer nouveaux, ~10 modifiés (CanvasService, NeuronService,
capture, AppShell, IdeasCanvas, uiStore…).

## Constitution Check (4.5.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Chemins résolus et confinés (profil de l'app, racines, dossiers système refusés) ; écritures `.hub` et vault atomiques, jamais sur un JSON illisible, entrées inconnues gardées ; Zod aux frontières (IPC, vault, état de vue, instantanés) ; clone par `CloneService` (adresse contrôlée, sans hooks ni sous-modules) ; contenu cloné jamais exécuté | ✅ |
| II Humain dans la boucle | Toute écriture dans un dossier de projet (vault, `.gitignore`, `git init`) et toute action git sur clic après aperçu ; collaborateur : jamais de push vers la branche par défaut ; retour à un point de sauvegarde confirmé et annulable ; graphe et cours confiés à la conversation sur clic (mode de permission, spec 014) | ✅ |
| III IA cadrée | Aucune tâche automatique nouvelle ; le brainstorm passe par la conversation existante (spec 008) ; textes de JOURNAL proposés par Claude, modifiables, écrits sur clic | ✅ |
| IV Local d'abord | Contenu de la carte et instantanés dans la base chiffrée ; le vault ne contient que des métadonnées, ignoré par git par défaut ; aucune donnée envoyée hors de la machine sans geste (clone, push) | ✅ |
| V Tests | Purs, intégration sur coffre et base temporaires, inventaires avant / après (SC-003, SC-008), axe | ✅ |
| VI Simplicité | Réutilise `ProjectService`, `HubRegistry`, `CloneService`, `initGit`, la conversation, la vue Workflow ; une colonne de rattachement plutôt qu'une base par projet ; instantané « tout ou rien » plutôt que rejeu de l'Historique | ✅ |

Hors de ce dépôt, **avec l'accord de mentalyas** : option GitHub oui / non du skill `/hub` (FR-017) et lecture de
`path` par `scripts/launcher.sh` pour les projets externes (R6).

## Project Structure

```text
src/main/infrastructure/db/schemaReprise.ts (ou schemaNeurons.ts)  brainstorms, save_points, colonnes brainstorm_id
src/main/infrastructure/db/migrations/0039_brainstorms.sql + down/  migration et annulation écrite à la main
src/main/infrastructure/hub/HubSessions.ts        .hub/sessions.json (atomique)
src/main/infrastructure/hub/ProjectVault.ts       .brainstormer/ (lecture Zod, aperçu, écriture, .gitignore)
src/main/infrastructure/db/repositories/BrainstormRepository.ts, SavePointRepository.ts
src/main/domain/brainstorms/{paths, viewState, snapshot, hubEnd, anomalies}.ts   purs
src/main/application/brainstorms/BrainstormService.ts   liste, ouvrir/fermer, créer (B1), adopter (B2), cloner (B3), relier
src/main/application/brainstorms/SavePointService.ts    poser, lister, revenir, annuler
src/main/application/brainstorms/HubFlow.ts             ouverture (/hub work) et fin de session (/hub end) étape par étape
src/main/application/brainstorms/LegacyCanvasMigration.ts  carte unique → brainstorms (R10, marqueur)
src/main/ipc/brainstormHandlers.ts                      canaux de contracts/interfaces.md
src/main/application/canvas/CanvasService.ts            filtre par brainstorm actif (modifié)
src/renderer/src/home/{ProjectManager, BrainstormList, NewBrainstorm, VaultSetup}.tsx
src/renderer/src/canvas/{SavePoints, SessionEnd}.tsx ; useViewState.ts (écriture différée)
src/renderer/src/app/{AppShell.tsx, uiStore.ts}         section home, brainstorm actif, état de vue restauré
```

## Lots (un test guidé à la fin de chacun ; un commit par lot livré)

0. **Fondations** : migration 0039 + `down`, repositories, `ViewState`, règles de chemin, `HubSessions`, `ProjectVault`.
1. **US1 Charger et reprendre** : `BrainstormService.list/open/close`, filtre du canevas, état de vue enregistré et
   restauré, Project Manager, anomalies `/hub work` (sans fetch automatique), **migration R10** de la carte unique
   (sur une copie du profil d'abord). Test guidé : reprise identique après redémarrage.
2. **US2 Points de sauvegarde** : instantanés gzip, retour et annulation, liste. Test guidé : SC-003.
3. **US3 De zéro** : formulaire, `ProjectService.create` dans le coffre, `initGit`, brainstorm et canevas, démarrage
   du brainstorm ; GitHub seulement si la spec 021 lot B est là (sinon « local » seulement, bouton grisé expliqué).
4. **US4 Projet en chantier (propriétaire, sans dépôt)** : aperçu, vault, `.gitignore`, référence externe (R6),
   rôle « mon propre dépôt » ou `git init` ; « Relier » un projet déplacé.
5. **US5 Depuis un lien Git** : `CloneService` (historique) vers `projects/` du coffre, brainstorm, canevas.
6. **US7 Coffre au premier lancement** : choisir / créer (structure lisible par `pm.bat`).
7. **Après spec 021 (lots A, B, G)** : US4 rôle **collaborateur** (branche, push gardé, PR) ; **US6 fin de session**
   (commit, push, journaux, graphe et cours par la conversation, fermeture) ; US5 **extraire un morceau**.
8. **Finitions** : démo (coffre fictif dans le profil démo), mesures SC-009, FOUNDATION, CLAUDE.md, quickstart complet.

## Complexity Tracking

| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Instantanés compressés en base | Retour « tout ou rien » fiable (SC-003), sans dépendre de l'annulabilité de chaque action passée | Rejeu de l'Historique jusqu'à une marque : fragile |
| Migration de données de la carte unique | Aucune perte (SC-008) au passage à un canevas par projet | Repartir d'une carte vide : perte de données |
| Écriture dans des fichiers hors de la base (`.hub`, vault) | Compatibilité `pm.bat` et skill `/hub` (D4) | Tout dans la base : deux vérités |
