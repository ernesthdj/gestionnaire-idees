# Implementation Plan: Le dossier du nœud (spec 028)

**Branch**: `main` (spec `028-dossier-du-noeud`) | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Summary

Tout nœud qui a des fichiers porte un **dossier de verre** relié à lui sur la carte. Il réunit quatre sources : les
documents de Claude, les fichiers couverts par un élément, ceux que Claude écrit dans la conversation du nœud, et
ceux ajoutés à la main. Dans le main, une table de rangement (`folder_entries`) et une table de place
(`folder_places`) servent la vue de la carte (`IdeasCanvasView.folders`) et des canaux `folder:*` ; les fichiers
couverts sont calculés, pas stockés. Le hook d'écriture existant (`DeliverableTracker`) range ce que Claude écrit ;
`document_ecrire` accepte tout nœud ; les documents de la spec 012 sont repris une fois dans les dossiers (épinglés
s'ils avaient été arrangés). Dans l'interface, `GlassFolder` est une réécriture inspirée de la référence 21st.dev, aux
jetons du thème. « Tout voir » ouvre une vue Dossier dans l'onglet du nœud du panneau de droite (spec 027), et Claude
lit le dossier par `dossier_lire`. Détails : [research.md](research.md), [data-model.md](data-model.md),
[contracts/ipc-folders.md](contracts/ipc-folders.md), [contracts/mcp-dossier.md](contracts/mcp-dossier.md).

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron, React, React Flow, zustand, TanStack Query, Tailwind v4, `motion`, Drizzle +
`better-sqlite3-multiple-ciphers`, `@modelcontextprotocol/sdk`, Zod (déjà présents) ; **aucune dépendance nouvelle**.
**Storage**: migration `0047_folder_entries` (+ `down` écrit à la main) ; réglage `migration.documentFolders`.
**Testing**: Vitest — purs : fusion et priorité des sources, tri, « nouveau », sorte d'un fichier, place par défaut
selon la sorte de nœud, palette et graine de l'illustration, états du dossier ; intégration : `FolderService`
(gardes de chemin : `..`, absolu, lecteur Windows, UNC, lien symbolique sortant, `.env` ; doublons ; plafond 500 ;
annulation), `FolderBackfill` (base fictive : intact, déplacé, retiré ; idempotence ; `down`), `DeliverableTracker`
(conversation d'une étape, d'un genesis, écriture refusée), `DocumentService` sur un élément, `dossier_lire` (frontière
d'arbre, non rangé, sensible, binaire), `local-only-end-to-end.test.ts` (cas `dossier_lire` ajoutés) ; renderer + axe :
`GlassFolder`, éventail, menu, vue Dossier ; e2e Playwright : `tests/e2e/node-folder.e2e.ts` (quickstart 1–8) et mesure
à 30 dossiers. **Tous les tests existants restent verts.**
**Target Platform**: Windows 11 (Electron)
**Project Type**: desktop-app
**Performance Goals**: 30 dossiers visibles, carte glissée et zoomée sans image au-delà de 50 ms ; « Tout voir » de
500 fichiers < 1 s ; `canvas:get` ne s'alourdit pas de plus de 20 ms sur le profil démo (aperçus calculés sans lire de
contenu, `stat` borné).
**Constraints**: jetons du thème, une feuille CSS pour tous les dossiers, clavier complet, `inert` hors ouverture,
animations réduites, CSP inchangée (ni ressource ni script externe), aucun chemin absolu vers l'interface.
**Scale/Scope**: ~14 fichiers nouveaux (main, shared, renderer), ~16 modifiés, ~14 fichiers de tests.

## Constitution Check (4.6.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Canaux `folder:*` validés par Zod ; chemins relatifs revérifiés (`checkProjectPath`, `realpath` sous la racine, fichiers sensibles refusés) avant toute I/O ; aucun programme lancé hors l'éditeur réglé (`folder:openInEditor`, mécanisme existant) ; noms de fichiers rendus comme texte ; composant réécrit sans ressource externe | ✅ |
| II Humain dans la boucle | Les rangements faits par Claude (document, écriture en conversation) sont marqués « par Claude » et annulables (un lot par appel / par tour) ; retirer un fichier du dossier ne touche jamais le disque ; « Demander à Claude » prépare sans envoyer | ✅ |
| III IA cadrée | `dossier_lire` en lecture, contenu présenté comme donnée ; aucune tâche d'IA automatique nouvelle | ✅ |
| IV Local d'abord | Rangement et lecture dans la base et les fichiers locaux ; `dossier_lire` ne transmet que des fichiers rangés du nœud, à la demande de Claude en conversation ; aucun cas particulier ajouté (FR-023 retirée, décision de mentalyas) | ✅ |
| V Tests | Logique de fusion, place, illustration, reprise et gardes couverte par des tests purs et d'intégration ; e2e par lot | ✅ |
| VI Simplicité | Réutilise le hook d'écriture, `ElementFilesService`, les lecteurs, `DocumentNode` (épinglé), `sidePanelStore`, l'éditeur réglé ; une seule table de rangement ; pas de dépendance | ✅ |

Amendements de specs (pas de la constitution) : spec 012 D3, D4 (déjà notés le 2026-10-12).

## Project Structure

```text
src/main/infrastructure/db/schemaFolders.ts                  NOUVEAU tables folder_entries, folder_places
src/main/infrastructure/db/migrations/0047_folder_entries.sql NOUVEAU (+ down/0047_folder_entries.down.sql)
src/main/infrastructure/db/repositories/FolderRepository.ts   NOUVEAU lignes, places, fusion SQL
src/main/domain/folders/folderRules.ts                        NOUVEAU pur : fusion, priorité, tri, sorte, « nouveau », plafond
src/main/application/folders/FolderService.ts                 NOUVEAU vue, ajout, retrait, masque, épingle, copie, record, historyHandlers
src/main/application/folders/FolderBackfill.ts                NOUVEAU reprise des documents de la spec 012 (marqueur)
src/main/application/mcp/FolderTools.ts                       NOUVEAU dossier_lire
src/main/ipc/folderHandlers.ts                                NOUVEAU canaux folder:*
src/shared/ipc/folders.ts                                     NOUVEAU vues et schémas partagés
src/shared/mcp/tools.ts                                       + dossier_lire ; description document_ecrire
src/main/application/finals/DeliverableTracker.ts             + débouché « conversation » (toute conversation liée)
src/main/application/documents/DocumentService.ts             nœud générique ; rangement dans la même transaction
src/main/application/mcp/DocumentTools.ts                     refus « élément » levé
src/main/application/mcp/NeuronTools.ts                       section Dossier :
src/main/application/mcp/toolHandler.ts                       dispatch dossier_lire
src/main/application/canvas/CanvasService.ts                  folders ; documents épinglés seulement
src/main/application/conversation/frame.ts                    consigne du dossier
src/main/bootstrap.ts                                         composition, backfill au démarrage, history handlers
src/shared/ipc/canvas.ts, channels.ts                         folders, canaux, évènement folder:changed
src/renderer/src/canvas/folder/folderGeometry.ts              NOUVEAU tracés du dossier (nos propres chemins)
src/renderer/src/canvas/folder/GlassFolder.tsx                NOUVEAU dossier (fermé, penché, ouvert), éventail, « + », « ··· »
src/renderer/src/canvas/folder/folderArt.ts                   NOUVEAU pur : palette, graine, tracé ; file de peinture
src/renderer/src/canvas/folder/folder.css                     NOUVEAU verre, couches, data-moving, animations réduites
src/renderer/src/canvas/folder/FolderNode.tsx                 NOUVEAU nœud React Flow (+ pastille au loin)
src/renderer/src/canvas/folder/FolderMenu.tsx                 NOUVEAU menu ··· (clavier)
src/renderer/src/canvas/side/FolderTabView.tsx                NOUVEAU vue Dossier (arborescence, filtre, recherche, fenêtrage)
src/renderer/src/canvas/buildGraph.ts, planLayout.ts, structureGraph.ts  place des dossiers, arêtes, pastilles
src/renderer/src/canvas/IdeasCanvas.tsx                       data-moving, glisser une feuille sur un nœud
src/renderer/src/canvas/side/sidePanelStore.ts                cible de lecteur `folder` + retour « ← Dossier »
src/renderer/src/canvas/cards/DetailCard.tsx                  entrée « Dossier »
src/main/infrastructure/db/demo/*                             dossiers fictifs du profil démo
tests/unit/folders/*, tests/integration/folders/*, tests/unit/renderer/glass-folder*.test.tsx, tests/e2e/node-folder.e2e.ts
```

**Structure Decision**: même découpage que les specs précédentes : `domain/` pur, `application/` services,
`infrastructure/db` dépôts et migration, `ipc/` routes Zod, `shared/` contrats ; le rendu de la carte reste dans
`buildGraph` (placement pur, testé).

## Lots (un test de bout en bout par lot, captures relues)

1. **US1 — le dossier des documents (MVP)** : migration + dépôt + `folderRules` + `FolderService` (vue, `record`,
   `markSeen`, `move`) ; `DocumentService` / `DocumentTools` pour tout nœud, rangement dans la transaction ;
   `FolderBackfill` (R4 : sans lui, anciens documents en nœuds et nouveaux dans le dossier) avec rendu des épinglés par
   `DocumentNode` ; `IdeasCanvasView.folders` ; `GlassFolder` (fermé, penché, ouvert, éventail de 4, illustration
   teintée, thèmes) ; place par défaut et décalage gardé ; clic sur un fichier → lecteur de l'onglet ; consigne et
   description de `document_ecrire`. E2E : quickstart 1, 2.
2. **US2 — les quatre sources** : couverts (calculés, masquer / démasquer), conversation (`DeliverableTracker`),
   « + » (sélecteur natif dans le projet), retirer, annulation (`historyHandlers`), « nouveau » + point d'accent +
   feuille qui tombe ; `folder:changed` ; lecture d'un fichier rangé (`folder:file`, cible de lecteur `folder`), pour
   que tout ce qui entre dans le dossier s'ouvre. E2E : quickstart 3.
3. **US3 — Tout voir** : `folder:list`, `FolderTabView` (arborescence, filtre, recherche, fenêtrage,
   introuvables grisés), retour au même défilement, entrée « Dossier » de la carte de détails. E2E : quickstart 4.
4. **US4 — Claude lit le dossier** : `dossier_lire`, section `Dossier :` de `neurone_contexte`, cas ajoutés au test
   de confidentialité de bout en bout (une ligne d'arguments, entretien). Intégration : quickstart 5.
5. **US5 — épingler** : menu « ··· » (épingler, désépingler), `folder:pin` / `unpin`, cadre relié au dossier.
   E2E : quickstart 6.
6. **US6 — grande carte** : pastille sous 0,45, clic → zoom, `data-moving`, flou réduit au-delà de 12, peinture hors
   écran suspendue, « Réorganiser » ; mesure e2e à 30 dossiers. E2E : quickstart 7.
7. **US7 — ranger ailleurs et agir** : glisser une feuille (`getIntersectingNodes`), « Ranger aussi dans… » au clavier,
   `folder:copyTo` (refus entre projets), « Ouvrir dans l'éditeur », « Demander à Claude de le compléter ».
   E2E : quickstart 8.
8. **Finitions** : dossiers fictifs du profil démo, axe et clavier sur tout le parcours (quickstart 9), JOURNAL,
   statut de la spec, `FOUNDATION.md` §00000000, `CLAUDE.md` ; un commit pour la spec livrée.

## Complexity Tracking

Aucune violation à justifier.
