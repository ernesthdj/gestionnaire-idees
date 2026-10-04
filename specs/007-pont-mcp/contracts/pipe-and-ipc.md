# Contrat — Canal relais ↔ main, et IPC interface ↔ main

## Canal nommé (relais → main)
- Nom : `\\.\pipe\gestionnaire-idees-mcp-<sha256(profil)[0..8]>` (`src/shared/mcp/endpoint.ts`).
- Trames : une ligne JSON terminée par `\n`, ≤ 1 Mo. Au-delà, ou JSON invalide : connexion fermée.
- 1. Relais → `{"hello":"gi-mcp/1","token":"<64 hex>"}` (≤ 2 s après connexion).
- 2. Main → `{"ok":true}` ou fermeture (jeton faux : `{"ok":false,"code":"SECRET_REFUSE"}` puis fermeture).
- 3. Relais → `{"id":<n>,"tool":"<nom>","args":{…}}` ; Main → `{"id":<n>,"ok":true,"data":{…}}` ou
  `{"id":<n>,"ok":false,"error":{"code":"…","message":"…"}}`.
- Le main revalide `tool` (liste fermée) et `args` (schéma Zod strict) ; exécution synchrone, une à la fois.
- Max 8 connexions ; journal : `mcp.call {tool, ms, status, count}` sans contenu.

## IPC (preload, validé par Zod dans le main)
| Canal | Entrée | Sortie |
|-------|--------|--------|
| `map:selection` | `{ ids: string[] (≤ 500) }` | — |
| `mcp:status` | — | `{ listening, clients, command, profileDir }` (`command` sans secret) |
| `mcp:rotateToken` | — | `{ ok: true }` (déconnecte les clients) |

## Événement main → fenêtre principale (liste blanche `MAIN_WINDOW_EVENTS`)
| Événement | Charge |
|-----------|--------|
| `map:changed` | `{ batchId, summary, count }` → invalidation `canvas`, `history` ; toast « {summary} — Annuler » |
