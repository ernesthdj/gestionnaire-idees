# Implementation Plan: Pont MCP — la carte lue et écrite par Claude Code

**Branch**: `007-pont-mcp` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-pont-mcp/spec.md` ; conception validée `docs/brainstorm/L3-pont-mcp.md`.

## Summary
Claude Code (tout CLI `claude`) lit et écrit la carte de l'app. Un **relais** lancé par Claude Code
(`electron.exe` en mode Node) est le serveur MCP : il déclare 9 outils figés et transmet chaque appel au **main**
par un **canal nommé** local authentifié par jeton (aucun port réseau). Le main revalide tout et exécute via un
`MapService` qui réutilise les dépôts existants : notes et cadres (nouveaux types de blocs), liens libres (nouvelle
table), idées (neurones bruts). Chaque appel qui écrit = une opération d'Historique « par Claude », annulable.
L'app place elle-même les lots (arbre en colonnes, zone libre). Révision de L3 : le protocole MCP vit dans le relais
(research R1) pour survivre aux redémarrages de l'app.

## Technical Context
**Language/Version**: TypeScript 5 (`strict`), Node 24 / Electron 44

**Primary Dependencies**: existantes (Electron, React 19, React Flow 12, Zod 4, Drizzle + better-sqlite3-multiple-ciphers) ;
**nouvelle** : `@modelcontextprotocol/sdk` (relais uniquement — R10)

**Storage**: SQLite chiffré ; migration `0017_map_primitives` (+ down)

**Testing**: Vitest (unitaires `tests/unit/mcp/`, intégration `tests/integration/mcp/` sur base réelle en mémoire,
renderer `tests/unit/renderer/`) ; canal testé avec un vrai `net` sur un nom de canal de test

**Target Platform**: Windows 11 (canal nommé `\\.\pipe\…`)

**Project Type**: desktop-app (Electron : main / preload / renderer) + un script relais

**Performance Goals**: lot de 50 éléments visible < 1 s (SC-002) ; `etat` < 100 ms côté main

**Constraints**: aucun port réseau ; trame ≤ 1 Mo ; lot ≤ 200 nœuds / 400 liens ; réponse ≤ 60 000 caractères

**Scale/Scope**: mono-utilisateur ; cartes jusqu'à quelques milliers d'éléments ; ≤ 8 clients simultanés

## Constitution Check
*Constitution 2.0.0. GATE avant Phase 0 et après Phase 1 : PASS.*

| Principe | Vérification | Statut |
|----------|--------------|--------|
| I. Sécurité | Canal nommé local, aucun port ; jeton 256 bits, `timingSafeEqual`, jamais dans `~/.claude.json` ni les logs ; Zod strict côté main ; trames bornées ; rendu texte (pas de HTML) ; IPC `map:selection`/`mcp:*` validés | ✅ |
| II. Humain dans la boucle | Exception MCP appliquée : écriture directe, `actor: claude`, 1 lot par appel, annulable ; `retirer` = archivage / suppression douce, jamais définitive | ✅ |
| III. IA cadrée | Les appels MCP ne sont pas des appels IA de l'app (pas d'`AIGateway`) ; sorties d'outils validées ; code de widget : `WidgetOut` + transpilation + bac à sable + « À revoir » | ✅ |
| IV. Local d'abord | Données servies localement au CLI de mentalyas ; aucun appel externe ajouté | ✅ |
| V. Qualité & tests | Logique pure testée (`layoutBatch`, validation des lots, résolution des clés) ; intégration (lots tout-ou-rien, Historique, annulation, jeton) ; aucun service externe réel | ✅ |
| VI. Simplicité | Réutilise blocs, Historique, widgets ; une seule dépendance, justifiée (R10) ; documents/tableaux, espaces, installation auto : hors lot | ✅ |

## Project Structure

### Documentation (this feature)
```text
specs/007-pont-mcp/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (mcp-tools.md, pipe-and-ipc.md)
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code
```text
src/shared/mcp/
├── tools.ts            # schémas Zod des 9 outils, bornes, noms (relais + main)
├── endpoint.ts         # nom du canal depuis le dossier du profil
└── protocol.ts         # trames hello / requête / réponse
src/shared/ipc/
├── canvas.ts           # BlockView (+title, parentBlockId, frameId, origin), MapLinkView, kinds note/frame
├── mcp.ts              # mcp:status, mcp:rotateToken, map:selection
└── channels.ts         # + canaux et événement map:changed
src/mcp-relay/
└── relay.ts            # serveur MCP stdio (SDK) → canal nommé ; mode « app fermée »
src/main/domain/mcp/
├── layout.ts           # layoutBatch (pur)
└── batch.ts            # résolution des clés, cycles, références (pur)
src/main/application/mcp/
├── MapService.ts       # etat, lectures, dessiner, modifier, relier, retirer, widget
├── MapReader.ts        # vues texte compactes + pagination
└── SelectionStore.ts
src/main/infrastructure/mcp/
├── PipeServer.ts       # net.createServer(\\.\pipe\…), poignée de main, trames, 8 clients
└── token.ts            # création / lecture / rotation de mcp.token
src/main/infrastructure/db/
├── schemaNeurons.ts    # colonnes + map_links + actor
├── migrations/0017_map_primitives.sql (+ down/)
└── repositories/       # BlockRepository (+), MapLinkRepository (nouveau), HistoryRepository (+ entités)
src/main/application/widgets/WidgetService.ts   # + createFromCode
src/main/application/history/HistoryService.ts  # + mcp_write, résumés « Claude : … »
src/main/ipc/mcpHandlers.ts · src/main/bootstrap.ts
src/renderer/src/canvas/
├── buildGraph.ts       # notes, cadres (groupes), liens libres, badge origine
├── nodes/NoteNode.tsx · nodes/FrameNode.tsx
└── IdeasCanvas.tsx     # useOnSelectionChange → map:selection
src/renderer/src/app/useMainEvents.ts           # map:changed → invalidation + toast Annuler
src/renderer/src/pages/settings/claude/ClaudeCodeSettings.tsx
electron.vite.config.ts  # 2e entrée main : mcp-relay
tests/unit/mcp/ · tests/integration/mcp/ · tests/unit/renderer/
```

**Structure Decision**: structure existante (Clean Architecture main : domain / application / infrastructure / ipc ;
shared pour les contrats). Le relais est un point d'entrée séparé, sans accès à la base, qui ne fait que traduire MCP ↔
canal.

## Ordre de livraison (pour /speckit-tasks)
1. **Socle** : dépendance, migration, schéma, contrats partagés, jeton, canal, relais minimal (`etat`) → test
   bout-en-bout depuis le CLI.
2. **US5 + US1** : Réglages › Claude Code, lectures, sélection.
3. **US2** : `dessiner`, placement, notes/cadres/liens sur la carte, Historique « par Claude », toast.
4. **US3** : modifier, relier, retirer.
5. **US4** : `widget_poser`.
6. Test manuel guidé (quickstart) + JOURNAL.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|-------|----------|----------------------------------|
| Processus relais séparé | Claude Code lance les serveurs MCP stdio ; garder la session MCP quand l'app redémarre | HTTP local : port joignable par le navigateur, jeton dans `~/.claude.json` |
| Nouvelle table `map_links` | Liens libres entre blocs et idées, sans statut ni empreinte | Réutiliser `neuron_links` : idée↔idée seulement, sémantique de suggestion |
