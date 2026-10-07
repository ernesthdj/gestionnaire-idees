# Contrats — 013 Actions finales

Tout est validé par Zod dans le main ; réponses IPC `{ success, data, error }` ; erreurs MCP via `toMcpError`.

## Outils MCP (`src/shared/mcp/tools.ts`)
| Outil | Entrée | Effet | Refus |
|---|---|---|---|
| `action_proposer` | `{ id?: uuid, livrable: 1..2000, raison: 1..2000 }` | proposition sur l'étape (conversation par défaut) ; événement `final:proposed` | `LOT_INVALIDE` (pas une étape, a des sous-étapes ou une proposition en attente, déjà action) |
| `fichier_ecrire` | `{ chemin: 1..260, contenu: ≤ 1 Mo }` | crée ou remplace dans le projet lié ; trace ; livrable ; Historique `mcp_write` | `NON_MODIFIABLE` (aucune exécution en cours, pas de dossier lié, fichier non texte), `LOT_INVALIDE` (chemin refusé, R2), `LOT_TROP_GROS` (taille, 40 fichiers) |
| `fichier_modifier` | `{ chemin, ancien: 1.., nouveau }` | remplacement exact ; `ancien` doit apparaître une seule fois | idem + `INTROUVABLE` (fichier absent, `ancien` absent ou multiple) |

`plan_proposer` refuse (`LOT_INVALIDE`) une action finale comme parent. `neurone_contexte` montre l'état d'action et
le livrable (chemins seulement).

## Canaux IPC (`src/shared/ipc/channels.ts`)
| Canal | Entrée | Sortie |
|---|---|---|
| `final:decide` | `{ neuronId, accept: boolean }` | `{ state }` |
| `final:demote` | `{ neuronId }` | `{}` |
| `final:execute` | `{ neuronId, force?: boolean }` | `{ executionId }` ; `PREREQUISITES` avec la liste des prérequis non faits si `force` absent ; `BUSY` ; `FOLDER_MISSING` |
| `final:stop` | `{ neuronId }` | `{}` |
| `deliverable:get` | `{ neuronId }` | `DeliverableDetailView` : `{ neuronId, state, accepted, files: [{ path, status, before, after, changedSince, current (si changedSince), reverted }], executions (5 dernières, fil d'événements) }` |
| `deliverable:accept` | `{ neuronId }` | `{ batchId }` — étape → `fait` ; `INVALID_STATE` si pas à revoir, en cours ou déjà accepté |
| `deliverable:correct` | `{ neuronId, message: 1..4000 }` | `{ executionId }` — `INVALID_STATE` si accepté ou en cours |
| `deliverable:revert` | `{ neuronId }` | `{ restored: string[], skipped: string[] }` — épargne les fichiers retouchés ; `FOLDER_MISSING` sans dossier lié |
| `deliverable:move` / `deliverable:resize` | comme `document:move` / `document:resize` | `{}` |

Événements main → renderer : `final:proposed` (toast), `final:changed { neuronId }` (début/fin d'exécution, écriture)
→ invalide `canvas` et `deliverable`.

## Messages de chat fixes
`FINAL_MESSAGE` (« Proposer l'action finale », nomme `action_proposer`) ; `EXECUTE_MESSAGE` (nomme `fichier_ecrire`,
`fichier_modifier`, rappelle : aucune commande, livrable annoncé, compte rendu final en liste de fichiers).

## D2 bis — commandes
| Outil MCP | Entrée | Effet | Refus |
|---|---|---|---|
| `commande_lancer` | `{ script: ^[A-Za-z0-9:_.-]{1,40}$ }` | lance le script approuvé ; rend code + fin de sortie | `NON_MODIFIABLE` (pas d'exécution, pas approuvé, texte changé, pas de package.json, npm introuvable, une commande déjà en cours) |

| Canal IPC | Entrée | Sortie |
|---|---|---|
| `commands:get` | `{ genesisId }` | `{ scripts: [{ name, text, approved, changed }], packageJson: boolean }` |
| `commands:approve` | `{ genesisId, scripts: string[] (≤ 20) }` | `{}` — remplace la liste, retient les textes actuels |

## D4 — visionneuse et éditeur
| Canal IPC | Entrée | Sortie |
|---|---|---|
| `deliverable:file` | `{ neuronId, path }` (un chemin du livrable) | `{ path, language, current: string \| null, tooBig: boolean, binary: boolean, missing: boolean }` |
| `deliverable:openInEditor` | `{ neuronId, path, line?: int ≥ 1 }` | `{}` ; `NO_EDITOR` (pas d'éditeur, extension hors liste blanche), `EDITOR_FAILED` |

Réglage `editor.command` (`settings:set`, ≤ 500 caractères, doit contenir `{fichier}`).

## D5 — tests du livrable
| Canal IPC | Entrée | Sortie |
|---|---|---|
| `deliverable:tests` | `{ neuronId }` | `{ files: string[], ignored: [{ path, reason }], available: boolean, reason?: 'NO_SCRIPT'\|'NOT_APPROVED'\|'CHANGED'\|'BUSY'\|'EXECUTING'\|'NO_TESTS', runs: TestRunView[] }` |
| `deliverable:runTests` | `{ neuronId }` | `TestRunView` (à la fin) ; refus = `reason` ci-dessus |
| `deliverable:fixTests` | `{ neuronId, runId }` | `{ executionId }` — correction avec `TEST_FIX_MESSAGE` |
| `deliverable:writeTests` | `{ neuronId }` | `{ executionId }` — correction avec `TEST_WRITE_MESSAGE` |

`TestRunView` : `{ id, files: string[], exitCode: int \| null, timedOut, durationMs, output, at }`. Événement
`final:changed` au début et à la fin d'un lancement.
