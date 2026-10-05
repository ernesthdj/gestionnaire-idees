# Implementation Plan: Documents (spec 012)

**Branch**: `012-documents` (travail sur `main`) · **Date**: 2026-10-05 · **Spec**: [spec.md](spec.md)

## Summary
Un document est une ligne `documents` rattachée à un neurone, dont le contenu vit dans un vrai fichier `.md` (dossier
du projet lié, sinon du profil) et dont chaque version est gardée en base (annulation, recréation). Claude écrit par
l'outil MCP `document_ecrire` ; le nœud `document` se place dans la colonne des enfants de son neurone (disposition du
plan, spec 011), affiche le Markdown rendu avec le composant sûr du chat, défile dedans, se redimensionne et bascule
en édition brute. Le fichier est la source de vérité : relu à chaque affichage, surveillé, conflit d'édition détecté.
Détail : [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

## Technical Context
**Language/Version**: TypeScript strict (Electron main, React 19 renderer)
**Primary Dependencies**: existantes — react-markdown + remark-gfm, React Flow (`NodeResizer`), Zod, Drizzle, MCP SDK
**Storage**: SQLite chiffré (documents, versions) + fichiers `.md` en clair (D1) ; migration `0023_documents` (+ down)
**Testing**: Vitest — unitaires purs (nommage, chemins), intégration sur base et dossier temporaires, renderer + axe
**Target Platform**: Windows
**Project Type**: desktop app
**Performance Goals**: document de 500 Ko rendu sans gel perceptible ; relecture après modification extérieure < 1 s
**Constraints**: aucun chemin fourni par Claude ou l'interface ; aucune écriture hors du dossier choisi ; aucun HTML
brut interprété ; aucune suppression définitive
**Scale/Scope**: quelques dizaines de documents par profil

## Constitution Check
| Principe | Respect |
|---|---|
| I Sécurité | Chemin résolu par le main (slug, `realpath`, `path.relative`), écriture atomique, borne 500 Ko, Zod sur IPC et MCP, Markdown sans HTML, liens https vers le navigateur, aucun contenu dans les logs. ✅ |
| II Humain dans la boucle | Écritures de Claude par MCP : directes, « par Claude », annulables (exception II) ; écritures de mentalyas annulables ; aucune suppression définitive (corbeille). ✅ |
| III IA cadrée | Pas d'appel IA lancé par l'app ; outil borné, refus motivés. ✅ |
| IV Local d'abord | Fichiers locaux ; le contenu en clair est un choix explicite de mentalyas (D1), limité aux documents. ✅ (écart documenté) |
| V Tests | Nommage, chemins, versions, conflits, Historique, outils, rendu testés ; aucun service externe. ✅ |
| VI Simplicité | Réutilise rendu Markdown, disposition du plan, Historique ; `textarea` plutôt qu'un éditeur riche ; `fs.watch` plutôt qu'une dépendance. ✅ |

**Écart IV justifié** : les données restent locales mais un document est en clair, à la demande de mentalyas (lisible
dans Obsidian, versionnable) ; la base (fiches, conversations, versions) reste chiffrée.

## Project Structure
```
src/main/
  domain/documents/        fileName.ts (slug, réservés, collisions), paths.ts (dossier sûr) — purs
  infrastructure/documents DocumentFiles.ts (lecture, écriture atomique, corbeille, realpath, empreinte), DocumentWatcher.ts
  infrastructure/db/       schéma + DocumentRepository + migration 0023
  application/documents/   DocumentService.ts (créer, réécrire, lire, enregistrer, retirer, recréer)
  application/mcp/         DocumentTools.ts (document_ecrire, document_lire) ; neurone_contexte
  application/history/     entités document, document_version ; kind document
  ipc/documentHandlers.ts
src/shared/ipc/            documents.ts, canvas.ts (DocumentView), channels.ts ; mcp/tools.ts (2 outils)
src/renderer/src/
  canvas/planLayout.ts     documents dans la colonne des enfants
  canvas/nodes/DocumentNode.tsx  rendu, défilement, redimension, édition, conflit
  chat/Markdown.tsx        variante « document » ; ChatPanel : bouton « Rédiger un document »
```

## Lots
1. **P1 — Fichiers et données** : nommage et chemins (purs, tests hostiles), fichiers, dépôt, service, Historique.
2. **P2 — Claude** : outils MCP, contexte, cadre, bouton du chat. Test guidé (US1).
3. **P3 — Lecture et édition** : nœud document, disposition, redimension, défilement, édition, conflit, surveillance.
   Test guidé (US2, US3).

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Fichier en clair (IV) | Décision D1 de mentalyas : lisible dans Obsidian / git | Tout en base chiffrée + export : refusé par mentalyas |
