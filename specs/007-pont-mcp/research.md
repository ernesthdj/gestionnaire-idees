# Research — Spec 007 Pont MCP

> Phase 0. Base : `docs/brainstorm/L3-pont-mcp.md` (validé le 2026-10-04). Chaque décision : choix, raison,
> alternatives écartées.

## R1 — Où vit le protocole MCP : dans le relais (révision de L3 §0)
- **Décision** : le **relais** est le serveur MCP (SDK officiel, transport stdio, liste d'outils figée importée de
  `src/shared/mcp/tools.ts`). Le main n'expose qu'un **RPC JSON-lignes authentifié** sur le canal nommé :
  une poignée de main `{hello, token}`, puis des requêtes `{id, tool, args}` → `{id, ok, data | error}`.
- **Raison** : app fermée ou relancée en pleine session, le relais garde la session MCP de Claude Code et répond
  simplement « Le Brainstormer n'est pas lancé » outil par outil, puis se reconnecte à l'appel suivant (spec, cas
  limite 1) — impossible proprement si la session MCP vivait dans le main (Claude Code devrait réinitialiser). Le
  main n'embarque aucune dépendance MCP ; **il revalide tout** (le relais n'est pas de confiance). Sécurité de L3
  inchangée (canal nommé, jeton, aucun port).
- **Alternatives** : relais « tuyau d'octets » + `McpServer` dans le main (L3 initial) — session perdue à chaque
  redémarrage de l'app, mode dégradé compliqué ; HTTP local — écarté en L3 (port joignable par le navigateur, jeton
  en clair dans `~/.claude.json`).

## R2 — Lancement du relais
- **Décision** : `electron.exe` avec `ELECTRON_RUN_AS_NODE=1` exécute `out/main/mcp-relay.js` (deuxième entrée du
  build `main` d'electron-vite). Commande d'enregistrement affichée dans Réglages :
  `claude mcp add brainstormer --scope user -e ELECTRON_RUN_AS_NODE=1 -e GI_PROFILE_DIR=<dossier du profil> -- "<electron.exe>" "<mcp-relay.js>"`.
- **Raison** : aucun Node séparé à installer ; même binaire que l'app ; `GI_PROFILE_DIR` distingue le profil réel du
  profil démo. Vérifié par l'aide de `claude mcp add` (2.1.289) : `-e KEY=value`, `--scope user`, `-- <commande>`.
- **Alternatives** : script `npx` (dépend d'un Node installé) ; exécutable empaqueté à part (YAGNI au lot 1).
- **À vérifier en implémentation** : résolution de `@modelcontextprotocol/sdk` par le relais depuis `node_modules`
  (dépendance externalisée) en dev ; empaquetage (asar) traité au lot 3 avec l'installation automatique.

## R3 — Point de rendez-vous et secret
- **Décision** : nom du canal `\\.\pipe\gestionnaire-idees-mcp-<8 premiers hex de sha256(dossier du profil)>`, calculé
  par la même fonction (`src/shared/mcp/endpoint.ts`) dans le main et le relais. Jeton : 32 octets aléatoires (hex)
  dans `<profil>/mcp.token`, créé au premier démarrage, remplacé par « Régénérer ».
- **Raison** : rien à configurer côté Claude Code hormis le dossier du profil ; profils réel et démo ne se croisent pas.
  Le fichier vit dans `%APPDATA%` (droits de l'utilisateur, Administrateurs et SYSTEM — ACL par défaut). Il n'est pas
  chiffré par `safeStorage` : le relais, en mode Node, n'y a pas accès ; un processus capable de lire `%APPDATA%` lit
  de toute façon la base des secrets de session — risque identique, accepté.
- **Alternatives** : jeton passé par `-e` (écrit en clair dans `~/.claude.json`, écarté) ; port aléatoire publié dans
  un fichier (écarté avec HTTP).

## R4 — Comparaison du jeton et bornes du canal
- **Décision** : `crypto.timingSafeEqual` sur des tampons de même longueur ; trame = une ligne JSON ≤ 1 Mo (au-delà :
  fermeture) ; poignée de main attendue en ≤ 2 s ; 8 connexions simultanées max.
- **Raison** : FR-001, FR-017 ; pas de lecture sans fin d'un client local hostile.

## R5 — Primitives : extension des blocs
- **Décision** : `canvas_blocks.kind` + `note`, `frame` ; colonnes `title`, `parent_block_id`, `frame_id`, `origin`.
  Liens libres dans une nouvelle table `map_links` (extrémités `block` ou `idea`). Un nœud `idee` crée un neurone racine
  brut (`origin: 'claude'`), placé et épinglé.
- **Raison** : les blocs ont déjà position, taille, texte, suppression annulable et rendu sur la carte ; les neurones
  portent la recette Brainstorm (L3 §2). Les liens existants (`neuron_links`, idée↔idée, suggestions et graines)
  gardent leur sens ; un lien libre n'a ni statut ni empreinte.
- **Alternatives** : table générique `map_items` séparée (duplique les blocs) ; tout en neurones (pollue
  l'incubateur et les états brut/éclos).
- Le bloc `label` existant (note sans titre) reste ; `note` est sa version titrée posée par Claude ou par mentalyas.

## R6 — Historique « par Claude »
- **Décision** : `change_log.actor` (`user` | `claude`, défaut `user`) ; nouveau `kind` `mcp_write` (annulable) ;
  nouvelles entités : `map_link` (présence), `block_text` (`{title, text}`), `neuron_text` (`{title, content}`). Un
  appel d'outil = un `batchId`. Résumé d'Historique : « Claude : 12 notes, 1 cadre, 9 liens » (première entrée = cadre
  ou premier nœud).
- **Raison** : FR-013 ; réutilise `HistoryService.undo` (lot inverse, conflits détectés).

## R7 — Placement
- **Décision** : fonction pure `layoutBatch` (`src/main/domain/mcp/layout.ts`) : arbre en colonnes (profondeur →
  colonne de 280 px, frères empilés, hauteur selon la longueur du texte, marges de 24 px) ; cadre = enveloppe + marge
  de 32 px et bandeau de titre ; zone libre = à droite de l'enveloppe de tous les éléments visibles (+ 120 px), ou sous
  l'ancre (et décalé jusqu'à ne plus intersecter aucun rectangle existant).
- **Raison** : FR-010, SC-002 ; déterministe donc testable ; O(n).
- **Alternatives** : physique d3-force (non déterministe, lente sur 200 nœuds) ; positions données par Claude (écarté
  en L2).

## R8 — Widget posé par Claude
- **Décision** : `WidgetService.createFromCode` réutilise le schéma `WidgetOut` (titre, html, css, ts, résumé), la
  transpilation et le versionnement existants ; l'entrée éventuelle est créée par `WidgetIoService.connect`. Aucune
  autorisation : le widget est « À revoir » par construction (pas de ligne `widget_approvals`).
- **Raison** : FR-015, SC-007 ; une seule voie de validation du code.

## R9 — Sélection et rafraîchissement
- **Décision** : l'interface envoie `map:selection` (ids, ≤ 500, regroupé à 150 ms) via `useOnSelectionChange` de React
  Flow ; le main la garde en mémoire (`SelectionStore`). Après écriture, événement `map:changed` `{batchId, summary,
  count}` → invalidation `canvas`/`history` + toast « Annuler » (`useUndo`).
- **Raison** : FR-006, FR-014 ; mêmes mécanismes que `neuron:created`.

## R10 — Dépendance
- **Décision** : `@modelcontextprotocol/sdk` (officiel, TypeScript), utilisé **uniquement par le relais**. Annoncée
  ici (constitution, workflow) ; installée en T001 après confirmation de mentalyas.
