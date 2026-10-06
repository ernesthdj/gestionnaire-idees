# Data model — 014 Claude libre

## Migration `0027_claude_libre` (+ down)
| Table / colonne | Type | Règle |
|---|---|---|
| `neurons.chat_permission_mode` | text null | `default` \| `acceptEdits` \| `bypassPermissions` ; `null` = défaut réglé |
| `neurons.chat_extra_dirs_json` | text null | tableau de chemins absolus vérifiés (≤ 10) |
| `neurons.chat_bypass_confirmed_at` | text null | avertissement Libre confirmé pour cette conversation |
| `permission_rules` | table | `id`, `project_key` (chemin réel en minuscules), `tool`, `pattern` (null = tout l'outil ; commande exacte pour Bash), `created_at`, `deleted_at` |
| `trusted_projects` | table | `project_key` PK, `created_at` |
| `final_actions.committed_hash` / `committed_at` | text null | dernier commit de l'étape |
| `permission_log` | table | `id`, `neuron_id`, `tool`, `decision` (`allow`, `always`, `deny`, `expired`, `rule`), `at` — jamais d'entrée ni de commande |

Réglages (`settings`) : `chat.defaultPermissionMode`, `chat.useUserSettings` (booléen).

## Vues (shared)
- `ChatPermissionRequest` : `{ id, neuronId, tool, summary, detail: { kind: 'write', path, preview } | { kind: 'command', command, cwd } | { kind: 'other', input }, at }`.
- `ChatOpenView` gagne `permissionMode`, `extraDirs`, `pending: ChatPermissionRequest[]`.
- `ChatMessageView` d'outil gagne `toolStatus: 'pending' | 'running' | 'ok' | 'denied' | 'error'` et `reason?`.
- `StepFinalView` gagne `committed: { hash, at } | null`, `canCommit: boolean`.
