# Contrats — 014 Claude libre

## Outil MCP interne
| Outil | Entrée | Sortie |
|---|---|---|
| `permission_demander` | `{ tool_name: string ≤ 100, input: object, tool_use_id?: string }` | texte JSON `{ behavior: 'allow', updatedInput }` ou `{ behavior: 'deny', message }` |

Retirés : `fichier_ecrire`, `fichier_modifier`, `commande_lancer`.

## Hook `PreToolUse` (relais `--hook`)
Entrée standard du hook (Claude Code) → `{ neuronId, tool, file_path }` au main ; sortie : code 0 (continuer).

## Canaux IPC
| Canal | Entrée | Sortie |
|---|---|---|
| `chat:permissionDecide` | `{ requestId, decision: 'allow' \| 'always' \| 'deny' }` | `{}` |
| `chat:setPermissionMode` | `{ neuronId, mode, confirmBypass?: true }` | `{ mode }` ; `CONFIRM_REQUIRED` sans confirmation pour Libre |
| `chat:addDir` | `{ neuronId }` (dialogue natif) | `{ extraDirs }` ; `FOLDER_REFUSED` (dossier de données) |
| `chat:removeDir` | `{ neuronId, path }` (un des dossiers) | `{ extraDirs }` |
| `rules:list` / `rules:remove` | `{ projectKey? }` / `{ id }` | règles |
| `trust:set` | `{ neuronId, trusted }` | `{ trusted }` |
| `final:commit` | `{ neuronId }` | `{}` (message envoyé à Claude) ; `NOT_A_REPO`, `EMPTY_DELIVERABLE`, `BUSY` |

Retirés : `commands:get`, `commands:approve`.

## Événements
`chat:permission` (nouvelle demande), `chat:permissionResolved` (`{ requestId, decision }`), `chat:tool` enrichi
(`toolUseId`, `toolStatus`, `reason`).
